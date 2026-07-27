# VOLKS HRMS — Observability, Telemetry & Operational Diagnostics (`docs/OBSERVABILITY.md`)

> **Governing Discipline**:
> Observability architecture, JSON logging structures, correlation propagation, and secret redaction engines documented here have been implemented and verified via `lib/logger.ts`, `server.ts`, and `tests/volks_0_7_observability.test.ts`.
>
> **Strict Classification**: Maximum allowed classification after Phase 7 is **`TESTED`**.

---

## 1. Three Pillars of Observability

VOLKS HRMS implements three core observability pillars:

```text
Browser Client Request (X-Request-ID: req-abc123)
                      │
                      ▼
 Node.js API Middleware (lib/logger.ts & server.ts)
                      │
   ┌──────────────────┼──────────────────┐
   ▼                  ▼                  ▼
[1. LOGS]        [2. METRICS]       [3. TRACES]
Structured JSON  HTTP Duration &    X-Request-ID Correlation
Events & Errors  DB Latency Stats   Across Services & DB
```

1. **Structured JSON Logs**: Machine-readable JSON records printed to `stdout` containing `timestamp`, `level`, `service`, `requestId`, `method`, `path`, `statusCode`, and `durationMs`.
2. **Metrics & Performance Telemetry**: Request latency (p50/p95/p99), DB query durations, error rates, and DB slow query detection (`DB_SLOW_QUERY_MS = 250ms`).
3. **Correlation & Traces**: `X-Request-ID` propagation across HTTP headers, service handlers, database logs, security events, and outbox workers.

---

## 2. Structured JSON Log Specification

Every log line printed by VOLKS API is formatted as valid JSON:

```json
{
  "timestamp": "2026-07-26T17:24:19.000Z",
  "level": "info",
  "service": "volks-api",
  "environment": "production",
  "requestId": "req-1785000000000-xyz890",
  "method": "POST",
  "path": "/api/attendance/check-in",
  "statusCode": 200,
  "durationMs": 12,
  "message": "[BUSINESS] Employee punched check-in"
}
```

---

## 3. Centralized Secret & PII Redaction Engine

VOLKS logger (`lib/logger.ts`) automatically intercepts and masks sensitive data before JSON formatting:

| Field Name Pattern | Unredacted Value | Redacted Output in Logs |
| :--- | :--- | :--- |
| `password`, `password_hash` | `SecretPassword123` | `"[REDACTED]"` |
| `authorization`, `token` | `Bearer bearer-token-xyz` | `"[REDACTED]"` |
| `national_id`, `aadhaar` | `1234-5678-9012` | `"[REDACTED]"` |
| `bank_account` | `ACC-9081234` | `"[REDACTED]"` |
| `compensation`, `net_salary` | `800000.00` | `"[REDACTED]"` |

---

## 4. Security & Business Operational Event Stream

VOLKS logs explicit security and business events:

- **Security Events**:
  - `LOGIN_SUCCESS`: Authenticated user session created.
  - `LOGIN_FAILURE`: Invalid credentials attempt (HTTP 401).
  - `SESSION_REVOKED`: Attempted access using revoked token (HTTP 401).
  - `TENANT_SPOOF_ATTEMPT`: Rejected header spoofing (HTTP 403).
  - `ROLE_ESCALATION_ATTEMPT`: Rejected unauthorized role elevation (HTTP 403).
  - `PAYROLL_DUPLICATE_ATTEMPT`: Duplicate payroll close attempt (HTTP 409).
- **Business Operational Events**:
  - `ATTENDANCE_CHECKIN` / `ATTENDANCE_CHECKOUT`: Employee time punches.
  - `REGULARIZATION_SUBMITTED`: Attendance correction requested.
  - `EXPENSE_SUBMITTED`: Reimbursement claim filed.
  - `PAYROLL_LOCKED`: Monthly payroll locked.
  - `EMPLOYEE_OFFBOARDED`: Employee terminated & sessions revoked.

---

## 5. Alert Model & Severity Classification

| Alert Severity | Operational Condition | Required Action | Target Response SLA |
| :--- | :--- | :--- | :--- |
| **`P1 - CRITICAL`** | `/ready` endpoint returns HTTP 503 (Database Down) | On-call engineer alerted immediately; initiate failover | $\le 15\text{ mins}$ |
| **`P2 - HIGH`** | 5xx Error rate $> 5\%$ or `DB_SLOW_QUERY` events $> 10/\text{min}$ | Inspect DB connection pool, slow queries & logs | $\le 1\text{ hour}$ |
| **`P3 - MEDIUM`** | Authentication failure rate spike ($> 20/\text{min}$) | Check for potential brute-force attack or client misconfig | $\le 4\text{ hours}$ |

---

## 6. Real World Debugging Walkthrough

### Scenario: Employee reports "My attendance punch failed"
1. **Identify Request ID**: Search browser network log or client alert for `X-Request-ID: req-1785000000000-xyz890`.
2. **Filter Log Stream**:
   ```bash
   cat production.log | grep "req-1785000000000-xyz890"
   ```
3. **Trace Execution Path**:
   - `HTTP POST /api/attendance/check-in` logged duration `45ms`.
   - Resulting status code `200 OK` or `500 Internal Error` clearly pinpointed with exact timestamp and error message.

---

## 7. Observability Risk Register

| Risk ID | Severity | Finding | Required Fix | Status |
| :--- | :--- | :--- | :--- | :--- |
| **RISK-OBS-01** | **`MEDIUM`** | Prometheus/OpenTelemetry exporter endpoint missing | Expose `/metrics` Prometheus scraper endpoint | Phase 8 |
| **RISK-OBS-02** | **`LOW`** | Log volume explosion under high traffic | Configure log sampling & rate limiting | Phase 8 |

---

### Final Classification: **`TESTED`**
