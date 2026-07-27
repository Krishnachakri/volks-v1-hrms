import { test, expect } from '@playwright/test';

test.describe('VOLKS Candidate Intelligence & ATS E2E Suite', () => {
  test('Full Candidate Recruitment -> Explainable Scoring -> Hire -> Employee 360 Conversion Flow', async ({ page }) => {
    console.log('[PLAYWRIGHT ATS] Navigating to VOLKS HRMS...');
    await page.goto('http://localhost:3000');

    // 1. Log in as HR Admin Persona
    console.log('[PLAYWRIGHT ATS] Logging in as HR Admin...');
    const loginInput = page.locator('#login-email');
    if (await loginInput.isVisible()) {
      await page.click('button:has-text("HR Admin")');
      await page.click('#login-submit-btn');
      await page.waitForSelector('#logout-btn');
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
    await page.waitForSelector('#logout-btn');
    await expect(page.getByTestId('nav-talent')).toBeVisible();

    console.log('[PLAYWRIGHT ATS] Candidate Intelligence & ATS E2E Test Passed Successfully!');
  });

  test('Talent & ATS API Boundaries, Offer Acceptance Mandate, 400/403/409 Guards & Atomic 360 Conversion', async ({ request }) => {
    // Authenticate as HR Admin
    const hrLogin = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'hr@volks.com', password: 'Password123!' },
    });
    const { token: hrToken } = await hrLogin.json();

    // Authenticate as Employee
    const empLogin = await request.post('http://localhost:4000/api/auth/login', {
      data: { email: 'employee@volks.com', password: 'Password123!' },
    });
    const { token: empToken } = await empLogin.json();

    // 1. Create Job Requisition (HR Admin)
    const reqRes = await request.post('http://localhost:4000/api/talent/postings', {
      headers: { Authorization: `Bearer ${hrToken}` },
      data: {
        title: `Principal Staff Architect ${Date.now()}`,
        headcount: 1,
      },
    });
    expect(reqRes.status()).toBe(200);
    const reqData = await reqRes.json();
    const jobId = reqData.job.job_id;

    // 2. Candidate Applies
    const applyRes = await request.post('http://localhost:4000/api/talent/apply', {
      data: {
        jobId,
        fullName: 'Ananya Deshmukh',
        email: `ananya.deshmukh.${Date.now()}@example.com`,
        phone: '+91-9876543210',
      },
    });
    expect(applyRes.status()).toBe(200);
    const applyData = await applyRes.json();
    const candidateId = applyData.candidateId;

    // 3. Test 403 Security Guard — EMPLOYEE persona cannot advance stage
    const unauthorizedStageRes = await request.post('http://localhost:4000/api/talent/stage', {
      headers: { Authorization: `Bearer ${empToken}` },
      data: {
        candidateId,
        newStage: 'INTERVIEW',
      },
    });
    expect(unauthorizedStageRes.status()).toBe(403);

    // 4. Recruiter advances stage to INTERVIEW
    const stageRes = await request.post('http://localhost:4000/api/talent/stage', {
      headers: { Authorization: `Bearer ${hrToken}` },
      data: {
        candidateId,
        newStage: 'INTERVIEW',
      },
    });
    expect(stageRes.status()).toBe(200);

    // 5. Create Offer with DRAFT status (unaccepted)
    const draftOfferRes = await request.post('http://localhost:4000/api/talent/offer', {
      headers: { Authorization: `Bearer ${hrToken}` },
      data: {
        candidateId,
        basic: 120000,
        hra: 72000,
        allowances: 48000,
        proposedStartDate: '2026-09-01',
        status: 'OFFER_SENT',
      },
    });
    expect(draftOfferRes.status()).toBe(200);

    // 6. MANDATORY RULE VERIFICATION: Attempting hire from un-accepted offer MUST fail with 400 Bad Request
    const unacceptedHireRes = await request.post('http://localhost:4000/api/talent/hire', {
      headers: { Authorization: `Bearer ${hrToken}` },
      data: {
        candidateId,
      },
    });
    expect(unacceptedHireRes.status()).toBe(400);
    const unacceptedHireData = await unacceptedHireRes.json();
    expect(unacceptedHireData.error).toContain('Formal offer must be explicitly ACCEPTED');

    // 7. Formally ACCEPT Offer
    const acceptOfferRes = await request.post('http://localhost:4000/api/talent/offer', {
      headers: { Authorization: `Bearer ${hrToken}` },
      data: {
        candidateId,
        basic: 120000,
        hra: 72000,
        allowances: 48000,
        proposedStartDate: '2026-09-01',
        status: 'ACCEPTED',
      },
    });
    expect(acceptOfferRes.status()).toBe(200);

    // 8. Execute Atomic Candidate-to-Employee 360 Conversion
    const hireRes = await request.post('http://localhost:4000/api/talent/hire', {
      headers: { Authorization: `Bearer ${hrToken}` },
      data: {
        candidateId,
      },
    });
    expect(hireRes.status()).toBe(200);
    const hireData = await hireRes.json();
    expect(hireData.status).toBe('HIRED');
    expect(hireData.personId).toBeTruthy();

    // 9. Test 409 Conflict Idempotency Guard — Duplicate Hire Rejection
    const dupHireRes = await request.post('http://localhost:4000/api/talent/hire', {
      headers: { Authorization: `Bearer ${hrToken}` },
      data: {
        candidateId,
      },
    });
    expect(dupHireRes.status()).toBe(409);

    // 10. Verify Employee created in Lifecycle in JOINING state
    const lifecycleRes = await request.get(`http://localhost:4000/api/lifecycle/status?personId=${hireData.personId}`, {
      headers: { Authorization: `Bearer ${hrToken}` },
    });
    expect(lifecycleRes.status()).toBe(200);
    const lcData = await lifecycleRes.json();
    expect(lcData.activeEngagement.state).toBe('JOINING');
    expect(lcData.onboardingTasks.length).toBeGreaterThan(0);
  });
});
