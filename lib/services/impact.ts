import { getDb } from '../db';
import { getSnapshot } from './bitemporal';

export interface ImpactAnalysis {
  personId: string;
  fullName: string;
  currentState: any;
  proposedState: any;
  downstreamEffects: string[];
  policyViolations: Array<{ severity: 'CRITICAL' | 'WARNING'; message: string }>;
  requiredApprovals: string[];
  isAllowed: boolean;
}

export async function calculateMutationImpact(
  personId: string,
  proposedMutation: {
    targetEmploymentType: 'INTERN' | 'ON_ROLL' | 'CONSULTANT';
    effectiveDate: string;
    proposedComp: number;
    proposedTitle: string;
    orgId: string;
  }
): Promise<ImpactAnalysis> {
  const db = await getDb();

  // Fetch current active state
  const snapshot = await getSnapshot(personId, new Date().toISOString().slice(0, 10));

  const downstreamEffects: string[] = [];
  const policyViolations: Array<{ severity: 'CRITICAL' | 'WARNING'; message: string }> = [];
  const requiredApprovals: string[] = ['HR_ADMIN'];

  if (snapshot) {
    downstreamEffects.push(
      `Current active engagement (${snapshot.employment_type}) will be marked CONVERTED effective ${proposedMutation.effectiveDate}.`
    );
    downstreamEffects.push(
      `Compensation will change from ₹${snapshot.compensation.toLocaleString()} to ₹${proposedMutation.proposedComp.toLocaleString()}.`
    );
    if (snapshot.position_title !== proposedMutation.proposedTitle) {
      downstreamEffects.push(
        `Job title will change from "${snapshot.position_title}" to "${proposedMutation.proposedTitle}".`
      );
    }
  } else {
    downstreamEffects.push(`Initial engagement creation for ${proposedMutation.targetEmploymentType}.`);
  }

  // Check Policy Violations
  // Violation Rule 1: Salary reduction threshold warning (> 20% drop)
  if (snapshot && proposedMutation.proposedComp < snapshot.compensation * 0.8) {
    policyViolations.push({
      severity: 'WARNING',
      message: `Proposed compensation (₹${proposedMutation.proposedComp}) is over 20% lower than current compensation (₹${snapshot.compensation}).`,
    });
    requiredApprovals.push('FINANCE_HEAD');
  }

  // Violation Rule 2: Active duplicate contract in same org
  const activeEng = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM employment_engagements
     WHERE person_id = $1 AND org_id = $2 AND state = 'ACTIVE' AND employment_type = $3;`,
    [personId, proposedMutation.orgId, proposedMutation.targetEmploymentType]
  );
  if (parseInt(activeEng.rows[0].count) > 0) {
    policyViolations.push({
      severity: 'CRITICAL',
      message: `Person already holds an ACTIVE ${proposedMutation.targetEmploymentType} engagement in this organization. Multi-active contract violation.`,
    });
  }

  const personRes = await db.query<{ full_name: string }>(`SELECT full_name FROM persons WHERE person_id = $1;`, [personId]);
  const fullName = personRes.rows[0]?.full_name || 'Person';

  const hasCritical = policyViolations.some((v) => v.severity === 'CRITICAL');

  return {
    personId,
    fullName,
    currentState: snapshot,
    proposedState: proposedMutation,
    downstreamEffects,
    policyViolations,
    requiredApprovals,
    isAllowed: !hasCritical,
  };
}
