# VOLKS HRMS — Security Model & Authentication Architecture

> Classification: TESTED  
> Last updated: 2026-07-27 (Phase AUTH complete)

---

## 1. Security Philosophy

VOLKS HRMS enforces a **Zero-Trust Client** model:

1. **The browser is never authoritative.** Identity, role, scope, and permissions are determined exclusively by the validated server-side session.
2. **Security decisions live in the server.** UI hiding and client-side conditional rendering are cosmetic UX only. Every operation is re-validated on the backend.
3. **Defence in depth.** Multiple independent layers: CORS origin validation, HttpOnly cookie transport, hashed token lookup, user-active check, role-based access, scope enforcement, parameterised SQL, structured audit logging.

---

## 2. Authentication Flow (Current Real Architecture)

```
Browser                           API Server (server.ts)          PostgreSQL
  |                                       |                            |
  |--- POST /api/auth/login ------------->|                            |
  |    { email, password }               |                            |
  |                                       |--- SELECT user WHERE ----->|
  |                                       |    email = $1              |
  |                                       |<-- user row + password_hash|
  |                                       |                            |
  |                                   PBKDF2-SHA256 verify            |
  |                                   (600,000 iter, constant-time)   |
  |                                       |                            |
  |                                       |--- INSERT INTO sessions -->|
  |                                       |    (token_hash, person_id, |
  |                                       |     role, expires_at)      |
  |                                       |                            |
  |<-- Set-Cookie: volks_session=TOKEN ---|                            |
  |    HttpOnly; SameSite=Lax; Path=/    |                            |
  |                                       |                            |
  |--- GET /api/auth/me ----------------->|                            |
  |    Cookie: volks_session=TOKEN       |--- SELECT FROM sessions -->|
  |                                       |    WHERE token_hash=$1     |
  |                                       |    AND revoked_at IS NULL  |
  |                                       |    AND expires_at > NOW()  |
  |                                       |<-- session row             |
  |                                       |                            |
  |                                       |--- SELECT FROM users ------>|
  |                                       |    WHERE person_id=$1      |
  |                                       |    AND is_active = true    |
  |                                       |<-- user row                |
  |<-- 200 { user, person } -------------|                            |
```

Every subsequent authenticated request repeats the session lookup and `is_active` check.

---

## 3. Password Security

| Property | Implementation |
|---|---|
| Algorithm | PBKDF2-SHA256 |
| Iterations | 600,000 (OWASP 2023 recommendation) |
| Salt | 16-byte cryptographically random (`crypto.randomBytes(16)`) |
| Stored format | `pbkdf2:sha256:600000$<hex_salt>$<hex_hash>` |
| Comparison | `crypto.timingSafeEqual` — constant-time, no timing oracle |
| Plain text | Never stored, never logged |

Implementation: `lib/auth.ts` — `hashPassword()` and `verifyPassword()`.

---

## 4. Session Management

| Property | Value |
|---|---|
| Token entropy | 32 bytes (`crypto.randomBytes(32).toString('hex')`) = 256 bits |
| Token storage (server) | Hashed in PostgreSQL `sessions` table |
| Token transport | HttpOnly cookie `volks_session` |
| Cookie flags | `HttpOnly; SameSite=Lax; Path=/` + `Secure` when HTTPS |
| Session duration | 1 hour (`expires_at = NOW() + 3600s`) |
| Session storage | PostgreSQL-backed — survives server restarts |

### Session lookup on every request

```sql
SELECT * FROM sessions
WHERE token_hash = $1
  AND revoked_at IS NULL
  AND expires_at > NOW();
```

Then:
```sql
SELECT is_active FROM users WHERE person_id = $1;
```

If `is_active = false`, request is rejected with `401 ACCOUNT_DEACTIVATED`.

---

## 5. Session Revocation

| Event | Action |
|---|---|
| User logout | `UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1` |
| Employee termination | `UPDATE sessions SET revoked_at = NOW() WHERE person_id = $1` (all sessions) |
| Account deactivation | `users.is_active = false` — checked on every request |

Subsequent requests with a revoked token return `401 SESSION_REVOKED`.

---

## 6. Server-Side RBAC

