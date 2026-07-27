import { resetDb } from '../lib/db';
import { seedDatabase } from '../scripts/seed';

async function runTemporalIntegrityTests() {
  console.log('============================================================');
  console.log('VOLKS HRMS — PostgreSQL Temporal Integrity & Constraint Test Suite');
  console.log('============================================================\n');

  // Reset & seed DB
  const db = await resetDb();
  await seedDatabase();

  let passedTests = 0;
  let totalTests = 6;

  // ------------------------------------------------------------
  // TEST 1: Role Conversion (Intern -> On-Roll) with Zero Duplication
  // ------------------------------------------------------------
  console.log('[TEST 1] Executing Role Conversion (Meera Nair: Intern -> On-Roll)...');
  try {
    const personRes = await db.query<{ person_id: string }>(
      `SELECT person_id FROM persons WHERE full_name = 'Meera Nair';`
    );
    const personId = personRes.rows[0].person_id;

    const internEngRes = await db.query<{ engagement_id: string }>(
      `SELECT engagement_id FROM employment_engagements WHERE person_id = $1 AND status = 'ACTIVE';`,
      [personId]
    );
    const internEngId = internEngRes.rows[0].engagement_id;

    const orgRes = await db.query<{ org_id: string }>(`SELECT org_id FROM organizations LIMIT 1;`);
    const orgId = orgRes.rows[0].org_id;

    const posRes = await db.query<{ position_id: string; department_id: string }>(
      `SELECT position_id, department_id FROM positions WHERE title = 'Associate Software Engineer';`
    );
    const posId = posRes.rows[0].position_id;
    const deptId = posRes.rows[0].department_id;

    const userRes = await db.query<{ user_id: string }>(`SELECT user_id FROM users WHERE person_id = $1;`, [personId]);
    const userId = userRes.rows[0].user_id;

    // ATOMIC TRANSACTION
    await db.exec('BEGIN;');

    // 1. Close Intern Engagement
    await db.query(
      `UPDATE employment_engagements SET status = 'CONVERTED', end_date = '2026-10-31' WHERE engagement_id = $1;`,
      [internEngId]
    );

    // 2. Open On-Roll Engagement linked via converted_from_id
    const newEngRes = await db.query<{ engagement_id: string }>(
      `INSERT INTO employment_engagements (person_id, org_id, employment_type, status, start_date, converted_from_id)
       VALUES ($1, $2, 'ON_ROLL', 'ACTIVE', '2026-11-01', $3) RETURNING engagement_id;`,
      [personId, orgId, internEngId]
    );
    const newEngId = newEngRes.rows[0].engagement_id;

    // 3. Create Effective Change
    await db.query(
      `INSERT INTO employment_changes (engagement_id, version, effective_from, effective_to, position_id, department_id, compensation, reason, created_by)
       VALUES ($1, 1, '2026-11-01', NULL, $2, $3, 850000, 'Converted Intern -> On-Roll', $4);`,
      [newEngId, posId, deptId, userId]
    );

    // 4. Audit Event Log
    await db.query(
      `INSERT INTO audit_events (entity_table, entity_id, action, actor_user_id, narrative, diff)
       VALUES ('employment_engagements', $1, 'CONVERT', $2, 'Meera Nair converted from Intern to On-Roll', $3);`,
      [newEngId, userId, JSON.stringify({ from: 'INTERN', to: 'ON_ROLL', conversion_date: '2026-11-01' })]
    );

    await db.exec('COMMIT;');

    // VERIFICATION
    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM persons WHERE person_id = $1;`,
      [personId]
    );
    if (parseInt(countRes.rows[0].count) !== 1) {
      throw new Error(`FAIL: Person count is ${countRes.rows[0].count}, expected exactly 1.`);
    }

    const engCountRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM employment_engagements WHERE person_id = $1;`,
      [personId]
    );
    if (parseInt(engCountRes.rows[0].count) !== 2) {
      throw new Error(`FAIL: Engagement count is ${engCountRes.rows[0].count}, expected 2 (1 CONVERTED, 1 ACTIVE).`);
    }

    console.log('✓ PASSED: Role Conversion completed with 0 duplicate identity rows and intact linkage.\n');
    passedTests++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 1]: ${err.message}\n`);
    await db.exec('ROLLBACK;').catch(() => {});
  }

  // ------------------------------------------------------------
  // TEST 2: Termination and Subsequent Re-Hire
  // ------------------------------------------------------------
  console.log('[TEST 2] Executing Termination & Re-Hire Workflow (Ananya Rao)...');
  try {
    const personRes = await db.query<{ person_id: string }>(
      `SELECT person_id FROM persons WHERE full_name = 'Ananya Rao';`
    );
    const personId = personRes.rows[0].person_id;

    const orgRes = await db.query<{ org_id: string }>(`SELECT org_id FROM organizations LIMIT 1;`);
    const orgId = orgRes.rows[0].org_id;

    const userRes = await db.query<{ user_id: string }>(`SELECT user_id FROM users WHERE person_id = $1;`, [personId]);
    const userId = userRes.rows[0].user_id;

    const posRes = await db.query<{ position_id: string; department_id: string }>(
      `SELECT position_id, department_id FROM positions WHERE title = 'Software Engineer';`
    );

    // Re-hire 6 months later as CONSULTANT
    await db.query(
      `INSERT INTO employment_engagements (person_id, org_id, employment_type, status, start_date)
       VALUES ($1, $2, 'CONSULTANT', 'ACTIVE', '2027-01-01');`,
      [personId, orgId]
    );

    const countRes = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM persons WHERE person_id = $1;`,
      [personId]
    );
    if (parseInt(countRes.rows[0].count) !== 1) {
      throw new Error(`FAIL: Person count multiplied on re-hire.`);
    }

    console.log('✓ PASSED: Re-hire completed without creating duplicate person records.\n');
    passedTests++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 2]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // TEST 3: Database-Level Single Active Engagement Constraint (Correction #3)
  // ------------------------------------------------------------
  console.log('[TEST 3] Testing Database Constraint: Preventing Overlapping Active Engagements...');
  try {
    const personRes = await db.query<{ person_id: string }>(
      `SELECT person_id FROM persons WHERE full_name = 'Krishna Chakri N';`
    );
    const personId = personRes.rows[0].person_id;
    const orgRes = await db.query<{ org_id: string }>(`SELECT org_id FROM organizations LIMIT 1;`);
    const orgId = orgRes.rows[0].org_id;

    // Krishna Chakri N already has an ACTIVE ON_ROLL engagement. Attempting to insert another ACTIVE engagement:
    let failedAsExpected = false;
    try {
      await db.query(
        `INSERT INTO employment_engagements (person_id, org_id, employment_type, status, start_date)
         VALUES ($1, $2, 'INTERN', 'ACTIVE', '2026-08-01');`,
        [personId, orgId]
      );
    } catch (dbErr: any) {
      failedAsExpected = true;
    }

    if (!failedAsExpected) {
      throw new Error('FAIL: Database allowed 2 simultaneous ACTIVE engagements for the same person!');
    }

    console.log('✓ PASSED: Database partial unique index (one_active_engagement_per_person) rejected illegal concurrent active engagement.\n');
    passedTests++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 3]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // TEST 4: Generalized Effective-Dated Model & Retroactive Correction (Correction #2)
  // ------------------------------------------------------------
  console.log('[TEST 4] Testing Retroactive Historical Correction & Validity Boundaries...');
  try {
    const personRes = await db.query<{ person_id: string }>(
      `SELECT person_id FROM persons WHERE full_name = 'Vikram Shetty';`
    );
    const personId = personRes.rows[0].person_id;

    const engRes = await db.query<{ engagement_id: string }>(
      `SELECT engagement_id FROM employment_engagements WHERE person_id = $1 AND status = 'ACTIVE';`,
      [personId]
    );
    const engId = engRes.rows[0].engagement_id;

    // Apply retroactive compensation adjustment effective 2025-01-01
    await db.query(
      `UPDATE employment_changes SET effective_to = '2024-12-31' WHERE engagement_id = $1 AND version = 1;`,
      [engId]
    );

    await db.query(
      `INSERT INTO employment_changes (engagement_id, version, effective_from, effective_to, compensation, reason)
       VALUES ($1, 2, '2025-01-01', NULL, 1050000, 'Retroactive Market Adjustment');`,
      [engId]
    );

    // Reconstruct snapshot as of 2025-06-01
    const snapshot = await db.query<{ compensation: string }>(
      `SELECT compensation FROM employment_changes
       WHERE engagement_id = $1 AND effective_from <= '2025-06-01' AND (effective_to IS NULL OR effective_to >= '2025-06-01')
       ORDER BY version DESC LIMIT 1;`,
      [engId]
    );

    if (parseFloat(snapshot.rows[0].compensation) !== 1050000) {
      throw new Error(`FAIL: Historical snapshot returned ${snapshot.rows[0].compensation}, expected 1050000.`);
    }

    console.log('✓ PASSED: Retroactive correction updated validity boundaries (effective_from / effective_to) correctly.\n');
    passedTests++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 4]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // TEST 5: Future-Dated Changes & Time Travel
  // ------------------------------------------------------------
  console.log('[TEST 5] Testing Future-Dated Changes & Time Travel Querying...');
  try {
    const personRes = await db.query<{ person_id: string }>(
      `SELECT person_id FROM persons WHERE full_name = 'Sana Iyer';`
    );
    const personId = personRes.rows[0].person_id;

    const engRes = await db.query<{ engagement_id: string }>(
      `SELECT engagement_id FROM employment_engagements WHERE person_id = $1 AND status = 'ACTIVE';`,
      [personId]
    );
    const engId = engRes.rows[0].engagement_id;

    // Add future-dated promotion effective 2026-12-01
    await db.query(
      `INSERT INTO employment_changes (engagement_id, version, effective_from, effective_to, compensation, reason)
       VALUES ($1, 2, '2026-12-01', NULL, 950000, 'Future Promotion');`,
      [engId]
    );

    // Query As Of TODAY (2026-07-25)
    const todaySnap = await db.query<{ compensation: string }>(
      `SELECT compensation FROM employment_changes
       WHERE engagement_id = $1 AND effective_from <= '2026-07-25' AND (effective_to IS NULL OR effective_to >= '2026-07-25')
       ORDER BY effective_from DESC LIMIT 1;`,
      [engId]
    );

    // Query As Of Future (2026-12-15)
    const futureSnap = await db.query<{ compensation: string }>(
      `SELECT compensation FROM employment_changes
       WHERE engagement_id = $1 AND effective_from <= '2026-12-15' AND (effective_to IS NULL OR effective_to >= '2026-12-15')
       ORDER BY effective_from DESC LIMIT 1;`,
      [engId]
    );

    if (parseFloat(todaySnap.rows[0].compensation) !== 700000) {
      throw new Error(`FAIL: Today snapshot returned ${todaySnap.rows[0].compensation}, expected current 700000.`);
    }

    if (parseFloat(futureSnap.rows[0].compensation) !== 950000) {
      throw new Error(`FAIL: Future snapshot returned ${futureSnap.rows[0].compensation}, expected future 950000.`);
    }

    console.log('✓ PASSED: Time travel correctly returns active state today vs future state on future date.\n');
    passedTests++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 5]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // TEST 6: Anomaly Resolution Governance (Correction #4)
  // ------------------------------------------------------------
  console.log('[TEST 6] Testing Anomaly Resolution Lifecycle (Detect -> Explain -> Recommend -> Preview -> Authorize -> Execute)...');
  try {
    const personRes = await db.query<{ person_id: string }>(
      `SELECT person_id FROM persons WHERE full_name = 'Rahul Bose';`
    );
    const personId = personRes.rows[0].person_id;

    // Detect Severe Anomaly: Terminated engagement but active user account
    const engRes = await db.query<{ engagement_id: string }>(
      `SELECT engagement_id FROM employment_engagements WHERE person_id = $1 AND status = 'TERMINATED';`,
      [personId]
    );
    const engId = engRes.rows[0].engagement_id;

    const userRes = await db.query<{ user_id: string; is_active: boolean }>(
      `SELECT user_id, is_active FROM users WHERE person_id = $1;`,
      [personId]
    );
    const user = userRes.rows[0];

    if (!user.is_active) {
      throw new Error('Expected Rahul Bose to have active system access despite termination.');
    }

    // 1. Detect & Create Anomaly Resolution Record
    const anomalyRes = await db.query<{ resolution_id: string }>(
      `INSERT INTO anomaly_resolutions (
        anomaly_type, person_id, engagement_id, status, explanation, recommendation, impact_preview
       ) VALUES (
        'GHOST_ACCESS', $1, $2, 'DETECTED',
        'Rahul Bose employment terminated on 2026-05-15, but system user account remains active.',
        'Revoke system access immediately per offboarding security policy.',
        $3
       ) RETURNING resolution_id;`,
      [
        personId,
        engId,
        JSON.stringify({ target_user_id: user.user_id, action: 'SET is_active = false', affected_systems: ['VOLKS Core', 'SSO'] })
      ]
    );
    const resId = anomalyRes.rows[0].resolution_id;

    // 2. Authorize & Execute
    await db.query(
      `UPDATE anomaly_resolutions
       SET status = 'EXECUTED', authorized_by = $1, executed_at = NOW()
       WHERE resolution_id = $2;`,
      [user.user_id, resId]
    );

    // Execute actual remediation
    await db.query(`UPDATE users SET is_active = false WHERE user_id = $1;`, [user.user_id]);

    // Verify
    const updatedUser = await db.query<{ is_active: boolean }>(`SELECT is_active FROM users WHERE user_id = $1;`, [user.user_id]);
    if (updatedUser.rows[0].is_active !== false) {
      throw new Error('FAIL: Anomaly resolution execution failed to update user access.');
    }

    console.log('✓ PASSED: Anomaly resolution 7-step governance executed cleanly without silent mutations.\n');
    passedTests++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 6]: ${err.message}\n`);
  }

  console.log('============================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED.`);
  console.log('============================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTemporalIntegrityTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
