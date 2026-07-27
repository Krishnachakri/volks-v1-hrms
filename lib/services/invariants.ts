import { getDb } from '../db';

export interface InvariantRule {
  rule_id: string;
  domain: 'IDENTITY' | 'ACCESS' | 'PAYROLL' | 'COMPLIANCE';
  severity: 'CRITICAL' | 'SEVERE' | 'WATCH';
  title: string;
  evaluate: () => Promise<DetectedAnomaly[]>;
}

export interface DetectedAnomaly {
  rule_id: string;
  domain: string;
  severity: string;
  person_id: string;
  person_name: string;
  engagement_id: string | null;
  title: string;
  explanation: string;
  recommendation: string;
  impact_preview: any;
}

export const INVARIANT_REGISTRY: InvariantRule[] = [
  {
    rule_id: 'GHOST_ACCESS_TERMINATED',
    domain: 'ACCESS',
    severity: 'SEVERE',
    title: 'Access Active After Engagement Terminated',
    evaluate: async () => {
      const db = await getDb();
      const query = `
        SELECT p.person_id, p.full_name, ee.engagement_id, u.user_id, ee.state, ee.end_date
        FROM persons p
        JOIN employment_engagements ee ON ee.person_id = p.person_id
        JOIN users u ON u.person_id = p.person_id
        WHERE ee.state IN ('TERMINATED', 'SUSPENDED')
          AND u.is_active = true;
      `;
      const res = await db.query<any>(query);
      return res.rows.map((row) => ({
        rule_id: 'GHOST_ACCESS_TERMINATED',
        domain: 'ACCESS',
        severity: 'SEVERE',
        person_id: row.person_id,
        person_name: row.full_name,
        engagement_id: row.engagement_id,
        title: 'Access active after engagement terminated',
        explanation: `${row.full_name}'s engagement is marked ${row.state.toLowerCase()} (ended ${row.end_date || 'recently'}), but system user account remains ACTIVE. Per offboarding policy, credentials should be revoked.`,
        recommendation: 'Deactivate system user account via 7-step resolution workflow.',
        impact_preview: { target_user_id: row.user_id, action: 'SET users.is_active = false' },
      }));
    },
  },
  {
    rule_id: 'UNPAID_WORK_ACTIVE_ENGAGEMENT',
    domain: 'PAYROLL',
    severity: 'WATCH',
    title: 'Payroll Inactive While Actively Engaged',
    evaluate: async () => {
      const db = await getDb();
      const query = `
        SELECT p.person_id, p.full_name, ee.engagement_id, pr.payroll_id, pr.bank_account_flagged
        FROM persons p
        JOIN employment_engagements ee ON ee.person_id = p.person_id
        JOIN payroll_records pr ON pr.engagement_id = ee.engagement_id
        WHERE ee.state = 'ACTIVE'
          AND pr.is_active = false;
      `;
      const res = await db.query<any>(query);
      return res.rows.map((row) => ({
        rule_id: 'UNPAID_WORK_ACTIVE_ENGAGEMENT',
        domain: 'PAYROLL',
        severity: 'WATCH',
        person_id: row.person_id,
        person_name: row.full_name,
        engagement_id: row.engagement_id,
        title: 'Payroll inactive while actively engaged',
        explanation: `${row.full_name} is actively engaged, but payroll status is INACTIVE${row.bank_account_flagged ? ' (bank details flagged)' : ''}. Employee may be working without compensation disbursement.`,
        recommendation: 'Verify bank account compliance and activate payroll disbursement.',
        impact_preview: { target_payroll_id: row.payroll_id, action: 'SET payroll_records.is_active = true' },
      }));
    },
  },
  {
    rule_id: 'LOCKOUT_RISK_ACTIVE_ENGAGEMENT',
    domain: 'ACCESS',
    severity: 'WATCH',
    title: 'Access Revoked While Engagement Active',
    evaluate: async () => {
      const db = await getDb();
      const query = `
        SELECT p.person_id, p.full_name, ee.engagement_id, u.user_id
        FROM persons p
        JOIN employment_engagements ee ON ee.person_id = p.person_id
        JOIN users u ON u.person_id = p.person_id
        WHERE ee.state = 'ACTIVE'
          AND u.is_active = false;
      `;
      const res = await db.query<any>(query);
      return res.rows.map((row) => ({
        rule_id: 'LOCKOUT_RISK_ACTIVE_ENGAGEMENT',
        domain: 'ACCESS',
        severity: 'SEVERE',
        person_id: row.person_id,
        person_name: row.full_name,
        engagement_id: row.engagement_id,
        title: 'Access revoked while engagement active',
        explanation: `${row.full_name} has an active employment engagement but system user credentials are INACTIVE. Employee is locked out of required tools.`,
        recommendation: 'Re-enable user account credentials.',
        impact_preview: { target_user_id: row.user_id, action: 'SET users.is_active = true' },
      }));
    },
  },
];

export async function evaluateAllInvariants(): Promise<DetectedAnomaly[]> {
  const allAnomalies: DetectedAnomaly[] = [];
  for (const rule of INVARIANT_REGISTRY) {
    const detected = await rule.evaluate();
    allAnomalies.push(...detected);
  }
  return allAnomalies;
}

export async function executeResolutionGovernance(
  resolutionId: string,
  authorizedByUserId: string
): Promise<void> {
  const db = await getDb();

  await db.exec('BEGIN;');

  try {
    const res = await db.query<any>(
      `SELECT * FROM anomaly_resolutions WHERE resolution_id = $1;`,
      [resolutionId]
    );

    if (res.rows.length === 0) throw new Error('Resolution record not found.');
    const row = res.rows[0];

    const preview = typeof row.impact_preview === 'string' ? JSON.parse(row.impact_preview) : row.impact_preview;

    // Execute actual system state change
    if (preview.target_user_id) {
      const activeState = preview.action.includes('true');
      await db.query(`UPDATE users SET is_active = $1 WHERE user_id = $2;`, [activeState, preview.target_user_id]);
    } else if (preview.target_payroll_id) {
      const activeState = preview.action.includes('true');
      await db.query(`UPDATE payroll_records SET is_active = $1 WHERE payroll_id = $2;`, [activeState, preview.target_payroll_id]);
    }

    // Update governance status to EXECUTED
    await db.query(
      `UPDATE anomaly_resolutions
       SET status = 'EXECUTED', authorized_by = $1, executed_at = NOW()
       WHERE resolution_id = $2;`,
      [authorizedByUserId, resolutionId]
    );

    // Record audit event
    await db.query(
      `INSERT INTO audit_events (entity_table, entity_id, action, actor_user_id, narrative, diff)
       VALUES ('anomaly_resolutions', $1, 'RESOLVE_ANOMALY', $2, $3, $4);`,
      [
        resolutionId,
        authorizedByUserId,
        `Anomaly ${row.rule_id} for person ${row.person_id} authorized and executed by HR Admin`,
        JSON.stringify(preview),
      ]
    );

    await db.exec('COMMIT;');
  } catch (err) {
    await db.exec('ROLLBACK;').catch(() => {});
    throw err;
  }
}
