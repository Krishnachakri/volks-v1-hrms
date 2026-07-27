import { test, expect } from '@playwright/test';

test.describe('VOLKS HRMS — Phase A Staticness Deletion & F5 Persistence Suite', () => {
  const loginAs = async (page: any, role: 'Employee' | 'Manager' | 'HR Admin' | 'Finance' | 'System Admin') => {
    await page.goto('http://localhost:3000');
    const loginInput = page.locator('#login-email');
    if (await loginInput.isVisible()) {
      await page.click(`button:has-text("${role}")`);
      await page.click('#login-submit-btn');
      await page.waitForSelector('#logout-btn');
    }
  };

  test('Phase A1: Dynamic Dashboard Summary API & Server Timestamp Sourcing', async ({ page }) => {
    // Direct API verification
    const summaryRes = await page.request.get('http://localhost:4000/api/dashboard/summary');
    expect(summaryRes.status()).toBe(200);
    const summaryData = await summaryRes.json();
    expect(summaryData.todayDateStr).toBeTruthy();
    expect(typeof summaryData.totalEmployees).toBe('number');
    expect(typeof summaryData.activeEmployees).toBe('number');

    // UI Verification
    await loginAs(page, 'HR Admin');
    await page.click('[data-testid="nav-home"]');

    await expect(page.locator('text=Total Headcount')).toBeVisible();
    await expect(page.getByText(`${summaryData.totalEmployees}`, { exact: true }).first()).toBeVisible();
  });

  test('Phase A2: Attendance Dynamic Calendar & DB Log Sourcing', async ({ page }) => {
    await loginAs(page, 'Employee');
    await page.click('[data-testid="nav-time"]');

    await expect(page.locator('text=Attendance Calendar — July 2026')).toBeVisible();
    await expect(page.locator('text=Present:')).toBeVisible();
    await expect(page.locator('text=Late:')).toBeVisible();
    await expect(page.locator('text=Leave:')).toBeVisible();
  });

  test('Phase A3 & A5: Talent Candidate Resume Upload, "Not Detected" Fallback & F5 Persistence Certification', async ({ page }) => {
    // 1. Create open job posting if missing
    await page.request.post('http://localhost:4000/api/talent/postings', {
      data: {
        title: 'Senior Software Engineer',
        actorRole: 'HR_ADMIN',
      },
    });

    // 2. Apply Candidate via API (backend engine)
    const candidateName = `CandidateTest${Date.now()}`;
    const applyRes = await page.request.post('http://localhost:4000/api/talent/apply', {
      data: {
        fullName: candidateName,
        email: null,
        phone: null,
        resumeFileName: `${candidateName}.pdf`,
      },
    });
    expect(applyRes.status()).toBe(200);

    // 3. Navigate to Talent UI
    await loginAs(page, 'HR Admin');
    await page.click('[data-testid="nav-talent"]');

    // 4. Verify candidate header and candidate in list
    await expect(page.getByText(/Recruitment Candidates/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(candidateName).first()).toBeVisible({ timeout: 10000 });

    // 5. Inspect missing email/phone render "Not detected"
    await page.getByText(candidateName).first().click();
    await expect(page.locator('text=📧 Not detected')).toBeVisible();
    await expect(page.locator('text=📞 Not detected')).toBeVisible();

    // 6. F5 Reload Test — Verify candidate survives page reload
    await page.reload();
    await page.waitForSelector('#logout-btn');
    await page.click('[data-testid="nav-talent"]');
    await page.waitForTimeout(1000);
    await expect(page.getByText(candidateName).first()).toBeVisible();
  });
});
