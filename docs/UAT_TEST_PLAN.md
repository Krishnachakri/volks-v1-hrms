# VOLKS HRMS - UAT Test Plan

> **Target**: Structured Human UAT  
> **Status**: READY FOR UAT  
> **Not certified as**: Production-Ready  
> Version: Phase AUTH Complete  
> Date: 2026-07-27

---

## Setup Before UAT

Refer to [README.md](../README.md) for full setup instructions.

### UAT Login Credentials

> These accounts are **DEVELOPMENT/UAT ONLY**.  
> Created by `scripts/seed.ts` in non-production environments.  
> **Do not use in any environment containing real employee data.**  
> **Do not share publicly.**

| Role | Email | Password |
|---|---|---|
| Employee | employee@volks.com | Password123! |
| Manager | manager@volks.com | Password123! |
| HR Admin | hr@volks.com | Password123! |
| Finance | finance@volks.com | Password123! |
| System Admin | admin@volks.com | Password123! |

The login screen has Quick-Fill buttons for each role for faster switching during UAT.

---

## Defect Severity Classification

| Severity | Definition | Examples |
|---|---|---|
| **P0** | Security vulnerability, data loss, or system completely unusable | Login bypassed, another user's data visible, server crash on common action |
| **P1** | Core workflow is completely blocked | Cannot submit leave, cannot close payroll, cannot terminate employee |
| **P2** | Workflow completes but produces incorrect result | Wrong leave balance after approval, payslip shows wrong amount, wrong role sees wrong data |
| **P3** | Minor UX issue or cosmetic defect | Misaligned UI element, confusing empty state, unclear error message |

### Defect Record Format

```
ID: UAT-<module>-<number>          e.g. UAT-LEAVE-001
Role: <role used>
Module: <module name>
Severity: P0 / P1 / P2 / P3
Precondition: <system state before test>
Steps:
  1. ...
  2. ...
Expected: <what should happen>
Actual: <what actually happened>
API Response: <copy error JSON if relevant>
Screenshot/Video: <attach>
```

---

## UAT SECTION 1 - EMPLOYEE WORKFLOWS

Login as: **employee@volks.com**

### TC-EMP-01: Login and Profile

| Step | Action | Expected Result |
|---|---|---|
| 1 | Open http://localhost:3000 | Login screen appears |
| 2 | Click "Employee" Quick-Fill | Email/password filled automatically, login triggered |
| 3 | Verify login success | Header shows name, "EMPLOYEE" badge, Logout button visible |
| 4 | Navigate to HOME | Role-specific dashboard loads - punch widget, leave summary visible |
| 5 | Navigate to PEOPLE, select own profile | 360 profile shows correct name, department, role |
| 6 | Press F5 to refresh | Still logged in, same screen loads (session is persistent) |

### TC-EMP-02: Attendance

| Step | Action | Expected Result |
|---|---|---|
| 1 | Navigate to TIME module | Monthly attendance calendar loads |
| 2 | Click Check In | Today's cell updates to show check-in time |
| 3 | Click Check Out | Today's cell shows both check-in and check-out |
| 4 | Refresh page | Attendance records persist - not reset |
| 5 | Click a past day | Day detail drawer opens with attendance record |
| 6 | Submit an On Duty regularization | Confirmation message shown, record appears |

### TC-EMP-03: Leave Application

| Step | Action | Expected Result |
|---|---|---|
| 1 | Navigate to LEAVE module | Leave balances shown (Casual, Sick, Earned) |
| 2 | Note current Casual leave balance | e.g. 12 days available |
| 3 | Apply for 1 day Casual leave | Success message, request appears as PENDING |
| 4 | Refresh page | Request still shows as PENDING (not reset) |
| 5 | Switch to Manager login, approve the request | (done in Manager section TC-MGR-02) |
| 6 | Switch back to Employee login | Request shows APPROVED, balance reduced by 1 |

### TC-EMP-04: Expense Claim

| Step | Action | Expected Result |
|---|---|---|
| 1 | Navigate to EXPENSES or HOME dashboard | Expense claim form accessible |
| 2 | Submit expense: TRAVEL, amount 1500, description "Client visit" | Success message |
| 3 | Refresh page | Claim visible as PENDING |
| 4 | After manager approves (TC-MGR-03): verify status | Shows APPROVED |

### TC-EMP-05: Payslip

| Step | Action | Expected Result |
|---|---|---|
| 1 | Navigate to PAY or own 360 profile | Payslip section visible |
| 2 | View most recent payslip | Shows gross, deductions, net pay breakdown |
| 3 | Verify itemization | Basic, HRA, allowances, PF, PT, LOP visible |

### TC-EMP-06: Resignation

