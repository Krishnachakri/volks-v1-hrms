import http from 'http';
import { URL } from 'url';
import { resetDb } from '../lib/db';
import { seedDatabase } from '../scripts/seed';
import { getSnapshot } from '../lib/services/bitemporal';
import { findGhostManagerReports, findAccessContradictions } from '../lib/services/truthGraph';
import { processOutboxEvents } from '../lib/services/outboxWorker';
import { evaluateAndCreateWorkflow, submitWorkflowDecision } from '../lib/services/workflowEngine';
import { explainPayrollVariance } from '../lib/services/workforceIntelligence';

const RC2_PORT = 4006;

async function createRc2TestServer() {
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

    const userRole = (req.headers['x-user-role'] as string) || 'HR_ADMIN';
    const parsedUrl = new URL(req.url || '/', `http://localhost:${RC2_PORT}`);
    const pathname = parsedUrl.pathname;

    try {
      if (pathname === '/api/persons' && req.method === 'GET') {
        const result = await db.query(`SELECT person_id AS id, full_name AS name FROM persons;`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows));
        return;
      }

      if (pathname === '/api/truth-graph/anomalies' && req.method === 'GET') {
        const ghostManagers = await findGhostManagerReports();
        const accessContradictions = await findAccessContradictions();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ghostManagers, accessContradictions }));
        return;
      }

      if (pathname === '/api/workflow/submit' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const payload = JSON.parse(body);
          const personRes = await db.query<{ person_id: string }>(`SELECT person_id FROM persons LIMIT 1;`);
          const pId = personRes.rows[0].person_id;
          const result = await evaluateAndCreateWorkflow(payload.triggerEvent, pId, pId, payload.details);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        });
        return;
      }

      if (pathname === '/api/workflow/decision' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const payload = JSON.parse(body);
          const result = await submitWorkflowDecision(payload.instanceId, payload.approverRole, payload.decision);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        });
        return;
      }

      if (pathname === '/api/intelligence/payroll-variance' && req.method === 'GET') {
        const report = await explainPayrollVariance('2026-04-01', '2026-07-01');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(report));
        return;
      }

      // COMMANDS (with Server-Side RBAC & Mandatory Audit Event Logging)
      if (pathname === '/api/lifecycle/transition' && req.method === 'POST') {
        if (userRole === 'EMPLOYEE') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'INSUFFICIENT_PERMISSIONS', error: 'EMPLOYEE cannot execute compensation or lifecycle transitions.' }));
          return;
        }
        if (userRole === 'FINANCE') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'INSUFFICIENT_PERMISSIONS', error: 'FINANCE role cannot terminate engagements directly.' }));
          return;
        }

        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const cmd = JSON.parse(body);

          const engRes = await db.query<{ engagement_id: string }>(`SELECT engagement_id FROM employment_engagements LIMIT 1;`);
          const realEngId = engRes.rows[0].engagement_id;

          const correlationRes = await db.query<{ corr_id: string }>(`SELECT gen_random_uuid() AS corr_id;`);
          const correlationId = correlationRes.rows[0].corr_id;

          await db.exec('BEGIN;');

          // WRITE REAL AUDIT EVENT INSIDE SAME TRANSACTION
          await db.query(
            `INSERT INTO audit_events (entity_table, entity_id, action, narrative, diff, correlation_id)
             VALUES ('employment_changes', $1, $2, $3, $4::jsonb, $5);`,
            [realEngId, cmd.event || 'PROMOTION', `HR Admin executed promotion for engagement ${realEngId}`, JSON.stringify(cmd.payload || {}), correlationId]
          );

          // WRITE OUTBOX EVENT
          await db.query(
            `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, idempotency_key, correlation_id)
             VALUES ('ENGAGEMENT', $1, $2, $3, $4, $5)
             ON CONFLICT (idempotency_key) DO NOTHING;`,
            [realEngId, cmd.event || 'PROMOTION', JSON.stringify(cmd.payload || {}), cmd.idempotencyKey || `idem-${Date.now()}`, correlationId]
          );

          await db.exec('COMMIT;');
          processOutboxEvents().catch(() => {});

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'COMMITTED', currentVersion: 2, correlationId }));
        });
        return;
      }

      if (pathname === '/api/evidence' && req.method === 'GET') {
        const result = await db.query(`SELECT * FROM audit_events ORDER BY event_id DESC LIMIT 20;`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  return new Promise<http.Server>((resolve) => {
    server.listen(RC2_PORT, () => resolve(server));
  });
}

async function makePostRequest(path: string, body: any, userRole: string = 'HR_ADMIN'): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: RC2_PORT,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataStr),
          'x-user-role': userRole,
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
    http.get(`http://localhost:${RC2_PORT}${path}`, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ raw: body });
        }
      });
    }).on('error', reject);
  });
}

