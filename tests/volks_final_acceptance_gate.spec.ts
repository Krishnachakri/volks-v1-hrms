import { test, expect } from '@playwright/test';

test.describe('VOLKS FINAL BASIC-HRMS ACCEPTANCE GATE — Playwright Suite', () => {
  const loginAs = async (page: any, role: 'Employee' | 'Manager' | 'HR Admin' | 'Finance' | 'System Admin') => {
    await page.goto('http://localhost:3000');
    const loginInput = page.locator('#login-email');
    if (await loginInput.isVisible()) {
      await page.click(`button:has-text("${role}")`);
      await page.click('#login-submit-btn');
      await page.waitForSelector('#logout-btn');
    }
  };

  test('1. EMPLOYEE Mandatory Persona Workflow', async ({ page }) => {
    await loginAs(page, 'Employee');

    // Punch In / Out
    await expect(page.getByText(/TODAY'S SHIFT/i)).toBeVisible();
    await page.getByRole('button', { name: /Punch Out/i }).click();
    await expect(page.getByText(/Checked out successfully/i)).toBeVisible();

    // Attendance Calendar, Regularization, OD
    await page.getByTestId('nav-time').click();
    await expect(page.getByText(/Attendance Calendar — July 2026/i)).toBeVisible();
    await page.getByText('3', { exact: true }).first().click();
    await expect(page.getByText(/Day Detail Drawer/i)).toBeVisible();
    await page.getByRole('button', { name: /Regularize Punch/i }).click();
    await page.getByRole('button', { name: /Submit Request/i }).click();

    // Leave & Expense
    await page.getByTestId('nav-leave').click();
    await expect(page.getByText(/Leave Management Studio/i)).toBeVisible();
    await page.getByTestId('nav-expenses').click();
    await expect(page.getByText(/Reimbursements & Expense Claims/i)).toBeVisible();

    // Payslip & Profile
    await page.getByTestId('nav-pay').click();
    await expect(page.getByText(/Salary & Monthly Payroll — July 2026/i)).toBeVisible();
    await page.getByTestId('nav-people').click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/Reports to/i)).toBeVisible();
  });

  test('2. MANAGER Mandatory Persona Workflow', async ({ page }) => {
    await loginAs(page, 'Manager');
    await page.getByTestId('nav-home').click();

    await expect(page.getByText(/Manager Approval Inbox/i)).toBeVisible();
    await expect(page.getByText(/Team Members Absent/i)).toBeVisible();
    await page.getByRole('button', { name: /Approve/i }).first().click();
  });

  test('3. HR & PAYROLL Mandatory Persona Workflows', async ({ page }) => {
    await loginAs(page, 'HR Admin');
    await page.getByTestId('nav-home').click();
    await expect(page.getByText(/Total Headcount/i)).toBeVisible();

    await page.click('#logout-btn');
    await loginAs(page, 'Finance');
    await page.getByTestId('nav-home').click();
    await expect(page.getByText(/Payroll Processing & Lock Control/i)).toBeVisible();
  });

  test('4. TALENT & RECRUITMENT Workflow', async ({ page }) => {
    await loginAs(page, 'HR Admin');
    await page.getByTestId('nav-talent').click();

    await expect(page.getByText(/Recruitment Pipeline/i)).toBeVisible();
    await page.getByRole('button', { name: /Performance Appraisals/i }).click();
    await expect(page.getByText(/Annual Performance Appraisal Review 2026/i)).toBeVisible();
  });

  test('5. ADMIN & INTEGRITY Audit Workflow', async ({ page }) => {
    await loginAs(page, 'System Admin');
    await page.getByTestId('nav-admin').click();
    await expect(page.getByText(/WORKFORCE OPERATING SYSTEM/i)).toBeVisible();

    await page.getByTestId('nav-integrity').click();
    await expect(page.getByText(/Workforce Integrity — Organizational Observability/i)).toBeVisible();
    await page.reload();
    await page.waitForSelector('#logout-btn');
    await expect(page.getByText(/Workforce Integrity — Organizational Observability/i)).toBeVisible();
  });
});
