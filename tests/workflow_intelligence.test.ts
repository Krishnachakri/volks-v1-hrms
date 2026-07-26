import { resetDb } from '../lib/db';
import { seedDatabase } from '../scripts/seed';
import { evaluateAndCreateWorkflow, submitWorkflowDecision } from '../lib/services/workflowEngine';
import {
  simulateOrgRestructuring,
  explainPayrollVariance,
  findSinglePointOfFailureTeams,
  reconstructHistoricalBelief,
} from '../lib/services/workforceIntelligence';

async function runWorkflowIntelligenceTests() {
  console.log('============================================================');
  console.log('VOLKS HRMS — Phase 5 & 6 Workflow & Intelligence Test Suite');
  console.log('============================================================\n');

  const db = await resetDb();
  await seedDatabase();

  let passed = 0;
  let total = 4;

  // ------------------------------------------------------------
  // TEST 1: Universal Policy Engine & Multi-Stage Approval Graph
  // ------------------------------------------------------------
  console.log('[TEST 1] Testing Universal Policy Engine & Multi-Stage Approval Graph...');
  try {
    const personRes = await db.query<{ person_id: string }>(`SELECT person_id FROM persons WHERE full_name = 'Krishna Chakri N';`);
    const personId = personRes.rows[0].person_id;

    // Evaluate promotion request (> 15% comp increase)
    const workflow = await evaluateAndCreateWorkflow('PROMOTION', personId, personId, { compIncreasePct: 37, newComp: 1100000 });

    if (workflow.approvalGraph.length !== 3) {
      throw new Error(`FAIL: Expected 3 approval steps, got ${workflow.approvalGraph.length}`);
    }

    // Step 1 Approval by Manager
    await submitWorkflowDecision(workflow.instanceId, 'MANAGER', 'APPROVED');
    // Step 2 Approval by Department Head
    await submitWorkflowDecision(workflow.instanceId, 'DEPT_HEAD', 'APPROVED');
    // Step 3 Final Approval by HR Admin
    const finalRes = await submitWorkflowDecision(workflow.instanceId, 'HR_ADMIN', 'APPROVED');

    if (finalRes.status !== 'APPROVED') {
      throw new Error(`FAIL: Final workflow status expected APPROVED, got ${finalRes.status}`);
    }

    console.log(`✓ PASSED: Workflow Engine evaluated policy & executed 3-step approval graph (MANAGER → DEPT_HEAD → HR_ADMIN) -> Final Status: APPROVED.\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 1]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // TEST 2: Org Restructuring Simulation
  // ------------------------------------------------------------
  console.log('[TEST 2] Testing Org Restructuring Simulation...');
  try {
    const sim = await simulateOrgRestructuring('Engineering', 'Ananya Rao');

    if (sim.riskWarnings.length === 0) {
      throw new Error('FAIL: Re-org simulation failed to detect Ghost Manager risk for Ananya Rao.');
    }

    console.log(`✓ PASSED: Org Re-org Simulator correctly detected Ghost Manager Risk Warning: "${sim.riskWarnings[0]}".\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 2]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // TEST 3: Payroll Variance Explainer
  // ------------------------------------------------------------
  console.log('[TEST 3] Testing Bitemporal Payroll Variance Explainer...');
  try {
    const report = await explainPayrollVariance('2026-04-01', '2026-07-01');

    if (report.items.length !== 4) {
      throw new Error(`FAIL: Expected 4 variance items, got ${report.items.length}`);
    }

    console.log(`✓ PASSED: Payroll Variance Explainer accounted for ₹${report.totalVariance.toLocaleString()} variance across 4 workforce changes.\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 3]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // TEST 4: Single Point of Failure Risk Scanner & Historical Belief
  // ------------------------------------------------------------
  console.log('[TEST 4] Testing Single Point of Failure Scanner & Historical Belief Reconstructor...');
  try {
    const risks = await findSinglePointOfFailureTeams();
    const belief = await reconstructHistoricalBelief('2026-06-01', '2026-06-01');

    if (risks.length < 2) throw new Error('FAIL: SPOF scanner did not return expected critical knowledge risks.');
    if (belief.reconstructedRecordsCount < 1) throw new Error('FAIL: Historical belief reconstructor returned 0 records.');

    console.log(`✓ PASSED: Identified ${risks.length} SPOF risks and reconstructed ${belief.reconstructedRecordsCount} historical belief records.\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [TEST 4]: ${err.message}\n`);
  }

  console.log('============================================================');
  console.log(`SUMMARY: ${passed}/${total} PHASE 5 & 6 TESTS PASSED.`);
  console.log('============================================================');

  if (passed !== total) process.exit(1);
}

runWorkflowIntelligenceTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
