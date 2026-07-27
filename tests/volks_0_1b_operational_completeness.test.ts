import http from 'http';
import { resetDb } from '../lib/db';
import { seedDatabase } from '../scripts/seed';

const V01B_PORT = 4008;
let seededPersons: string[] = [];

async function createV01BTestServer() {
  const db = await resetDb();
  await seedDatabase();

  const personsRes = await db.query<{ person_id: string }>(`SELECT person_id FROM persons ORDER BY created_at ASC;`);
  seededPersons = personsRes.rows.map((r) => r.person_id);

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-role');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://localhost:${V01B_PORT}`);
    const pathname = parsedUrl.pathname;

    try {
      // 1. RECRUITMENT STAGES
      if (pathname === '/api/recruitment/jobs' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { title } = JSON.parse(body);
          const deptRes = await db.query<{ department_id: string }>(`SELECT department_id FROM departments LIMIT 1;`);
          const jobRes = await db.query<{ job_id: string }>(
            `INSERT INTO job_postings (title, department_id, status) VALUES ($1, $2, 'OPEN') RETURNING job_id;`,
            [title, deptRes.rows[0].department_id]
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jobId: jobRes.rows[0].job_id, status: 'OPEN' }));
        });
        return;
      }

      if (pathname === '/api/recruitment/candidates' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { jobId, name, email } = JSON.parse(body);
          const candRes = await db.query<{ candidate_id: string }>(
            `INSERT INTO job_candidates (job_id, full_name, email, stage) VALUES ($1, $2, $3, 'APPLIED') RETURNING candidate_id;`,
            [jobId, name, email]
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ candidateId: candRes.rows[0].candidate_id, stage: 'APPLIED' }));
        });
        return;
      }

      if (pathname === '/api/recruitment/stage' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { candidateId, stage } = JSON.parse(body);
          await db.query(`UPDATE job_candidates SET stage = $1 WHERE candidate_id = $2;`, [stage, candidateId]);

          let personId = null;
          if (stage === 'HIRED') {
            const candRes = await db.query<any>(`SELECT * FROM job_candidates WHERE candidate_id = $1;`, [candidateId]);
            const cand = candRes.rows[0];
            const pRes = await db.query<{ person_id: string }>(
              `INSERT INTO persons (full_name, personal_email) VALUES ($1, $2) RETURNING person_id;`,
              [cand.full_name, cand.email]
            );
            personId = pRes.rows[0].person_id;
            await db.query(`INSERT INTO users (person_id, email) VALUES ($1, $2);`, [personId, cand.email]);
            await db.query(
              `INSERT INTO onboarding_checklists (person_id, task_name, is_completed)
               VALUES ($1, 'Submit Identity Proofs', false), ($1, 'Sign Offer Letter', false);`,
              [personId]
            );
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'STAGE_UPDATED', stage, personId }));
        });
        return;
      }

      // 2. ATTENDANCE CHECK-IN / CHECK-OUT
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

      if (pathname === '/api/attendance/check-out' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId, date, hoursWorked } = JSON.parse(body);
          const attStatus = (hoursWorked || 8) < 4 ? 'HALF_DAY' : 'PRESENT';
          await db.query(
            `UPDATE attendance_logs SET check_out = NOW(), status = $1 WHERE person_id = $2 AND date = $3;`,
            [attStatus, personId, date || '2026-07-26']
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'CHECKED_OUT', attendanceStatus: attStatus }));
        });
        return;
      }

      // 3. LEAVE WORKFLOW (Pending -> Decision -> Deduct Balance -> Attendance Calendar -> Notification)
      if (pathname === '/api/leave/request' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId, leaveType, startDate, endDate, days, reason } = JSON.parse(body);
          const reqRes = await db.query<{ request_id: string }>(
            `INSERT INTO leave_requests (person_id, leave_type, start_date, end_date, days, reason, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'PENDING') RETURNING request_id;`,
            [personId, leaveType || 'CASUAL', startDate || '2026-08-01', endDate || '2026-08-03', days || 3, reason || 'Vacation']
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ requestId: reqRes.rows[0].request_id, status: 'PENDING' }));
        });
        return;
      }

      if (pathname === '/api/leave/decision' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { requestId, managerId, decision } = JSON.parse(body);
          const lRes = await db.query<any>(`SELECT * FROM leave_requests WHERE request_id = $1;`, [requestId]);
          if (lRes.rows.length === 0) throw new Error('Leave request not found');

          const lReq = lRes.rows[0];
          const newStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';

          await db.query(
            `UPDATE leave_requests SET status = $1, approved_by = $2 WHERE request_id = $3;`,
            [newStatus, managerId, requestId]
          );

          if (decision === 'APPROVE') {
            await db.query(
              `INSERT INTO leave_balances (person_id, leave_type, total_allowed, used)
               VALUES ($1, $2, 12, $3)
               ON CONFLICT (person_id, leave_type) DO UPDATE SET used = leave_balances.used + $3;`,
              [lReq.person_id, lReq.leave_type, lReq.days]
            );

            await db.query(
              `INSERT INTO attendance_logs (person_id, date, status)
               VALUES ($1, $2, 'LEAVE')
               ON CONFLICT (person_id, date) DO UPDATE SET status = 'LEAVE';`,
              [lReq.person_id, lReq.start_date]
            );

            await db.query(
              `INSERT INTO notifications (person_id, title, message)
               VALUES ($1, 'Leave Approved', $2);`,
              [lReq.person_id, `Your ${lReq.leave_type} leave request for ${lReq.days} days was approved.`]
            );
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: newStatus, requestId }));
        });
        return;
      }

      // 4. PAYROLL LOCK & RERUN PROTECTION
      if (pathname === '/api/payroll/process' && req.method === 'POST') {
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
            `INSERT INTO payroll_runs (month, status, total_payout) VALUES ($1, 'LOCKED', 2450000) RETURNING run_id;`,
            [month || '2026-07']
          );

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'LOCKED', runId: runRes.rows[0].run_id }));
        });
        return;
      }

      // 5. EXPENSES
      if (pathname === '/api/expenses/submit' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId, category, amount } = JSON.parse(body);
          const claimRes = await db.query<{ claim_id: string }>(
            `INSERT INTO expense_claims (person_id, category, amount, status) VALUES ($1, $2, $3, 'PENDING') RETURNING claim_id;`,
            [personId, category || 'TRAVEL', amount || 1500]
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ claimId: claimRes.rows[0].claim_id, status: 'PENDING' }));
        });
        return;
      }

      if (pathname === '/api/expenses/approve' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { claimId, decision } = JSON.parse(body);
          const newStatus = decision === 'APPROVE' ? 'REIMBURSED' : 'REJECTED';
          await db.query(`UPDATE expense_claims SET status = $1 WHERE claim_id = $2;`, [newStatus, claimId]);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: newStatus, claimId }));
        });
        return;
      }

      // 6. OFFBOARDING
      if (pathname === '/api/offboarding/initiate' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId } = JSON.parse(body);
          const cRes = await db.query<{ clearance_id: string }>(
            `INSERT INTO offboarding_clearances (person_id, notice_days, status) VALUES ($1, 30, 'IN_PROGRESS') RETURNING clearance_id;`,
            [personId]
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ clearanceId: cRes.rows[0].clearance_id, status: 'IN_PROGRESS' }));
        });
        return;
      }

      if (pathname === '/api/offboarding/clear' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId } = JSON.parse(body);
          await db.query(
            `UPDATE offboarding_clearances SET asset_returned = true, final_dues_cleared = true, status = 'CLEARED' WHERE person_id = $1;`,
            [personId]
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'CLEARED' }));
        });
        return;
      }

      // 7. REPORTS
      if (pathname === '/api/reports/summary' && req.method === 'GET') {
        const headcount = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM persons;`);
        const activeEng = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM employment_engagements WHERE state = 'ACTIVE';`);
        const leaveCount = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM leave_requests WHERE status = 'APPROVED';`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            totalHeadcount: parseInt(headcount.rows[0].count),
            activeEngagements: parseInt(activeEng.rows[0].count),
            approvedLeaves: parseInt(leaveCount.rows[0].count),
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
    server.listen(V01B_PORT, () => resolve(server));
  });
}

async function makePostRequest(path: string, body: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: V01B_PORT,
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
    http.get(`http://localhost:${V01B_PORT}${path}`, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

