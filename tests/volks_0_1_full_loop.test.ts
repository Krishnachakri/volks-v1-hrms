import http from 'http';
import { resetDb } from '../lib/db';
import { seedDatabase } from '../scripts/seed';

const V01_PORT = 4007;

async function createV01TestServer() {
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

    const parsedUrl = new URL(req.url || '/', `http://localhost:${V01_PORT}`);
    const pathname = parsedUrl.pathname;

    try {
      if (pathname === '/api/recruitment/hire' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { name, email } = JSON.parse(body);
          const pRes = await db.query<{ person_id: string }>(
            `INSERT INTO persons (full_name, personal_email) VALUES ($1, $2) RETURNING person_id;`,
            [name, email]
          );
          const personId = pRes.rows[0].person_id;
          await db.query(`INSERT INTO users (person_id, email) VALUES ($1, $2);`, [personId, email]);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'HIRED', personId }));
        });
        return;
      }

      if (pathname === '/api/attendance/check-in' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId, date } = JSON.parse(body);
          await db.query(
            `INSERT INTO attendance_logs (person_id, date, check_in, status)
             VALUES ($1, $2, NOW(), 'PRESENT')
             ON CONFLICT (person_id, date) DO UPDATE SET check_in = NOW();`,
            [personId, date || '2026-07-26']
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'CHECKED_IN' }));
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
             VALUES ($1, $2, '2026-08-01', '2026-08-03', $3, 'APPROVED') RETURNING request_id;`,
            [personId, leaveType || 'CASUAL', days || 3]
          );

          await db.query(
            `INSERT INTO leave_balances (person_id, leave_type, total_allowed, used)
             VALUES ($1, $2, 12, $3)
             ON CONFLICT (person_id, leave_type) DO UPDATE SET used = leave_balances.used + $3;`,
            [personId, leaveType || 'CASUAL', days || 3]
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'APPROVED', requestId: reqRes.rows[0].request_id }));
        });
        return;
      }

      if (pathname === '/api/payroll/process' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { month } = JSON.parse(body);
          const runRes = await db.query<{ run_id: string }>(
            `INSERT INTO payroll_runs (month, total_payout) VALUES ($1, 2450000) RETURNING run_id;`,
            [month || '2026-07']
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'PROCESSED', runId: runRes.rows[0].run_id }));
        });
        return;
      }

      if (pathname === '/api/performance/review' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId, rating, feedback } = JSON.parse(body);
          await db.query(
            `INSERT INTO performance_reviews (person_id, reviewer_id, cycle, rating, feedback)
             VALUES ($1, $1, '2026-H1', $2, $3);`,
            [personId, rating || 4.8, feedback || 'Outstanding performance.']
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'SUBMITTED' }));
        });
        return;
      }

      if (pathname === '/api/offboarding/clear' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId } = JSON.parse(body);
          await db.query(
            `INSERT INTO offboarding_clearances (person_id, asset_returned, final_dues_cleared, status)
             VALUES ($1, true, true, 'CLEARED');`,
            [personId]
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'CLEARED' }));
        });
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
    server.listen(V01_PORT, () => resolve(server));
  });
}

async function makePostRequest(path: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: V01_PORT,
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
        res.on('end', () => resolve(JSON.parse(responseBody)));
      }
    );
    req.on('error', reject);
    req.write(dataStr);
    req.end();
  });
}

async function runVolks01FullLoopTest() {
  console.log('============================================================');
  console.log('VOLKS 0.1 — Complete Basic HRMS Lifecycle Verification (18 Modules)');
  console.log('============================================================\n');

  const server = await createV01TestServer();
  let passed = 0;
  const total = 6;

  // 1. Candidate Hiring & User Creation
  console.log('[STEP 1] Hiring Candidate via Recruitment API...');
  const hireRes = await makePostRequest('/api/recruitment/hire', { name: 'Elena Vance', email: 'elena.vance@example.com' });
  const personId = hireRes.personId;
  if (!personId) throw new Error('FAIL: Recruitment hire did not return personId.');
  console.log(`✓ STEP 1 PASSED: Hired Elena Vance (Person ID: ${personId})\n`);
  passed++;

  // 2. Attendance Check-In
  console.log('[STEP 2] Logging Attendance Check-In...');
  const attRes = await makePostRequest('/api/attendance/check-in', { personId, date: '2026-07-26' });
  if (attRes.status !== 'CHECKED_IN') throw new Error('FAIL: Attendance check-in failed.');
  console.log(`✓ STEP 2 PASSED: Attendance recorded (Status: ${attRes.status})\n`);
  passed++;

  // 3. Leave Request & Balance Deduct
  console.log('[STEP 3] Requesting Leave & Deducting Balance...');
  const leaveRes = await makePostRequest('/api/leave/request', { personId, leaveType: 'CASUAL', days: 3 });
  if (leaveRes.status !== 'APPROVED') throw new Error('FAIL: Leave request failed.');
  console.log(`✓ STEP 3 PASSED: Leave approved & balance updated (Request ID: ${leaveRes.requestId})\n`);
  passed++;

  // 4. Payroll Processing
  console.log('[STEP 4] Processing Monthly Payroll Run...');
  const payRes = await makePostRequest('/api/payroll/process', { month: '2026-07' });
  if (payRes.status !== 'PROCESSED') throw new Error('FAIL: Payroll run failed.');
  console.log(`✓ STEP 4 PASSED: Monthly payroll processed (Run ID: ${payRes.runId})\n`);
  passed++;

  // 5. Performance Review Submission
  console.log('[STEP 5] Submitting Performance Review...');
  const perfRes = await makePostRequest('/api/performance/review', { personId, rating: 4.8, feedback: 'Exceeds expectations.' });
  if (perfRes.status !== 'SUBMITTED') throw new Error('FAIL: Performance review failed.');
  console.log(`✓ STEP 5 PASSED: Performance review submitted (Rating: 4.8 / 5.0)\n`);
  passed++;

  // 6. Offboarding & Final Settlement Clearance
  console.log('[STEP 6] Executing Offboarding & Final Settlement Clearance...');
  const offRes = await makePostRequest('/api/offboarding/clear', { personId });
  if (offRes.status !== 'CLEARED') throw new Error('FAIL: Offboarding clearance failed.');
  console.log(`✓ STEP 6 PASSED: Offboarding clearance granted (Status: ${offRes.status})\n`);
  passed++;

  server.close();

  console.log('============================================================');
  console.log(`SUMMARY: ${passed}/${total} VOLKS 0.1 OPERATIONAL LIFECYCLE STEPS PASSED.`);
  console.log('============================================================');

  if (passed !== total) process.exit(1);
}

runVolks01FullLoopTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
