import { getDb } from '../db';

export interface BitemporalSnapshot {
  person_id: string;
  full_name: string;
  engagement_id: string;
  employment_type: string;
  state: string;
  position_title: string;
  department_name: string;
  compensation: number;
  currency: string;
  valid_from: string;
  valid_to: string | null;
  system_from: string;
  system_to: string | null;
  as_of_valid: string;
  as_of_known: string;
}

export async function getSnapshot(
  personId: string,
  validAt: string,
  knownAt?: string
): Promise<BitemporalSnapshot | null> {
  const db = await getDb();

  // If knownAt is not specified, default to current system time (infinity)
  const systemTimeClause = knownAt
    ? `ec.system_from <= $3::timestamptz AND (ec.system_to IS NULL OR ec.system_to > $3::timestamptz)`
    : `ec.system_to IS NULL`;

  const params: any[] = [personId, validAt];
  if (knownAt) params.push(knownAt);

  const query = `
    SELECT 
      p.person_id,
      p.full_name,
      ee.engagement_id,
      ee.employment_type,
      ee.state,
      pos.title AS position_title,
      dept.name AS department_name,
      ec.compensation,
      ec.currency,
      ec.valid_from,
      ec.valid_to,
      ec.system_from,
      ec.system_to
    FROM persons p
    JOIN employment_engagements ee ON ee.person_id = p.person_id
    JOIN employment_changes ec ON ec.engagement_id = ee.engagement_id
    LEFT JOIN positions pos ON pos.position_id = ec.position_id
    LEFT JOIN departments dept ON dept.department_id = ec.department_id
    WHERE p.person_id = $1
      AND ec.valid_from <= $2::date
      AND (ec.valid_to IS NULL OR ec.valid_to >= $2::date)
      AND ${systemTimeClause}
    ORDER BY ec.version DESC, ec.system_from DESC
    LIMIT 1;
  `;

  const res = await db.query<any>(query, params);
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  return {
    person_id: row.person_id,
    full_name: row.full_name,
    engagement_id: row.engagement_id,
    employment_type: row.employment_type,
    state: row.state,
    position_title: row.position_title || 'N/A',
    department_name: row.department_name || 'N/A',
    compensation: parseFloat(row.compensation),
    currency: row.currency,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    system_from: row.system_from,
    system_to: row.system_to,
    as_of_valid: validAt,
    as_of_known: knownAt || new Date().toISOString(),
  };
}

export async function insertRetroactiveCorrection(
  engagementId: string,
  validFrom: string,
  validTo: string | null,
  newComp: number,
  reason: string,
  actorUserId: string
): Promise<void> {
  const db = await getDb();

  await db.exec('BEGIN;');

  try {
    const now = new Date().toISOString();

    // 1. Soft-close system time for existing active system records in that valid-time window
    await db.query(
      `UPDATE employment_changes
       SET system_to = $1::timestamptz
       WHERE engagement_id = $2
         AND system_to IS NULL
         AND valid_from <= $3::date
         AND (valid_to IS NULL OR valid_to >= $3::date);`,
      [now, engagementId, validFrom]
    );

    // 2. Fetch current version number
    const verRes = await db.query<{ max_v: number }>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS max_v FROM employment_changes WHERE engagement_id = $1;`,
      [engagementId]
    );
    const nextVer = verRes.rows[0].max_v;

    // 3. Insert new bitemporal state record with system_from = NOW()
    await db.query(
      `INSERT INTO employment_changes (
        engagement_id, version, valid_from, valid_to, system_from, system_to, compensation, reason, created_by
       ) VALUES (
        $1, $2, $3::date, $4, $5::timestamptz, NULL, $6, $7, $8
       );`,
      [engagementId, nextVer, validFrom, validTo, now, newComp, reason, actorUserId]
    );

    // 4. Log audit event
    await db.query(
      `INSERT INTO audit_events (entity_table, entity_id, action, actor_user_id, narrative, diff)
       VALUES ('employment_changes', $1, 'RETROACTIVE_CORRECTION', $2, $3, $4);`,
      [
        engagementId,
        actorUserId,
        `Retroactive compensation correction applied for period starting ${validFrom}`,
        JSON.stringify({ validFrom, validTo, newComp, reason, systemTimestamp: now }),
      ]
    );

    await db.exec('COMMIT;');
  } catch (err) {
    await db.exec('ROLLBACK;').catch(() => {});
    throw err;
  }
}
