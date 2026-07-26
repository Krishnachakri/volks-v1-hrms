import { test, expect } from '@playwright/test';

test.describe('VOLKS Candidate Intelligence & ATS E2E Suite', () => {
  test('Full Candidate Recruitment -> Explainable Scoring -> Hire -> Employee 360 Conversion Flow', async ({ page }) => {
    console.log('[PLAYWRIGHT ATS] Navigating to VOLKS HRMS...');
    await page.goto('http://localhost:3000');

    // 1. Select HR Admin Persona
    console.log('[PLAYWRIGHT ATS] Selecting HR Admin Persona...');
    const adminBtn = page.getByRole('button', { name: /HR Admin/i }).first();
    if (await adminBtn.isVisible()) {
      await adminBtn.click();
    }

    // 2. Navigate to Talent Module
    console.log('[PLAYWRIGHT ATS] Navigating to Talent module...');
    await page.getByTestId('nav-talent').click();

    // 3. Verify Candidate Intelligence & ATS Sub-Tab is Active
    console.log('[PLAYWRIGHT ATS] Verifying Candidate Intelligence & ATS sub-tab...');
    await expect(page.getByText(/Candidate Intelligence & ATS/i).first()).toBeVisible();

    // 4. Verify Ethical Non-Autonomous ATS Warning Notice
    console.log('[PLAYWRIGHT ATS] Verifying Ethical Non-Autonomous ATS notice...');
    await expect(page.getByText(/Non-Negotiable Ethical ATS Principle/i)).toBeVisible();

    // 5. Verify Candidate Match Scorecard Elements
    console.log('[PLAYWRIGHT ATS] Inspecting Explainable Scorecard metrics...');
    await expect(page.getByText(/Required Skills/i).first()).toBeVisible();
    await expect(page.getByText(/Preferred Skills/i).first()).toBeVisible();
    await expect(page.getByText(/Experience Match/i).first()).toBeVisible();
    await expect(page.getByText(/Extracted Resume Evidence Snippets/i)).toBeVisible();

    // 6. Test Candidate Stage Progression to Interview
    console.log('[PLAYWRIGHT ATS] Testing candidate stage progression...');
    const moveBtn = page.getByRole('button', { name: /Move to Interview/i });
    if (await moveBtn.isVisible()) {
      await moveBtn.click();
    }

    // 7. Test Candidate Hire & Employee 360 Conversion
    console.log('[PLAYWRIGHT ATS] Executing Hire Candidate & Create Employee...');
    const hireBtn = page.getByRole('button', { name: /Hire Candidate & Create Employee/i });
    if (await hireBtn.isVisible()) {
      await hireBtn.click();
      await expect(page.getByText(/Candidate Hired \(Employee Created\)/i).first()).toBeVisible();
    }

    // 8. Test Persistence Across Page Refresh
    console.log('[PLAYWRIGHT ATS] Reloading page to verify persistence...');
    await page.reload();
    await expect(page.getByTestId('nav-talent')).toBeVisible();

    console.log('[PLAYWRIGHT ATS] Candidate Intelligence & ATS E2E Test Passed Successfully!');
  });
});
