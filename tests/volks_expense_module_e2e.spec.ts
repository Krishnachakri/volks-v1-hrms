import { test, expect } from '@playwright/test';

test.describe('VOLKS HRMS — Expense Module Deep E2E Workflow & Business Rules Suite', () => {
  test('Full Employee -> Manager Approval -> Finance Reimbursement -> F5 Persistence -> Rejection Workflow', async ({ page, request }) => {
    // 1. Reset expense claims data for test determinism
    await request.get('http://localhost:4000/api/expenses/claims?personId=p-101&reset=true');

    const uniqueId = Date.now();
    const uniqueClaimDesc = `EXP-CLAIM-CLIENT-DINNER-${uniqueId}`;
    const claimAmount = '2500.00';

    // 2. Open Application & Login as EMPLOYEE
    await page.goto('http://localhost:3000');
    const loginInput = page.locator('#login-email');
    if (await loginInput.isVisible()) {
      await page.click('button:has-text("Employee")');
      await page.click('#login-submit-btn');
      await page.waitForSelector('#logout-btn');
    }

    // 3. Navigate to EXPENSES Tab
    await page.getByTestId('nav-expenses').click();
    await expect(page.locator('h1')).toContainText('Reimbursements & Expense Claims');

    // 4. Open Submit Expense Modal & Fill Form
    await page.click('#submit-expense-btn');
    await page.selectOption('#expense-category-select', 'CLIENT_ENTERTAINMENT');
    await page.fill('#expense-amount', claimAmount);
    await page.fill('#expense-description', uniqueClaimDesc);
    await page.fill('#expense-receipt-url', '/uploads/dinner_receipt.pdf');

    await page.click('#submit-claim-btn');
    await expect(page.locator('#submit-expense-app')).not.toBeVisible({ timeout: 5000 });

    // 5. Verify Claim Listed in Employee Table with PENDING Status
    const claimsTable = page.locator('table');
    await expect(claimsTable).toContainText(uniqueClaimDesc, { timeout: 10000 });
    await expect(claimsTable).toContainText('PENDING');

    // 6. Log in as MANAGER & Approve Claim
    await page.click('#logout-btn');
    await page.waitForSelector('#login-email');
    await page.click('button:has-text("Manager")');
    await page.click('#login-submit-btn');
    await page.waitForSelector('#logout-btn');
    await page.getByTestId('nav-expenses').click();
    await expect(page.locator('p')).toContainText('Manager Approval & Verification Studio');

    const managerPendingCard = page.locator('[id^="expense-card-"]').filter({ hasText: uniqueClaimDesc }).first();
    await expect(managerPendingCard).toBeVisible({ timeout: 5000 });
    await managerPendingCard.locator('button:has-text("Approve Claim")').click();

    await expect(page.getByText('Expense claim approved successfully.').first()).toBeVisible({ timeout: 5000 });

    // 7. Log in as HR_ADMIN & Process Reimbursement
    await page.click('#logout-btn');
    await page.waitForSelector('#login-email');
    await page.click('button:has-text("HR Admin")');
    await page.click('#login-submit-btn');
    await page.waitForSelector('#logout-btn');
    await page.getByTestId('nav-expenses').click();
    await expect(page.locator('p')).toContainText('Organization Reimbursement & Finance Processing Ledger');

    const financeApprovedCard = page.locator('[id^="expense-card-"]').filter({ hasText: uniqueClaimDesc }).first();
    await expect(financeApprovedCard).toBeVisible({ timeout: 5000 });
    await financeApprovedCard.locator('#reimburse-claim-btn').click();

    await expect(page.getByText('Expense claim reimbursed successfully.').first()).toBeVisible({ timeout: 5000 });

    // 8. Log in back as EMPLOYEE & Verify Status REIMBURSED
    await page.click('#logout-btn');
    await page.waitForSelector('#login-email');
    await page.click('button:has-text("Employee")');
    await page.click('#login-submit-btn');
    await page.waitForSelector('#logout-btn');
    await page.getByTestId('nav-expenses').click();
    await expect(claimsTable).toContainText(uniqueClaimDesc);
    await expect(claimsTable).toContainText('REIMBURSED');

    // 9. F5 Reload Persistence Verification
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#logout-btn');
    await page.getByTestId('nav-expenses').click();
    await expect(claimsTable).toContainText(uniqueClaimDesc);
    await expect(claimsTable).toContainText('REIMBURSED');

    // 10. REJECTION WORKFLOW TEST
    const rejClaimDesc = `EXP-CLAIM-TRAVEL-REJECT-${uniqueId}`;

    await page.click('#submit-expense-btn');
    await page.selectOption('#expense-category-select', 'TRAVEL');
    await page.fill('#expense-amount', '12000.00');
    await page.fill('#expense-description', rejClaimDesc);
    await page.click('#submit-claim-btn');
    await expect(page.locator('#submit-expense-app')).not.toBeVisible({ timeout: 5000 });

    // Manager Rejects Request with mandatory reason
    await page.click('#logout-btn');
    await page.waitForSelector('#login-email');
    await page.click('button:has-text("Manager")');
    await page.click('#login-submit-btn');
    await page.waitForSelector('#logout-btn');
    await page.getByTestId('nav-expenses').click();

    const managerRejCard = page.locator('[id^="expense-card-"]').filter({ hasText: rejClaimDesc }).first();
    await managerRejCard.locator('button:has-text("Reject Claim")').click();

    await page.fill('#expense-reject-reason', 'Travel policy budget limit exceeded');
    await page.click('#confirm-expense-reject-btn');

    await expect(page.getByText('Expense claim rejected.').first()).toBeVisible({ timeout: 5000 });

    // Employee sees REJECTED status and reason
    await page.click('#logout-btn');
    await page.waitForSelector('#login-email');
    await page.click('button:has-text("Employee")');
    await page.click('#login-submit-btn');
    await page.waitForSelector('#logout-btn');
    await page.getByTestId('nav-expenses').click();
    await expect(claimsTable).toContainText(rejClaimDesc);
    await expect(claimsTable).toContainText('REJECTED');
    await expect(claimsTable).toContainText('Travel policy budget limit exceeded');
  });

  test('Expense API Boundary & Business Rules Validations', async ({ request }) => {
    // A. Negative Amount Rejection
    const resNeg = await request.post('http://localhost:4000/api/expenses/apply', {
      data: {
        personId: 'p-101',
        category: 'TRAVEL',
        amount: -500,
        description: 'Negative Amount Test',
      },
    });
    expect(resNeg.status()).toBe(400);
    const bodyNeg = await resNeg.json();
    expect(bodyNeg.error).toContain('Amount must be greater than 0');

    // B. Invalid Category Rejection
    const resCat = await request.post('http://localhost:4000/api/expenses/apply', {
      data: {
        personId: 'p-101',
        category: 'LUXURY_CRYPTO',
        amount: 1000,
        description: 'Invalid Category Test',
      },
    });
    expect(resCat.status()).toBe(400);
    const bodyCat = await resCat.json();
    expect(bodyCat.error).toContain('Invalid category');

    // C. Missing Description Rejection
    const resDesc = await request.post('http://localhost:4000/api/expenses/apply', {
      data: {
        personId: 'p-101',
        category: 'MEALS',
        amount: 500,
        description: '   ',
      },
    });
    expect(resDesc.status()).toBe(400);
    const bodyDesc = await resDesc.json();
    expect(bodyDesc.error).toContain('Expense description is required');

    // D. Self-Approval Security Rejection
    const resApply = await request.post('http://localhost:4000/api/expenses/apply', {
      data: {
        personId: 'p-101',
        category: 'SUPPLIES',
        amount: 1500,
        description: `Self Approval Test Claim ${Date.now()}`,
      },
    });
    expect(resApply.status()).toBe(200);
    const { claimId } = await resApply.json();

    const resSelfApprove = await request.post('http://localhost:4000/api/expenses/approve', {
      data: {
        claimId,
        approverPersonId: 'p-101',
      },
    });
    expect(resSelfApprove.status()).toBe(403);
    const bodySelfApprove = await resSelfApprove.json();
    expect(bodySelfApprove.error).toContain('cannot approve their own expense claims');

    // E. Unauthorized Employee Reimbursement Attempt
    const resSelfReimburse = await request.post('http://localhost:4000/api/expenses/reimburse', {
      data: {
        claimId,
        actorPersonId: 'p-102',
        actorRole: 'EMPLOYEE',
      },
    });
    expect(resSelfReimburse.status()).toBe(403);

    // F. Double Reimbursement Prevention
    // 1. Approve cleanly with manager p-102
    const resApprove = await request.post('http://localhost:4000/api/expenses/approve', {
      data: {
        claimId,
        approverPersonId: 'p-102',
      },
    });
    expect(resApprove.status()).toBe(200);

    // 2. Reimburse cleanly with HR_ADMIN
    const resReimburse1 = await request.post('http://localhost:4000/api/expenses/reimburse', {
      data: {
        claimId,
        actorPersonId: 'p-102',
        actorRole: 'HR_ADMIN',
      },
    });
    expect(resReimburse1.status()).toBe(200);

    // 3. Attempt second reimbursement
    const resReimburse2 = await request.post('http://localhost:4000/api/expenses/reimburse', {
      data: {
        claimId,
        actorPersonId: 'p-102',
        actorRole: 'HR_ADMIN',
      },
    });
    expect(resReimburse2.status()).toBe(409);
    const bodyReimburse2 = await resReimburse2.json();
    expect(bodyReimburse2.error).toContain('Only APPROVED claims can be reimbursed');
  });
});
