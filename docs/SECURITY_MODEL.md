# VOLKS HRMS — Production Security Model & Boundary Architecture (`docs/SECURITY_MODEL.md`)

> **Governing Discipline**:
> Security boundaries and access controls documented here reflect server-side enforcement in `server.ts` and automated verification via `tests/volks_0_4a_security_boundary.test.ts`.
>
> **Strict Classification**: Maximum allowed classification after Phase 4 is **`TESTED`**.

---

## 1. Executive Summary & Security Philosophy

VOLKS HRMS enforces a **Zero-Trust Client** security model:
1. **The Client (Browser) is Never Authoritative**: User identity, role, tenant scope, and permissions are determined exclusively by validated server-side session principal tokens.
2. **Server-Enforced Guardrails**: UI hiding or client-side conditional rendering is treated as cosmetic UX; all security decisions occur strictly within backend API handlers (`server.ts`).
3. **Defense in Depth**: Multi-layer protection spanning network CORS headers, token authentication, role-based authorization, tenant predicates, parameterized SQL execution, and audit logging.

---

## 2. Authentication & Session Lifecycle

```text
       [Client Login Request]
                 │
                 ▼
       POST /api/auth/login
                 │
                 ▼
   Verify Credentials in PostgreSQL
                 │
                 ▼
 Generate Session Token & Store in activeSessions Map
                 │
                 ▼
Return Session Token (Expires in 1 Hour)
                 │
                 ▼
Client Attaches Header: Authorization: Bearer <token>
                 │
                 ▼
Server Validates Token Active & Not Expired
```

### 2.1 Token Specification & Session Management
- **Token Format**: Opaque server-generated session tokens (`bearer-token-<timestamp>-<hash>`).
- **Session Duration**: 1 Hour (3,600,000 ms).
- **Session Revocation**: Executing offboarding settlement (`POST /api/offboarding/final-settlement`) immediately purges all active session tokens associated with the employee's `personId` from the active session registry. Any subsequent requests with revoked tokens return **`HTTP 401 SESSION_REVOKED`**.
- **Session Persistence Risk**: Active sessions are currently stored in Node.js process memory (`activeSessions`). Server restarts clear active sessions. Redis or database-backed session storage is required for multi-instance production deployment (`RISK-SEC-01`).

---

## 3. Server-Side Role-Based Access Control (RBAC)

VOLKS HRMS implements strict server-side role validation:

| Persona Role | Permitted Actions | Restricted Actions | Enforcement Point |
| :--- | :--- | :--- | :--- |
| **`EMPLOYEE`** | View own profile, punch attendance, apply leave, submit expense claims | Execute payroll runs, modify department setups, offboard employees | `server.ts` (`session.role !== 'EMPLOYEE'`) |
| **`MANAGER`** | Approve team leave requests, view team attendance, review team expenses | Execute company payroll, modify global system settings | `server.ts` RBAC check |
| **`HR_ADMIN`** | Execute monthly payroll close, department management, employee offboarding, full system access | N/A | `server.ts` (`role === 'HR_ADMIN'`) |

### Role Escalation Defense Test (`tests/volks_0_4a_security_boundary.test.ts`)
- **Attack Scenario**: An employee sends a request to close payroll (`POST /api/payroll/close-month`) while injecting a forged header `x-user-role: HR_ADMIN`.
- **Server Defense**: Server ignores client-supplied headers and evaluates the authenticated session token's principal role (`EMPLOYEE`).
- **Result**: Request rejected with **`HTTP 403 ROLE_ESCALATION_FORBIDDEN`**.

---

## 4. Multi-Tenant Isolation & Anti-Spoofing Architecture

### Tenant Context Authority Rule
The organization identity (`orgId`) of a request is strictly resolved from the authenticated server-side session principal.

### Cross-Tenant Header Spoofing Test (`tests/volks_0_4a_security_boundary.test.ts`)
- **Attack Scenario**: An authenticated user belonging to `ORG-1001` sends a request with header `x-org-id: ORG-OTHER-CORP` to access another tenant's data.
- **Server Defense**: Server compares the client header `x-org-id` against `session.orgId`.
- **Result**: Discrepancy detected $\to$ Rejected with **`HTTP 403 TENANT_SPOOFING_FORBIDDEN`**.

---

## 5. OWASP Security Safeguards & Data Protection

### 5.1 SQL Injection Prevention
- 100% of database queries executed in `server.ts` and service modules use PostgreSQL parameterized inputs (`$1, $2, $3...`).
- Zero string interpolation or concatenation is used for dynamic SQL query assembly.

### 5.2 Password Hashing & Secret Storage
- Password hashes in the database use PBKDF2/Bcrypt hash structures (`users.password_hash`).
- Raw plain-text passwords are never stored in database tables or emitted in logs.

### 5.3 CORS & Network Security
- **Current Development Setting**: `Access-Control-Allow-Origin: *` in `server.ts`.
- **Production Hardening Requirement**: Restrict allowed origins to specific trusted domain origins in production deployment (`RISK-SEC-02`).

---

## 6. Security Risk Register

| Risk ID | Severity | Threat / Finding | Impact | Mitigation Status | Target Phase |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RISK-SEC-01** | **`HIGH`** | In-memory session store lost on process restart | Users logged out during deployment | **Identified** (Redis/DB store needed) | Phase 5 |
| **RISK-SEC-02** | **`MEDIUM`** | Wildcard CORS `Access-Control-Allow-Origin: *` | Cross-origin request vulnerability | **Identified** (Restrict origins) | Phase 6 |
| **RISK-SEC-03** | **`LOW`** | Rate limiting / throttling missing on login route | Potential brute-force attack | **Identified** (Rate limiter needed) | Phase 4 |

---

## 7. Verification & Security Test Suite

All security boundary controls are automatically verified by `tests/volks_0_4a_security_boundary.test.ts`:

- [x] Cross-tenant header spoofing rejected (**HTTP 403**)
- [x] Role escalation via forged headers rejected (**HTTP 403**)
- [x] Expired session tokens rejected (**HTTP 401**)
- [x] Offboarded employee sessions revoked immediately (**HTTP 401**)
- [x] Duplicate payroll run attempts rejected (**HTTP 409**)

---

### Final Classification: **`TESTED`**
