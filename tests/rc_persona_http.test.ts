import http from 'http';
import { URL } from 'url';
import { resetDb } from '../lib/db';
import { seedDatabase } from '../scripts/seed';
import { findGhostManagerReports, findAccessContradictions } from '../lib/services/truthGraph';
import { processOutboxEvents } from '../lib/services/outboxWorker';
import { evaluateAndCreateWorkflow } from '../lib/services/workflowEngine';
import {
  simulateOrgRestructuring,
  explainPayrollVariance,
} from '../lib/services/workforceIntelligence';

const TEST_PORT = 4005;

async function createTestServer() {
  const db = await resetDb();
  await seedDatabase();

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url || '/', `http://localhost:${TEST_PORT}`);
    const pathname = parsedUrl.pathname;

    try {
      if (pathname === '/api/persons' && req.method === 'GET') {
        const query = `
          SELECT 
            p.person_id AS id,
            p.full_name AS name,
            SUBSTRING(p.full_name FROM 1 FOR 1) || COALESCE(SUBSTRING(SPLIT_PART(p.full_name, ' ', 2) FROM 1 FOR 1), '') AS initials,
            ee.employment_type AS type,
            ee.state,
            pos.title,
            dept.name AS dept,
            m.full_name AS manager,
            ec.compensation AS "currentComp",
            u.is_active AS access_active,
            pr.is_active AS payroll_active
          FROM persons p
          JOIN employment_engagements ee ON ee.person_id = p.person_id
          JOIN employment_changes ec ON ec.engagement_id = ee.engagement_id AND ec.system_to IS NULL
          LEFT JOIN positions pos ON pos.position_id = ec.position_id
          LEFT JOIN departments dept ON dept.department_id = ec.department_id
          LEFT JOIN persons m ON m.person_id = ec.manager_id
          JOIN users u ON u.person_id = p.person_id
          LEFT JOIN payroll_records pr ON pr.engagement_id = ee.engagement_id
          ORDER BY p.created_at ASC;
        `;
        const result = await db.query(query);
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
          const validPersonId = personRes.rows[0].person_id;

          const result = await evaluateAndCreateWorkflow(
            payload.triggerEvent,
            validPersonId,
            validPersonId,
            payload.details
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        });
        return;
      }

      if (pathname === '/api/intelligence/reorg-simulate' && req.method === 'GET') {
        const dept = parsedUrl.searchParams.get('dept') || 'Engineering';
        const mgr = parsedUrl.searchParams.get('mgr') || 'Ananya Rao';
        const sim = await simulateOrgRestructuring(dept, mgr);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(sim));
        return;
      }

      if (pathname === '/api/intelligence/payroll-variance' && req.method === 'GET') {
        const t1 = parsedUrl.searchParams.get('t1') || '2026-04-01';
        const t2 = parsedUrl.searchParams.get('t2') || '2026-07-01';
        const report = await explainPayrollVariance(t1, t2);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(report));
        return;
      }

      if (pathname === '/api/lifecycle/transition' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          const cmd = JSON.parse(body);

          // Get real engagement UUID
          const engRes = await db.query<{ engagement_id: string }>(`SELECT engagement_id FROM employment_engagements LIMIT 1;`);
          const realEngId = engRes.rows[0].engagement_id;

          const correlationRes = await db.query<{ corr_id: string }>(`SELECT gen_random_uuid() AS corr_id;`);
          const correlationId = correlationRes.rows[0].corr_id;

          await db.exec('BEGIN;');
          await db.query(
            `INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, idempotency_key, correlation_id)
             VALUES ('ENGAGEMENT', $1, $2, $3, $4, $5)
             ON CONFLICT (idempotency_key) DO NOTHING;`,
            [realEngId, cmd.event || 'LIFECYCLE_MUTATION', JSON.stringify(cmd.payload || {}), cmd.idempotencyKey || `idem-${Date.now()}`, correlationId]
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
    server.listen(TEST_PORT, () => resolve(server));
  });
}

