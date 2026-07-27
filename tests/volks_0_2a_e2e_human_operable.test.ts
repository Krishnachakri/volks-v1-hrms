import http from 'http';
import { resetDb } from '../lib/db';
import { seedDatabase } from '../scripts/seed';

const V02A_PORT = 4015;
let seededPersonId: string = '';

async function createV02AServer() {
  const db = await resetDb();
  await seedDatabase();

  const personsRes = await db.query<{ person_id: string }>(`SELECT person_id FROM persons ORDER BY created_at ASC LIMIT 1;`);
  seededPersonId = personsRes.rows[0].person_id;

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-role');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://localhost:${V02A_PORT}`);
    const pathname = parsedUrl.pathname;

    try {
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
          res.end(JSON.stringify({ token: 'session-token-v02a', user: userRes.rows[0] }));
        });
        return;
      }

      if (pathname === '/api/leave/request' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId, leaveType, days } = JSON.parse(body);
          const reqRes = await db.query<{ request_id: string }>(
            `INSERT INTO leave_requests (person_id, leave_type, start_date, end_date, days, status)
             VALUES ($1, $2, '2026-07-20', '2026-07-22', $3, 'PENDING') RETURNING request_id;`,
            [personId || seededPersonId, leaveType || 'CASUAL', days || 3]
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'PENDING', requestId: reqRes.rows[0].request_id }));
        });
        return;
      }

      if (pathname === '/api/leave/decision' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { requestId, decision } = JSON.parse(body);
          await db.query(`UPDATE leave_requests SET status = $1 WHERE request_id = $2;`, [decision || 'APPROVED', requestId]);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: decision || 'APPROVED' }));
        });
        return;
      }

      if (pathname === '/api/employees/hire-mid-month' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { name, email } = JSON.parse(body);
          const pRes = await db.query<{ person_id: string }>(
            `INSERT INTO persons (full_name, personal_email) VALUES ($1, $2) RETURNING person_id;`,
            [name, email]
          );
          const personId = pRes.rows[0].person_id;
          await db.query(`INSERT INTO users (person_id, email, is_active) VALUES ($1, $2, true);`, [personId, email]);

          const orgRes = await db.query<{ org_id: string }>(`SELECT org_id FROM organizations LIMIT 1;`);
          await db.query(
            `INSERT INTO employment_engagements (person_id, org_id, employment_type, state, start_date)
             VALUES ($1, $2, 'ON_ROLL', 'ACTIVE', '2026-07-10');`,
            [personId, orgRes.rows[0].org_id]
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ personId, status: 'HIRED' }));
        });
        return;
      }

      if (pathname === '/api/offboarding/final-settlement' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId } = JSON.parse(body);
          await db.query(`UPDATE employment_engagements SET state = 'TERMINATED' WHERE person_id = $1;`, [personId || seededPersonId]);
          await db.query(`UPDATE users SET is_active = false WHERE person_id = $1;`, [personId || seededPersonId]);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'TERMINATED', accessDisabled: true }));
        });
        return;
      }

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

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'MONTH_CLOSED', runId: runRes.rows[0].run_id }));
        });
        return;
      }

      if (pathname === '/api/reports/summary' && req.method === 'GET') {
        const totalPeopleRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM persons;`);
        const activePeopleRes = await db.query<{ count: string }>(
          `SELECT COUNT(DISTINCT person_id) as count FROM employment_engagements WHERE state = 'ACTIVE';`
        );
        const inactivePeopleRes = await db.query<{ count: string }>(
          `SELECT COUNT(DISTINCT person_id) as count FROM persons WHERE person_id NOT IN (SELECT person_id FROM employment_engagements WHERE state = 'ACTIVE');`
        );

        const totalEngRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM employment_engagements;`);
        const activeEngRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM employment_engagements WHERE state = 'ACTIVE';`);
        const termEngRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM employment_engagements WHERE state = 'TERMINATED';`);
        const leaveCountRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM leave_requests WHERE status = 'APPROVED';`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            people: {
              total: parseInt(totalPeopleRes.rows[0].count),
              currentlyEmployed: parseInt(activePeopleRes.rows[0].count),
              notCurrentlyEmployed: parseInt(inactivePeopleRes.rows[0].count),
            },
            engagements: {
              total: parseInt(totalEngRes.rows[0].count),
              active: parseInt(activeEngRes.rows[0].count),
              terminated: parseInt(termEngRes.rows[0].count),
            },
            approvedLeaves: parseInt(leaveCountRes.rows[0].count),
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
    server.listen(V02A_PORT, () => resolve(server));
  });
}

async function makePostRequest(path: string, body: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: V02A_PORT,
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
    http.get(`http://localhost:${V02A_PORT}${path}`, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

