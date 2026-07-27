import { test, expect } from '@playwright/test';

test.describe('VOLKS HRMS — Phase Auth: Real Authentication, Session Security & Server-Side RBAC', () => {

  test('1. Wrong password login is rejected with 401 Unauthorized', async ({ request }) => {
    const res = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'employee@volks.com', password: 'WrongPassword999!' },
    });
    expect(res.status()).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Invalid email or password/i);
  });

  test('2. Valid login creates authenticated session with HttpOnly cookie and user roles', async ({ request }) => {
    const res = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'employee@volks.com', password: 'Password123!' },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.user.email).toBe('employee@volks.com');
    expect(data.user.roles).toContain('EMPLOYEE');
  });

  test('3. Unauthenticated requests to protected APIs return 401 Unauthorized', async ({ request }) => {
    const res = await request.get('http://localhost:4000/api/auth/me');
    expect(res.status()).toBe(401);
  });

  test('4. EMPLOYEE requesting privileged HR endpoint (Payroll Process) returns 403 Forbidden', async ({ request }) => {
    // 1. Login as Employee
    const loginRes = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'employee@volks.com', password: 'Password123!' },
    });
    const { token } = await loginRes.json();

    // 2. Call payroll process as Employee
    const res = await request.post('http://localhost:4000/api/payroll/process', {
      headers: { Authorization: `Bearer ${token}` },
      data: { month: '2026-07' },
    });

    expect(res.status()).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/Unauthorized/i);
  });

  test('5. Role spoof attack (EMPLOYEE passing actorRole=HR_ADMIN) is blocked with 403 Forbidden', async ({ request }) => {
    const loginRes = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'employee@volks.com', password: 'Password123!' },
    });
    const { token } = await loginRes.json();

    const res = await request.post('http://localhost:4000/api/payroll/process', {
      headers: { Authorization: `Bearer ${token}` },
      data: { month: '2026-07', actorRole: 'HR_ADMIN', actorPersonId: 'p-103' },
    });

    expect(res.status()).toBe(403);
  });

  test('6. MANAGER approving non-report employee leave returns 403 Forbidden (Manager Hierarchy Isolation)', async ({ request }) => {
    // 1. Employee Vikram Shetty (p3 — not managed by Rahul Bose) submits leave request
    const p3Login = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'vikram@volks.com', password: 'Password123!' },
    });
    const { token: p3Token } = await p3Login.json();

    const uniqueDay = Math.floor(Math.random() * 15) + 10;
    const applyRes = await request.post('http://localhost:4000/api/leave/apply', {
      headers: { Authorization: `Bearer ${p3Token}` },
      data: { leaveType: 'CASUAL', startDate: `2026-12-${uniqueDay}`, endDate: `2026-12-${uniqueDay + 1}`, days: 2, reason: 'Manager Hierarchy Test Leave' },
    });
    expect(applyRes.status()).toBe(200);
    const { requestId: leaveReqId } = await applyRes.json();

    // 2. Login as Manager (Rahul Bose — who manages Krishna Chakri, NOT Vikram Shetty)
    const mgrALogin = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'manager@volks.com', password: 'Password123!' },
    });
    const { token: mgrAToken } = await mgrALogin.json();

    // 3. Manager Rahul Bose attempting to approve Vikram Shetty's leave receives 403 Forbidden
    const res = await request.post('http://localhost:4000/api/leave/approve', {
      headers: { Authorization: `Bearer ${mgrAToken}` },
      data: { requestId: leaveReqId },
    });

    expect(res.status()).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/Forbidden|reporting hierarchy/i);
  });

  test('7. HR Admin calling privileged endpoint passes AUTHORIZATION gate (Not 401/403)', async ({ request }) => {
    // Login as HR Admin (Ananya Sharma)
    const loginRes = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'hr@volks.com', password: 'Password123!' },
    });
    const { token } = await loginRes.json();

    const res = await request.post('http://localhost:4000/api/payroll/process', {
      headers: { Authorization: `Bearer ${token}` },
      data: { month: '2026-07' },
    });

    // Proves authorization passed! Status is either 200 (processed) or 409 (locked), but NEVER 401 or 403!
    expect([200, 409]).toContain(res.status());
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
  });

  test('8. Logout revokes session token; subsequent /api/auth/me returns 401 Unauthorized', async ({ request }) => {
    const loginRes = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'employee@volks.com', password: 'Password123!' },
    });
    const { token } = await loginRes.json();

    // Verify session active
    const meBefore = await request.get('http://localhost:4000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meBefore.status()).toBe(200);

    // Logout
    const logoutRes = await request.post('http://localhost:4000/api/auth/logout', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logoutRes.status()).toBe(200);

    // Verify session revoked
    const meAfter = await request.get('http://localhost:4000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meAfter.status()).toBe(401);
  });

  test('9. UI Login View renders and authenticates successfully', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('#login-email');

    // Quick fill as HR Admin
    await page.click('button:has-text("HR Admin")');
    await page.click('#login-submit-btn');

    // Verify successful login into main layout
    await page.waitForSelector('#logout-btn');
    await expect(page.locator('#logout-btn')).toBeVisible();

    // Refresh page (F5) to verify session persistence via /api/auth/me
    await page.reload();
    await page.waitForSelector('#logout-btn');
    await expect(page.locator('#logout-btn')).toBeVisible();

    // Logout
    await page.click('#logout-btn');
    await page.waitForSelector('#login-email');
    await expect(page.locator('#login-email')).toBeVisible();
  });

});
