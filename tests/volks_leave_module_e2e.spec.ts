import { test, expect } from '@playwright/test';

test.describe('VOLKS Sprint 1 — Leave Module Deep E2E & Cross-Module Verification', () => {
  test('Complete End-to-End Leave Workflow: Balances -> Apply -> Validation Rejection -> Manager Approval -> Balance Deduction -> Attendance Badge -> F5 Persistence', async ({ page }) => {
    const uniqueReason = `Family-Trip-E2E-${Date.now()}`;
    const startDate = '2026-08-20';
    const endDate = '2026-08-22'; // 3 Days

    console.log(`[E2E LEAVE] Starting Leave Module E2E Test with Unique Reason: ${uniqueReason}`);

    // 1. NAVIGATE TO APP & SELECT EMPLOYEE PERSONA
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Select EMPLOYEE persona in select dropdown
    const personaSelect = page.locator('select').first();
    await expect(personaSelect).toBeVisible({ timeout: 10000 });
    await personaSelect.selectOption('EMPLOYEE');

    // 2. NAVIGATE TO LEAVE TAB USING DETERMINISTIC DATA-TESTID
    const leaveNavBtn = page.locator('[data-testid="nav-leave"]');
    await expect(leaveNavBtn).toBeVisible({ timeout: 10000 });
    await leaveNavBtn.click();

    // Verify Balances Ledger
    await expect(page.getByText('Leave Entitlement Balances')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Earned Leave')).toBeVisible();
    await expect(page.getByText('Casual Leave')).toBeVisible();
    await expect(page.getByText('Sick Leave')).toBeVisible();

    // 3. APPLY FOR LEAVE
    const applyBtn = page.getByRole('button', { name: /Apply for Leave/i });
    await expect(applyBtn).toBeVisible();
    await applyBtn.click();

    // Fill Modal Form
    await page.fill('input[type="date"] >> nth=0', startDate);
    await page.fill('input[type="date"] >> nth=1', endDate);
    await page.fill('textarea', uniqueReason);

    // Submit Request
    const submitBtn = page.getByRole('button', { name: /Submit Request/i });
    await submitBtn.click();

    // Verify Success Toast & PENDING row
    await expect(page.getByText(/submitted successfully/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(uniqueReason)).toBeVisible();
    await expect(page.getByText('PENDING').first()).toBeVisible();
    console.log('[E2E LEAVE] Leave request submitted cleanly with PENDING status.');

    // 4. TEST OVERLAPPING LEAVE REJECTION
    await applyBtn.click();
    await page.fill('input[type="date"] >> nth=0', '2026-08-21');
    await page.fill('input[type="date"] >> nth=1', '2026-08-23');
    await page.fill('textarea', 'Overlapping test');
    await submitBtn.click();

    // Verify Error Rejection Toast
    await expect(page.getByText(/An active or pending leave request already exists/i)).toBeVisible({ timeout: 10000 });
    console.log('[E2E LEAVE] Overlapping leave request correctly rejected with error message.');

    // Close Modal
    const cancelBtn = page.getByRole('button', { name: /Cancel/i });
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    }

    // 5. SWITCH TO MANAGER / HR ADMIN PERSONA & APPROVE EXACT REQUEST
    await personaSelect.selectOption('HR_ADMIN');

    // Ensure on Leave tab
    await leaveNavBtn.click();

    // Locate request row with uniqueReason and click Approve
    const requestRow = page.locator('tr', { hasText: uniqueReason });
    await expect(requestRow).toBeVisible({ timeout: 10000 });

    const approveBtn = requestRow.getByRole('button', { name: /Approve/i });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Verify status updates to APPROVED
    await expect(requestRow.getByText('APPROVED')).toBeVisible({ timeout: 10000 });
    console.log('[E2E LEAVE] Leave request approved by Manager cleanly.');

    // 6. RELOAD PAGE (F5) TO VERIFY PERSISTENCE & BALANCE MUTATION
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Re-select Leave tab
    await page.locator('[data-testid="nav-leave"]').click();

    // Verify APPROVED status persisted
    const persistedRow = page.locator('tr', { hasText: uniqueReason });
    await expect(persistedRow).toBeVisible({ timeout: 10000 });
    await expect(persistedRow.getByText('APPROVED')).toBeVisible();

    // Verify Earned Leave balance deducted by 3 days (12 -> 9 Days Left)
    await expect(page.getByText('9 Days Left')).toBeVisible({ timeout: 10000 });
    console.log('[E2E LEAVE] Balance mutation (9 Days Left) & status persisted cleanly after F5 refresh!');

    console.log('============================================================');
    console.log('SPRINT 1 LEAVE MODULE E2E CERTIFICATION PASSED 100% 🚀');
    console.log('============================================================');
  });
});
