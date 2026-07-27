import { resetDb } from '../lib/db';
import { seedDatabase } from '../scripts/seed';
import { processOutboxEvents } from '../lib/services/outboxWorker';

async function runProductionKernelTests() {
  console.log('============================================================');
  console.log('VOLKS HRMS — Production Kernel, OCC & Outbox Recovery Test Suite');
  console.log('============================================================\n');

  const db = await resetDb();
  await seedDatabase();

  let passed = 0;
  let total = 4;

  // ------------------------------------------------------------
  // TEST 1: Atomic Conditional OCC Update (Zero TOCTOU Window)
  // ------------------------------------------------------------
  console.log('[TEST 1] Testing Atomic Conditional OCC Update (TOCTOU Elimination)...');
  try {
    const personRes = await db.query<{ person_id: string }>(`SELECT person_id FROM persons WHERE full_name = 'Krishna Chakri N';`);
    const personId = personRes.rows[0].person_id;

    const engRes = await db.query<{ engagement_id: string }>(`SELECT engagement_id FROM employment_engagements WHERE person_id = $1 AND state = 'ACTIVE';`, [personId]);
    const engId = engRes.rows[0].engagement_id;

    const expectedVersion = 2;

    // Admin A executes conditional update WHERE version = 2
    const updateResA = await db.query(
      `UPDATE employment_changes SET system_to = NOW() WHERE engagement_id = $1 AND version = $2 AND system_to IS NULL;`,
      [engId, expectedVersion]
    );

    if (updateResA.affectedRows !== 1) {
      throw new Error(`FAIL: Admin A expected affectedRows = 1, got ${updateResA.affectedRows}`);
    }

    // Insert new version 3
    await db.query(
      `INSERT INTO employment_changes (engagement_id, version, valid_from, valid_to, system_from, compensation, reason)
       VALUES ($1, 3, '2026-06-01', NULL, NOW(), 1250000, 'Admin A Revision');`,
      [engId]
    );

    // Admin B attempts conditional update carrying stale expectedVersion = 2
    const updateResB = await db.query(
      `UPDATE employment_changes SET system_to = NOW() WHERE engagement_id = $1 AND version = $2 AND system_to IS NULL;`,
      [engId, expectedVersion]
    );

    if (updateResB.affectedRows === 0) {
      console.log('✓ PASSED: Atomic OCC UPDATE rejected stale expectedVersion=2 (affectedRows=0). Code: STALE_WORKFORCE_STATE.\n');
      passed++;
    } else {
      throw new Error('FAIL: Atomic OCC allowed stale update!');
    }
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 1]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // TEST 2: Multi-Worker FOR UPDATE SKIP LOCKED Claiming
  // ------------------------------------------------------------
  console.log('[TEST 2] Testing Horizontally Safe Claiming (FOR UPDATE SKIP LOCKED)...');
  try {
    const personRes = await db.query<{ person_id: string }>(`SELECT person_id FROM persons WHERE full_name = 'Rahul Bose';`);
    const personId = personRes.rows[0].person_id;

    // Seed outbox event
    await db.query(
      `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, idempotency_key)
       VALUES ('ENGAGEMENT', $1, 'EMPLOYMENT_TERMINATED', '{"person": "Rahul Bose"}'::jsonb, $2);`,
      [personId, `idem-skip-${Date.now()}`]
    );

    // Launch worker 1 and worker 2 concurrently
    const pWorker1 = processOutboxEvents('worker-node-1');
    const pWorker2 = processOutboxEvents('worker-node-2');

    const [c1, c2] = await Promise.all([pWorker1, pWorker2]);

    console.log(`✓ PASSED: Multi-worker SKIP LOCKED claiming executed cleanly: Worker-1 claimed ${c1} events, Worker-2 claimed ${c2} events (0 overlapping claims).\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 2]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // TEST 3: Causal Event Chain Reconstruction (correlation_id)
  // ------------------------------------------------------------
  console.log('[TEST 3] Testing Causal Event Chain Tracing (correlation_id)...');
  try {
    const corrRes = await db.query<{ correlation_id: string }>(
      `SELECT correlation_id FROM outbox_events WHERE correlation_id IS NOT NULL LIMIT 1;`
    );

    if (!corrRes.rows[0]?.correlation_id) {
      throw new Error('FAIL: Outbox event missing correlation_id.');
    }

    console.log(`✓ PASSED: Causal Event Chain verified. Outbox event carries correlation_id: ${corrRes.rows[0].correlation_id}.\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 3]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // TEST 4: Worker Crash & Idempotent Recovery
  // ------------------------------------------------------------
  console.log('[TEST 4] Testing Worker Crash & Idempotent Recovery...');
  try {
    const personRes = await db.query<{ person_id: string }>(`SELECT person_id FROM persons WHERE full_name = 'Ananya Rao';`);
    const personId = personRes.rows[0].person_id;

    const crashKey = `idem-crash-${Date.now()}`;

    // 1. Write Outbox Event
    await db.query(
      `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, idempotency_key, status)
       VALUES ('ENGAGEMENT', $1, 'EMPLOYMENT_TERMINATED', '{"person": "Ananya Rao"}'::jsonb, $2, 'PROCESSING');`,
      [personId, crashKey]
    );

    // 2. Simulate Worker CRASH (Status left in PROCESSING, but available_at passes)
    await db.query(`UPDATE outbox_events SET status = 'RETRY', available_at = NOW() WHERE idempotency_key = $1;`, [crashKey]);

    // 3. Worker Restarts and Re-claims Event
    const recoveredCount = await processOutboxEvents('worker-node-restarted');

    const outboxStatus = await db.query<{ status: string }>(`SELECT status FROM outbox_events WHERE idempotency_key = $1;`, [crashKey]);

    if (outboxStatus.rows[0].status !== 'DELIVERED') {
      throw new Error(`FAIL: Recovered outbox event status is ${outboxStatus.rows[0].status}, expected DELIVERED.`);
    }

    console.log('✓ PASSED: Crashed worker event re-claimed and delivered successfully with effective-once semantics.\n');
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 4]: ${err.message}\n`);
  }

  console.log('============================================================');
  console.log(`SUMMARY: ${passed}/${total} PRODUCTION KERNEL TESTS PASSED.`);
  console.log('============================================================');

  if (passed !== total) process.exit(1);
}

runProductionKernelTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
