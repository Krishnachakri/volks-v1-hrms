import { getDb } from '../db';

export interface GhostManagerRisk {
  employee_id: string;
  employee_name: string;
  manager_id: string;
  manager_name: string;
  manager_state: string;
  manager_access_active: boolean;
  risk_explanation: string;
}

export interface AccessContradiction {
  person_id: string;
  full_name: string;
  engagement_state: string;
  system_access_active: boolean;
  contradiction_type: 'GHOST_USER' | 'LOCKED_OUT_EMPLOYEE';
  exposure_assessment: string;
}

export interface ManagerlessTeamRisk {
  department_id: string;
  department_name: string;
  current_manager: string;
  affected_report_count: number;
}

export async function findGhostManagerReports(): Promise<GhostManagerRisk[]> {
  const db = await getDb();
  const query = `
    SELECT 
      emp.person_id AS employee_id,
      emp.full_name AS employee_name,
      mgr.person_id AS manager_id,
      mgr.full_name AS manager_name,
      m_ee.state AS manager_state,
      m_u.is_active AS manager_access_active
    FROM persons emp
    JOIN employment_engagements e_ee ON e_ee.person_id = emp.person_id AND e_ee.state = 'ACTIVE'
    JOIN employment_changes ec ON ec.engagement_id = e_ee.engagement_id AND ec.system_to IS NULL
    JOIN persons mgr ON mgr.person_id = ec.manager_id
    JOIN employment_engagements m_ee ON m_ee.person_id = mgr.person_id
    JOIN users m_u ON m_u.person_id = mgr.person_id
    WHERE m_ee.state IN ('TERMINATED', 'SUSPENDED')
      AND m_u.is_active = true;
  `;

  const res = await db.query<any>(query);
  return res.rows.map((row) => ({
    employee_id: row.employee_id,
    employee_name: row.employee_name,
    manager_id: row.manager_id,
    manager_name: row.manager_name,
    manager_state: row.manager_state,
    manager_access_active: row.manager_access_active,
    risk_explanation: `${row.employee_name} reports to ${row.manager_name}, whose employment is ${row.manager_state} but system access remains ACTIVE.`,
  }));
}

export async function findAccessContradictions(): Promise<AccessContradiction[]> {
  const db = await getDb();
  const query = `
    SELECT 
      p.person_id,
      p.full_name,
      COALESCE(ee.state::text, 'NO_ENGAGEMENT') AS engagement_state,
      u.is_active AS system_access_active
    FROM persons p
    JOIN users u ON u.person_id = p.person_id
    LEFT JOIN employment_engagements ee ON ee.person_id = p.person_id AND ee.state = 'ACTIVE'
    WHERE (ee.state IS NULL AND u.is_active = true)
       OR (ee.state = 'TERMINATED' AND u.is_active = true)
       OR (ee.state = 'ACTIVE' AND u.is_active = false);
  `;

  const res = await db.query<any>(query);
  return res.rows.map((row) => {
    const isGhost = row.system_access_active && (row.engagement_state === 'TERMINATED' || row.engagement_state === 'NO_ENGAGEMENT');
    return {
      person_id: row.person_id,
      full_name: row.full_name,
      engagement_state: row.engagement_state,
      system_access_active: row.system_access_active,
      contradiction_type: isGhost ? 'GHOST_USER' : 'LOCKED_OUT_EMPLOYEE',
      exposure_assessment: isGhost
        ? `Security Breach Risk: Credentials active for non-engaged person (${row.full_name}).`
        : `Operational Lockout Risk: Active employee (${row.full_name}) has disabled system credentials.`,
    };
  });
}

export async function simulateOrphanedTeams(proposedTerminatedManagerId: string): Promise<ManagerlessTeamRisk[]> {
  const db = await getDb();
  const query = `
    SELECT 
      d.department_id,
      d.name AS department_name,
      mgr.full_name AS current_manager,
      COUNT(ec.change_id) AS affected_report_count
    FROM departments d
    JOIN positions pos ON pos.department_id = d.department_id
    JOIN employment_changes ec ON ec.position_id = pos.position_id AND ec.system_to IS NULL
    JOIN persons mgr ON mgr.person_id = ec.manager_id
    WHERE ec.manager_id = $1
    GROUP BY d.department_id, d.name, mgr.full_name;
  `;

  const res = await db.query<any>(query, [proposedTerminatedManagerId]);
  return res.rows.map((row) => ({
    department_id: row.department_id,
    department_name: row.department_name,
    current_manager: row.current_manager,
    affected_report_count: parseInt(row.affected_report_count),
  }));
}
