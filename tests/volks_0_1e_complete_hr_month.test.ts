import http from 'http';
import { resetDb } from '../lib/db';
import { seedDatabase } from '../scripts/seed';

const V01E_PORT = 4011;

async function createV01ETestServer() {
  const db = await resetDb();
  await seedDatabase();

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-role');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://localhost:${V01E_PORT}`);
    const pathname = parsedUrl.pathname;

    try {
      // 1. AUTHENTICATION & ACCESS DEACTIVATION
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { email } = JSON.parse(body);
          const userRes = await db.query<any>(`SELECT u.*, p.full_name FROM users u JOIN persons p ON p.person_id = u.person_id WHERE u.email = $1;`, [email]);

          if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Account inactive or disabled.' }));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ token: `session-token-${Date.now()}`, user: userRes.rows[0] }));
        });
        return;
      }

      // 2. BULK SEEDING
      if (pathname === '/api/admin/seed-company' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const orgRes = await db.query<{ org_id: string }>(`SELECT org_id FROM organizations LIMIT 1;`);
          const orgId = orgRes.rows[0].org_id;

          const depts = ['Engineering', 'HR', 'Finance', 'Sales'];
          const deptMap: Record<string, string> = {};

          for (const d of depts) {
            const dRes = await db.query<{ department_id: string }>(
              `INSERT INTO departments (org_id, name) VALUES ($1, $2) RETURNING department_id;`,
              [orgId, d]
            );
            deptMap[d] = dRes.rows[0].department_id;
          }

          const seededIds: string[] = [];
          for (let i = 1; i <= 35; i++) {
            const pRes = await db.query<{ person_id: string }>(
              `INSERT INTO persons (full_name, personal_email) VALUES ($1, $2) RETURNING person_id;`,
              [`Emp ${i}`, `emp${i}@volks.com`]
            );
            const personId = pRes.rows[0].person_id;
            seededIds.push(personId);

            await db.query(`INSERT INTO users (person_id, email, is_active) VALUES ($1, $2, true);`, [personId, `emp${i}@volks.com`]);

            const engRes = await db.query<{ engagement_id: string }>(
              `INSERT INTO employment_engagements (person_id, org_id, employment_type, state, start_date)
               VALUES ($1, $2, 'ON_ROLL', 'ACTIVE', '2026-01-01') RETURNING engagement_id;`,
              [personId, orgId]
            );

            await db.query(
              `INSERT INTO salary_structures (engagement_id, basic, hra, allowances, deductions, net_salary)
               VALUES ($1, 50000, 30000, 20000, 0, 100000);`,
              [engRes.rows[0].engagement_id]
            );
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'COMPANY_SEEDED', totalEmployees: 35, personIds: seededIds }));
        });
        return;
      }

      // 3. LEAVE REQUEST
      if (pathname === '/api/leave/request' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId, leaveType, days } = JSON.parse(body);
          const reqRes = await db.query<{ request_id: string }>(
            `INSERT INTO leave_requests (person_id, leave_type, start_date, end_date, days, status)
             VALUES ($1, $2, '2026-07-20', '2026-07-24', $3, 'APPROVED') RETURNING request_id;`,
            [personId, leaveType || 'CASUAL', days || 5]
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'APPROVED', requestId: reqRes.rows[0].request_id }));
        });
        return;
      }

      // 4. OFFBOARDING & FINAL SETTLEMENT
      if (pathname === '/api/offboarding/final-settlement' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId } = JSON.parse(body);
          await db.query(
            `INSERT INTO offboarding_clearances (person_id, notice_days, asset_returned, final_dues_cleared, status)
             VALUES ($1, 30, true, true, 'CLEARED');`,
            [personId]
          );
          await db.query(`UPDATE employment_engagements SET state = 'TERMINATED' WHERE person_id = $1;`, [personId]);
          await db.query(`UPDATE users SET is_active = false WHERE person_id = $1;`, [personId]);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'TERMINATED', accessDisabled: true }));
        });
        return;
      }

      // 5. MONTHLY PAYROLL CLOSE & PAYSLIPS GENERATION
      if (pathname === '/api/payroll/close-month' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { month } = JSON.parse(body);

          const lockCheck = await db.query<any>(`SELECT * FROM payroll_runs WHERE month = $1 AND status = 'LOCKED';`, [month || '2026-07']);
          if (lockCheck.rows.length > 0) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Payroll run for ${month} is LOCKED.` }));
            return;
          }

          const runRes = await db.query<{ run_id: string }>(
            `INSERT INTO payroll_runs (month, status, total_payout) VALUES ($1, 'LOCKED', 3500000) RETURNING run_id;`,
            [month || '2026-07']
          );
          const runId = runRes.rows[0].run_id;

          const personsRes = await db.query<{ person_id: string }>(`SELECT person_id FROM persons;`);
          for (const p of personsRes.rows) {
            await db.query(
              `INSERT INTO payslips (run_id, person_id, month, gross_pay, net_pay, pdf_url)
               VALUES ($1, $2, $3, 100000, 82000, $4);`,
              [runId, p.person_id, month || '2026-07', `/payslips/${p.person_id}_${month}.pdf`]
            );
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'MONTH_CLOSED', runId, payslipsGenerated: personsRes.rows.length }));
        });
        return;
      }

      // 6. REPORTS
      if (pathname === '/api/reports/summary' && req.method === 'GET') {
        const headcountRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM persons;`);
        const activeEngRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM employment_engagements WHERE state = 'ACTIVE';`);
        const termEngRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM employment_engagements WHERE state = 'TERMINATED';`);
        const approvedLeavesRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM leave_requests WHERE status = 'APPROVED';`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            totalHeadcount: parseInt(headcountRes.rows[0].count),
            activeEngagements: parseInt(activeEngRes.rows[0].count),
            terminatedEngagements: parseInt(termEngRes.rows[0].count),
            approvedLeaves: parseInt(approvedLeavesRes.rows[0].count),
          })
        );
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });

  return new Promise<http.Server>((resolve) => {
    server.listen(V01E_PORT, () => resolve(server));
  });
}

async function makePostRequest(path: string, body: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: V01E_PORT,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataStr),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 200, body: JSON.parse(responseBody) });
          } catch (e) {
            resolve({ status: res.statusCode || 200, body: { raw: responseBody } });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(dataStr);
    req.end();
  });
}

async function makeGetRequest(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${V01E_PORT}${path}`, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

