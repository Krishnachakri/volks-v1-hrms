# VOLKS HRMS — Master Operations Runbook (`docs/OPERATIONS_RUNBOOK.md`)

> **Governing Discipline**:
> Executable runbooks for system startup, shutdown, health monitoring, session revocation, database backup/restore, migration execution, and incident triage.
>
> **Strict Classification**: Maximum allowed classification after Phase 10 is **`PILOT READY — NOT PRODUCTION-PROVEN`**.

---

## 1. System Operations & Lifecycle

### Starting VOLKS Locally
```bash
# Terminal 1: API Server
npm run server

# Terminal 2: Vite Frontend Dev Server
npm run dev
```

### Starting Containerized Stack (Production Deployment)
```bash
docker-compose up -d --build
```

### Checking Container & Service Status
```bash
docker-compose ps
curl http://localhost:4000/health
curl http://localhost:4000/ready
```

---

## 2. Emergency Operational Runbooks

### Runbook 01: Emergency Session Token Revocation (Offboarding Security)
When an employee is offboarded, execute immediate session revocation via HTTP API or SQL:
```sql
-- Immediate SQL Revocation
UPDATE sessions SET revoked_at = NOW() WHERE person_id = 'p-101';
UPDATE users SET is_active = false WHERE person_id = 'p-101';
```
Or trigger API: `POST /api/offboarding/final-settlement` `{ "personId": "p-101" }`.

### Runbook 02: Investigating HTTP 500 / Service Failures via Request ID
1. Obtain `X-Request-ID` from browser Network tab or error response payload (e.g. `req-1785000000000-abc`).
2. Search machine-readable JSON log stream:
```bash
cat server.log | grep "req-1785000000000-abc"
```
3. Inspect `error` key and `durationMs` timing metrics to locate offending operation.

### Runbook 03: Disaster Recovery Backup Export & Database Restoration
```bash
# Automated Disaster Recovery Drill Verification
npx tsx tests/volks_0_5_data_survival.test.ts

# Manual Database Dump (Production PostgreSQL)
pg_dump -U volksuser -d volks_db > volks_backup_$(date +%Y%m%d_%H%M%S).sql

# Manual Database Restore
psql -U volksuser -d volks_db < volks_backup_20260726.sql
```

---

### Final Classification: **`PILOT READY — NOT PRODUCTION-PROVEN`**
