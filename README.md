# VOLKS HRMS

**VOLKS** is a production-oriented Human Resource Management System built on a bitemporal PostgreSQL data engine.
It models valid-time and system-time separately so that every employment event — promotions, transfers, terminations — is historically auditable with point-in-time accuracy.

---

## Architecture Overview

```
+-------------------------------------------------------------+
|                     VOLKS HRMS Stack                       |
+------------------------+------------------------------------+
|  Frontend              |  Backend (API)                     |
|  React 19 + Vite       |  Node.js + TypeScript (server.ts)  |
|  Port 3000             |  Port 4000                         |
+------------------------+------------------------------------+
|                  PostgreSQL 15+                            |
|  Bitemporal schema, versioned migrations, sessions         |
+------------------------------------------------------------+
```

### Key Design Principles
- **Bitemporal history**: every employment change stores `valid_from/valid_to` (business time) and `created_at` (system time)
- **Zero-trust client**: all auth decisions happen server-side; the browser is never authoritative
- **HttpOnly cookies**: session tokens are never accessible to JavaScript
- **Server-side RBAC**: roles are derived from the authenticated session, never from request headers
- **Outbox pattern**: all business events are durably written to `outbox_events` before being processed

### Modules
| # | Module | Description |
|---|---|---|
| 1 | **Home** | Role-aware operational dashboard |
| 2 | **People** | Employee directory + 360 degree profile |
| 3 | **Time** | Monthly attendance calendar |
| 4 | **Leave** | Apply, approve, balance tracking |
| 5 | **Pay** | Payroll close, lock, payslip generation |
| 6 | **Expenses** | Claims and reimbursements |
| 7 | **Talent** | ATS pipeline, offers, hiring |
| 8 | **Lifecycle** | Promotions, transfers, offboarding |
| 9 | **Admin** | Department and shift configuration |
| 10 | **Integrity** | Bitemporal time machine + audit |

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20+ |
| npm | 10+ |
| PostgreSQL | 15+ |
| Git | 2.x |

> Optional: Docker + Docker Compose (for containerised PostgreSQL)

---

## Installation

```bash
git clone https://github.com/Krishnachakri/volks-v1-hrms.git
cd volks-v1-hrms
npm install
```

---

## Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://volks:volks@localhost:5432/volks_hrms
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4000
```

> **Never commit `.env` to version control.** It is listed in `.gitignore`.

---

## PostgreSQL Setup

### Option A - Docker (recommended for local development)

```bash
docker compose up -d volks-db
```

This starts a PostgreSQL 15 container with a persistent volume at `volks_postgres_data`.

### Option B - Local PostgreSQL

```sql
CREATE USER volks WITH PASSWORD 'volks';
CREATE DATABASE volks_hrms OWNER volks;
```

---

## Migrations and Seeding

Migrations run **automatically on server startup** via `lib/migrations.ts`.
The seed script runs automatically in `NODE_ENV !== production`.

To run seed manually:

```bash
npm run seed
```

> **Development/UAT seed accounts are created by `scripts/seed.ts`.**
> These accounts exist **ONLY** in non-production environments.
> They must never be seeded into any environment containing real employee data.
> See the UAT Test Plan for login details: [docs/UAT_TEST_PLAN.md](docs/UAT_TEST_PLAN.md)

---

## Starting the Application

### Backend API Server (port 4000)

```bash
npx tsx server.ts
```

Expected output:
```
Seed database completed successfully with 5 DEVELOPMENT UAT accounts.
{"message":"VOLKS API Server listening on http://localhost:4000"}
```

### Frontend Dev Server (port 3000)

Open a second terminal:

```bash
npx vite
```

Expected output:
```
VITE v6.x ready in Xms
Local: http://localhost:3000/
```

---

## Accessing the Application

Open your browser to: **http://localhost:3000**

You will see the VOLKS Login screen. The login page contains Quick-Fill buttons for each UAT role.

> UAT login credentials are documented in [docs/UAT_TEST_PLAN.md](docs/UAT_TEST_PLAN.md) and are **DEVELOPMENT/UAT ONLY**.
> Do not use these in any environment containing real employee data.

---

## Running Tests

### Playwright E2E tests (browser-based)

Requires both backend and frontend to be running:

```bash
npx playwright test
```

### TypeScript unit/integration tests

```bash
npm run test:v05        # Pilot shadow month
npm run test:v04a       # Security boundary
npm run test:v04        # Production hardening
npm run test:temporal   # Temporal integrity
npm run test:concurrency # Concurrency and outbox
```

### Build verification

```bash
npm run build
```

---

## UAT

The testing team should follow: [docs/UAT_TEST_PLAN.md](docs/UAT_TEST_PLAN.md)

Covers Employee, Manager, HR Admin, Finance, and System Admin workflows, plus cross-role negative tests and defect severity format (P0-P3).

---

## Troubleshooting

| Problem | Resolution |
|---|---|
| `DATABASE_URL connection refused` | Ensure PostgreSQL is running: `docker compose up -d volks-db` |
| Port 3000 or 4000 already in use | Kill existing processes: use Task Manager or `netstat -ano` |
| Login returns 401 after server restart | Sessions are PostgreSQL-backed - log in again after restart |
| Build fails with TypeScript errors | Run `npx tsc --noEmit` to inspect errors |
| Playwright tests fail | Ensure both API server and Vite are running before test run |
| 429 Too Many Requests on login | Rate limit window is 15 minutes per IP by default |

---

## Health Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /health` | API liveness check |
| `GET /ready` | PostgreSQL connectivity check |

---

## Documentation Index

| Document | Description |
|---|---|
| [docs/UAT_TEST_PLAN.md](docs/UAT_TEST_PLAN.md) | Complete UAT test plan for the testing team |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | All REST endpoints with auth requirements |
| [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) | Auth architecture, RBAC, and threat model |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Full schema with all tables and columns |
| [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) | Docker, TLS, migrations, production setup |
| [docs/HRMS_FEATURE_MATRIX.md](docs/HRMS_FEATURE_MATRIX.md) | Every feature to API to DB table mapping |
| [docs/VOLKS_ENGINEERING_HANDBOOK.md](docs/VOLKS_ENGINEERING_HANDBOOK.md) | Architecture decisions and patterns |
| [docs/OPERATIONS_RUNBOOK.md](docs/OPERATIONS_RUNBOOK.md) | Day-2 operational procedures |
| [docs/DISASTER_RECOVERY.md](docs/DISASTER_RECOVERY.md) | Backup and restore procedures |
| [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md) | Logging, metrics, health endpoints |

---

**Repository**: https://github.com/Krishnachakri/volks-v1-hrms