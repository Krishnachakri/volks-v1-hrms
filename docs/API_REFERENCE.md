# VOLKS HRMS - API Reference

> Classification: PILOT READY  
> Last updated: 2026-07-27 (Phase AUTH complete)  
> Authentication: HttpOnly session cookie (`volks_session`)

---

## Authentication

All protected endpoints require an active session cookie set by `POST /api/auth/login`.

The cookie is **HttpOnly** - it is sent automatically by the browser with every request.
There is no need to set an `Authorization` header manually from the browser.

For server-to-server or test clients, you may alternatively pass:
```
Authorization: Bearer <session_token>
```

The server checks the cookie first, falling back to the Authorization header.

---

## Auth Endpoints

### POST /api/auth/login
**Auth required**: No  
**Rate limited**: Yes (10 attempts per 15-minute window per IP; HTTP 429 with `Retry-After` header)

Request body:
```json
{ "email": "hr@volks.com", "password": "Password123!" }
```

Responses:
| Status | Meaning |
|---|---|
| 200 | Login successful. Sets `volks_session` HttpOnly cookie. Returns user profile. |
| 400 | Missing email or password |
| 401 | Invalid credentials |
| 403 | Account deactivated |
| 429 | Rate limit exceeded. Check `Retry-After` header for wait time. |

Success response body:
```json
{
  "token": "<session_token>",
  "expiresAt": "<ISO timestamp>",
  "user": {
    "userId": "uuid",
    "personId": "uuid",
    "name": "Full Name",
    "email": "hr@volks.com",
    "role": "HR_ADMIN",
    "roles": ["HR_ADMIN"]
  }
}
```

---

### GET /api/auth/me
**Auth required**: Yes (any authenticated role)

Returns the current authenticated user and their person record.

Responses:
| Status | Meaning |
|---|---|
| 200 | Returns `{ authenticated: true, user: {...}, person: {...} }` |
| 401 | No active session or session expired/revoked |

---

### POST /api/auth/logout
**Auth required**: No (safe to call even without session)

Revokes the current session in PostgreSQL and clears the cookie.

Responses:
| Status | Meaning |
|---|---|
| 200 | `{ "status": "LOGGED_OUT" }` |

---

## Health Endpoints

### GET /health
**Auth required**: No  
Returns `{ "status": "UP", "service": "VOLKS HRMS API" }` — HTTP 200

### GET /ready
**Auth required**: No  
Executes `SELECT 1` against PostgreSQL.  
Returns `{ "status": "READY", "database": "HEALTHY" }` — HTTP 200  
Returns `{ "status": "UNAVAILABLE", "database": "DOWN" }` — HTTP 503

---

## People

### GET /api/persons
**Auth required**: Yes  
**Permitted roles**: EMPLOYEE, MANAGER, HR_ADMIN, SYSTEM_ADMIN

Returns the full person directory including employment and user data.

---

## Attendance

### POST /api/attendance/check-in
**Auth required**: Yes  
**Permitted roles**: EMPLOYEE

Body: `{ "personId": "uuid" }`  
**Scope**: Employee can only check in for themselves (server derives identity from session).

### POST /api/attendance/check-out
**Auth required**: Yes  
**Permitted roles**: EMPLOYEE

Body: `{ "personId": "uuid" }`

### POST /api/attendance/regularize
**Auth required**: Yes  
**Permitted roles**: EMPLOYEE

Body: `{ "reason": "System punch failure", "date": "2026-07-27" }`  
Returns: `200 OK`

---

## Leave

### GET /api/leave/balances
**Auth required**: Yes  
**Permitted roles**: EMPLOYEE, MANAGER, HR_ADMIN  
Query: `?personId=<uuid>`

### GET /api/leave/requests
**Auth required**: Yes  
**Permitted roles**: EMPLOYEE (own), MANAGER (team), HR_ADMIN (all)  
Query: `?personId=<uuid>&status=PENDING`

### POST /api/leave/apply
**Auth required**: Yes  
**Permitted roles**: EMPLOYEE

Body:
```json
{
  "personId": "uuid",
  "leaveType": "CASUAL",
  "startDate": "2026-08-01",
  "endDate": "2026-08-02",
  "reason": "Personal"
}
```

Responses: `200 OK`, `400` (insufficient balance), `409` (overlapping request)

### POST /api/leave/approve
**Auth required**: Yes  
**Permitted roles**: MANAGER, HR_ADMIN  
**Scope**: MANAGER must be in the reporting hierarchy of the target employee.

Body: `{ "requestId": "uuid", "decision": "APPROVED" | "REJECTED" }`  
Responses: `200 OK`, `403` (not the reporting manager), `404` (request not found)

---

## Expenses

### POST /api/expenses/claim
**Auth required**: Yes  
**Permitted roles**: EMPLOYEE

Body:
```json
{
  "personId": "uuid",
  "amount": 2500,
  "category": "TRAVEL",
  "description": "Client visit"
}
```

