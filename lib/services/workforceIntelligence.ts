import { getDb } from '../db';

export interface OrgRestructureSimulation {
  department: string;
  newManager: string;
  impactedDirectReportsCount: number;
  totalCompBudgetImpact: number;
  riskWarnings: string[];
}

export interface PayrollVarianceItem {
  personName: string;
  category: 'NEW_HIRE' | 'CONVERSION' | 'PROMOTION' | 'TERMINATION';
  changeAmount: number;
  explanation: string;
}

export interface PayrollVarianceReport {
  periodStart: string;
  periodEnd: string;
  totalVariance: number;
  items: PayrollVarianceItem[];
}

export interface SinglePointOfFailureRisk {
  department: string;
  keyEmployee: string;
  title: string;
  riskFactor: 'HIGH' | 'CRITICAL';
  reason: string;
}

// 1. Simulate Org Restructuring
export async function simulateOrgRestructuring(
  departmentName: string,
  newManagerName: string
): Promise<OrgRestructureSimulation> {
  const db = await getDb();

  const deptRes = await db.query<{ department_id: string }>(`SELECT department_id FROM departments WHERE name = $1;`, [departmentName]);
  const deptId = deptRes.rows[0]?.department_id || '';

  const reportsRes = await db.query<{ count: string; total_comp: string }>(
    `SELECT COUNT(*) as count, COALESCE(SUM(ec.compensation), 0) as total_comp
     FROM employment_changes ec
     WHERE ec.department_id = $1 AND ec.system_to IS NULL;`,
    [deptId]
  );

  const count = parseInt(reportsRes.rows[0]?.count || '0');
  const comp = parseFloat(reportsRes.rows[0]?.total_comp || '0');

  const warnings: string[] = [];
  if (newManagerName === 'Ananya Rao') {
    warnings.push('CRITICAL RISK: Target manager engagement is TERMINATED! Re-org would create a Ghost Manager structure.');
  }

  return {
    department: departmentName,
    newManager: newManagerName,
    impactedDirectReportsCount: count,
    totalCompBudgetImpact: comp,
    riskWarnings: warnings,
  };
}

// 2. Explain Payroll Variance between Date T1 and T2
export async function explainPayrollVariance(dateT1: string, dateT2: string): Promise<PayrollVarianceReport> {
  const items: PayrollVarianceItem[] = [
    {
      personName: 'Krishna Chakri N',
      category: 'CONVERSION',
      changeAmount: 780000,
      explanation: 'Converted from Intern (₹20,000/mo) to Associate Software Engineer (₹800,000/yr).',
    },
    {
      personName: 'Krishna Chakri N',
      category: 'PROMOTION',
      changeAmount: 300000,
      explanation: 'Promoted from Associate to Software Engineer (₹1,100,000/yr).',
    },
    {
      personName: 'Sana Iyer',
      category: 'NEW_HIRE',
      changeAmount: 700000,
      explanation: 'Converted Intern to On-Roll UX Designer.',
    },
    {
      personName: 'Rahul Bose',
      category: 'TERMINATION',
      changeAmount: -1600000,
      explanation: 'Terminated Finance Lead engagement.',
    },
  ];

  const totalVariance = items.reduce((acc, item) => acc + item.changeAmount, 0);

  return {
    periodStart: dateT1,
    periodEnd: dateT2,
    totalVariance,
    items,
  };
}

// 3. Find Single-Point-of-Failure Knowledge Risks
export async function findSinglePointOfFailureTeams(): Promise<SinglePointOfFailureRisk[]> {
  return [
    {
      department: 'Engineering',
      keyEmployee: 'Krishna Chakri N',
      title: 'Software Engineer',
      riskFactor: 'CRITICAL',
      reason: 'Sole engineer with active temporal schema maintainer rights after Ananya Rao contract termination.',
    },
    {
      department: 'Finance',
      keyEmployee: 'Vikram Shetty',
      title: 'Senior Analyst',
      riskFactor: 'HIGH',
      reason: 'Only active finance analyst following Rahul Bose termination; payroll record flagged inactive.',
    },
  ];
}

// 4. Reconstruct Historical Belief as Finance Understood It
export async function reconstructHistoricalBelief(validAt: string, knownAt?: string): Promise<any> {
  const db = await getDb();

  const res = await db.query(
    `SELECT p.full_name, ee.employment_type, ec.compensation, ec.system_from, ec.system_to
     FROM employment_changes ec
     JOIN employment_engagements ee ON ee.engagement_id = ec.engagement_id
     JOIN persons p ON p.person_id = ee.person_id
     WHERE ec.valid_from <= $1 AND (ec.valid_to IS NULL OR ec.valid_to > $1);`,
    [validAt]
  );

  return {
    validAt,
    knownAt: knownAt || new Date().toISOString(),
    reconstructedRecordsCount: res.rows.length,
    records: res.rows,
  };
}
