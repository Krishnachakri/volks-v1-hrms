import { test, expect } from '@playwright/test';

test.describe('VOLKS FINAL BASIC-HRMS ACCEPTANCE GATE — Playwright Suite', () => {
  test('1. EMPLOYEE Mandatory Persona Workflow', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

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
    await expect(page.getByText(/Attendance Calendar — July 2026/i)).toBeVisible();
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
    await page.goto('http://localhost:3000');
    await page.getByRole('combobox').selectOption('MANAGER');
    await page.getByTestId('nav-home').click();

    await expect(page.getByText(/Manager Approval Inbox/i)).toBeVisible();
    await expect(page.getByText(/Team Members Absent/i)).toBeVisible();
    await page.getByRole('button', { name: /Approve/i }).first().click();
  });

  test('3. HR & PAYROLL Mandatory Persona Workflows', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByRole('combobox').selectOption('HR_ADMIN');
    await page.getByTestId('nav-home').click();
    await expect(page.getByText(/Total Headcount/i)).toBeVisible();

    await page.getByRole('combobox').selectOption('AUDITOR');
    await page.getByTestId('nav-home').click();
    await expect(page.getByText(/Payroll Processing & Lock Control/i)).toBeVisible();
  });

  test('4. TALENT & RECRUITMENT Workflow', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByTestId('nav-talent').click();

    await expect(page.getByText(/Recruitment Pipeline/i)).toBeVisible();
    await page.getByRole('button', { name: /Performance Appraisals/i }).click();
    await expect(page.getByText(/Annual Performance Appraisal Review 2026/i)).toBeVisible();
  });

  test('5. ADMIN & INTEGRITY Audit Workflow', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.getByTestId('nav-admin').click();
    await expect(page.getByText(/WORKFORCE OPERATING SYSTEM/i)).toBeVisible();

    await page.getByTestId('nav-integrity').click();
    await expect(page.getByText(/Workforce Integrity — Organizational Observability/i)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Workforce Integrity — Organizational Observability/i)).toBeVisible();
  });
});
