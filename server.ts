import http from 'http';
import { URL } from 'url';
import { getDb } from './lib/db';
import { seedDatabase } from './scripts/seed';
import { processOutboxEvents } from './lib/services/outboxWorker';
import { logger } from './lib/logger';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;
const CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:4000';
const DB_SLOW_QUERY_MS = process.env.DB_SLOW_QUERY_MS ? parseInt(process.env.DB_SLOW_QUERY_MS) : 250;

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

  // Start Background Outbox Worker (Batch poll every 10s)
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

      // 2. EXPENSE CLAIMS
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

      // 3. DEPARTMENT SETUP
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

      // 4. PERSONS LIST
      if (pathname === '/api/persons' && req.method === 'GET') {
        const pRes = await db.query(`SELECT person_id, full_name, personal_email FROM persons;`);
        logger.info('Persons list retrieved', { requestId, path: pathname, statusCode: 200, durationMs: Date.now() - startTime });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(pRes.rows));
        return;
      }

      // 5. ATTENDANCE PUNCHES
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

      // 6. PAYROLL EXECUTION
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

      // 7. OFFBOARDING & SESSION REVOCATION
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

      // 8. REPORTS SUMMARY
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
