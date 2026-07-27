import http from 'http';
import { URL } from 'url';
import { getDb } from './lib/db';
import { seedDatabase } from './scripts/seed';
import { processOutboxEvents } from './lib/services/outboxWorker';
import { logger } from './lib/logger';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
const CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:4000';
const DB_SLOW_QUERY_MS = process.env.DB_SLOW_QUERY_MS ? parseInt(process.env.DB_SLOW_QUERY_MS) : 250;
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB Max Upload Limit

let outboxIntervalTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;

// ------------------------------------------------------------
// SESSION STORAGE HELPER FUNCTIONS (PostgreSQL-Backed)
// ------------------------------------------------------------
async function createDbSession(db: any, token: string, personId: string, role: string, email: string) {
  const expiresAt = new Date(Date.now() + 3600000).toISOString();
  const orgId = 'ORG-1001';
  await db.query(
    `INSERT INTO sessions (token_hash, person_id, org_id, role, email, expires_at) VALUES ($1, $2, $3, $4, $5, $6);`,
    [token, personId, orgId, role, email, expiresAt]
  );
  return { token, expiresAt, orgId, role, email, personId };
}

async function getDbSession(db: any, token: string) {
  const res = await db.query<any>(
    `SELECT * FROM sessions WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW();`,
    [token]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    personId: row.person_id,
    orgId: row.org_id,
    role: row.role,
    email: row.email,
    expiresAt: new Date(row.expires_at).getTime(),
  };
}

async function revokePersonSessions(db: any, personId: string) {
  await db.query(`UPDATE sessions SET revoked_at = NOW() WHERE person_id = $1;`, [personId]);
}