### GET /api/expenses/claims
**Auth required**: Yes  
**Permitted roles**: EMPLOYEE (own), MANAGER (team), FINANCE, HR_ADMIN

### POST /api/expenses/approve
**Auth required**: Yes  
**Permitted roles**: MANAGER, HR_ADMIN

Body: `{ "claimId": "uuid", "decision": "APPROVED" | "REJECTED" }`

### POST /api/expenses/reimburse
**Auth required**: Yes  
**Permitted roles**: FINANCE, HR_ADMIN

Body: `{ "claimId": "uuid" }`

---

## Payroll

### POST /api/payroll/process
**Auth required**: Yes  
**Permitted roles**: HR_ADMIN, FINANCE, SYSTEM_ADMIN

Body: `{ "month": "2026-07" }`  
Responses: `200 OK`, `409` (month already processed)

### POST /api/payroll/lock
**Auth required**: Yes  
**Permitted roles**: HR_ADMIN, FINANCE, SYSTEM_ADMIN

Body: `{ "month": "2026-07" }`  
Responses: `200 OK`, `409` (already locked)

### GET /api/payroll/payslips
**Auth required**: Yes  
**Permitted roles**: EMPLOYEE (own), HR_ADMIN, FINANCE  
Query: `?personId=<uuid>`

---

## Talent / ATS

### GET /api/talent/postings
**Auth required**: Yes  
**Permitted roles**: HR_ADMIN, MANAGER

### POST /api/talent/postings
**Auth required**: Yes  
**Permitted roles**: HR_ADMIN

Body: `{ "title": "...", "department": "...", "employmentType": "ON_ROLL", ... }`

### POST /api/talent/apply
**Auth required**: Yes  
**Permitted roles**: HR_ADMIN (on behalf of candidate)

### POST /api/talent/stage
**Auth required**: Yes  
**Permitted roles**: HR_ADMIN, MANAGER  
**Scope**: MANAGER must be the hiring manager for the requisition.

Body: `{ "candidateId": "uuid", "stage": "SCREENING" | "INTERVIEW" | "SELECTED" | "OFFERED" | "REJECTED" }`

### POST /api/talent/offer
**Auth required**: Yes  
**Permitted roles**: HR_ADMIN

Body: `{ "candidateId": "uuid", "requisitionId": "uuid", "basic": 50000, "hra": 20000, "allowances": 10000, "proposedStartDate": "2026-08-01" }`

### POST /api/talent/hire
**Auth required**: Yes  
**Permitted roles**: HR_ADMIN

Converts an accepted candidate into an employee. Creates person, user, engagement, salary structure, and leave balances atomically.

Body: `{ "candidateId": "uuid", "offerId": "uuid" }`

---

## Lifecycle

### POST /api/lifecycle/promote
**Auth required**: Yes  
**Permitted roles**: HR_ADMIN

### POST /api/lifecycle/transfer
**Auth required**: Yes  
**Permitted roles**: HR_ADMIN

### POST /api/lifecycle/resignation
**Auth required**: Yes  
**Permitted roles**: EMPLOYEE (self), HR_ADMIN

### POST /api/lifecycle/clearance
**Auth required**: Yes  
**Permitted roles**: HR_ADMIN

### POST /api/lifecycle/terminate
**Auth required**: Yes  
**Permitted roles**: HR_ADMIN  

Atomically: sets engagement state to TERMINATED, sets `users.is_active = false`, revokes all active sessions for that person.

Body: `{ "personId": "uuid", "lastWorkingDate": "2026-07-31" }`  
Responses: `200 OK` with `{ accessDisabled: true, sessionsRevoked: true }`

---

## Reports

### GET /api/reports/summary
**Auth required**: Yes  
**Permitted roles**: All authenticated roles  

Returns headcount, pending leave requests, pending approvals, and payroll status for the current user's scope.

Responses: `200 OK`, `401` (session expired or revoked)

---

## Admin

### POST /api/admin/departments
**Auth required**: Yes  
**Permitted roles**: HR_ADMIN, SYSTEM_ADMIN

Body: `{ "name": "Engineering", "code": "ENG" }`

---

## Common Error Codes

| HTTP Status | Error Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing or invalid request field |
| 401 | `UNAUTHENTICATED` | No active session |
| 401 | `SESSION_REVOKED` | Session was revoked (logout or termination) |
| 401 | `SESSION_EXPIRED` | Session has passed its expiry time |
| 401 | `ACCOUNT_DEACTIVATED` | User account is deactivated |
| 403 | `ROLE_FORBIDDEN` | Authenticated role is not permitted for this operation |
| 403 | `MANAGER_SCOPE_VIOLATION` | Manager operating outside their direct report hierarchy |
| 409 | `DUPLICATE_OPERATION` | Operation already completed (e.g. payroll already locked) |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many login attempts - check `Retry-After` header |
| 500 | `INTERNAL_ERROR` | Unexpected server error |