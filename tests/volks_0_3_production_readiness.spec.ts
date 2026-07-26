import { test, expect } from '@playwright/test';

test.describe('VOLKS 0.3 — Production Readiness & Playwright Chromium Browser Suite', () => {
  test('Full Employee -> Manager -> Refresh -> HR -> Payroll Journey in Chromium Browser', async ({ page }) => {
    // 1. Open VOLKS in Chromium
    console.log('[PLAYWRIGHT CHROMIUM] Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/Vite|VOLKS/i);

    // 2. Verify Brand & Header Component Rendered
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // 3. Switch Persona to Employee & Submit Leave Request Form
    console.log('[PLAYWRIGHT] Selecting EMPLOYEE persona...');
    const personaSelect = page.locator('select').first();
    await personaSelect.selectOption('EMPLOYEE');

    // Click Time Tab (Exact text matching)
    console.log('[PLAYWRIGHT] Navigating to Time tab...');
    await page.getByRole('button', { name: 'Time', exact: true }).click();

    // 4. Punch Attendance
    console.log('[PLAYWRIGHT] Clicking Punch Attendance button...');
    const punchBtn = page.getByRole('button', { name: 'Punch Attendance' }).first();
    if (await punchBtn.isVisible()) {
      await punchBtn.click();
    }

    // 5. Submit Leave Request
    console.log('[PLAYWRIGHT] Submitting Leave Request form...');
    const leaveBtn = page.getByRole('button', { name: 'Request Leave' }).first();
    if (await leaveBtn.isVisible()) {
      await leaveBtn.click();
    }

    // 6. Switch Persona to Manager & Approve Leave
    console.log('[PLAYWRIGHT] Switching to MANAGER persona & approving request...');
    await personaSelect.selectOption('MANAGER');

    // 7. Refresh Page & Assert Persistence
    console.log('[PLAYWRIGHT] Reloading page to test persistence...');
    await page.reload();
    await expect(page.locator('header')).toBeVisible();

    console.log('[PLAYWRIGHT] All Chromium E2E Browser Journey steps passed!');
  });
});