| Step | Action | Expected Result |
|---|---|---|
| 1 | Navigate to LIFECYCLE | Resignation/offboarding section visible |
| 2 | Submit resignation | Resignation recorded with date |
| 3 | Verify HR is notified / request visible in HR queue | (verify in HR section TC-HR-06) |

### TC-EMP-07: Logout

| Step | Action | Expected Result |
|---|---|---|
| 1 | Click Logout button | Redirected to login screen |
| 2 | Try browser back button | Should NOT return to authenticated state |
| 3 | Try accessing http://localhost:3000 | Login screen shown (not dashboard) |

---

## UAT SECTION 2 - MANAGER WORKFLOWS

Login as: **manager@volks.com**

### TC-MGR-01: Team Visibility

| Step | Action | Expected Result |
|---|---|---|
| 1 | Login as Manager | Manager dashboard loads |
| 2 | Navigate to HOME | Manager-specific widgets: pending approvals queue visible |
| 3 | Navigate to PEOPLE | Directory loads - should show all employees |
| 4 | Select a team member's 360 profile | Profile opens - manager can view |
| 5 | Try to view payroll run controls | Should NOT see payroll close/lock buttons (HR Admin only) |

### TC-MGR-02: Leave Approval

| Step | Action | Expected Result |
|---|---|---|
| 1 | Ensure TC-EMP-03 was run first (Employee submitted leave) | |
| 2 | Navigate to LEAVE as Manager | "Pending Manager Approvals Queue" section visible |
| 3 | Find the employee's pending request | Card visible with name, dates, type |
| 4 | Click Approve | Success message. Status changes to APPROVED |
| 5 | Verify employee balance deducted (switch to Employee login) | Leave balance reduced |
| 6 | Try to reject a different request | Same rejection flow works |

### TC-MGR-03: Expense Approval

| Step | Action | Expected Result |
|---|---|---|
| 1 | Ensure TC-EMP-04 was run first | |
| 2 | Navigate to EXPENSES or HOME as Manager | Pending expense claims visible |
| 3 | Approve the employee's TRAVEL claim | Success message, status changes to APPROVED |
| 4 | Try to reimburse (mark as reimbursed) | Should be blocked - FINANCE role required |

### TC-MGR-04: Scope Isolation (Negative Test)

| Step | Action | Expected Result |
|---|---|---|
| 1 | As Manager, note your own person ID from profile | |
| 2 | Try to approve leave for an employee NOT in your team | Should return 403 or show as inaccessible |
| 3 | Try to access payroll close endpoint directly via browser fetch | Should return 403 |

---

## UAT SECTION 3 - HR ADMIN WORKFLOWS

Login as: **hr@volks.com**

### TC-HR-01: People Module

| Step | Action | Expected Result |
|---|---|---|
| 1 | Navigate to PEOPLE | Full directory loads |
| 2 | Search/filter employees | Filter works correctly |
| 3 | View any employee 360 profile | All sections visible including employment history |
| 4 | View employment changes timeline | Shows historical changes if any |

### TC-HR-02: Talent / ATS

| Step | Action | Expected Result |
|---|---|---|
| 1 | Navigate to TALENT | ATS Kanban/pipeline loads |
| 2 | Create a new job requisition | Requisition created with code, title, department |
| 3 | Add a candidate to the requisition | Candidate appears in pipeline |
| 4 | Move candidate through stages: SCREENING -> INTERVIEW -> SELECTED | Each stage transition persists |
| 5 | Create an offer for the candidate | Offer record created with salary breakdown |
| 6 | Accept the offer and hire | Person, user, engagement, salary, leave records created atomically |
| 7 | Verify hired person appears in PEOPLE module | New employee visible in directory |

### TC-HR-03: Lifecycle - Promotion

| Step | Action | Expected Result |
|---|---|---|
| 1 | Navigate to LIFECYCLE | Lifecycle Studio loads |
| 2 | Initiate a promotion for an employee | New employment change record created with new title/grade |
| 3 | Verify employment history | Previous and new role both visible in timeline |

### TC-HR-04: Lifecycle - Transfer

| Step | Action | Expected Result |
|---|---|---|
| 1 | Initiate a department transfer | Transfer recorded with effective date |
| 2 | Verify new department shows on 360 profile | Department updated |

### TC-HR-05: Payroll Operations

| Step | Action | Expected Result |
|---|---|---|
| 1 | Navigate to PAY module | Payroll controls visible |
| 2 | Process payroll for current month | Processing completes |
| 3 | Lock payroll for current month | Status changes to LOCKED |
| 4 | Try to lock the same month again | Should return 409 Conflict |
| 5 | View payslips generated | Payslips available for all employees |

### TC-HR-06: Offboarding and Termination

