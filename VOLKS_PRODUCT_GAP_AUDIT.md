# VOLKS HRMS — Product Operational Gap Audit

> **Audit Objective**:
> Evaluate VOLKS HRMS against real-world operational HRMS requirements and the reference system screenshots in `/media` (`hrms-hero.png`, `hrms-attendance.png`, `hrms-salary.png`, `hrms-requisition.png`, `hrms-appraisal.png`, `hrms-pwa.png`).

---

## 1. Executive Summary & Audit Matrix

| Module | Capability / Workflow | Backend API | UI Surface | E2E Verification | Action Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **HOME** | Employee "What I Need Today" Dashboard | `[PARTIAL]` | `[PARTIAL]` | `[VERIFIED]` | Redesign to operational daily dashboard |
| | Manager Approval & Attendance Exception Home | `[EXISTS]` | `[PARTIAL]` | `[VERIFIED]` | Add Manager Approval Inbox & Team Absence list |
| | HR Admin Lifecycle & Hiring Summary | `[EXISTS]` | `[PARTIAL]` | `[VERIFIED]` | Add HR Action Center |
| | Payroll Readiness & Lock Home | `[EXISTS]` | `[PARTIAL]` | `[VERIFIED]` | Add Payroll Execution Widget |
| **PEOPLE** | Employee Directory & Search | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Add Department & Designation Filters |
| | Employee 360 Profile & Job Details | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Expand Documents & Asset tabs |
| | Organization Structure & Department Setup | `[EXISTS]` | `[PARTIAL]` | `[VERIFIED]` | Build Visual Org Hierarchy Tree |
| **TIME** | Interactive Monthly Attendance Calendar | `[EXISTS]` | `[PARTIAL]` | `[VERIFIED]` | Build Full Monthly Grid Calendar + Day Detail Drawer |
| | Punch Check-In / Check-Out Control | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Keep & link to punch history log |
| | Punch History & Working Hours Summary | `[EXISTS]` | `[PARTIAL]` | `[VERIFIED]` | Build Punch Log Table with Late/Early badges |
| | Attendance Regularization Workflow | `[EXISTS]` | `[PARTIAL]` | `[VERIFIED]` | Build Employee Request Modal & Manager Approval Inbox |
| | On Duty (OD) Workflow | `[EXISTS]` | `[MISSING]` | `[UNVERIFIED]` | Build Apply OD Form & Approval Flow |
| | Work From Home (WFH) Request | `[EXISTS]` | `[MISSING]` | `[UNVERIFIED]` | Build Apply WFH Form & Approval Flow |
| | Shift Roster & Holiday Calendar | `[EXISTS]` | `[PARTIAL]` | `[VERIFIED]` | Build Holiday & Shift Calendar View |
| **LEAVE** | Leave Balances (Entitlement, Consumed, Remaining) | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Display Leave Cards with Remaining Days |
| | Apply Leave (Half-Day, Range, Reason, LOP) | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Add Half-Day toggle & Insufficient Balance guard |
| | Leave Approval Queue & Team Leave Calendar | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Build Manager Team Leave Calendar |
| **PAY** | Salary Structures (Basic, HRA, Allowances) | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Build Structure Breakup Table |
| | Monthly Payroll Execution & Locking | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Build One-Click Lock & Rerun Guard |
| | Statutory Deductions (PF, PT, TDS) | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Display Statutory Component Breakup |
| | Itemized Payslips & PDF Generation | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Render Payslip Viewer & Download Link |
| **EXPENSES** | Expense Claim Submission | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Add Category & Amount Validation |
| | Manager Expense Approval Inbox | `[EXISTS]` | `[PARTIAL]` | `[VERIFIED]` | Build Manager Expense Approval Queue |
| **TALENT** | Job Requisitions & Recruitment Pipeline | `[EXISTS]` | `[PARTIAL]` | `[VERIFIED]` | Build Recruitment Kanban (Reference `hrms-requisition.png`) |
| | Candidate Hiring & Onboarding | `[EXISTS]` | `[PARTIAL]` | `[VERIFIED]` | Connect Candidate `HIRED` action to Person Creation |
| | Performance Reviews & Appraisals | `[EXISTS]` | `[PARTIAL]` | `[VERIFIED]` | Build Appraisal Review Form (Reference `hrms-appraisal.png`) |
| **LIFECYCLE** | Promotions & Salary Revisions | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Keep Bitemporal Timeline view |
| | Asset Assignment & Return | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Build Asset List & Return Clearance |
| | Offboarding & Final Settlement | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Add Immediate Credentials Revocation |
| **ADMIN** | Company Configuration & Departments | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Build Department & Policy Form |
| | Audit Logs & Access Control | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Relocate Dual-Axis Time Machine to Integrity Tab |
| **INTEGRITY** | Dual-Axis Time Machine & Audit Investigation | `[EXISTS]` | `[EXISTS]` | `[VERIFIED]` | Preserved under Integrity Tab |

---

## 2. /media Reference Screenshot Mapping

1. **`hrms-attendance.png`** $\longrightarrow$ **TIME Module**:
   - Monthly grid calendar with color-coded day pills (`PRESENT` green, `LATE` amber, `ABSENT` red, `LEAVE` blue, `HOLIDAY` purple).
   - Day click opens drawer displaying Shift, First Punch, Last Punch, Total Hours, Late minutes, and Regularize button.
2. **`hrms-salary.png`** $\longrightarrow$ **PAY Module**:
   - Salary breakup card showing Basic (50%), HRA (30%), Special Allowance, PF deduction (12% capped at ₹1,800), Professional Tax (₹200), and Net Salary.
   - Monthly payroll lock status badge & PDF download button.
3. **`hrms-requisition.png`** $\longrightarrow$ **TALENT Module**:
   - Job openings table + Candidate hiring pipeline stages (Applied $\to$ Interview $\to$ Offered $\to$ Hired).
4. **`hrms-appraisal.png`** $\longrightarrow$ **TALENT Module**:
   - Performance Appraisal review form with rating sliders, goals, competencies, manager comments, and final score.
5. **`hrms-hero.png` & `hrms-pwa.png`** $\longrightarrow$ **HOME & Employee Self-Service**:
   - Quick punch widget, leave balances summary, team attendance widget, and operational notifications.

---

## 3. Product Architecture Decision Log

- **DECISION 1**: Relocate Dual-Axis Time Machine from main navigation home to **Integrity / Audit** tab so normal employees have a clean operational daily dashboard.
- **DECISION 2**: Build an interactive Monthly Attendance Calendar in **TIME** with Day Detail Drawer, Regularization, and On Duty (OD) application flows.
- **DECISION 3**: Build dedicated Manager Approval Inboxes for Leave, Attendance Regularizations, On Duty, and Expense claims.
- **DECISION 4**: Preserve all 18 core VOLKS backend modules, bitemporal ledger, and PostgreSQL schema integrity while building complete frontend UI surfaces.
