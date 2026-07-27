import { test, expect } from '@playwright/test';

test.describe('VOLKS HRMS — Leave Module Deep E2E Workflow & Business Rules Suite', () => {
  test('Full Employee -> Overlap Prevention -> Manager Approval -> Balance Mutation -> TIME Sync -> F5 Persistence -> Rejection Workflow', async ({ page, request }) => {
    // Reset leave data for test determinism
    await request.get('http://localhost:4000/api/leave/balances?personId=p-101&reset=true');

    // 1. Open Application & Login as EMPLOYEE
    await page.goto('http://localhost:3000');
    const loginInput = page.locator('#login-email');
    if (await loginInput.isVisible()) {
      await page.click('button:has-text("Employee")');
      await page.waitForSelector('#logout-btn');
    }

    // 2. Navigate to LEAVE Tab
    await page.click('button:has-text("LEAVE")');
    await expect(page.locator('h1')).toContainText('Leave Management Studio');

    // 3. Record Initial CASUAL Leave Available Balance
    const casualHeader = page.locator('span:has-text("CASUAL LEAVE")');
    await expect(casualHeader).toBeVisible();
    const casualCard = casualHeader.locator('xpath=ancestor::div[contains(@style, "border")]').first();
    const initialAvailableText = await casualCard.locator('span:has-text("Days Available")').innerText();
    const initialAvailable = parseInt(initialAvailableText.replace(/\D/g, ''));
    expect(initialAvailable).toBeGreaterThan(0);

    // 4. Generate Unique Dynamic Dates (2 days next month to avoid collisions)
    const formatDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const today = new Date();
    const randOffset = Math.floor(Math.random() * 200) + 10;
    const futureStart = new Date(today.getFullYear(), today.getMonth() + 1, randOffset);
    const futureEnd = new Date(today.getFullYear(), today.getMonth() + 1, randOffset + 1);

    const startDateStr = formatDateStr(futureStart);
    const endDateStr = formatDateStr(futureEnd);
    const requestedDays = 2;

    // 5. Open Apply Leave Modal & Fill Form
    await page.click('#apply-leave-btn');
    await page.selectOption('#leave-type-select', 'CASUAL');
    await page.fill('#leave-start-date', startDateStr);
    await page.fill('#leave-end-date', endDateStr);
    await page.fill('#leave-reason', 'Deep E2E Automated Verification Test');

    await page.click('#submit-leave-app');
    await expect(page.locator('#submit-leave-app')).not.toBeVisible({ timeout: 5000 });

    // 6. Verify Request Listed in My Requests with PENDING Status
    const myRequestsTable = page.locator('table');
    await expect(myRequestsTable).toContainText('CASUAL', { timeout: 10000 });
    await expect(myRequestsTable).toContainText('PENDING');
    await expect(myRequestsTable).toContainText('Deep E2E Automated Verification Test');

    // 7. OVERLAP PREVENTION TEST: Submit second request covering overlapping dates
    await page.click('#apply-leave-btn');
    await page.selectOption('#leave-type-select', 'CASUAL');
    await page.fill('#leave-start-date', startDateStr);
    await page.fill('#leave-end-date', endDateStr);
    await page.fill('#leave-reason', 'Overlapping Request Should Fail');
    await page.click('#submit-leave-app');

    await page.locator('button', { hasText: 'Cancel' }).click(); // Close modal
    await expect(page.locator('#submit-leave-app')).not.toBeVisible({ timeout: 5000 });

    // 8. Log in as MANAGER
    await page.click('#logout-btn');
    await page.waitForSelector('#login-email');
    await page.click('button:has-text("Manager")');
    await page.waitForSelector('#logout-btn');
    await page.getByTestId('nav-leave').click();
    await expect(page.locator('h1')).toContainText('Leave Management Studio');

    // 9. Locate & Approve the Pending Request in Manager Queue
    const approvalQueue = page.locator('h2:has-text("Pending Manager Approvals Queue")');
    await expect(approvalQueue).toBeVisible();

    const pendingCard = page.locator('[id^="request-card-"]').filter({ hasText: 'Deep E2E Automated Verification Test' }).first();
    await expect(pendingCard).toBeVisible();

    await pendingCard.locator('button:has-text("Approve")').click();
    await expect(page.getByText('Leave request approved successfully.').first()).toBeVisible({ timeout: 5000 });

    // 10. Log in back as EMPLOYEE & Verify Balance Mutation & Status
    await page.click('#logout-btn');
    await page.waitForSelector('#login-email');
    await page.click('button:has-text("Employee")');
    await page.waitForSelector('#logout-btn');
    await page.getByTestId('nav-leave').click();
    await expect(page.locator('h1')).toContainText('Leave Management Studio');

    // Request status in table must be APPROVED
    await expect(myRequestsTable).toContainText('APPROVED');

    // Balance must be deducted by requestedDays (2 days)
    const newAvailableText = await casualCard.locator('span:has-text("Days Available")').innerText();
    const newAvailable = parseInt(newAvailableText.replace(/\D/g, ''));
    expect(newAvailable).toBe(initialAvailable - requestedDays);

    // 11. TIME Module Integration Verification
    await page.getByTestId('nav-time').click();
    await expect(page.locator('h2:has-text("Attendance Calendar")')).toBeVisible();

    // 12. F5 Reload Persistence Verification
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#logout-btn');
    await page.getByTestId('nav-leave').click();
    await expect(myRequestsTable).toContainText('APPROVED');
    
    const postReloadText = await casualCard.locator('span:has-text("Days Available")').innerText();
    const postReloadAvailable = parseInt(postReloadText.replace(/\D/g, ''));
    expect(postReloadAvailable).toBe(newAvailable);

    // 13. REJECTION WORKFLOW TEST
    const rejStart = formatDateStr(new Date(today.getFullYear(), today.getMonth() + 1, 20));
    const rejEnd = formatDateStr(new Date(today.getFullYear(), today.getMonth() + 1, 21));

    await page.click('#apply-leave-btn');
    await page.selectOption('#leave-type-select', 'SICK');
    await page.fill('#leave-start-date', rejStart);
    await page.fill('#leave-end-date', rejEnd);
    await page.fill('#leave-reason', 'Sick Leave To Be Rejected Test');
    await page.click('#submit-leave-app');
    await expect(page.locator('#submit-leave-app')).not.toBeVisible({ timeout: 5000 });

    // Manager Rejects Request via Manager Login
    await page.click('#logout-btn');
    await page.waitForSelector('#login-email');
    await page.click('button:has-text("Manager")');
    await page.click('#login-submit-btn');
    await page.waitForSelector('#logout-btn');
    await page.getByTestId('nav-leave').click();

    const rejCard = page.locator('[id^="request-card-"]').filter({ hasText: 'Sick Leave To Be Rejected Test' }).first();
    await rejCard.locator('button:has-text("Reject")').click();

    await rejCard.locator('input[placeholder="Mandatory rejection reason..."]').fill('Insufficient project coverage');
    await rejCard.locator('button:has-text("Confirm Reject")').click();

    await expect(page.getByText('Leave request rejected.').first()).toBeVisible();

    // Employee sees REJECTED status via Employee Login
    await page.click('#logout-btn');
    await page.waitForSelector('#login-email');
    await page.click('button:has-text("Employee")');
    await page.click('#login-submit-btn');
    await page.waitForSelector('#logout-btn');
    await page.getByTestId('nav-leave').click();
    await expect(myRequestsTable).toContainText('REJECTED');
  });

  test('Leave API Boundary & Business Rules Validations', async ({ request }) => {
    // A. Insufficient Balance Boundary Test
    const resOver = await request.post('http://localhost:4000/api/leave/apply', {
      data: {
        personId: 'p-101',
        leaveType: 'CASUAL',
        startDate: '2026-09-01',
        endDate: '2026-10-30',
        days: 60,
        reason: 'Excessive Days Boundary Test',
      },
    });
    expect(resOver.status()).toBe(400);
    const bodyOver = await resOver.json();
    expect(bodyOver.error).toContain('Insufficient');

    // B. Invalid Date Range Boundary Test
    const resDate = await request.post('http://localhost:4000/api/leave/apply', {
      data: {
        personId: 'p-101',
        leaveType: 'SICK',
        startDate: '2026-09-10',
        endDate: '2026-09-05',
        days: 1,
        reason: 'Backwards Date Range Test',
      },
    });
    expect(resDate.status()).toBe(400);
    const bodyDate = await resDate.json();
    expect(bodyDate.error).toContain('End date cannot be prior to start date');

    // C. Self-Approval Security Test
    // 1. Create request for p-101
    const randDay = Math.floor(Math.random() * 20) + 10;
    const testDate = `2026-11-${randDay}`;
    const resApp = await request.post('http://localhost:4000/api/leave/apply', {
      data: {
        personId: 'p-101',
        leaveType: 'SICK',
        startDate: testDate,
        endDate: testDate,
        days: 1,
        reason: `Self Approval Test Request ${Date.now()}`,
      },
    });
    expect(resApp.status()).toBe(200);
    const { requestId } = await resApp.json();

    // 2. Attempt self approval
    const resSelf = await request.post('http://localhost:4000/api/leave/approve', {
      data: {
        requestId,
        approverPersonId: 'p-101',
      },
    });
    expect(resSelf.status()).toBe(403);
    const bodySelf = await resSelf.json();
    expect(bodySelf.error).toContain('cannot approve their own leave');

    // D. Double-Approval Protection Test
    // 1. Approve cleanly with manager p-102
    const resApprove1 = await request.post('http://localhost:4000/api/leave/approve', {
      data: {
        requestId,
        approverPersonId: 'p-102',
      },
    });
    expect(resApprove1.status()).toBe(200);

    // 2. Attempt second approval
    const resApprove2 = await request.post('http://localhost:4000/api/leave/approve', {
      data: {
        requestId,
        approverPersonId: 'p-102',
      },
    });
    expect(resApprove2.status()).toBe(409);
    const bodyApprove2 = await resApprove2.json();
    expect(bodyApprove2.error).toContain('Cannot approve request with status');
  });
});