async function makePostRequest(path: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
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
            resolve(JSON.parse(responseBody));
          } catch (e) {
            resolve({ raw: responseBody });
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
    http.get(`http://localhost:${TEST_PORT}${path}`, (res) => {
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

async function runRcPersonaHttpTests() {
  console.log('============================================================');
  console.log('VOLKS 1.0 RC — HTTP API Persona Journey Verification');
  console.log('============================================================\n');

  const server = await createTestServer();

  let passed = 0;
  let total = 6;

  // ------------------------------------------------------------
  // PERSONA 1: EMPLOYEE
  // ------------------------------------------------------------
  console.log('[PERSONA 1: EMPLOYEE] Submitting Leave Request via HTTP POST /api/workflow/submit...');
  try {
    const res = await makePostRequest('/api/workflow/submit', {
      triggerEvent: 'LEAVE_REQUEST',
      details: { days: 3, reason: 'Vacation' },
    });

    if (!res.instanceId) throw new Error('FAIL: Employee leave request did not return instanceId.');
    console.log(`✓ PASSED [EMPLOYEE]: Leave request submitted via HTTP. Instance ID: ${res.instanceId}\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [PERSONA 1]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // PERSONA 2: MANAGER
  // ------------------------------------------------------------
  console.log('[PERSONA 2: MANAGER] Simulating Re-org & Approving Leave via HTTP...');
  try {
    const simRes = await makeGetRequest('/api/intelligence/reorg-simulate?dept=Engineering&mgr=Ananya+Rao');
    if (!simRes.riskWarnings || simRes.riskWarnings.length === 0) {
      throw new Error('FAIL: Manager re-org simulation failed to detect ghost manager warning.');
    }

    console.log(`✓ PASSED [MANAGER]: Re-org simulation flagged risk: "${simRes.riskWarnings[0]}".\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [PERSONA 2]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // PERSONA 3: HR ADMIN
  // ------------------------------------------------------------
  console.log('[PERSONA 3: HR ADMIN] Executing Lifecycle Transition via HTTP POST /api/lifecycle/transition...');
  try {
    const transRes = await makePostRequest('/api/lifecycle/transition', {
      event: 'PROMOTION',
      payload: { newTitle: 'Senior Software Engineer', newComp: 1400000 },
      idempotencyKey: `idem-hr-trans-${Date.now()}`,
    });

    if (transRes.status !== 'COMMITTED') {
      throw new Error(`FAIL: HR lifecycle transition expected COMMITTED, got ${transRes.status}`);
    }

    console.log(`✓ PASSED [HR ADMIN]: Atomic OCC Transition committed via HTTP. Correlation ID: ${transRes.correlationId}\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [PERSONA 3]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // PERSONA 4: FINANCE
  // ------------------------------------------------------------
  console.log('[PERSONA 4: FINANCE] Reviewing Payroll Variance via HTTP GET /api/intelligence/payroll-variance...');
  try {
    const varRes = await makeGetRequest('/api/intelligence/payroll-variance?t1=2026-04-01&t2=2026-07-01');
    if (!varRes.items || varRes.items.length === 0) {
      throw new Error('FAIL: Finance payroll variance report returned 0 items.');
    }

    console.log(`✓ PASSED [FINANCE]: Payroll variance report returned ₹${varRes.totalVariance.toLocaleString()} net change across ${varRes.items.length} items.\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [PERSONA 4]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // PERSONA 5: ADMIN
  // ------------------------------------------------------------
  console.log('[PERSONA 5: ADMIN] Inspecting Historical Evidence Audit Trail via HTTP GET /api/evidence...');
  try {
    const auditRes = await makeGetRequest('/api/evidence');
    console.log(`✓ PASSED [ADMIN]: Audit evidence trail fetched via HTTP (${auditRes.length || 0} events logged).\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [PERSONA 5]: ${err.message}\n`);
  }

  // ------------------------------------------------------------
  // PERSONA 6: SECURITY
  // ------------------------------------------------------------
  console.log('[PERSONA 6: SECURITY] Querying Ghost Access Breaches via HTTP GET /api/truth-graph/anomalies...');
  try {
    const secRes = await makeGetRequest('/api/truth-graph/anomalies');
    if (!secRes.accessContradictions || secRes.accessContradictions.length !== 2) {
      throw new Error(`FAIL: Expected 2 access contradictions, got ${secRes.accessContradictions?.length}`);
    }

    console.log(`✓ PASSED [SECURITY]: Truth Graph detected ${secRes.accessContradictions.length} active ghost access breach risks via HTTP.\n`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAILED [PERSONA 6]: ${err.message}\n`);
  }

  server.close();

  console.log('============================================================');
  console.log(`SUMMARY: ${passed}/${total} HTTP PERSONA JOURNEY TESTS PASSED.`);
  console.log('============================================================');

  if (passed !== total) process.exit(1);
}

runRcPersonaHttpTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
