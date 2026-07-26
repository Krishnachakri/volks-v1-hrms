import http from 'http';
import { URL } from 'url';
import { getDb } from './lib/db';
import { seedDatabase } from './scripts/seed';
import { getSnapshot } from './lib/services/bitemporal';
import { processOutboxEvents } from './lib/services/outboxWorker';

const PORT = 4000;

interface AuthSession {
  personId: string;
  orgId: string;
  role: string;
  email: string;
  expiresAt: number;
}

const activeSessions: Record<string, AuthSession> = {};

async function startServer() {
  const db = await getDb();
  await seedDatabase().catch(() => {});

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-role, x-org-id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const parsedUrl = new URL(req.url || '/', `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;

    try {
      // 0. HEALTH CHECK
      if (pathname === '/health' && req.method === 'GET') {
        const dbCheck = await db.query('SELECT 1;');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'UP', database: dbCheck.rows.length === 1 ? 'HEALTHY' : 'DOWN' }));
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
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Account inactive or disabled.' }));
            return;
          }

          const sessionToken = `bearer-token-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const user = userRes.rows[0];

          activeSessions[sessionToken] = {
            personId: user.person_id,
            orgId: 'ORG-1001',
            role: user.email.includes('admin') || user.email.includes('bose') ? 'HR_ADMIN' : 'EMPLOYEE',
            email: user.email,
            expiresAt: Date.now() + 3600000,
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ token: sessionToken, expiresAt: new Date(activeSessions[sessionToken].expiresAt).toISOString(), user }));
        });
        return;
      }

      // 2. EXPENSE CLAIMS ENDPOINT
      if (pathname === '/api/expenses/claim' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId, amount, category, description } = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'SUBMITTED', claimId: `EXP-${Date.now()}`, amount, category, personId }));
        });
        return;
      }

      // 3. DEPARTMENT SETUP ENDPOINT
      if (pathname === '/api/admin/departments' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { name, code } = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'CREATED', deptId: `DEPT-${Date.now()}`, name, code }));
        });
        return;
      }

      // 4. PERSONS LIST
      if (pathname === '/api/persons' && req.method === 'GET') {
        const pRes = await db.query(`SELECT person_id, full_name, personal_email FROM persons;`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(pRes.rows));
        return;
      }

      // 5. ATTENDANCE CHECK-IN / CHECK-OUT / REGULARIZE
      if (pathname === '/api/attendance/check-in' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'CHECKED_IN', timestamp: new Date().toISOString() }));
        return;
      }
      if (pathname === '/api/attendance/check-out' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'CHECKED_OUT', timestamp: new Date().toISOString() }));
        return;
      }
      if (pathname === '/api/attendance/regularize' && req.method === 'POST') {
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
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Payroll run for ${month} is LOCKED.` }));
            return;
          }

          const runRes = await db.query<{ run_id: string }>(
            `INSERT INTO payroll_runs (month, status, total_payout) VALUES ($1, 'LOCKED', 4200000) RETURNING run_id;`,
            [month || '2026-07']
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'MONTH_CLOSED', runId: runRes.rows[0].run_id }));
        });
        return;
      }

      // 7. OFFBOARDING
      if (pathname === '/api/offboarding/final-settlement' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const { personId } = JSON.parse(body);
          await db.query(`UPDATE employment_engagements SET state = 'TERMINATED' WHERE person_id = $1;`, [personId]);
          await db.query(`UPDATE users SET is_active = false WHERE person_id = $1;`, [personId]);

          for (const t in activeSessions) {
            if (activeSessions[t].personId === personId) {
              delete activeSessions[t];
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'TERMINATED', accessDisabled: true }));
        });
        return;
      }

      // 8. REPORTS SUMMARY
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
          })
        );
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} is already in use — Local VOLKS API server is active.`);
    } else {
      console.error(err);
    }
  });

  server.listen(PORT, () => {
    console.log(`VOLKS API Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
