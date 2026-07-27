# VOLKS HRMS — Deployment, Real PostgreSQL & Infrastructure Engineering (`docs/DEPLOYMENT_GUIDE.md`)

> **Governing Discipline**:
> All deployment architectures, containerization models, and migration systems documented here have been implemented and verified via `migrations/`, `Dockerfile`, `docker-compose.yml`, `lib/migrations.ts`, and `tests/volks_0_6_deployment.test.ts`.
>
> **Strict Classification**: Maximum allowed classification after Phase 6 is **`TESTED`**.

---

## 1. Architecture Transition Matrix (Before vs After Phase 6)

| Architectural Dimension | Phase 1-5 Baseline | Phase 6 Deployment Target |
| :--- | :--- | :--- |
| **Database Engine** | In-memory `@electric-sql/pglite` | Managed PostgreSQL 15+ / Docker Postgres |
| **Connection Strategy** | Direct in-process SQLite/PGlite calls | `DATABASE_URL` adapter & connection pooling |
| **Schema Management** | Monolithic `schema.sql` file load | Versioned sequential migrations (`migrations/`) |
| **Session Persistence** | In-memory `activeSessions` JS object | PostgreSQL-backed `sessions` table |
| **Outbox Worker** | Manual invocation in test code | Background `setInterval` batch polling in `server.ts` |
| **CORS Policy** | Wildcard `Access-Control-Allow-Origin: *` | Environment allowlist (`CORS_ALLOWED_ORIGINS`) |
| **Health Monitoring** | Simple `/health` liveness endpoint | Separate `/health` (Liveness) & `/ready` (DB Readiness) |
| **Containerization** | Un-containerized local process | Multi-stage `Dockerfile` & `docker-compose.yml` |

---

## 2. PostgreSQL & Versioned Migration Architecture

```text
Server Startup (server.ts)
           │
           ▼
Connect to DB Engine (lib/db.ts)
           │
           ▼
Execute Migration Runner (lib/migrations.ts)
           │
           ▼
Query schema_migrations Table
           │
 ┌─────────┴─────────┐
 │                   │
 [Migration Applied] [New Migration Found]
 │                   │
 Skip                BEGIN; Execute SQL; Insert Record; COMMIT;
```

### Versioned Migration Inventory (`migrations/`):
1. **`001_initial_schema.sql`**: Core DDL tables (`persons`, `users`, `engagements`, `changes`, `payroll_runs`...).
2. **`002_bitemporal_indexes.sql`**: Composite bitemporal index `idx_changes_bitemporal` on `employment_changes (engagement_id, valid_from, valid_to)` + performance indexes.
3. **`003_session_storage.sql`**: `sessions` table for persistent PostgreSQL-backed session storage.

---

## 3. Persistent DB Session Management

```sql
CREATE TABLE sessions (
    session_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash   TEXT UNIQUE NOT NULL,
    person_id    UUID NOT NULL REFERENCES persons(person_id),
    org_id       TEXT NOT NULL,
    role         TEXT NOT NULL,
    email        TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ
);
```

### Session Revocation Mechanics:
When an employee is offboarded (`POST /api/offboarding/final-settlement`):
- `server.ts` executes: `UPDATE sessions SET revoked_at = NOW() WHERE person_id = $1;`
- Subsequent request with revoked token returns **`HTTP 401 SESSION_REVOKED`**.
- Survives server restarts because sessions persist in PostgreSQL!

---

## 4. Operational Health & Readiness Endpoints

- **`GET /health` (Liveness)**:
  - Returns `HTTP 200 { "status": "UP", "service": "VOLKS HRMS API" }`.
  - Used by Kubernetes/Docker liveness probes to verify Node process is running.
- **`GET /ready` (Readiness)**:
  - Executes `SELECT 1;` against PostgreSQL.
  - Returns `HTTP 200 { "status": "READY", "database": "HEALTHY" }` if DB connected.
  - Returns `HTTP 503 { "status": "UNAVAILABLE", "database": "DOWN" }` if DB unreachable.

---

## 5. Docker Containerization & Orchestration

### Multi-Stage Dockerfile Strategy
- **Stage 1 (`builder`)**: Installs dependencies, compiles TypeScript source.
- **Stage 2 (`runner`)**: Light-weight Node 20 Alpine image running under non-root security context (`volksuser:1001`).

### Docker Compose Multi-Container Stack (`docker-compose.yml`):
```bash
docker compose up -d --build
```
- Spawns `volks-db` (PostgreSQL 15 Container with persistent volume `volks_postgres_data`).
- Spawns `volks-app` (Node.js API & Web Application Container).
- Health check ensures `volks-app` waits for `volks-db` readiness before executing migrations and starting HTTP server.

---

## 6. Comprehensive Request Trace ("How VOLKS Runs")

```text
User Opens Browser (http://localhost:3000)
                  │
                  ▼
HTTP POST /api/auth/login
                  │
                  ▼
Node.js API Server (server.ts)
                  │
                  ▼
Validate Credentials in PostgreSQL
                  │
                  ▼
Create Session Record in `sessions` Table
                  │
                  ▼
Return Token -> Browser Stores Bearer Token
                  │
                  ▼
User Actions (e.g. Punch Attendance / Apply Leave)
                  │
                  ▼
HTTP Header: Authorization: Bearer <token>
                  │
                  ▼
Validate Token in PostgreSQL `sessions` Table
                  │
                  ▼
Execute Business Service Inside DB Transaction (BEGIN...COMMIT)
                  │
                  ▼
Insert Audit / Outbox Event into `outbox_events`
                  │
                  ▼
Background Worker (`outboxWorker.ts`) Polls via FOR UPDATE SKIP LOCKED
                  │
                  ▼
Return JSON Response -> React State Re-renders
```

---

## 7. Deployment Risk Register

| Risk ID | Severity | Finding | Required Fix | Status |
| :--- | :--- | :--- | :--- | :--- |
| **RISK-DEP-01** | **`HIGH`** | Production TLS/HTTPS certificate termination required | Nginx/Caddy proxy setup | **Documented** |
| **RISK-DEP-02** | **`MEDIUM`** | Managed PostgreSQL connection pool sizing | Configure PgBouncer for > 500 users | **Documented** |

---

### Final Classification: **`TESTED`**