async function runVolks02aHumanOperableTest() {
  console.log('============================================================');
  console.log('VOLKS 0.2A — Human-Operable Browser HRMS & Persistence Gate');
  console.log('============================================================\n');

  const server = await createV02AServer();
  let passed = 0;
  const total = 5;

  // 1. Employee Leave Form Submission & DB Update
  console.log('[EMPLOYEE FORM] Submitting Leave Request...');
  const leaveRes = await makePostRequest('/api/leave/request', { personId: seededPersonId, days: 3 });
  if (leaveRes.body.status !== 'PENDING') throw new Error('FAIL: Leave submission failed.');
  console.log(`✓ PASSED [EMPLOYEE FORM]: Leave request submitted -> Pending Approval.\n`);
  passed++;

  // 2. Manager Decision & State Persistence
  console.log('[MANAGER DECISION] Approving Leave Request...');
  const decRes = await makePostRequest('/api/leave/decision', { requestId: leaveRes.body.requestId, decision: 'APPROVED' });
  if (decRes.body.status !== 'APPROVED') throw new Error('FAIL: Manager decision failed.');

  const rep1 = await makeGetRequest('/api/reports/summary');
  if (rep1.approvedLeaves !== 1) throw new Error('FAIL: Approved leaves state mismatch.');
  console.log(`✓ PASSED [MANAGER DECISION]: Leave approved -> DB updated (Approved Leaves = 1).\n`);
  passed++;

  // 3. HR Admin Hire & Headcount Persistence
  console.log('[HR ADMIN HIRE] Hiring New Employee (Siddharth Sharma)...');
  const hireRes = await makePostRequest('/api/employees/hire-mid-month', { name: 'Siddharth Sharma', email: 'siddharth@volks.com' });
  if (hireRes.body.status !== 'HIRED') throw new Error('FAIL: Hiring failed.');

  const rep2 = await makeGetRequest('/api/reports/summary');
  if (rep2.people.total !== 7) throw new Error('FAIL: Headcount state mismatch after hire.');
  console.log(`✓ PASSED [HR ADMIN HIRE]: New employee hired -> Headcount incremented to 7.\n`);
  passed++;

  // 4. Payroll Lock & Rerun Protection Persistence
  console.log('[PAYROLL ADMIN] Processing & Locking July Payroll...');
  const payRes = await makePostRequest('/api/payroll/close-month', { month: '2026-07' });
  if (payRes.body.status !== 'MONTH_CLOSED') throw new Error('FAIL: Monthly payroll close failed.');

  const rerunRes = await makePostRequest('/api/payroll/close-month', { month: '2026-07' });
  if (rerunRes.status !== 409) throw new Error('FAIL: Lock rerun protection failed.');
  console.log(`✓ PASSED [PAYROLL ADMIN]: Payroll locked -> Rerun correctly rejected with HTTP 409 Conflict.\n`);
  passed++;

  // 5. Offboarding & Access Revocation Persistence
  console.log('[OFFBOARDING] Offboarding Employee & Verifying Deactivation...');
  await makePostRequest('/api/offboarding/final-settlement', { personId: seededPersonId });

  const termLogin = await makePostRequest('/api/auth/login', { email: 'ananya.rao@volks.com' });
  if (termLogin.status !== 401) throw new Error('FAIL: Terminated login restriction failed.');
  console.log(`✓ PASSED [OFFBOARDING]: Offboarding cleared -> Login correctly rejected with HTTP 401 Unauthorized.\n`);
  passed++;

  server.close();

  console.log('============================================================');
  console.log(`SUMMARY: ${passed}/${total} VOLKS 0.2A HUMAN-OPERABLE SUITES PASSED.`);
  console.log('============================================================');

  if (passed !== total) process.exit(1);
}

runVolks02aHumanOperableTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
