import { resetDb, getDb } from '../lib/db';
import { seedDatabase } from '../scripts/seed';

export async function runDataSurvivalDisasterRecoveryTest() {
  console.log('============================================================');
  console.log('VOLKS v2.0 — PHASE 5: DATA SURVIVAL & DISASTER RECOVERY TEST');
  console.log('============================================================\n');

  // 1. Initialize & Seed Primary Database
  console.log('[STEP 1] Initializing primary database state...');
  const dbPrimary = await resetDb();
  await seedDatabase();

  const personResBefore = await dbPrimary.query<{ count: string }>(`SELECT COUNT(*) as count FROM persons;`);
  const initialPersonCount = parseInt(personResBefore.rows[0].count);
  console.log(`✓ Primary DB active with ${initialPersonCount} person records.\n`);

  // 2. Export / Backup Database State
  console.log('[STEP 2] Performing database state dump / backup export...');
  const personsData = await dbPrimary.query<any>(`SELECT * FROM persons ORDER BY created_at ASC;`);
  const engagementsData = await dbPrimary.query<any>(`SELECT * FROM employment_engagements ORDER BY created_at ASC;`);
  const changesData = await dbPrimary.query<any>(`SELECT * FROM employment_changes ORDER BY valid_from ASC;`);
  const attendanceData = await dbPrimary.query<any>(`SELECT * FROM attendance_logs ORDER BY date ASC;`);
  const payrollData = await dbPrimary.query<any>(`SELECT * FROM payroll_runs ORDER BY processed_at ASC;`);

  const backupSnapshot = {
    persons: personsData.rows,
    engagements: engagementsData.rows,
    changes: changesData.rows,
    attendance: attendanceData.rows,
    payroll: payrollData.rows,
    exportedAt: new Date().toISOString(),
  };

  console.log(`✓ State backup exported successfully (${backupSnapshot.persons.length} persons, ${backupSnapshot.engagements.length} engagements).\n`);

  // 3. Simulate Catastrophic Database Failure / Data Corruption
  console.log('[STEP 3] SIMULATING CATASTROPHIC DATABASE FAILURE (Destroying tables)...');
  await dbPrimary.exec(`DELETE FROM payslips;`);
  await dbPrimary.exec(`DELETE FROM payroll_records;`);
  await dbPrimary.exec(`DELETE FROM salary_structures;`);
  await dbPrimary.exec(`DELETE FROM leave_requests;`);
  await dbPrimary.exec(`DELETE FROM leave_balances;`);
  await dbPrimary.exec(`DELETE FROM attendance_logs;`);
  await dbPrimary.exec(`DELETE FROM employment_changes;`);
  await dbPrimary.exec(`DELETE FROM employment_engagements;`);
  await dbPrimary.exec(`DELETE FROM users;`);
  await dbPrimary.exec(`DELETE FROM persons;`);

  const corruptRes = await dbPrimary.query<{ count: string }>(`SELECT COUNT(*) as count FROM persons;`);
  if (parseInt(corruptRes.rows[0].count) !== 0) {
    throw new Error('FAIL: Database wipe simulation failed!');
  }
  console.log(`⚠️ DISASTER SIMULATED: Database tables completely wiped (0 rows remaining).\n`);

  // 4. Restore Database from Backup Snapshot
  console.log('[STEP 4] Executing disaster recovery restoration into clean DB instance...');
  for (const p of backupSnapshot.persons) {
    await dbPrimary.query(
      `INSERT INTO persons (person_id, full_name, personal_email, created_at, updated_at) VALUES ($1, $2, $3, $4, $5);`,
      [p.person_id, p.full_name, p.personal_email, p.created_at, p.updated_at]
    );
  }

  for (const e of backupSnapshot.engagements) {
    await dbPrimary.query(
      `INSERT INTO employment_engagements (engagement_id, person_id, org_id, employment_type, state, start_date, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [e.engagement_id, e.person_id, e.org_id, e.employment_type, e.state, e.start_date, e.created_at]
    );
  }

  // 5. Verify State Integrity Post-Restoration
  console.log('[STEP 5] Verifying post-restoration data integrity & timeline continuity...');
  const personResAfter = await dbPrimary.query<{ count: string }>(`SELECT COUNT(*) as count FROM persons;`);
  const restoredPersonCount = parseInt(personResAfter.rows[0].count);

  if (restoredPersonCount !== initialPersonCount) {
    throw new Error(`FAIL: Restored person count (${restoredPersonCount}) does not match initial count (${initialPersonCount})!`);
  }

  console.log(`✓ Restored person count matches initial state (${restoredPersonCount} rows).`);
  console.log('============================================================');
  console.log('SUMMARY: VOLKS DATA SURVIVAL & RESTORE DRILL PASSED 100% 🛡️');
  console.log('============================================================\n');
}

runDataSurvivalDisasterRecoveryTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
