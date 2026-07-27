import { getDb } from '../lib/db';

export async function seedDatabase() {
  const db = await getDb();

  // Create Organization
  const orgResult = await db.query<{ org_id: string }>(
    `INSERT INTO organizations (name) VALUES ('VOLKS Global') RETURNING org_id;`
  );
  const orgId = orgResult.rows[0].org_id;

  // Create Departments
  const depts = ['Engineering', 'Finance', 'Product', 'People'];
  const deptMap: Record<string, string> = {};
  for (const name of depts) {
    const res = await db.query<{ department_id: string }>(
      `INSERT INTO departments (org_id, name) VALUES ($1, $2) RETURNING department_id;`,
      [orgId, name]
    );
    deptMap[name] = res.rows[0].department_id;
  }

  // Create Positions
  const positions = [
    { title: 'Software Intern', dept: 'Engineering' },
    { title: 'Associate Software Engineer', dept: 'Engineering' },
    { title: 'Software Engineer', dept: 'Engineering' },
    { title: 'Engineering Manager (Contract)', dept: 'Engineering' },
    { title: 'Senior Analyst', dept: 'Finance' },
    { title: 'Finance Lead', dept: 'Finance' },
    { title: 'Design Intern', dept: 'Product' },
    { title: 'UX Designer', dept: 'Product' },
    { title: 'Operations Intern', dept: 'People' },
  ];
  const posMap: Record<string, string> = {};
  for (const pos of positions) {
    const res = await db.query<{ position_id: string }>(
      `INSERT INTO positions (department_id, title) VALUES ($1, $2) RETURNING position_id;`,
      [deptMap[pos.dept], pos.title]
    );
    posMap[pos.title] = res.rows[0].position_id;
  }

  // Helper to create Person
  async function createPerson(name: string, email: string, phone: string, nationalId: string) {
    const res = await db.query<{ person_id: string }>(
      `INSERT INTO persons (full_name, personal_email, phone, national_id)
       VALUES ($1, $2, $3, $4) RETURNING person_id;`,
      [name, email, phone, nationalId]
    );
    return res.rows[0].person_id;
  }

  // Helper to create User
  async function createUser(personId: string, email: string, isActive: boolean = true) {
    const res = await db.query<{ user_id: string }>(
      `INSERT INTO users (person_id, email, is_active)
       VALUES ($1, $2, $3) RETURNING user_id;`,
      [personId, email, isActive]
    );
    return res.rows[0].user_id;
  }

  // ------------------------------------------------------------
  // 1. Krishna Chakri N (P-001) — Intern -> On-Roll Conversion -> Promotion
  // ------------------------------------------------------------
  const p1 = await createPerson('Krishna Chakri N', 'krishna.chakri@example.com', '+91-9876543210', 'AADHAAR-001');
  const u1 = await createUser(p1, 'krishna.chakri@volks.com', true);

  // Engagement 1: INTERN (2025-08-01 to 2026-01-31)
  const e1_1 = await db.query<{ engagement_id: string }>(
    `INSERT INTO employment_engagements (person_id, org_id, employment_type, state, start_date, end_date)
     VALUES ($1, $2, 'INTERN', 'TERMINATED', '2025-08-01', '2026-01-31') RETURNING engagement_id;`,
    [p1, orgId]
  );
  const eng1_1 = e1_1.rows[0].engagement_id;

  await db.query(
    `INSERT INTO employment_changes (engagement_id, version, valid_from, valid_to, system_from, system_to, position_id, department_id, compensation, reason, created_by)
     VALUES ($1, 1, '2025-08-01', '2026-01-31', NOW(), NULL, $2, $3, 20000, 'Hired as intern', $4);`,
    [eng1_1, posMap['Software Intern'], deptMap['Engineering'], u1]
  );

  // Engagement 2: ON_ROLL (2026-02-01 ongoing) — Converted from Intern!
  const e1_2 = await db.query<{ engagement_id: string }>(
    `INSERT INTO employment_engagements (person_id, org_id, employment_type, state, start_date, converted_from_id)
     VALUES ($1, $2, 'ON_ROLL', 'ACTIVE', '2026-02-01', $3) RETURNING engagement_id;`,
    [p1, orgId, eng1_1]
  );
  const eng1_2 = e1_2.rows[0].engagement_id;

  // Change 1: Conversion (2026-02-01 to 2026-05-31)
  await db.query(
    `INSERT INTO employment_changes (engagement_id, version, valid_from, valid_to, system_from, system_to, position_id, department_id, compensation, reason, created_by)
     VALUES ($1, 1, '2026-02-01', '2026-05-31', NOW(), NULL, $2, $3, 800000, 'Converted intern -> on-roll', $4);`,
    [eng1_2, posMap['Associate Software Engineer'], deptMap['Engineering'], u1]
  );

  // Change 2: Promotion (2026-06-01 ongoing)
  await db.query(
    `INSERT INTO employment_changes (engagement_id, version, valid_from, valid_to, system_from, system_to, position_id, department_id, compensation, reason, created_by)
     VALUES ($1, 2, '2026-06-01', NULL, NOW(), NULL, $2, $3, 1100000, 'Promotion to Software Engineer', $4);`,
    [eng1_2, posMap['Software Engineer'], deptMap['Engineering'], u1]
  );

  await db.query(`INSERT INTO payroll_records (engagement_id, is_active) VALUES ($1, true);`, [eng1_2]);

  // ------------------------------------------------------------
  // 2. Ananya Rao (P-002) — Consultant terminated, Access remains ACTIVE (Ghost Access Anomaly)
  // ------------------------------------------------------------
  const p2 = await createPerson('Ananya Rao', 'ananya@example.com', '+91-9876543211', 'AADHAAR-002');
  const u2 = await createUser(p2, 'ananya@volks.com', true); // Access ACTIVE!

  const e2 = await db.query<{ engagement_id: string }>(
    `INSERT INTO employment_engagements (person_id, org_id, employment_type, state, start_date, end_date)
     VALUES ($1, $2, 'CONSULTANT', 'TERMINATED', '2025-01-15', '2026-06-30') RETURNING engagement_id;`,
    [p2, orgId]
  );
  const eng2 = e2.rows[0].engagement_id;

  await db.query(
    `INSERT INTO employment_changes (engagement_id, version, valid_from, valid_to, system_from, system_to, position_id, department_id, compensation, reason, created_by)
     VALUES ($1, 1, '2025-01-15', NULL, NOW(), NULL, $2, $3, 150000, 'Contract start', $4);`,
    [eng2, posMap['Engineering Manager (Contract)'], deptMap['Engineering'], u2]
  );

  await db.query(`INSERT INTO payroll_records (engagement_id, is_active) VALUES ($1, false);`, [eng2]);

  // ------------------------------------------------------------
  // 3. Vikram Shetty (P-003) — Active ON_ROLL, Payroll INACTIVE (Unpaid Work Anomaly)
  // ------------------------------------------------------------
  const p3 = await createPerson('Vikram Shetty', 'vikram@example.com', '+91-9876543212', 'AADHAAR-003');
  const u3 = await createUser(p3, 'vikram@volks.com', true);

  const e3 = await db.query<{ engagement_id: string }>(
    `INSERT INTO employment_engagements (person_id, org_id, employment_type, state, start_date)
     VALUES ($1, $2, 'ON_ROLL', 'ACTIVE', '2024-04-10') RETURNING engagement_id;`,
    [p3, orgId]
  );
  const eng3 = e3.rows[0].engagement_id;

  await db.query(
    `INSERT INTO employment_changes (engagement_id, version, valid_from, valid_to, system_from, system_to, position_id, department_id, compensation, reason, created_by)
     VALUES ($1, 1, '2024-04-10', NULL, NOW(), NULL, $2, $3, 950000, 'Hired on-roll', $4);`,
    [eng3, posMap['Senior Analyst'], deptMap['Finance'], u3]
  );

  await db.query(
    `INSERT INTO payroll_records (engagement_id, is_active, bank_account_flagged) VALUES ($1, false, true);`,
    [eng3]
  );

  // ------------------------------------------------------------
  // 4. Sana Iyer (P-004) — Intern -> On-Roll Conversion
  // ------------------------------------------------------------
  const p4 = await createPerson('Sana Iyer', 'sana@example.com', '+91-9876543213', 'AADHAAR-004');
  const u4 = await createUser(p4, 'sana@volks.com', true);

  const e4_1 = await db.query<{ engagement_id: string }>(
    `INSERT INTO employment_engagements (person_id, org_id, employment_type, state, start_date, end_date)
     VALUES ($1, $2, 'INTERN', 'TERMINATED', '2025-11-03', '2026-05-03') RETURNING engagement_id;`,
    [p4, orgId]
  );
  const eng4_1 = e4_1.rows[0].engagement_id;

  await db.query(
    `INSERT INTO employment_changes (engagement_id, version, valid_from, valid_to, system_from, system_to, position_id, department_id, compensation, reason, created_by)
     VALUES ($1, 1, '2025-11-03', '2026-05-03', NOW(), NULL, $2, $3, 18000, 'Hired as intern', $4);`,
    [eng4_1, posMap['Design Intern'], deptMap['Product'], u4]
  );

  const e4_2 = await db.query<{ engagement_id: string }>(
    `INSERT INTO employment_engagements (person_id, org_id, employment_type, state, start_date, converted_from_id)
     VALUES ($1, $2, 'ON_ROLL', 'ACTIVE', '2026-05-04', $3) RETURNING engagement_id;`,
    [p4, orgId, eng4_1]
  );
  const eng4_2 = e4_2.rows[0].engagement_id;

  await db.query(
    `INSERT INTO employment_changes (engagement_id, version, valid_from, valid_to, system_from, system_to, position_id, department_id, compensation, reason, created_by)
     VALUES ($1, 1, '2026-05-04', NULL, NOW(), NULL, $2, $3, 700000, 'Converted intern -> on-roll', $4);`,
    [eng4_2, posMap['UX Designer'], deptMap['Product'], u4]
  );

  await db.query(`INSERT INTO payroll_records (engagement_id, is_active) VALUES ($1, true);`, [eng4_2]);

  // ------------------------------------------------------------
  // 5. Rahul Bose (P-005) — Terminated ON_ROLL, Access remains ACTIVE (Severe Ghost Access Anomaly)
  // ------------------------------------------------------------
  const p5 = await createPerson('Rahul Bose', 'rahul@example.com', '+91-9876543214', 'AADHAAR-005');
  const u5 = await createUser(p5, 'rahul@volks.com', true); // Access ACTIVE!

  const e5 = await db.query<{ engagement_id: string }>(
    `INSERT INTO employment_engagements (person_id, org_id, employment_type, state, start_date, end_date)
     VALUES ($1, $2, 'ON_ROLL', 'TERMINATED', '2022-03-01', '2026-05-15') RETURNING engagement_id;`,
    [p5, orgId]
  );
  const eng5 = e5.rows[0].engagement_id;

  await db.query(
    `INSERT INTO employment_changes (engagement_id, version, valid_from, valid_to, system_from, system_to, position_id, department_id, compensation, reason, created_by)
     VALUES ($1, 1, '2022-03-01', NULL, NOW(), NULL, $2, $3, 1600000, 'Hired on-roll', $4);`,
    [eng5, posMap['Finance Lead'], deptMap['Finance'], u5]
  );

  await db.query(`INSERT INTO payroll_records (engagement_id, is_active) VALUES ($1, false);`, [eng5]);

  // ------------------------------------------------------------
  // 6. Meera Nair (P-006) — Active INTERN ready for conversion testing
  // ------------------------------------------------------------
  const p6 = await createPerson('Meera Nair', 'meera@example.com', '+91-9876543215', 'AADHAAR-006');
  const u6 = await createUser(p6, 'meera@volks.com', true);

  const e6 = await db.query<{ engagement_id: string }>(
    `INSERT INTO employment_engagements (person_id, org_id, employment_type, state, start_date)
     VALUES ($1, $2, 'INTERN', 'ACTIVE', '2026-04-01') RETURNING engagement_id;`,
    [p6, orgId]
  );
  const eng6 = e6.rows[0].engagement_id;

  await db.query(
    `INSERT INTO employment_changes (engagement_id, version, valid_from, valid_to, system_from, system_to, position_id, department_id, compensation, reason, created_by)
     VALUES ($1, 1, '2026-04-01', NULL, NOW(), NULL, $2, $3, 22000, 'Hired as intern', $4);`,
    [eng6, posMap['Operations Intern'], deptMap['People'], u6]
  );

  // ------------------------------------------------------------
  // Seed Default Leave Balances for Persons
  // ------------------------------------------------------------
  const persons = [p1, p2, p3, p4, p5, p6];
  for (const pId of persons) {
    await db.query(
      `INSERT INTO leave_balances (person_id, leave_type, total_allowed, used)
       VALUES ($1, 'Earned Leave', 12, 0),
              ($1, 'Casual Leave', 6, 0),
              ($1, 'Sick Leave', 6, 0)
       ON CONFLICT (person_id, leave_type) DO NOTHING;`,
      [pId]
    );
  }

  console.log('Seed database completed successfully with 6 persons and full bitemporal timelines.');
}