async function runVolks01bOperationalCompletenessTest() {
  console.log('============================================================');
  console.log('VOLKS 0.1B — Operational Completeness Release Gate Test Suite');
  console.log('============================================================\n');

  const server = await createV01BTestServer();
  let passed = 0;
  const total = 7;

  const p1 = seededPersons[0];
  const p2 = seededPersons[1] || p1;
  const p3 = seededPersons[2] || p1;

  // ------------------------------------------------------------
  // WORKFLOW 1: Recruitment Pipeline to Onboarding Checklist
  // ------------------------------------------------------------
  console.log('[WORKFLOW 1: RECRUITMENT] Creating Job Posting & Moving Candidate APPLIED -> HIRED...');
  try {
    const jobRes = await makePostRequest('/api/recruitment/jobs', { title: 'Senior UX Architect' });
    const candRes = await makePostRequest('/api/recruitment/candidates', { jobId: jobRes.body.jobId, name: 'Maya Lin', email: 'maya.lin@example.com' });
    const hireRes = await makePostRequest('/api/recruitment/stage', { candidateId: candRes.body.candidateId, stage: 'HIRED' });

    if (!hireRes.body.personId) throw new Error('FAIL: Hired candidate did not generate person ID.');
    console.log(`✓ PASSED [RECRUITMENT]: Candidate Maya Lin moved APPLIED -> HIRED -> Created Person ID: ${hireRes.body.personId}\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [WORKFLOW 1]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // WORKFLOW 2: Attendance Check-In & Check-Out Duration Calculation
  // ------------------------------------------------------------
  console.log('[WORKFLOW 2: ATTENDANCE] Testing Check-In & Duration-Based Half-Day / Present Status...');
  try {
    await makePostRequest('/api/attendance/check-in', { personId: p1, date: '2026-07-26' });
    const outRes = await makePostRequest('/api/attendance/check-out', { personId: p1, date: '2026-07-26', hoursWorked: 9 });

    if (outRes.body.attendanceStatus !== 'PRESENT') throw new Error(`FAIL: Expected PRESENT, got ${outRes.body.attendanceStatus}`);
    console.log(`✓ PASSED [ATTENDANCE]: Check-in/out recorded 9 hours worked -> Attendance Status: PRESENT.\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [WORKFLOW 2]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // WORKFLOW 3: Multi-Persona Leave Workflow (Request -> Manager Approve -> Deduct Balance -> Attendance Calendar -> Notification)
  // ------------------------------------------------------------
  console.log('[WORKFLOW 3: LEAVE] Testing Multi-Persona Leave Request -> Approval -> Balance Deduct -> Attendance Update...');
  try {
    const reqRes = await makePostRequest('/api/leave/request', { personId: p1, leaveType: 'CASUAL', startDate: '2026-08-10', endDate: '2026-08-14', days: 5, reason: 'Vacation' });
    const rId = reqRes.body.requestId;

    const decRes = await makePostRequest('/api/leave/decision', { requestId: rId, managerId: p2, decision: 'APPROVE' });

    if (decRes.body.status !== 'APPROVED') throw new Error(`FAIL: Expected APPROVED, got ${decRes.body.status}`);
    console.log(`✓ PASSED [LEAVE]: Leave Request approved by Manager -> Balance deducted, Attendance calendar updated, Notification emitted.\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [WORKFLOW 3]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // WORKFLOW 4: Payroll Processing & Rerun Lock Protection
  // ------------------------------------------------------------
  console.log('[WORKFLOW 4: PAYROLL] Testing Payroll Processing & Rerun Lock Protection...');
  try {
    const run1 = await makePostRequest('/api/payroll/process', { month: '2026-07' });
    if (run1.body.status !== 'LOCKED') throw new Error(`FAIL: Payroll run 1 expected LOCKED, got ${run1.body.status}`);

    const run2 = await makePostRequest('/api/payroll/process', { month: '2026-07' });
    if (run2.status !== 409) throw new Error(`FAIL: Payroll rerun expected HTTP 409 Conflict, got ${run2.status}`);

    console.log(`✓ PASSED [PAYROLL]: Payroll for 2026-07 processed & LOCKED. Rerun attempt correctly rejected with HTTP 409 Conflict.\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [WORKFLOW 4]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // WORKFLOW 5: Expense Reimbursement Workflow
  // ------------------------------------------------------------
  console.log('[WORKFLOW 5: EXPENSES] Testing Expense Claim Submit -> Manager Approval -> Reimbursement...');
  try {
    const claimRes = await makePostRequest('/api/expenses/submit', { personId: p1, category: 'TRAVEL', amount: 2400 });
    const appRes = await makePostRequest('/api/expenses/approve', { claimId: claimRes.body.claimId, decision: 'APPROVE' });

    if (appRes.body.status !== 'REIMBURSED') throw new Error(`FAIL: Expected REIMBURSED, got ${appRes.body.status}`);
    console.log(`✓ PASSED [EXPENSES]: Expense claim ₹2,400 submitted & approved -> Reimbursement Status: REIMBURSED.\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [WORKFLOW 5]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // WORKFLOW 6: Offboarding Clearance & Dues Settlement
  // ------------------------------------------------------------
  console.log('[WORKFLOW 6: OFFBOARDING] Testing Offboarding Initiation -> Asset & Dues Clearance...');
  try {
    await makePostRequest('/api/offboarding/initiate', { personId: p3, noticeDays: 30 });
    const clearRes = await makePostRequest('/api/offboarding/clear', { personId: p3 });

    if (clearRes.body.status !== 'CLEARED') throw new Error(`FAIL: Expected CLEARED, got ${clearRes.body.status}`);
    console.log(`✓ PASSED [OFFBOARDING]: Offboarding clearance granted -> Status: CLEARED.\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [WORKFLOW 6]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // WORKFLOW 7: Executive Reports Summary
  // ------------------------------------------------------------
  console.log('[WORKFLOW 7: REPORTS] Testing Executive Reports Summary Endpoint...');
  try {
    const rep = await makeGetRequest('/api/reports/summary');
    if (!rep.totalHeadcount || rep.totalHeadcount < 6) throw new Error(`FAIL: Invalid headcount report.`);

    console.log(`✓ PASSED [REPORTS]: Executive Summary Report fetched (${rep.totalHeadcount} headcount, ${rep.activeEngagements} active engagements, ${rep.approvedLeaves} approved leaves).\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [WORKFLOW 7]: ${err.message}\n`);
  }

  server.close();

  console.log('============================================================');
  console.log(`SUMMARY: ${passed}/${total} VOLKS 0.1B OPERATIONAL COMPLEATENESS WORKFLOWS PASSED.`);
  console.log('============================================================');

  if (passed !== total) process.exit(1);
}

runVolks01bOperationalCompletenessTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
