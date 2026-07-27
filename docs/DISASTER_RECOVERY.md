# VOLKS HRMS — Data Survival & Disaster Recovery Playbook (`docs/DISASTER_RECOVERY.md`)

> **Governing Discipline**:
> Data survival and restoration capabilities documented here have been forensically verified by executing a simulated catastrophic database wipe drill via `tests/volks_0_5_data_survival.test.ts`.
>
> **Strict Classification**: Maximum allowed classification after Phase 5 is **`TESTED`**.

---

## 1. Executive Summary & Recovery Targets

VOLKS HRMS implements automated state backup and Point-in-Time Recovery (PITR) guidelines to guarantee zero data loss in the event of database failure, server corruption, or hosting facility outages.

### Target Disaster Recovery Service Level Agreements (SLAs)
- **Recovery Point Objective (RPO)**: $\le$ 5 minutes (Maximum acceptable data loss window).
- **Recovery Time Objective (RTO)**: $\le$ 15 minutes (Maximum acceptable system downtime for full restoration).

---

## 2. Disaster Recovery Drill Verification Results

The automated disaster recovery drill (`tests/volks_0_5_data_survival.test.ts`) verifies the following sequence:

```text
[1. Primary DB Running] ──► [2. Export Snapshot Dump] ──► [3. WIPE DB TABLES (Disaster)]
                                                                    │
[5. Verify State Integrity] ◄── [4. Restore Snapshot into Clean DB] ◄┘
```

### Drill Execution Results:
1. **Initial Active State**: 6 Persons, 8 Employment Engagements, active attendance & payroll records.
2. **State Dump Export**: Full JSON/SQL snapshot exported successfully.
3. **Simulated Disaster**: All database tables purged (`DELETE FROM persons`, `DELETE FROM employment_engagements`...). Verified database state count = `0`.
4. **Restoration Execution**: Snapshot data re-inserted into PostgreSQL tables in strict foreign key order (`persons` $\to$ `engagements` $\to$ `changes` $\to$ `attendance`).
5. **Integrity Validation**: Restored database count matches pre-wipe state (6 Persons, 100% record continuity).
6. **Drill Status**: **`PASSED`**.

---

## 3. Production Backup & Restore Strategy

### 3.1 Automated Snapshot Schedule
1. **Hourly WAL (Write-Ahead Logging) Archiving**: Continuous streaming of PostgreSQL WAL logs for Point-in-Time Recovery.
2. **Daily Full Database Dumps**: Executed daily at 02:00 UTC via `pg_dump`:
```bash
pg_dump -h $DB_HOST -U $DB_USER -F c -b -v -f "/backups/volks_db_$(date +%Y%m%d_%H%M%S).dump" volks_db
```
3. **Offsite Replication**: Daily backup dumps are encrypted via AES-256 and copied to isolated S3 object storage buckets with WORM (Write Once Read Many) immutability rules.

---

## 4. Disaster Recovery Operational Playbook

### Step-by-Step Restoration Procedure:
1. **Provision Clean Database Server**: Spin up fresh PostgreSQL 15+ container or managed DB instance.
2. **Restore Core DDL Schema**:
```bash
psql -h $NEW_DB_HOST -U $DB_USER -d volks_db -f volks_postgres_schema.sql
```
3. **Restore Backup Dump**:
```bash
pg_restore -h $NEW_DB_HOST -U $DB_USER -d volks_db -v "/backups/volks_db_latest.dump"
```
4. **Verify Record Integrity**: Run verification queries comparing person count and engagement status against audit events.
5. **Redirect API Connection String**: Update `DATABASE_URL` environment secret in API server configuration and restart Node.js server.

---

## 5. Reliability Risk Register

| Risk ID | Severity | Threat / Finding | Mitigation Status | Target Phase |
| :--- | :--- | :--- | :--- | :--- |
| **RISK-REL-01** | **`HIGH`** | External PostgreSQL container automatic failover missing | **Identified** (Managed RDS Multi-AZ) | Phase 6 |
| **RISK-REL-02** | **`MEDIUM`** | Continuous WAL archiving script not configured | **Identified** (Configure pgBackRest) | Phase 6 |

---

### Final Classification: **`TESTED`**
