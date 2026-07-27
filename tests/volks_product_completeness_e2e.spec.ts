import { test, expect } from '@playwright/test';

test.describe('VOLKS HRMS — Product Completeness & Reference Workflow E2E Suite', () => {
  test('Full Employee & Manager Product Flow: Home -> Attendance -> Regularization -> Talent -> Pay -> Integrity', async ({ page }) => {
    // 1. Open VOLKS Web Application & Log in as Employee
    await page.goto('http://localhost:3000');
    const loginInput = page.locator('#login-email');
    if (await loginInput.isVisible()) {
      await page.click('button:has-text("Employee")');
      await page.click('#login-submit-btn');
      await page.waitForSelector('#logout-btn');
    }

    // 2. Verify Operational Home Dashboard
    await expect(page.getByText(/Welcome back/i)).toBeVisible();
    await expect(page.getByText(/TODAY'S SHIFT/i)).toBeVisible();

    // 3. Navigate to Time (Monthly Attendance Calendar)
    await page.getByTestId('nav-time').click();
    await expect(page.getByText(/Attendance Calendar — July 2026/i)).toBeVisible();

    // 4. Click a Date to Open Day Detail Drawer & Regularize
    await page.getByText('3', { exact: true }).first().click();
    await expect(page.getByText(/Day Detail Drawer/i)).toBeVisible();
    await page.getByRole('button', { name: /Regularize Punch/i }).click();
    await expect(page.getByText(/Regularize Attendance — July 3/i)).toBeVisible();
    await page.getByRole('button', { name: /Submit Request/i }).click();

    // 5. Navigate to Talent (Recruitment Pipeline & Appraisals)
    await page.getByTestId('nav-talent').click();
    await expect(page.getByText(/Recruitment Pipeline/i)).toBeVisible();
    await page.getByRole('button', { name: /Performance Appraisals/i }).click();
    await expect(page.getByText(/Annual Performance Appraisal Review 2026/i)).toBeVisible();

    // 6. Navigate to Pay (Salary & Payslips)
    await page.getByTestId('nav-pay').click();
    await expect(page.getByText(/Salary & Monthly Payroll — July 2026/i)).toBeVisible();
    await expect(page.getByText(/Net Payable Salary/i)).toBeVisible();

    // 7. Log in as Manager & Check Approval Inbox
    await page.click('#logout-btn');
    await page.waitForSelector('#login-email');
    await page.click('button:has-text("Manager")');
    await page.click('#login-submit-btn');
    await page.waitForSelector('#logout-btn');
    await page.getByTestId('nav-home').click();
    await expect(page.getByText(/Manager Approval Inbox/i)).toBeVisible();

    // 8. Navigate to Integrity Tab (Workforce Integrity)
    await page.getByTestId('nav-integrity').click();
    await expect(page.getByText(/Workforce Integrity/i).first()).toBeVisible();

    // 9. Verify Refresh Persistence
    await page.reload();
    await page.waitForSelector('#logout-btn');
    await expect(page.getByText(/Workforce Integrity/i).first()).toBeVisible();
  });
});
