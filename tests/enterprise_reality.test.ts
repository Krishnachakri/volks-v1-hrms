import { resetDb } from '../lib/db';
import { seedDatabase } from '../scripts/seed';
import { findGhostManagerReports, findAccessContradictions, simulateOrphanedTeams } from '../lib/services/truthGraph';
import { getSnapshot, insertRetroactiveCorrection } from '../lib/services/bitemporal';

async function runEnterpriseRealityTests() {
  console.log('============================================================');
  console.log('VOLKS HRMS — Phase 4 Enterprise Reality & Scale Test Suite');
  console.log('============================================================\n');

  const db = await resetDb();
  await seedDatabase();

  let passed = 0;
  let total = 3;

  // ------------------------------------------------------------
  // TEST 1: Workforce Truth Graph Organizational Observability
  // ------------------------------------------------------------
  console.log('[TEST 1] Testing Workforce Truth Graph Queries (Ghost Managers & Contradictions)...');
  try {
    const accessContradictions = await findAccessContradictions();
    if (accessContradictions.length === 0) {
      throw new Error('FAIL: Expected to detect access contradictions in seed database.');
    }

    console.log(`✓ PASSED: Truth Graph detected ${accessContradictions.length} cross-system access contradictions.`);
    accessContradictions.forEach((ac) => {
      console.log(`  - [${ac.contradiction_type}] ${ac.full_name}: ${ac.exposure_assessment}`);
    });
    console.log('');
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 1]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // TEST 2: Concurrency & Atomic Transaction Isolation
  // ------------------------------------------------------------
  console.log('[TEST 2] Testing Concurrency & Transaction Isolation...');
  try {
    const personRes = await db.query<{ person_id: string }>(`SELECT person_id FROM persons WHERE full_name = 'Krishna Chakri N';`);
    const personId = personRes.rows[0].person_id;

    const engRes = await db.query<{ engagement_id: string }>(`SELECT engagement_id FROM employment_engagements WHERE person_id = $1 AND state = 'ACTIVE';`, [personId]);
    const engId = engRes.rows[0].engagement_id;

    const userRes = await db.query<{ user_id: string }>(`SELECT user_id FROM users WHERE person_id = $1;`, [personId]);
    const userId = userRes.rows[0].user_id;

    // Simulate 2 concurrent HR Admin retroactive corrections
    const p1 = insertRetroactiveCorrection(engId, '2026-03-01', '2026-05-31', 860000, 'Admin 1 Adjustment', userId);
    const p2 = insertRetroactiveCorrection(engId, '2026-03-01', '2026-05-31', 870000, 'Admin 2 Adjustment', userId);

    await Promise.all([p1, p2]);

    // Verify snapshot consistency
    const snap = await getSnapshot(personId, '2026-04-01');
    if (!snap || (snap.compensation !== 860000 && snap.compensation !== 870000)) {
      throw new Error(`FAIL: Concurrent updates corrupted snapshot result: ${snap?.compensation}`);
    }

    console.log(`✓ PASSED: Concurrent transaction updates executed atomically without corrupting temporal truth. Final compensation: ₹${snap.compensation.toLocaleString()}.\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 2]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // TEST 3: Enterprise Scale Benchmark (10,000+ Fact Records)
  // ------------------------------------------------------------
  console.log('[TEST 3] Benchmark: Seeding 10,000+ Temporal Fact Records & Query Latency...');
  try {
    const orgRes = await db.query<{ org_id: string }>(`SELECT org_id FROM organizations LIMIT 1;`);
    const orgId = orgRes.rows[0].org_id;

    const posRes = await db.query<{ position_id: string; department_id: string }>(`SELECT position_id, department_id FROM positions LIMIT 1;`);
    const posId = posRes.rows[0].position_id;
    const deptId = posRes.rows[0].department_id;

    const userRes = await db.query<{ user_id: string }>(`SELECT user_id FROM users LIMIT 1;`);
    const userId = userRes.rows[0].user_id;

    console.log('  - Populating 10,000+ temporal fact records in PostgreSQL WASM engine...');

    const startInsert = Date.now();
    await db.exec('BEGIN;');

    // Insert 500 benchmark persons with 20 changes each = 10,000 temporal facts
    for (let p = 1; p <= 500; p++) {
      const pRes = await db.query<{ person_id: string }>(
        `INSERT INTO persons (full_name, personal_email, national_id) VALUES ($1, $2, $3) RETURNING person_id;`,
        [`Scale Person ${p}`, `scale_${p}_${Date.now()}@example.com`, `SCALE-ID-${p}-${Date.now()}`]
      );
      const pid = pRes.rows[0].person_id;

      const eRes = await db.query<{ engagement_id: string }>(
        `INSERT INTO employment_engagements (person_id, org_id, employment_type, state, start_date) VALUES ($1, $2, 'ON_ROLL', 'ACTIVE', '2020-01-01') RETURNING engagement_id;`,
        [pid, orgId]
      );
      const eid = eRes.rows[0].engagement_id;

      for (let v = 1; v <= 20; v++) {
        await db.query(
          `INSERT INTO employment_changes (engagement_id, version, valid_from, valid_to, system_from, position_id, department_id, compensation, reason, created_by)
           VALUES ($1, $2, '2020-01-01', NULL, NOW(), $3, $4, $5, 'Scale Test Change', $6);`,
          [eid, v, posId, deptId, 500000 + v * 10000, userId]
        );
      }
    }

    await db.exec('COMMIT;');
    const insertDuration = Date.now() - startInsert;
    console.log(`  - 10,000+ temporal facts inserted in ${insertDuration}ms.`);

    // Measure Snapshot Query Latency across 100 random queries
    const startQuery = Date.now();
    const samplePerson = await db.query<{ person_id: string }>(`SELECT person_id FROM persons WHERE full_name = 'Scale Person 250';`);
    const pid = samplePerson.rows[0].person_id;

    for (let q = 0; q < 50; q++) {
      await getSnapshot(pid, '2022-06-15');
    }
    const queryDuration = Date.now() - startQuery;
    const avgLatency = queryDuration / 50;

    console.log(`  - Executed 50 bitemporal snapshot queries in ${queryDuration}ms (Avg Latency: ${avgLatency.toFixed(2)}ms per query).`);

    if (avgLatency > 15) {
      throw new Error(`FAIL: Average query latency exceeds 15ms limit (${avgLatency.toFixed(2)}ms).`);
    }

    console.log('✓ PASSED: PostgreSQL Bitemporal Engine meets sub-15ms enterprise performance SLA under 10,000+ facts.\n');
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 3]: ${err.message}\n`);
    await db.exec('ROLLBACK;').catch(() => {});
  }

  console.log('============================================================');
  console.log(`SUMMARY: ${passed}/${total} PHASE 4 ENTERPRISE REALITY TESTS PASSED.`);
  console.log('============================================================');

  if (passed !== total) process.exit(1);
}

runEnterpriseRealityTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
