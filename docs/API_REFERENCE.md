# VOLKS HRMS — Master API Reference Map (`docs/API_REFERENCE.md`)

> **Governing Discipline**:
> This catalog reflects the verified HTTP REST endpoints exposed by Node.js API server (`server.ts`).
>
> **Strict Classification**: Maximum allowed classification after Phase 10 is **`PILOT READY — NOT PRODUCTION-PROVEN`**.

---

## HTTP Endpoints Catalog

### 1. `GET /health` — Operational Liveness Check
- **Role Required**: Public (No Auth)
- **Response Status**: `200 OK`
- **Response Payload**: `{ "status": "UP", "service": "VOLKS HRMS API", "requestId": "req-xxx" }`

### 2. `GET /ready` — Database Readiness Check
- **Role Required**: Public (No Auth)
- **Response Status**: `200 OK` (DB Healthy) / `503 Service Unavailable` (DB Down)
- **Database Effect**: Executes `SELECT 1;`. Triggers `DB_SLOW_QUERY` warning if duration $> 250\text{ms}$.

### 3. `POST /api/auth/login` — User Authentication & Session Creation
- **Role Required**: Public
- **Request Body**: `{ "email": "employee@volks.com" }`
- **Validation**: Email must exist in `users` table and `is_active = true`.
- **Database Effect**: Inserts active session record into `sessions` table.
- **Response Status**: `200 OK` (Token returned), `401 Unauthorized` (Disabled/Inactive user).

### 4. `GET /api/persons` — Person Directory List
- **Role Required**: Authenticated User (`EMPLOYEE`, `MANAGER`, `HR_ADMIN`)
- **Response Status**: `200 OK`
- **Database Effect**: Reads `persons` table.

### 5. `POST /api/attendance/check-in` & `/check-out` — Attendance Time Punches
- **Role Required**: Authenticated User
- **Response Status**: `200 OK`
- **Database Effect**: Inserts attendance punch log. Emits `ATTENDANCE_CHECKIN` / `ATTENDANCE_CHECKOUT` events.

### 6. `POST /api/attendance/regularize` — Attendance Regularization Request
- **Role Required**: `EMPLOYEE`
- **Request Body**: `{ "reason": "System punch failure", "date": "2026-07-26" }`
- **Response Status**: `200 OK`

### 7. `POST /api/expenses/claim` — Expense Reimbursement Submission
- **Role Required**: `EMPLOYEE`
- **Request Body**: `{ "personId": "p-101", "amount": 2500, "category": "TRAVEL" }`
- **Response Status**: `200 OK`

### 8. `POST /api/payroll/close-month` — Monthly Payroll Close & Locking
- **Role Required**: `HR_ADMIN`
- **Request Body**: `{ "month": "2026-07" }`
- **Validation**: Rejects request with `409 Conflict` if payroll for requested month is already locked.
- **Database Effect**: Inserts `payroll_runs` record with `status = 'LOCKED'`. Emits `PAYROLL_LOCKED` event.
- **Response Status**: `200 OK` (Month closed), `409 Conflict` (Already locked).

### 9. `POST /api/offboarding/final-settlement` — Employee Termination & Session Revocation
- **Role Required**: `HR_ADMIN`
- **Request Body**: `{ "personId": "p-101" }`
- **Database Effect**: Sets `employment_engagements.state = 'TERMINATED'`, `users.is_active = false`, and revokes all active sessions in `sessions` table (`revoked_at = NOW()`). Emits `EMPLOYEE_OFFBOARDED` event.
- **Response Status**: `200 OK` (`accessDisabled: true`, `sessionsRevoked: true`).

### 10. `GET /api/reports/summary` — Executive Headcount Summary Report
- **Role Required**: `EMPLOYEE`, `MANAGER`, `HR_ADMIN`
- **Validation**: Rejects revoked session tokens with `401 Unauthorized` (`SESSION_REVOKED`).
- **Response Status**: `200 OK`, `401 Unauthorized` (Session revoked).

---

### Final Classification: **`PILOT READY — NOT PRODUCTION-PROVEN`**
