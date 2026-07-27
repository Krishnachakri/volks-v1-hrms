import crypto from 'crypto';

export interface AuthContext {
  userId: string;
  personId: string;
  email: string;
  roles: string[];
  orgId: string;
}

/**
 * OWASP 2026 Recommended Password Hashing
 * Algorithm: PBKDF2-HMAC-SHA256 with 600,000 iterations and 16-byte random salt.
 * Hash string format: pbkdf2:sha256:600000$<salt_hex>$<hash_hex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 600000;
  const keylen = 32;
  const digest = 'sha256';
  const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest);
  return `pbkdf2:${digest}:${iterations}$${salt}$${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!storedHash || !password) return false;
    
    // Check versioned hash format: pbkdf2:sha256:600000$salt$hash
    const parts = storedHash.split('$');
    if (parts.length !== 3) {
      // Fallback for unhashed legacy records if any
      return storedHash === password;
    }

    const [header, salt, expectedHashHex] = parts;
    const headerParts = header.split(':');
    if (headerParts[0] !== 'pbkdf2') return false;
    
    const digest = headerParts[1] || 'sha256';
    const iterations = parseInt(headerParts[2] || '600000', 10);

    const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 32, digest);
    const expectedBuffer = Buffer.from(expectedHashHex, 'hex');

    if (derivedKey.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(derivedKey, expectedBuffer);
  } catch (err) {
    return false;
  }
}

/**
 * Extracts and parses cookie values from HTTP req headers
 */
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      cookies[name] = decodeURIComponent(val);
    }
  });
  return cookies;
}

/**
 * Extracts session token from Cookie header or Authorization Bearer header
 */
export function extractSessionToken(req: any): string | null {
  // 1. Check HttpOnly cookie header first (Primary Production Architecture)
  const cookies = parseCookies(req.headers.cookie);
  if (cookies['volks_session']) {
    return cookies['volks_session'];
  }

  // 2. Check Authorization Bearer header (Transitional bridge fallback)
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '').trim();
  }

  return null;
}

/**
 * Resolves session and returns AuthContext if valid and user is active
 */
export async function resolveAuthContext(db: any, token: string | null): Promise<AuthContext | null> {
  if (!token) return null;

  // Query session joined with user and person to verify account is active
  const res = await db.query(
    `SELECT s.*, u.user_id, u.role as user_role, u.is_active, p.person_id, p.full_name
     FROM sessions s
     JOIN persons p ON p.person_id = s.person_id
     JOIN users u ON u.person_id = p.person_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW();`,
    [token]
  );

  if (res.rows.length === 0) return null;

  const row = res.rows[0];

  // User Deactivation Guard: Rejects sessions if user account is deactivated (is_active = false)
  if (!row.is_active) return null;

  // Resolve roles array
  let roles: string[] = [];
  if (row.role) {
    roles = row.role.split(',').map((r: string) => r.trim().toUpperCase());
  } else if (row.user_role) {
    roles = row.user_role.split(',').map((r: string) => r.trim().toUpperCase());
  }
  if (!roles.includes('EMPLOYEE')) {
    roles.push('EMPLOYEE');
  }

  return {
    userId: row.user_id,
    personId: row.person_id,
    email: row.email,
    roles,
    orgId: row.org_id || 'ORG-1001',
  };
}

/**
 * Checks if AuthContext contains at least one of the required roles
 */
export function hasRole(auth: AuthContext | null, allowedRoles: string[]): boolean {
  if (!auth) return false;
  if (auth.roles.includes('SYSTEM_ADMIN')) return true;
  return allowedRoles.some((role) => auth.roles.includes(role.toUpperCase()));
}

/**
 * Checks if target employee is within the manager's authorized reporting hierarchy
 */
export async function isManagerOf(db: any, managerPersonId: string, targetPersonId: string): Promise<boolean> {
  if (!managerPersonId || !targetPersonId) return false;
  if (managerPersonId === targetPersonId) return false; // Self is not manager scope

  const res = await db.query(
    `SELECT COUNT(*) as count
     FROM employment_changes ec
     JOIN employment_engagements ee ON ee.engagement_id = ec.engagement_id
     WHERE ee.person_id = $1
       AND ec.manager_id = $2
       AND ee.state IN ('ACTIVE', 'PROBATION', 'NOTICE_PERIOD')
       AND (ec.valid_to IS NULL OR ec.valid_to >= CURRENT_DATE);`,
    [targetPersonId, managerPersonId]
  );

  return parseInt(res.rows[0]?.count || '0', 10) > 0;
}
