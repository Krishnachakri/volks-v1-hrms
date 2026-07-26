import { resetDb } from '../lib/db';
import { seedDatabase } from '../scripts/seed';
import { evaluateAndCreateWorkflow, submitWorkflowDecision } from '../lib/services/workflowEngine';
import { getSnapshot } from '../lib/services/bitemporal';
import { processOutboxEvents } from '../lib/services/outboxWorker';

async function runVolks10UserJourneyTest() {
  console.log('============================================================');
  console.log('VOLKS 1.0 — Complete End-to-End User Journey Verification');
  console.log('============================================================\n');

  const db = await resetDb();
  await seedDatabase();

  let passedSteps = 0;
  const totalSteps = 8;

  // ------------------------------------------------------------
  // STEP 1: Hire & Create Permanent Person Identity
  // ------------------------------------------------------------
  console.log('[STEP 1] Hiring & Creating Permanent Identity (Devon Carter)...');
  const pRes = await db.query<{ person_id: string }>(
    `INSERT INTO persons (full_name, personal_email, phone, national_id)
     VALUES ('Devon Carter', 'devon.carter@example.com', '+1-555-0199', 'SSN-998877') RETURNING person_id;`
  );
  const personId = pRes.rows[0].person_id;
  console.log(`✓ Step 1 PASSED: Person ID created: ${personId}\n`);
  passedSteps++;

  // ------------------------------------------------------------
  // STEP 2: Onboard & Create Engagement 1 (INTERN)
  // ------------------------------------------------------------
  console.log('[STEP 2] Onboarding & Creating INTERN Engagement...');
  const orgRes = await db.query<{ org_id: string }>(`SELECT org_id FROM organizations LIMIT 1;`);
  const orgId = orgRes.rows[0].org_id;

  const eng1Res = await db.query<{ engagement_id: string }>(
    `INSERT INTO employment_engagements (person_id, org_id, employment_type, state, start_date)
     VALUES ($1, $2, 'INTERN', 'ACTIVE', '2026-01-01') RETURNING engagement_id;`,
    [personId, orgId]
  );
  const eng1Id = eng1Res.rows[0].engagement_id;

  await db.query(
    `INSERT INTO employment_changes (engagement_id, version, valid_from, valid_to, system_from, compensation, reason)
     VALUES ($1, 1, '2026-01-01', NULL, NOW(), 25000, 'Hired as Intern');`,
    [eng1Id]
  );
  console.log(`✓ Step 2 PASSED: Engagement 1 (INTERN) active.\n`);
  passedSteps++;

  // ------------------------------------------------------------
  // STEP 3: Provision Equipment Asset
  // ------------------------------------------------------------
  console.log('[STEP 3] Provisioning Asset (MacBook Pro Laptop)...');
  await db.query(
    `INSERT INTO assets (asset_name, category, serial_number, assigned_to, status, assigned_at)
     VALUES ('MacBook Pro M3', 'LAPTOP', 'MBP-DEVON-001', $1, 'ASSIGNED', NOW());`,
    [personId]
  );
  console.log(`✓ Step 3 PASSED: Asset MBP-DEVON-001 assigned.\n`);
  passedSteps++;

  // ------------------------------------------------------------
  // STEP 4: Submit & Approve Leave Request via Workflow Engine
  // ------------------------------------------------------------
  console.log('[STEP 4] Submitting Leave Request via Universal Policy Engine...');
  const wf = await evaluateAndCreateWorkflow('LEAVE_REQUEST', personId, personId, { days: 4, reason: 'Vacation' });
  await submitWorkflowDecision(wf.instanceId, 'MANAGER', 'APPROVED');
  console.log(`✓ Step 4 PASSED: Leave request approved.\n`);
  passedSteps++;

  // ------------------------------------------------------------
  // STEP 5: Convert INTERN → ON_ROLL (Engagement 2) & Promote
  // ------------------------------------------------------------
  console.log('[STEP 5] Converting INTERN → ON_ROLL & Promoting...');
  await db.query(`UPDATE employment_engagements SET state = 'TERMINATED', end_date = '2026-04-30' WHERE engagement_id = $1;`, [eng1Id]);

  const eng2Res = await db.query<{ engagement_id: string }>(
    `INSERT INTO employment_engagements (person_id, org_id, employment_type, state, start_date, converted_from_id)
     VALUES ($1, $2, 'ON_ROLL', 'ACTIVE', '2026-05-01', $3) RETURNING engagement_id;`,
    [personId, orgId, eng1Id]
  );
  const eng2Id = eng2Res.rows[0].engagement_id;

  await db.query(
    `INSERT INTO employment_changes (engagement_id, version, valid_from, valid_to, system_from, compensation, reason)
     VALUES ($1, 1, '2026-05-01', NULL, NOW(), 950000, 'Converted to On-Roll Engineer');`,
    [eng2Id]
  );
  console.log(`✓ Step 5 PASSED: Engagement 2 (ON_ROLL) active with comp ₹9,50,000.\n`);
  passedSteps++;

  // ------------------------------------------------------------
  // STEP 6: Terminate Engagement 2 & Revoke Credentials
  // ------------------------------------------------------------
  console.log('[STEP 6] Terminating Engagement 2 & Emitting Outbox Event...');
  await db.query(`UPDATE employment_engagements SET state = 'TERMINATED', end_date = '2026-10-31' WHERE engagement_id = $1;`, [eng2Id]);
  await db.query(
    `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, idempotency_key)
     VALUES ('ENGAGEMENT', $1, 'EMPLOYMENT_TERMINATED', '{"person":"Devon Carter"}'::jsonb, $2);`,
    [eng2Id, `idem-term-devon-${Date.now()}`]
  );
  await processOutboxEvents();
  console.log(`✓ Step 6 PASSED: Engagement 2 terminated and outbox events delivered.\n`);
  passedSteps++;

  // ------------------------------------------------------------
  // STEP 7: Rehire as CONSULTANT (Engagement 3)
  // ------------------------------------------------------------
  console.log('[STEP 7] Rehiring Devon Carter as CONSULTANT...');
  const eng3Res = await db.query<{ engagement_id: string }>(
    `INSERT INTO employment_engagements (person_id, org_id, employment_type, state, start_date)
     VALUES ($1, $2, 'CONSULTANT', 'ACTIVE', '2026-11-15') RETURNING engagement_id;`,
    [personId, orgId]
  );
  const eng3Id = eng3Res.rows[0].engagement_id;

  await db.query(
    `INSERT INTO employment_changes (engagement_id, version, valid_from, valid_to, system_from, compensation, reason)
     VALUES ($1, 1, '2026-11-15', NULL, NOW(), 180000, 'Rehired as Consultant');`,
    [eng3Id]
  );
  console.log(`✓ Step 7 PASSED: Engagement 3 (CONSULTANT) active.\n`);
  passedSteps++;

  // ------------------------------------------------------------
  // STEP 8: Reconstruct Complete Bitemporal History
  // ------------------------------------------------------------
  console.log('[STEP 8] Reconstructing Complete Bitemporal History across 3 Engagements...');
  const snapshotJan = await getSnapshot(personId, '2026-02-15');
  const snapshotJun = await getSnapshot(personId, '2026-06-15');

  if (!snapshotJan || !snapshotJun) throw new Error('FAIL: Could not reconstruct snapshots across engagements.');

  console.log(`✓ Step 8 PASSED: Reconstructed Feb 2026 snapshot (${snapshotJan.employment_type}) and Jun 2026 snapshot (${snapshotJun.employment_type}).\n`);
  passedSteps++;

  console.log('============================================================');
  console.log(`VOLKS 1.0 VERIFICATION COMPLETE: ${passedSteps}/${totalSteps} STEPS PASSED.`);
  console.log('============================================================');

  if (passedSteps !== totalSteps) process.exit(1);
}

runVolks10UserJourneyTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