| Step | Action | Expected Result |
|---|---|---|
| 1 | Navigate to LIFECYCLE | Offboarding section visible |
| 2 | Initiate offboarding for the employee who resigned (TC-EMP-06) | Clearance checklist appears |
| 3 | Complete clearance items | Manager handover, IT access, finance dues, docs |
| 4 | Execute final termination | Engagement state = TERMINATED, `is_active = false` |
| 5 | Verify terminated user cannot login | Login attempt returns 403 Account Deactivated |
| 6 | If terminated user was logged in during termination | Any subsequent API call should return 401 SESSION_REVOKED |

---

## UAT SECTION 4 - FINANCE WORKFLOWS

Login as: **finance@volks.com**

### TC-FIN-01: Expense Reimbursement

| Step | Action | Expected Result |
|---|---|---|
| 1 | Login as Finance | Finance dashboard visible |
| 2 | Navigate to EXPENSES | Approved expense claims visible |
| 3 | Mark an approved claim as reimbursed | Status changes to REIMBURSED |
| 4 | Verify Finance cannot approve claims (only reimburse) | Approve button not visible or returns 403 |

### TC-FIN-02: Payroll Finance Operations

| Step | Action | Expected Result |
|---|---|---|
| 1 | Navigate to PAY module | Finance-permitted payroll operations visible |
| 2 | Try to access HR-only lifecycle operations | Should be blocked with 403 |
| 3 | Verify Finance cannot terminate employees | Termination action not available |

---

## UAT SECTION 5 - SYSTEM ADMIN WORKFLOWS

Login as: **admin@volks.com**

### TC-ADMIN-01: Configuration

| Step | Action | Expected Result |
|---|---|---|
| 1 | Login as System Admin | Admin dashboard loads |
| 2 | Navigate to ADMIN module | Configuration options visible |
| 3 | Create a new department | Department created successfully |
| 4 | Configure shift policies | Shift policy saved |

### TC-ADMIN-02: Admin Authorization Boundaries

| Step | Action | Expected Result |
|---|---|---|
| 1 | As System Admin, access all modules | All modules accessible |
| 2 | Verify admin cannot bypass MANAGER scope rules | Admin acting on behalf of specific team still respects hierarchy |

---

## UAT SECTION 6 - CROSS-ROLE NEGATIVE TESTS

These tests verify that role boundaries are enforced server-side, not just hidden in the UI.

### TC-NEG-01: Employee Cannot Close Payroll

| Test | Method | Expected |
|---|---|---|
| Employee sends POST /api/payroll/lock with session cookie | Browser fetch or Postman | HTTP 403 ROLE_FORBIDDEN |

### TC-NEG-02: Employee Cannot Approve Own Leave

| Test | Method | Expected |
|---|---|---|
| Employee sends POST /api/leave/approve for their own request | Browser fetch | HTTP 403 ROLE_FORBIDDEN |

### TC-NEG-03: Manager Cannot Access Other Manager's Team

| Test | Method | Expected |
|---|---|---|
| Manager sends leave approval for employee not in their hierarchy | UI or direct API call | HTTP 403 MANAGER_SCOPE_VIOLATION |

### TC-NEG-04: Finance Cannot Terminate Employee

| Test | Method | Expected |
|---|---|---|
| Finance user sends POST /api/lifecycle/terminate | Direct API call | HTTP 403 ROLE_FORBIDDEN |

### TC-NEG-05: Unauthenticated Access

| Test | Method | Expected |
|---|---|---|
| Clear all cookies, access any protected endpoint | Browser or Postman | HTTP 401 UNAUTHENTICATED |

### TC-NEG-06: Terminated Employee Session

| Test | Method | Expected |
|---|---|---|
| Log in as an employee, keep session open. HR Admin terminates that employee. Next API call from the original session. | Two browser tabs | HTTP 401 SESSION_REVOKED |

### TC-NEG-07: Login Rate Limiting

| Test | Method | Expected |
|---|---|---|
| Submit 11+ login attempts with wrong password rapidly | Postman or browser | 11th attempt returns HTTP 429 with Retry-After header |

---

## UAT Startup Smoke Test

Before beginning UAT, verify the system is healthy:

```
1. PostgreSQL running       -> GET /ready returns { "status": "READY" }
2. API server running       -> GET /health returns { "status": "UP" }
3. Frontend running         -> http://localhost:3000 shows Login screen
4. Login as Employee        -> Session cookie set, dashboard loads
5. GET /api/auth/me         -> Returns correct user profile
6. Login as Manager         -> Manager dashboard and team queue visible
7. Login as HR Admin        -> All HR controls visible
8. Login as Finance         -> Finance-scoped view visible
9. Login as System Admin    -> Admin configuration visible
10. Logout                  -> Redirected to login screen, back button does not restore session
```

All 10 smoke checks must pass before UAT begins.