async function startServer() {
  const db = await getDb();
  if (process.env.NODE_ENV !== 'production') {
    await seedDatabase().catch(() => {});
  }

  // Start Background Outbox Worker (Batch poll every 10s using SKIP LOCKED)
  outboxIntervalTimer = setInterval(async () => {
    if (!isShuttingDown) {
      const startTime = Date.now();
      const count = await processOutboxEvents('server-worker-node').catch(() => 0);
      const duration = Date.now() - startTime;
      if (count > 0) {
        logger.info(`Outbox batch complete (${count} events processed)`, {
          eventType: 'OUTBOX_BATCH_COMPLETE',
          durationMs: duration,
          details: { count },
        });
      }
    }
  }, 10000);

  const server = http.createServer(async (req, res) => {
    const startTime = Date.now();
    const requestId = (req.headers['x-request-id'] as string) || `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const origin = req.headers.origin || '';
    const allowedList = CORS_ALLOWED_ORIGINS.split(',');
    const allowOrigin = allowedList.includes(origin) || CORS_ALLOWED_ORIGINS === '*' ? origin || '*' : allowedList[0];

    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-role, x-org-id, X-Request-ID');
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (isShuttingDown) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'SERVER_SHUTTING_DOWN', requestId }));
      return;
    }

    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const parsedUrl = new URL(req.url || '/', `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;

    try {
      // 0A. LIVENESS CHECK
      if (pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'UP', service: 'VOLKS HRMS API', requestId }));
        logger.info('Liveness check passed', { requestId, path: pathname, statusCode: 200, durationMs: Date.now() - startTime });
        return;
      }

      // 0B. READINESS CHECK (DB Query Check)
      if (pathname === '/ready' && req.method === 'GET') {
        const dbStart = Date.now();
        const dbCheck = await db.query('SELECT 1;');
        const dbDuration = Date.now() - dbStart;
        const isReady = dbCheck.rows.length === 1;

        if (dbDuration > DB_SLOW_QUERY_MS) {
          logger.warn(`Slow DB Readiness query (${dbDuration}ms)`, { requestId, eventType: 'DB_SLOW_QUERY', durationMs: dbDuration });
        }

        res.writeHead(isReady ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: isReady ? 'READY' : 'UNAVAILABLE', database: isReady ? 'HEALTHY' : 'DOWN', requestId }));
        logger.info('Readiness check executed', { requestId, path: pathname, statusCode: isReady ? 200 : 503, durationMs: Date.now() - startTime });
        return;
      }

      // 1. AUTHENTICATION / LOGIN
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { email } = JSON.parse(body);
          const userRes = await db.query<any>(`SELECT u.*, p.full_name FROM users u JOIN persons p ON p.person_id = u.person_id WHERE u.email = $1;`, [email]);

          if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
            logger.security('LOGIN_FAILURE', `Failed login attempt for email: ${email}`, { requestId, path: pathname, statusCode: 401 });
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Account inactive or disabled.', requestId }));
            return;
          }

          const sessionToken = `bearer-token-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const user = userRes.rows[0];
          const role = user.email.includes('admin') || user.email.includes('bose') ? 'HR_ADMIN' : 'EMPLOYEE';

          const session = await createDbSession(db, sessionToken, user.person_id, role, user.email);

          logger.security('LOGIN_SUCCESS', `User ${user.email} authenticated successfully`, { requestId, path: pathname, statusCode: 200, actorRole: role });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ token: sessionToken, expiresAt: session.expiresAt, user, requestId }));
        });
        return;
      }

      // Session Resolution
      let session: any = null;
      if (token) {
        session = await getDbSession(db, token);
      }

      // ------------------------------------------------------------
      // 2. LEAVE MANAGEMENT API ENDPOINTS (SPRINT 1 VERTICAL SLICE)
      // ------------------------------------------------------------
      if (pathname === '/api/leave/balances' && req.method === 'GET') {
        const queryPersonId = parsedUrl.searchParams.get('personId') || 'p-101';
        let balRes = await db.query<any>(`SELECT leave_type, total_allowed, used FROM leave_balances WHERE person_id = $1;`, [queryPersonId]);

        if (balRes.rows.length === 0) {
          // Seed default balances if missing
          await db.query(
            `INSERT INTO leave_balances (person_id, leave_type, total_allowed, used)
             VALUES ($1, 'Earned Leave', 12, 0), ($1, 'Casual Leave', 6, 0), ($1, 'Sick Leave', 6, 0)
             ON CONFLICT DO NOTHING;`,
            [queryPersonId]
          );
          balRes = await db.query<any>(`SELECT leave_type, total_allowed, used FROM leave_balances WHERE person_id = $1;`, [queryPersonId]);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(balRes.rows));
        return;
      }

      if (pathname === '/api/leave/requests' && req.method === 'GET') {
        const reqRes = await db.query<any>(
          `SELECT lr.*, p.full_name FROM leave_requests lr LEFT JOIN persons p ON p.person_id = lr.person_id ORDER BY lr.created_at DESC;`
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(reqRes.rows));
        return;
      }

      if (pathname === '/api/leave/apply' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const { personId, leaveType, startDate, endDate, reason } = JSON.parse(body);
            const pId = personId || 'p-101';

            // A. Date Validation
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'INVALID_DATE_RANGE', message: 'Start date must be on or before end date.', requestId }));
              return;
            }

            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

            // B. Insufficient Balance Check
            const balCheck = await db.query<any>(
              `SELECT total_allowed, used FROM leave_balances WHERE person_id = $1 AND leave_type = $2;`,
              [pId, leaveType || 'Earned Leave']
            );

            let totalAllowed = 12;
            let used = 0;
            if (balCheck.rows.length > 0) {
              totalAllowed = balCheck.rows[0].total_allowed;
              used = balCheck.rows[0].used;
            }

            const remaining = totalAllowed - used;
            if (days > remaining) {
              logger.warn(`Insufficient leave balance: requested ${days}, remaining ${remaining}`, { requestId, statusCode: 400 });
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'INSUFFICIENT_LEAVE_BALANCE', message: `Insufficient ${leaveType} balance. Requested: ${days} days, Available: ${remaining} days.`, requestId }));
              return;
            }

            // C. Overlapping Leave Check
            const overlapCheck = await db.query<any>(
              `SELECT request_id FROM leave_requests WHERE person_id = $1 AND status IN ('PENDING', 'APPROVED') AND start_date <= $3 AND end_date >= $2;`,
              [pId, startDate, endDate]
            );

            if (overlapCheck.rows.length > 0) {
              logger.warn(`Overlapping leave request detected for person ${pId}`, { requestId, statusCode: 409 });
              res.writeHead(409, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'OVERLAPPING_LEAVE_REQUEST', message: 'An active or pending leave request already exists for the selected date range.', requestId }));
              return;
            }

            // Insert Leave Request
            const reqRes = await db.query<{ request_id: string }>(
              `INSERT INTO leave_requests (person_id, leave_type, start_date, end_date, days, status, reason)
               VALUES ($1, $2, $3, $4, $5, 'PENDING', $6) RETURNING request_id;`,
              [pId, leaveType || 'Earned Leave', startDate, endDate, days, reason || 'Leave Application']
            );

            const requestId = reqRes.rows[0].request_id;
            logger.business('LEAVE_REQUEST_SUBMITTED', `Leave request ${requestId} submitted for ${days} days`, { requestId, statusCode: 200 });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'SUBMITTED', requestId, days, leaveType, requestIdHeader: requestId }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message, requestId }));
          }
        });
        return;
      }

      if (pathname === '/api/leave/approve' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const { requestId: reqId, approverId, action } = JSON.parse(body);

            const reqQuery = await db.query<any>(`SELECT * FROM leave_requests WHERE request_id = $1;`, [reqId]);
            if (reqQuery.rows.length === 0) {
              res.writeHead(444, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'REQUEST_NOT_FOUND', requestId }));
              return;
            }

            const leaveReq = reqQuery.rows[0];
            if (leaveReq.status !== 'PENDING') {
              logger.warn(`Attempted duplicate approval/rejection on request ${reqId}`, { requestId, statusCode: 409 });
              res.writeHead(409, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'REQUEST_ALREADY_PROCESSED', message: `Leave request ${reqId} has already been ${leaveReq.status}.`, requestId }));
              return;
            }

            const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

            await db.exec('BEGIN;');
            await db.query(
              `UPDATE leave_requests SET status = $1, approved_by = $2 WHERE request_id = $3;`,
              [newStatus, approverId || 'p-005', reqId]
            );

            if (action === 'APPROVE') {
              // Deduct Balance
              await db.query(
                `UPDATE leave_balances SET used = used + $1 WHERE person_id = $2 AND leave_type = $3;`,
                [leaveReq.days, leaveReq.person_id, leaveReq.leave_type]
              );

              // Cross-Module Attendance Integration: Add LEAVE badges in attendance_logs
              let cur = new Date(leaveReq.start_date);
              const last = new Date(leaveReq.end_date);
              while (cur <= last) {
                const dateStr = cur.toISOString().split('T')[0];
                await db.query(
                  `INSERT INTO attendance_logs (person_id, date, status)
                   VALUES ($1, $2, 'LEAVE')
                   ON CONFLICT (person_id, date) DO UPDATE SET status = 'LEAVE';`,
                  [leaveReq.person_id, dateStr]
                );
                cur.setDate(cur.getDate() + 1);
              }
            }

            await db.exec('COMMIT;');

            logger.business('LEAVE_REQUEST_DECIDED', `Leave request ${reqId} set to ${newStatus}`, { requestId, statusCode: 200 });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: newStatus, requestId: reqId, personId: leaveReq.person_id, days: leaveReq.days }));
          } catch (err: any) {
            await db.exec('ROLLBACK;');
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message, requestId }));
          }
        });
        return;
      }

      // 3. RESUME UPLOAD & FILE VALIDATION (BLOCK-02 Fix)
      if (pathname === '/api/candidates/upload-resume' && req.method === 'POST') {
        let size = 0;
        let bodyBuffer: Buffer[] = [];

        req.on('data', (chunk) => {
          size += chunk.length;
          bodyBuffer.push(chunk);

          // 5MB Size Enforcement
          if (size > MAX_UPLOAD_SIZE_BYTES) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'PAYLOAD_TOO_LARGE', message: 'File size exceeds maximum permitted limit of 5MB.', requestId }));
            req.destroy();
          }
        });

        req.on('end', async () => {
          if (res.writableEnded) return;
          try {
            const rawBody = Buffer.concat(bodyBuffer).toString();
            const { fileName, fileContent } = JSON.parse(rawBody);

            const ext = (fileName || '').substring(fileName.lastIndexOf('.')).toLowerCase();
            const validExtensions = ['.pdf', '.docx', '.txt'];

            if (!validExtensions.includes(ext)) {
              logger.warn(`Invalid file type upload attempt: ${fileName}`, { requestId, statusCode: 400 });
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'INVALID_FILE_TYPE', message: 'Only .pdf, .docx, and .txt files are supported.', requestId }));
              return;
            }

            logger.info(`Resume uploaded and validated: ${fileName}`, { requestId, statusCode: 200 });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'SUCCESS', fileName, sizeBytes: size, requestId }));
          } catch (e: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'BAD_REQUEST', message: e.message, requestId }));
          }
        });
        return;
      }

      // 4. CANDIDATE HIRE & ATOMIC PERSON + ENGAGEMENT CREATION
      if (pathname === '/api/candidates/hire' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { fullName, email, jobTitle } = JSON.parse(body);
          const personId = `p-${Date.now()}`;
          const engagementId = `eng-${Date.now()}`;

          await db.exec('BEGIN;');
          try {
            await db.query(
              `INSERT INTO persons (person_id, full_name, personal_email) VALUES ($1, $2, $3);`,
              [personId, fullName, email]
            );
            await db.query(
              `INSERT INTO employment_engagements (engagement_id, person_id, org_id, employment_type, state, start_date) VALUES ($1, $2, 'ORG-1001', 'ON_ROLL', 'ACTIVE', CURRENT_DATE);`,
              [engagementId, personId]
            );
            await db.exec('COMMIT;');

            logger.business('EMPLOYEE_HIRED', `Candidate ${fullName} hired cleanly`, { requestId, statusCode: 200 });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'HIRED', personId, engagementId, fullName, jobTitle, requestId }));
          } catch (err: any) {
            await db.exec('ROLLBACK;');
            logger.error(`Hire candidate transaction failed: ${err.message}`, { requestId, statusCode: 500 });
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message, requestId }));
          }
        });
        return;
      }

      // 5. EXPENSE CLAIMS
      if (pathname === '/api/expenses/claim' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId, amount, category } = JSON.parse(body);
          logger.business('EXPENSE_SUBMITTED', `Expense claim of ${amount} submitted`, { requestId, path: pathname, statusCode: 200 });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'SUBMITTED', claimId: `EXP-${Date.now()}`, amount, category, personId, requestId }));
        });
        return;
      }

      // 6. DEPARTMENT SETUP
      if (pathname === '/api/admin/departments' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { name, code } = JSON.parse(body);
          logger.info(`Department ${name} created`, { requestId, path: pathname, statusCode: 200 });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'CREATED', deptId: `DEPT-${Date.now()}`, name, code, requestId }));
        });
        return;
      }

      // 7. PERSONS LIST
      if (pathname === '/api/persons' && req.method === 'GET') {
        const pRes = await db.query(`SELECT person_id, full_name, personal_email FROM persons;`);
        logger.info('Persons list retrieved', { requestId, path: pathname, statusCode: 200, durationMs: Date.now() - startTime });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(pRes.rows));
        return;
      }

      // 8. ATTENDANCE PUNCHES
      if (pathname === '/api/attendance/check-in' && req.method === 'POST') {
        logger.business('ATTENDANCE_CHECKIN', 'Employee punched check-in', { requestId, path: pathname, statusCode: 200 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'CHECKED_IN', timestamp: new Date().toISOString(), requestId }));
        return;
      }
      if (pathname === '/api/attendance/check-out' && req.method === 'POST') {
        logger.business('ATTENDANCE_CHECKOUT', 'Employee punched check-out', { requestId, path: pathname, statusCode: 200 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'CHECKED_OUT', timestamp: new Date().toISOString(), requestId }));
        return;
      }
      if (pathname === '/api/attendance/regularize' && req.method === 'POST') {
        logger.business('REGULARIZATION_SUBMITTED', 'Regularization request submitted', { requestId, path: pathname, statusCode: 200 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'PENDING_APPROVAL', requestId: `REG-${Date.now()}` }));
        return;
      }

      // 9. PAYROLL EXECUTION
      if (pathname === '/api/payroll/close-month' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { month } = JSON.parse(body);
          const lockCheck = await db.query<any>(`SELECT * FROM payroll_runs WHERE month = $1 AND status = 'LOCKED';`, [month || '2026-07']);
          if (lockCheck.rows.length > 0) {
            logger.security('PAYROLL_DUPLICATE_ATTEMPT', `Attempted duplicate payroll close for month ${month}`, { requestId, path: pathname, statusCode: 409 });
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Payroll run for ${month} is LOCKED.`, requestId }));
            return;
          }

          const runRes = await db.query<{ run_id: string }>(
            `INSERT INTO payroll_runs (month, status, total_payout) VALUES ($1, 'LOCKED', 4200000) RETURNING run_id;`,
            [month || '2026-07']
          );
          logger.business('PAYROLL_LOCKED', `Payroll for ${month} locked successfully`, { requestId, path: pathname, statusCode: 200 });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'MONTH_CLOSED', runId: runRes.rows[0].run_id, requestId }));
        });
        return;
      }

      // 10. OFFBOARDING & SESSION REVOCATION
      if (pathname === '/api/offboarding/final-settlement' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId } = JSON.parse(body);
          await db.query(`UPDATE employment_engagements SET state = 'TERMINATED' WHERE person_id = $1;`, [personId]);
          await db.query(`UPDATE users SET is_active = false WHERE person_id = $1;`, [personId]);
          await revokePersonSessions(db, personId);

          logger.security('EMPLOYEE_OFFBOARDED', `Employee ${personId} offboarded and sessions revoked`, { requestId, path: pathname, statusCode: 200 });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'TERMINATED', accessDisabled: true, sessionsRevoked: true, requestId }));
        });
        return;
      }

      // 11. REPORTS SUMMARY
      if (pathname === '/api/reports/summary' && req.method === 'GET') {
        if (token && !session) {
          logger.security('SESSION_REVOKED', 'Request attempted with revoked session token', { requestId, path: pathname, statusCode: 401 });
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'SESSION_REVOKED', requestId }));
          return;
        }

        const totalPeopleRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM persons;`);
        const activePeopleRes = await db.query<{ count: string }>(
          `SELECT COUNT(DISTINCT person_id) as count FROM employment_engagements WHERE state = 'ACTIVE';`
        );
        const inactivePeopleRes = await db.query<{ count: string }>(
          `SELECT COUNT(DISTINCT person_id) as count FROM persons WHERE person_id NOT IN (SELECT person_id FROM employment_engagements WHERE state = 'ACTIVE');`
        );

        logger.info('Reports summary retrieved', { requestId, path: pathname, statusCode: 200, durationMs: Date.now() - startTime });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            people: {
              total: parseInt(totalPeopleRes.rows[0].count),
              currentlyEmployed: parseInt(activePeopleRes.rows[0].count),
              notCurrentlyEmployed: parseInt(inactivePeopleRes.rows[0].count),
            },
            requestId,
          })
        );
        return;
      }

      logger.warn('Endpoint not found', { requestId, path: pathname, statusCode: 404, durationMs: Date.now() - startTime });
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found', requestId }));
    } catch (err: any) {
      logger.error(`Internal server error: ${err.message}`, { requestId, path: pathname, statusCode: 500, error: err.message });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message, requestId }));
    }
  });

  // Graceful Shutdown Listener
  const gracefulShutdown = () => {
    isShuttingDown = true;
    logger.info('Initiating graceful shutdown...');
    if (outboxIntervalTimer) clearInterval(outboxIntervalTimer);
    server.close(() => {
      logger.info('VOLKS API Server closed cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      logger.info(`Port ${PORT} is already in use — Local VOLKS API server is active.`);
    } else {
      logger.error(err.message, { error: err.message });
    }
  });

  server.listen(PORT, () => {
    logger.info(`VOLKS API Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => logger.error(err.message));
