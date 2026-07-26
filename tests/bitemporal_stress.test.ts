import { resetDb } from '../lib/db';
import { seedDatabase } from '../scripts/seed';
import { getSnapshot, insertRetroactiveCorrection } from '../lib/services/bitemporal';
import { transitionLifecycleState } from '../lib/services/lifecycle';
import { calculateMutationImpact } from '../lib/services/impact';
import { evaluateAllInvariants, executeResolutionGovernance } from '../lib/services/invariants';

async function runBitemporalStressTests() {
  console.log('============================================================');
  console.log('VOLKS HRMS — Phase 2 Bitemporal & Domain Engine Stress Test Suite');
  console.log('============================================================\n');

  const db = await resetDb();
  await seedDatabase();

  let passed = 0;
  let total = 4;

  // ------------------------------------------------------------
  // TEST 1: True Bitemporal Snapshot Reconstruction (validAt vs knownAt)
  // ------------------------------------------------------------
  console.log('[TEST 1] Testing True Bitemporal Snapshot Reconstruction (validAt vs knownAt)...');
  try {
    const personRes = await db.query<{ person_id: string }>(`SELECT person_id FROM persons WHERE full_name = 'Krishna Chakri N';`);
    const personId = personRes.rows[0].person_id;

    // Capture system timestamp T1 before retroactive correction
    const t1 = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 100)); // Ensure distinct system timestamp

    // Fetch active engagement
    const engRes = await db.query<{ engagement_id: string }>(`SELECT engagement_id FROM employment_engagements WHERE person_id = $1 AND state = 'ACTIVE';`, [personId]);
    const engId = engRes.rows[0].engagement_id;

    const userRes = await db.query<{ user_id: string }>(`SELECT user_id FROM users WHERE person_id = $1;`, [personId]);
    const userId = userRes.rows[0].user_id;

    // Perform Retroactive Correction at T2 (retroactive to 2026-02-01)
    await insertRetroactiveCorrection(engId, '2026-02-01', '2026-05-31', 850000, 'Retroactive Adjustment', userId);

    const t2 = new Date().toISOString();

    // Query 1: What is true on 2026-03-01 according to CURRENT system knowledge (T2)?
    const currentSnap = await getSnapshot(personId, '2026-03-01');
    if (!currentSnap || currentSnap.compensation !== 850000) {
      throw new Error(`FAIL: Current knowledge snapshot expected 850000, got ${currentSnap?.compensation}`);
    }

    // Query 2: What did VOLKS BELIEVE was true on 2026-03-01 as of system time T1?
    const historicalKnownSnap = await getSnapshot(personId, '2026-03-01', t1);
    if (!historicalKnownSnap || historicalKnownSnap.compensation !== 800000) {
      throw new Error(`FAIL: Historical knownAt snapshot expected 800000, got ${historicalKnownSnap?.compensation}`);
    }

    console.log(`✓ PASSED: Bitemporal Engine correctly returns current knowledge (₹8,50,000) vs past system belief (₹8,00,000) at T1.`);
    console.log(`  - validAt=2026-03-01 (Current Knowledge) => ₹${currentSnap.compensation}`);
    console.log(`  - validAt=2026-03-01 (as known at ${t1}) => ₹${historicalKnownSnap.compensation}\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 1]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // TEST 2: Universal State Machine Lifecycle Transitions
  // ------------------------------------------------------------
  console.log('[TEST 2] Testing Universal State Machine Lifecycle Engine...');
  try {
    const personRes = await db.query<{ person_id: string }>(`SELECT person_id FROM persons WHERE full_name = 'Meera Nair';`);
    const personId = personRes.rows[0].person_id;

    const orgRes = await db.query<{ org_id: string }>(`SELECT org_id FROM organizations LIMIT 1;`);
    const orgId = orgRes.rows[0].org_id;

    const engRes = await db.query<{ engagement_id: string }>(`SELECT engagement_id FROM employment_engagements WHERE person_id = $1 AND state = 'ACTIVE';`, [personId]);
    const engId = engRes.rows[0].engagement_id;

    const deptRes = await db.query<{ department_id: string }>(`SELECT department_id FROM departments LIMIT 1;`);
    const deptId = deptRes.rows[0].department_id;

    const userRes = await db.query<{ user_id: string }>(`SELECT user_id FROM users WHERE person_id = $1;`, [personId]);
    const userId = userRes.rows[0].user_id;

    // Transition Meera Nair: INTERN -> ON_ROLL ACTIVE via CONVERT event
    const result = await transitionLifecycleState({
      personId,
      orgId,
      currentEngagementId: engId,
      event: 'CONVERT',
      targetState: 'ACTIVE',
      targetEmploymentType: 'ON_ROLL',
      effectiveDate: '2026-11-01',
      title: 'Operations Manager',
      departmentId: deptId,
      compensation: 900000,
      reason: 'Lifecycle Studio Conversion Event',
      actorUserId: userId,
    });

    if (!result.newEngagementId) throw new Error('FAIL: Transition did not return new engagement ID');

    // Verify 0 duplicate persons rows
    const pCount = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM persons WHERE person_id = $1;`, [personId]);
    if (parseInt(pCount.rows[0].count) !== 1) throw new Error('FAIL: Duplicate identity row created during transition');

    console.log('✓ PASSED: State machine transition executed smoothly with zero identity duplication.\n');
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 2]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // TEST 3: Impact Engine Pre-Mutation Calculation
  // ------------------------------------------------------------
  console.log('[TEST 3] Testing Pre-Mutation Impact Engine (Downstream + Policy Violations)...');
  try {
    const personRes = await db.query<{ person_id: string }>(`SELECT person_id FROM persons WHERE full_name = 'Krishna Chakri N';`);
    const personId = personRes.rows[0].person_id;

    const orgRes = await db.query<{ org_id: string }>(`SELECT org_id FROM organizations LIMIT 1;`);
    const orgId = orgRes.rows[0].org_id;

    // Propose salary drop from 1,100,000 to 500,000 (> 20% drop warning)
    const impact = await calculateMutationImpact(personId, {
      targetEmploymentType: 'ON_ROLL',
      effectiveDate: '2026-12-01',
      proposedComp: 500000,
      proposedTitle: 'Junior Associate',
      orgId,
    });

    if (impact.policyViolations.length === 0) {
      throw new Error('FAIL: Expected policy violation for salary reduction over 20%.');
    }

    if (!impact.requiredApprovals.includes('FINANCE_HEAD')) {
      throw new Error('FAIL: Expected FINANCE_HEAD approval requirement.');
    }

    console.log(`✓ PASSED: Impact Engine calculated ${impact.downstreamEffects.length} downstream effects, ${impact.policyViolations.length} policy violations, and required approvals: [${impact.requiredApprovals.join(', ')}].\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 3]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // TEST 4: Extensible Invariant Engine & 7-Step Governance
  // ------------------------------------------------------------
  console.log('[TEST 4] Testing Extensible Invariant Rule Framework & Governance Resolution...');
  try {
    const anomalies = await evaluateAllInvariants();
    if (anomalies.length === 0) throw new Error('FAIL: Expected to detect seed anomalies.');

    const ghostAnomaly = anomalies.find((a) => a.rule_id === 'GHOST_ACCESS_TERMINATED');
    if (!ghostAnomaly) throw new Error('FAIL: Expected GHOST_ACCESS_TERMINATED anomaly.');

    const userRes = await db.query<{ user_id: string }>(`SELECT user_id FROM users LIMIT 1;`);
    const adminId = userRes.rows[0].user_id;

    // Log Anomaly Resolution Governance Record
    const resIdRes = await db.query<{ resolution_id: string }>(
      `INSERT INTO anomaly_resolutions (
        rule_id, person_id, engagement_id, status, explanation, recommendation, impact_preview
       ) VALUES (
        $1, $2, $3, 'DETECTED', $4, $5, $6
       ) RETURNING resolution_id;`,
      [
        ghostAnomaly.rule_id,
        ghostAnomaly.person_id,
        ghostAnomaly.engagement_id,
        ghostAnomaly.explanation,
        ghostAnomaly.recommendation,
        JSON.stringify(ghostAnomaly.impact_preview),
      ]
    );
    const resolutionId = resIdRes.rows[0].resolution_id;

    // Execute governance resolution
    await executeResolutionGovernance(resolutionId, adminId);

    console.log(`✓ PASSED: Extensible Invariant Framework detected ${anomalies.length} anomalies across ACCESS & PAYROLL domains and resolved cleanly via governance.\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 4]: ${err.message}\n`);
  }

  console.log('============================================================');
  console.log(`SUMMARY: ${passed}/${total} PHASE 2 STRESS TESTS PASSED.`);
  console.log('============================================================');

  if (passed !== total) process.exit(1);
}

runBitemporalStressTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