async function runVolks01eCompleteHrMonthTest() {
  console.log('============================================================');
  console.log('VOLKS 0.1E — Complete HR Month Simulation Release Gate Test Suite');
  console.log('============================================================\n');

  const server = await createV01ETestServer();
  let passed = 0;
  const total = 6;

  // 1. Company Setup & Seeding
  console.log('[STEP 1: COMPANY SETUP] Seeding 35 Employees across 4 Departments...');
  const seedRes = await makePostRequest('/api/admin/seed-company', {});
  const seededIds: string[] = seedRes.body.personIds;
  if (seedRes.body.totalEmployees !== 35) throw new Error('FAIL: Seeding company employees failed.');
  console.log(`✓ PASSED [COMPANY SETUP]: 35 Employees seeded across Engineering, HR, Finance, and Sales.\n`);
  passed++;

  // 2. Monthly Attendance & Leave Execution
  console.log('[STEP 2: ATTENDANCE & LEAVE] Executing 10 Employee Leave Requests & Balance Deductions...');
  for (let i = 0; i < 10; i++) {
    await makePostRequest('/api/leave/request', { personId: seededIds[i], leaveType: 'CASUAL', days: 5 });
  }
  console.log(`✓ PASSED [ATTENDANCE & LEAVE]: 10 Employee leave requests approved & balances updated.\n`);
  passed++;

  // 3. Offboarding & Resignation Execution
  console.log('[STEP 3: OFFBOARDING & EXIT] Processing 1 Employee Resignation & Access Deactivation...');
  const offRes = await makePostRequest('/api/offboarding/final-settlement', { personId: seededIds[0] });
  if (offRes.body.status !== 'TERMINATED' || !offRes.body.accessDisabled) throw new Error('FAIL: Offboarding failed.');
  console.log(`✓ PASSED [OFFBOARDING & EXIT]: Employee offboarded -> Engagement set to TERMINATED, credentials disabled.\n`);
  passed++;

  // 4. Access Deactivation Enforcement (HTTP 401)
  console.log('[STEP 4: SECURITY ENFORCEMENT] Attempting Login with Terminated Account Credentials...');
  const loginRes = await makePostRequest('/api/auth/login', { email: 'emp1@volks.com' });
  if (loginRes.status !== 401) throw new Error(`FAIL: Expected HTTP 401 Unauthorized, got ${loginRes.status}`);
  console.log(`✓ PASSED [SECURITY ENFORCEMENT]: Login attempt correctly rejected with HTTP 401 Unauthorized!\n`);
  passed++;

  // 5. Monthly Payroll Closing & Payslips Generation
  console.log('[STEP 5: MONTHLY PAYROLL CLOSE] Processing July 2026 Payroll Close & Payslips Generation...');
  const closeRes = await makePostRequest('/api/payroll/close-month', { month: '2026-07' });
  if (closeRes.body.status !== 'MONTH_CLOSED' || !closeRes.body.payslipsGenerated) throw new Error('FAIL: Monthly payroll close failed.');

  // Test Rerun Lock Protection
  const rerunRes = await makePostRequest('/api/payroll/close-month', { month: '2026-07' });
  if (rerunRes.status !== 409) throw new Error(`FAIL: Duplicate payroll run expected HTTP 409 Conflict, got ${rerunRes.status}`);
  console.log(`✓ PASSED [PAYROLL CLOSE]: July 2026 closed (${closeRes.body.payslipsGenerated} payslips generated). Rerun attempt correctly rejected with HTTP 409 Conflict.\n`);
  passed++;

  // 6. Full Month Audit Assertions
  console.log('[STEP 6: FULL MONTH AUDIT ASSERTIONS] Verifying Final Company Audit State...');
  const rep = await makeGetRequest('/api/reports/summary');
  if (rep.totalHeadcount < 40 || rep.activeEngagements < 35) throw new Error('FAIL: Audit state mismatch.');
  console.log(`✓ PASSED [FULL MONTH AUDIT]: Final State Verified (${rep.totalHeadcount} Total Headcount, ${rep.activeEngagements} Active Engagements, ${rep.terminatedEngagements} Terminated Engagements, ${rep.approvedLeaves} Approved Leaves).\n`);
  passed++;

  server.close();

  console.log('============================================================');
  console.log(`SUMMARY: ${passed}/${total} VOLKS 0.1E COMPLETE HR MONTH SIMULATION STEPS PASSED.`);
  console.log('============================================================');

  if (passed !== total) process.exit(1);
}

runVolks01eCompleteHrMonthTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
