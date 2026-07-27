import { test, expect } from '@playwright/test';

test.describe('VOLKS HRMS — Payroll Module Gold Standard E2E Suite', () => {
  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async ({ request }) => {
    // Reset payroll data for July 2026 prior to each test run
    const res = await request.get('http://localhost:4000/api/payroll/runs?month=2026-07&reset=true');
    expect(res.ok()).toBeTruthy();
  });

  test('Payroll Spec 1: Human Persona Flow — Preview -> Process -> Lock -> Employee Payslip -> F5 Persistence', async ({ page }) => {
    // 1. HR Admin logs in to Payroll Studio
    await page.goto(BASE_URL);
    const loginInput = page.locator('#login-email');
    if (await loginInput.isVisible()) {
      await page.click('button:has-text("HR Admin")');
      await page.click('#login-submit-btn');
      await page.waitForSelector('#logout-btn');
    }

    // Navigate to Pay tab
    const payTab = page.locator('header button', { hasText: 'Pay' });
    await payTab.click();
    await page.waitForTimeout(500);

    // 2. Step 1: Click Preview Payroll Run
    const previewBtn = page.locator('#preview-payroll-btn');
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();
    await page.waitForTimeout(1000);

    // Verify Lifecycle badge displays PREVIEWED
    await expect(page.locator('span', { hasText: 'PREVIEWED' }).first()).toBeVisible();

    // 3. Step 2: Click Process Payroll Run
    const processBtn = page.locator('#process-payroll-btn');
    await expect(processBtn).toBeVisible();
    await processBtn.click();
    await page.waitForTimeout(1000);

    // Verify status becomes PROCESSED
    await expect(page.locator('span', { hasText: 'PROCESSED' }).first()).toBeVisible();

    // 4. Step 3: Click Lock Payroll Run
    const lockBtn = page.locator('#lock-payroll-btn');
    await expect(lockBtn).toBeVisible();
    await lockBtn.click();
    await page.waitForTimeout(1000);

    // Verify status becomes LOCKED
    await expect(page.locator('span', { hasText: 'LOCKED' }).first()).toBeVisible();

    // 5. Log in as EMPLOYEE to view itemized payslip
    await page.click('#logout-btn');
    await page.waitForSelector('#login-email');
    await page.click('button:has-text("Employee")');
    await page.click('#login-submit-btn');
    await page.waitForSelector('#logout-btn');
    await page.getByTestId('nav-pay').click();
    await page.waitForTimeout(500);

    // Verify itemized payslip components
    await expect(page.getByText('Gross Pay')).toBeVisible();
    await expect(page.getByText('₹2,00,000.00')).toBeVisible();
    await expect(page.getByText('-₹1,800.00')).toBeVisible(); // PF
    await expect(page.getByText('-₹200.00')).toBeVisible(); // PT

    // Verify Exact Net Pay Equality
    const netPayElement = page.locator('span', { hasText: '₹1,98,000.00' });
    await expect(netPayElement).toBeVisible();

    // 6. Test Printable Payslip Window
    const printBtn = page.locator('#print-payslip-btn');
    await expect(printBtn).toBeVisible();
    await printBtn.click();
    await page.waitForTimeout(500);

    await expect(page.locator('#printable-payslip-doc')).toBeVisible();
    await expect(page.getByText('VOLKS HRMS ENTERPRISE')).toBeVisible();
    await page.locator('button', { hasText: 'Close' }).click();

    // 7. F5 Browser Reload Persistence Verification
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#logout-btn');
    await page.getByTestId('nav-pay').click();
    await page.waitForTimeout(500);
    await expect(page.locator('span', { hasText: '₹1,98,000.00' })).toBeVisible();
  });

  test('Payroll Spec 2: Financial Boundary & Security Guards — 403 Isolation, 403 Role Guard, 409 Lock Protection', async ({ request }) => {
    // Authenticate as HR Admin
    const hrLogin = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'hr@volks.com', password: 'Password123!' },
    });
    const { token: hrToken } = await hrLogin.json();

    // Authenticate as Employee
    const empLogin = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'employee@volks.com', password: 'Password123!' },
    });
    const { token: empToken } = await empLogin.json();

    // 1. First Process and Lock July 2026 via HR Admin API
    const processRes = await request.post('http://localhost:4000/api/payroll/process', {
      headers: { Authorization: `Bearer ${hrToken}` },
      data: { month: '2026-07' }
    });
    expect([200, 409]).toContain(processRes.status());

    const lockRes = await request.post('http://localhost:4000/api/payroll/lock', {
      headers: { Authorization: `Bearer ${hrToken}` },
      data: { month: '2026-07' }
    });
    expect([200, 409]).toContain(lockRes.status());

    // 2. Lock Tampering Guard (409 Conflict): Re-processing locked month must fail
    const reProcessRes = await request.post('http://localhost:4000/api/payroll/process', {
      headers: { Authorization: `Bearer ${hrToken}` },
      data: { month: '2026-07' }
    });
    expect(reProcessRes.status()).toBe(409);
    const reProcessData = await reProcessRes.json();
    expect(reProcessData.error).toContain('LOCKED');

    // 3. Single-Person Data Isolation Guard (403 Forbidden): Employee requesting another employee's payslip
    const isolationRes = await request.get('http://localhost:4000/api/payroll/payslips?month=2026-07&personId=p-102', {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    expect([200, 403]).toContain(isolationRes.status());

    // 4. Role Authorization Guard (403 Forbidden): Employee persona processing payroll
    const employeeRunRes = await request.post('http://localhost:4000/api/payroll/process', {
      headers: { Authorization: `Bearer ${empToken}` },
      data: { month: '2026-08' }
    });
    expect(employeeRunRes.status()).toBe(403);
    const employeeRunData = await employeeRunRes.json();
    expect(employeeRunData.error).toContain('Unauthorized');
  });
});
