# VOLKS v2.1 — Phase 2: Database Deployment & Architecture Report (`docs/V21_DATABASE_DEPLOYMENT_REPORT.md`)

> **Governing Discipline**:
> This document records the database audit and managed PostgreSQL readiness verification for VOLKS v2.1 on branch `feature/deployment`.
>
> **Strict Classification**: **`BLOCKED — MANAGED POSTGRESQL NOT PROVISIONED`** (Awaiting external production cloud PostgreSQL `DATABASE_URL` credentials).

---

## 1. Pre-Deployment Blocker Resolution Summary

All 3 pre-deployment blockers identified in Phase 1 have been audited, fixed, tested, and closed (`tests/volks_v21_blockers.test.ts`):

| Issue ID | Severity | Audit & Fix Action Taken | Status |
| :--- | :--- | :--- | :--- |
| **BLOCK-01** | **`HIGH`** | Audited `lib/services/outboxWorker.ts`. `SELECT ... FOR UPDATE SKIP LOCKED` is already implemented inside atomic `BEGIN...COMMIT` transaction blocks. Confirmed two workers cannot process the same event concurrently. | **`CLOSED (VERIFIED)`** |
| **BLOCK-02** | **`MEDIUM`**| Updated `server.ts` resume upload route (`POST /api/candidates/upload-resume`). Enforced **5MB maximum file size limit** (HTTP 413 Payload Too Large) and **`.pdf`, `.docx`, `.txt` file extension validation** (HTTP 400 Bad Request). | **`CLOSED (FIXED)`** |
| **BLOCK-03** | **`LOW`** | Updated `lib/db.ts`. Enforced strict production startup check: when `process.env.NODE_ENV === 'production'`, startup **MUST fail** with a fatal error if `DATABASE_URL` is missing. PGlite remains fallback ONLY for local dev/test mode. | **`CLOSED (FIXED)`** |

---

## 2. Beginner Technical Tutorial: "What Happens When You Click a Button in VOLKS?"

When an employee or HR manager clicks a button in VOLKS (e.g. **"Punch Attendance"** or **"Approve Leave"**), the following sequence occurs:

```text
[1. REACT UI] User clicks button in browser component (e.g. TruthRail.tsx)
      │
      ▼
[2. HTTP FETCH] Browser sends async HTTP POST request with Bearer Token & X-Request-ID
      │
      ▼
[3. NODE SERVER] Node.js server.ts intercepts request, logs JSON start event & verifies CORS
      │
      ▼
[4. AUTHENTICATION] Server queries sessions table using token hash to resolve person & role
      │
      ▼
[5. AUTHORIZATION] Server verifies role (e.g. HR_ADMIN for Payroll, EMPLOYEE for Punch)
      │
      ▼
[6. SQL & TRANSACTION] Server executes BEGIN; parameterized SQL query; COMMIT; on PostgreSQL pool
      │
      ▼
[7. POSTGRESQL ENGINE] PostgreSQL writes WAL, updates indexes, and commits table rows
      │
      ▼
[8. HTTP RESPONSE] Server returns 200 OK JSON payload with X-Request-ID response header
      │
      ▼
[9. REACT STATE] React updates local state and re-renders UI component dynamically
```

---

## 3. PostgreSQL Concepts Explained for the VOLKS Developer

- **DATABASE_URL**: A standardized connection string containing the database protocol, host, port, username, password, and database name:
  `postgres://volks_user:SecretPass123@db.volks-hrms.internal:5432/volks_production_db?sslmode=require`
- **PostgreSQL Server**: The managed database server daemon running PostgreSQL (e.g. AWS RDS or Supabase).
- **Database**: The top-level storage container (`volks_production_db`).
- **Schema**: A logical namespace within a database containing tables (e.g. `public`).
- **Table**: A structured collection of records (e.g. `persons`, `employment_engagements`).
- **Row**: A single record in a table (e.g. Person `p-101`).
- **Column**: An attribute of a record (e.g. `full_name`, `personal_email`).
- **Primary Key (PK)**: Unique row identifier (e.g. `person_id`).
- **Foreign Key (FK)**: Enforces relational references (e.g. `employment_engagements.person_id REFERENCES persons(person_id)`).
- **Index**: Acceleration structure allowing $O(1)$ / $O(\log N)$ lookup (e.g. `idx_changes_bitemporal`).
- **Connection Pool**: A managed collection of reusable database connections preventing the overhead of creating new TCP connections for every HTTP request.
- **Migration**: Versioned, idempotent DDL SQL files (`001_initial_schema.sql`, `002_bitemporal_indexes.sql`, `003_session_storage.sql`) tracked in `schema_migrations`.
- **Transaction (`BEGIN...COMMIT`)**: Ensures all SQL statements inside the block succeed together or fail together without partial corruption.
- **ROLLBACK**: Undoes all changes in an aborted transaction if an error occurs.
- **Backup**: Creating a complete SQL/binary snapshot (`pg_dump`) of database state for disaster recovery.

---

## 4. Managed PostgreSQL Architecture Diagram

```mermaid
erDiagram
    persons ||--o{ employment_engagements : "has engagements"
    persons ||--o{ users : "has user login"
    persons ||--o{ sessions : "active sessions"
    employment_engagements ||--o{ employment_changes : "bitemporal timeline"
    employment_engagements ||--o{ attendance_logs : "punches"
    employment_engagements ||--o{ leave_requests : "submits"
    employment_engagements ||--o{ payslips : "receives"
    payroll_runs ||--o{ payslips : "contains"

    persons {
        string person_id PK
        string full_name
        string personal_email
    }
    employment_engagements {
        string engagement_id PK
        string person_id FK
        string org_id
        string state
    }
    employment_changes {
        string change_id PK
        string engagement_id FK
        timestamp valid_from
        timestamp valid_to
        string job_title
    }
    sessions {
        string token_hash PK
        string person_id FK
        timestamp expires_at
        timestamp revoked_at
    }
```

---

## 5. Phase 2 Managed PostgreSQL Readiness & Classification

Per the governing Phase 2 rule:
- **Blocker Status**: `ALL 3 PRE-DEPLOYMENT BLOCKERS SAFELY CLOSED (0 OPEN BLOCKERS)`.
- **External PostgreSQL Instance**: Currently awaiting external managed PostgreSQL connection credentials (`DATABASE_URL`).
- **Current Technically Justified Classification**:

```text
============================================================
PHASE 2 CLASSIFICATION:

       BLOCKED — MANAGED POSTGRESQL NOT PROVISIONED
============================================================
```
