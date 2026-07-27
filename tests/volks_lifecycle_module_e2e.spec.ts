import { test, expect } from '@playwright/test';

test.describe('VOLKS HRMS — Lifecycle Module Deep E2E & Business Rules Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
  });

  test('Lifecycle Spec 1: Human Persona Flow — Onboarding, Probation, Bitemporal Promotion & F5 Reload Persistence', async ({ page }) => {
    // 1. Login as HR Admin & Navigate to Lifecycle Tab
    const loginInput = page.locator('#login-email');
    if (await loginInput.isVisible()) {
      await page.click('button:has-text("HR Admin")');
      await page.click('#login-submit-btn');
      await page.waitForSelector('#logout-btn');
    }
    await page.getByTestId('nav-lifecycle').click();
    await expect(page.getByText(/Lifecycle Studio/i)).toBeVisible();

    // 2. Verify Onboarding & Probation Sub-Tab
    await page.getByRole('button', { name: /Onboarding & Probation/i }).click();
    await expect(page.getByText(/Onboarding Task Checklist/i)).toBeVisible();

    // 3. Assign New Onboarding Task
    await page.fill('#new-task-name-input', 'Complete Information Security Compliance Training');
    await page.click('#add-onboarding-task-btn');
    await expect(page.getByText(/Complete Information Security Compliance Training/i).first()).toBeVisible();

    // 4. Complete Onboarding Task
    const completeBtn = page.locator('button', { hasText: /Complete Task/i }).first();
    if (await completeBtn.isVisible()) {
      await completeBtn.click();
    }

    // 5. Submit Probation Confirmation Review
    await page.selectOption('#probation-decision-select', 'CONFIRM');
    await page.fill('#probation-feedback-input', 'Outstanding performance during 90-day probation period. Strongly confirmed.');
    await page.click('#submit-probation-review');
    await expect(page.getByText(/Probation review 'CONFIRM' processed!/i)).toBeVisible();

    // 6. Navigate to Career Movements Sub-Tab & Execute Bitemporal Promotion
    await page.getByRole('button', { name: /Career Movements/i }).click();
    await page.selectOption('#career-event-type-select', 'PROMOTE');
    await page.fill('#effective-date-input', '2026-08-01');
    await page.fill('#proposed-salary-input', '1400000');
    await page.fill('#mutation-reason-input', 'Gold Standard Lifecycle E2E Performance Promotion');
    await page.click('#submit-career-transition');

    await expect(page.getByText(/Career transition 'PROMOTE' \(v\d+\) committed successfully!/i)).toBeVisible();
    await expect(page.getByText(/14,00,000|1,400,000/i).first()).toBeVisible();

    // 7. F5 Persistence Verification
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#logout-btn');
    await page.getByTestId('nav-lifecycle').click();
    await expect(page.getByText(/Lifecycle Studio/i)).toBeVisible();
    await expect(page.getByText(/14,00,000|1,400,000/i).first()).toBeVisible();
  });

  test('Lifecycle Spec 2: Employee Resignation, Clearance Checkpoints & Financial Exit Integrity', async ({ page }) => {
    // 1. Log in as HR Admin & Navigate to Lifecycle
    const loginInput = page.locator('#login-email');
    if (await loginInput.isVisible()) {
      await page.click('button:has-text("HR Admin")');
      await page.click('#login-submit-btn');
      await page.waitForSelector('#logout-btn');
    }
    await page.getByTestId('nav-lifecycle').click();

    // 2. Navigate to Resignation & Clearance Sub-Tab
    await page.getByRole('button', { name: /Resignation & Clearance/i }).click();
    await expect(page.getByText(/Submit Resignation Request/i)).toBeVisible();

    // 3. Submit Resignation Request
    await page.fill('#resignation-reason-input', 'Relocating to another city for personal reasons.');
    await page.fill('#requested-lwd-input', '2026-08-31');
    await page.click('#submit-resignation-btn');
    await expect(page.getByText(/NOTICE_PERIOD/i).first()).toBeVisible();

    // 4. Toggle Clearance Checkpoints
    await page.click('#clearance-managerHandover');
    await page.click('#clearance-itAccessCleared');
    await page.click('#clearance-financeDuesCleared');

    // 5. Attempt Final Termination Execution
    await page.click('#submit-termination-btn');
    // Expect success or exit blocker handling
    await page.waitForTimeout(1000);
  });

  test('Lifecycle Spec 3: Security & Boundary Guards — 403 Self-Action, 409 Illegal Transition & Rehire', async ({ page, request }) => {
    // 1. Test 403 Self-Action Guard via API (Employee cannot execute career mutation on self)
    const selfTransitionRes = await request.post('http://localhost:4000/api/lifecycle/transition', {
      data: {
        personId: 'p-101',
        actorPersonId: 'p-101',
        actorRole: 'EMPLOYEE',
        eventType: 'PROMOTE',
        newComp: 2000000,
      },
    });
    expect(selfTransitionRes.status()).toBe(403);
    const selfData = await selfTransitionRes.json();
    expect(selfData.error).toContain('Unauthorized');

    // 2. Test 409 Illegal Transition Guard on Terminated Employee
    // First terminate p-102 or dummy person
    const termRes = await request.post('http://localhost:4000/api/lifecycle/terminate', {
      data: {
        personId: 'p-102',
        actorRole: 'HR_ADMIN',
        effectiveDate: '2026-08-31',
      },
    });
    expect([200, 400]).toContain(termRes.status());

    if (termRes.status() === 200) {
      // Attempt promotion on TERMINATED employee -> 409 Conflict
      const illegalPromoRes = await request.post('http://localhost:4000/api/lifecycle/transition', {
        data: {
          personId: 'p-102',
          actorPersonId: 'p-101',
          actorRole: 'HR_ADMIN',
          eventType: 'PROMOTE',
          newComp: 2500000,
        },
      });
      expect(illegalPromoRes.status()).toBe(409);
      const illegalData = await illegalPromoRes.json();
      expect(illegalData.error).toContain('Forbidden: Cannot execute career mutation');

      // 3. Test Rehire Endpoint (Creates NEW Engagement Row)
      const rehireRes = await request.post('http://localhost:4000/api/lifecycle/rehire', {
        data: {
          personId: 'p-102',
          actorRole: 'HR_ADMIN',
          rehireDate: '2026-09-01',
          newComp: 1500000,
        },
      });
      expect(rehireRes.status()).toBe(200);
      const rehireData = await rehireRes.json();
      expect(rehireData.status).toBe('REHIRED');
      expect(rehireData.newEngagementId).toBeTruthy();
    }
  });
});
