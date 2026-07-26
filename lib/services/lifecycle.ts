import { getDb } from '../db';

export type LifecycleState = 'PRE_HIRE' | 'ACTIVE' | 'SUSPENDED' | 'NOTICE' | 'TERMINATED';
export type LifecycleEvent = 'HIRE' | 'ACTIVATE' | 'SUSPEND' | 'RESUME' | 'START_NOTICE' | 'TERMINATE' | 'CONVERT' | 'REHIRE' | 'TRANSFER' | 'PROMOTE' | 'COMPENSATION_CHANGE';
export type EmploymentType = 'INTERN' | 'ON_ROLL' | 'CONSULTANT';

export interface TransitionRequest {
  personId: string;
  orgId: string;
  currentEngagementId?: string;
  event: LifecycleEvent;
  targetState: LifecycleState;
  targetEmploymentType: EmploymentType;
  effectiveDate: string;
  title: string;
  departmentId: string;
  compensation: number;
  reason: string;
  actorUserId: string;
}

export async function transitionLifecycleState(req: TransitionRequest): Promise<{ newEngagementId: string }> {
  const db = await getDb();

  await db.exec('BEGIN;');

  try {
    let convertedFromId: string | null = null;

    if (req.currentEngagementId) {
      convertedFromId = req.currentEngagementId;

      // Close current engagement: If event is CONVERT or TERMINATE, state becomes TERMINATED or replaced by new active engagement
      const closeState: LifecycleState = req.event === 'TERMINATE' ? 'TERMINATED' : 'TERMINATED';
      await db.query(
        `UPDATE employment_engagements
         SET state = $1, end_date = $2::date
         WHERE engagement_id = $3;`,
        [closeState, req.effectiveDate, req.currentEngagementId]
      );
    }

    // Insert new engagement
    const engRes = await db.query<{ engagement_id: string }>(
      `INSERT INTO employment_engagements (
        person_id, org_id, employment_type, state, start_date, converted_from_id
       ) VALUES (
        $1, $2, $3, $4, $5::date, $6
       ) RETURNING engagement_id;`,
      [req.personId, req.orgId, req.targetEmploymentType, req.targetState, req.effectiveDate, convertedFromId]
    );
    const newEngagementId = engRes.rows[0].engagement_id;

    // Fetch or create position
    const posRes = await db.query<{ position_id: string }>(
      `SELECT position_id FROM positions WHERE title = $1 AND department_id = $2 LIMIT 1;`,
      [req.title, req.departmentId]
    );
    let posId = posRes.rows[0]?.position_id;

    if (!posId) {
      const newPosRes = await db.query<{ position_id: string }>(
        `INSERT INTO positions (department_id, title) VALUES ($1, $2) RETURNING position_id;`,
        [req.departmentId, req.title]
      );
      posId = newPosRes.rows[0].position_id;
    }

    // Insert bitemporal change
    await db.query(
      `INSERT INTO employment_changes (
        engagement_id, version, valid_from, valid_to, system_from, system_to, position_id, department_id, compensation, reason, created_by
       ) VALUES (
        $1, 1, $2::date, NULL, NOW(), NULL, $3, $4, $5, $6, $7
       );`,
      [newEngagementId, req.effectiveDate, posId, req.departmentId, req.compensation, req.reason, req.actorUserId]
    );

    // Narrative Audit Event
    const personRes = await db.query<{ full_name: string }>(`SELECT full_name FROM persons WHERE person_id = $1;`, [req.personId]);
    const personName = personRes.rows[0]?.full_name || 'Person';

    await db.query(
      `INSERT INTO audit_events (entity_table, entity_id, action, actor_user_id, narrative, diff)
       VALUES ('employment_engagements', $1, $2, $3, $4, $5);`,
      [
        newEngagementId,
        req.event,
        req.actorUserId,
        `${personName} executed ${req.event} event → state: ${req.targetState} (${req.targetEmploymentType}) as ${req.title}`,
        JSON.stringify(req),
      ]
    );

    await db.exec('COMMIT;');
    return { newEngagementId };
  } catch (err) {
    await db.exec('ROLLBACK;').catch(() => {});
    throw err;
  }
}