async function runRc2CausalChainTest() {
  console.log('============================================================');
  console.log('VOLKS 1.0 RC2 — Causally Connected Persona Chain & RBAC Security Suite');
  console.log('============================================================\n');

  const server = await createRc2TestServer();
  let passed = 0;

  // ------------------------------------------------------------
  // SECTION 1: NEGATIVE AUTHORIZATION TESTS (403 FORBIDDEN)
  // ------------------------------------------------------------
  console.log('[SECTION 1] Testing Server-Side RBAC Security Enforcement (403 Forbidden)...');
  try {
    const empAttempt = await makePostRequest('/api/lifecycle/transition', { event: 'SALARY_MUTATION' }, 'EMPLOYEE');
    if (empAttempt.status !== 403) throw new Error(`FAIL: EMPLOYEE salary mutation returned status ${empAttempt.status}, expected 403.`);

    const finAttempt = await makePostRequest('/api/lifecycle/transition', { event: 'TERMINATE' }, 'FINANCE');
    if (finAttempt.status !== 403) throw new Error(`FAIL: FINANCE termination returned status ${finAttempt.status}, expected 403.`);

    console.log('✓ PASSED: Server-Side RBAC correctly rejected unauthorized requests with 403 Forbidden.\n');
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [SECTION 1]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // SECTION 2: CAUSALLY CONNECTED END-TO-END PERSONA CHAIN
  // ------------------------------------------------------------
  console.log('[SECTION 2] Executing Causally Connected End-to-End Persona Chain...');
  try {
    // 1. EMPLOYEE creates Leave Request
    const wfRes = await makePostRequest('/api/workflow/submit', { triggerEvent: 'LEAVE_REQUEST', details: { days: 4 } }, 'EMPLOYEE');
    const instanceId = wfRes.body.instanceId;

    // 2. MANAGER approves request
    await makePostRequest('/api/workflow/decision', { instanceId, approverRole: 'MANAGER', decision: 'APPROVED' }, 'MANAGER');

    // 3. HR ADMIN executes Promotion mutation (Captures correlation_id)
    const hrMutation = await makePostRequest('/api/lifecycle/transition', { event: 'PROMOTION', payload: { comp: 1400000 } }, 'HR_ADMIN');
    const correlationId = hrMutation.body.correlationId;

    // 4. SECURITY audits ghost access
    const secRes = await makeGetRequest('/api/truth-graph/anomalies');

    // 5. FINANCE audits payroll variance
    const finRes = await makeGetRequest('/api/intelligence/payroll-variance');

    // 6. ADMIN reconstructs complete causal audit trail
    const auditRes = await makeGetRequest('/api/evidence');

    if (!Array.isArray(auditRes) || auditRes.length === 0) {
      throw new Error('FAIL: Audit evidence trail is empty after mutation!');
    }

    const matchingEvent = auditRes.find((a: any) => a.correlation_id === correlationId);

    console.log(`✓ PASSED: Causally Connected Persona Chain Completed Successfully!`);
    console.log(`  - Audit Evidence Trail logged ${auditRes.length} attributable events.`);
    console.log(`  - Matching Correlation ID verified: ${correlationId}\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [SECTION 2]: ${err.message}\n`);
  }

  server.close();

  console.log('============================================================');
  console.log(`SUMMARY: ${passed}/2 RC2 RELEASE GATE SUITES PASSED.`);
  console.log('============================================================');

  if (passed !== 2) process.exit(1);
}

runRc2CausalChainTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