Roles are read from the authenticated PostgreSQL session row — never from request headers, query parameters, or body fields.

```typescript
// req.auth is populated by resolveAuthContext(db, token)
req.auth = {
  userId: string,
  personId: string,
  email: string,
  roles: string[],   // e.g. ['HR_ADMIN']
  orgId: string,
}
```

### Role Capabilities

| Role | Core Permissions |
|---|---|
| `EMPLOYEE` | Own profile, own attendance/leave/expenses, own payslip |
| `MANAGER` | Team visibility, leave/expense approval for direct reports only |
| `HR_ADMIN` | All people operations, payroll close, termination |
| `FINANCE` | Expense reimbursement, payroll finance operations |
| `SYSTEM_ADMIN` | System configuration, all admin controls |

### Manager Scope Enforcement

Having role `MANAGER` is not sufficient for operations on a specific employee. The API also verifies:

```sql
SELECT 1 FROM employment_changes ec
JOIN employment_engagements ee ON ee.engagement_id = ec.engagement_id
WHERE ee.person_id = $targetPersonId
  AND ec.manager_id = $managerPersonId
  AND ee.state IN ('ACTIVE', 'PROBATION', 'NOTICE_PERIOD');
```

MANAGER A attempting to act on MANAGER B's report receives `403 MANAGER_SCOPE_VIOLATION`.

---

## 7. CORS Policy

| Environment | Behaviour |
|---|---|
| Development | Allows `http://localhost:3000` and `http://localhost:4000` by default |
| Production | Requires `CORS_ALLOWED_ORIGINS` env var set to real frontend domain |
| Credentials | `Access-Control-Allow-Credentials: true` is set **only** when the request origin matches the allowed list |
| Wildcard | **Never used.** Wildcard origin is incompatible with credentialed cookie requests |
| Unknown origins | No CORS headers set — browser will block the response |

Configured in `server.ts` via `resolveCorsOrigin()`.

---

## 8. CSRF Considerations

VOLKS uses `SameSite=Lax` cookies. This prevents the most common CSRF attack vector (cross-site form POST).

Remaining considerations for production:
- `SameSite=Strict` would be stronger but breaks some OAuth redirect flows
- A CSRF token header can be added if the threat model requires it
- State-changing endpoints currently require `POST` (not `GET`), which limits CSRF exposure

---

## 9. Additional Security Controls

| Control | Implementation |
|---|---|
| SQL injection | 100% parameterised queries — zero string interpolation |
| Security headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` |
| Login rate limiting | 10 attempts per 15-minute window per IP, returns `429` with `Retry-After` header, sliding window resets — no permanent lockout |
| Proxy IP extraction | Opt-in via `TRUSTED_PROXY=true` env var |
| Sensitive data logging | Passwords never logged; tokens never logged |

---

## 10. Known Risks & Production Requirements

| Risk ID | Severity | Finding | Required Before Production |
|---|---|---|---|
| RISK-SEC-01 | HIGH | No TLS — `Secure` cookie flag requires HTTPS | TLS termination via nginx/Caddy reverse proxy |
| RISK-SEC-02 | HIGH | No forgot-password/reset flow | Implement secure password reset before onboarding real users |
| RISK-SEC-03 | MEDIUM | Rate limiter is in-process — resets on server restart | Redis-backed rate limiter for multi-instance or restart resilience |
| RISK-SEC-04 | MEDIUM | No email/MFA second factor | Acceptable for internal HRMS, evaluate for admin accounts |
| RISK-SEC-05 | LOW | Audit log is structured JSON to stdout — no SIEM integration | Connect to log aggregator in production |

---

## 11. Automated Security Tests

`tests/volks_auth_module_e2e.spec.ts` — 9/9 passing:
- Valid login sets session cookie
- Invalid password returns 401
- GET /api/auth/me with valid session returns user profile
- GET /api/auth/me without session returns 401
- Logout revokes session
- Protected endpoint without session returns 401
- Role-restricted endpoint with wrong role returns 403
- Terminated employee session is revoked

`tests/volks_0_4a_security_boundary.test.ts`:
- Role escalation via forged headers rejected (403)
- Expired session tokens rejected (401)
- Payroll duplicate run rejected (409)