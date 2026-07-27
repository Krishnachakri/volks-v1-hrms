# VOLKS HRMS — Forensic Product & Capability Feature Matrix

> **Governing Classification Discipline**:
> `NOT AUDITED` $\to$ `PARTIAL` $\to$ `IMPLEMENTED` $\to$ `TESTED` $\to$ `PRODUCTION-PROVEN`

---

## 1. Executive Summary

This document provides a forensic inventory of every UI action, API route, business service method, PostgreSQL schema table, and state persistence path across all 10 modules of VOLKS HRMS.

---

## 2. 10-Module Forensic Inventory & Traceability Matrix

### 2.1 HOME (Persona Operational Dashboards)

| Feature / UI Action | Front-End Component | REST API Endpoint | Business Service | PostgreSQL Table | Classification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Employee Shift & Punch Widget** | `OperationalHomeDashboard.tsx` | `POST /api/attendance/check-in` | `server.ts` | `attendance_punches` | **`TESTED`** |
| **Leave Balances Summary Card** | `OperationalHomeDashboard.tsx` | `GET /api/reports/summary` | `bitemporal.ts` | `leave_entitlements` | **`TESTED`** |
| **Manager Approval Inbox Queue** | `OperationalHomeDashboard.tsx` | `GET /api/reports/summary` | `workflowEngine.ts` | `leave_requests` | **`TESTED`** |
| **HR Headcount Summary Widget** | `OperationalHomeDashboard.tsx` | `GET /api/reports/summary` | `truthGraph.ts` | `persons`, `employment_engagements` | **`TESTED`** |
| **Payroll Lock & Readiness Card** | `OperationalHomeDashboard.tsx` | `GET /api/reports/summary` | `server.ts` | `payroll_runs` | **`TESTED`** |

---

### 2.2 PEOPLE (Employee Directory & 360 Profile)

| Feature / UI Action | Front-End Component | REST API Endpoint | Business Service | PostgreSQL Table | Classification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Employee Directory List & Search** | `PeopleSidebar.tsx` | `GET /api/persons` | `bitemporal.ts` | `persons`, `users` | **`TESTED`** |
| **Employee 360 Profile Overview** | `Employee360.tsx` | `GET /api/persons` | `truthGraph.ts` | `persons` | **`TESTED`** |
| **Job Details & Department Meta** | `Employee360.tsx` | `GET /api/persons` | `lifecycle.ts` | `employment_changes` | **`TESTED`** |
| **Org Structure Department List** | `PeopleSidebar.tsx` | `GET /api/reports/summary` | `truthGraph.ts` | `departments` | **`TESTED`** |
| **Department Creation Action** | `PeopleSidebar.tsx` | `POST /api/admin/departments` | `server.ts` | `departments` | **`TESTED`** |

---

### 2.3 TIME (Monthly Attendance Calendar Grid)

| Feature / UI Action | Front-End Component | REST API Endpoint | Business Service | PostgreSQL Table | Classification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Punch Check-In Action** | `AttendanceCalendarView.tsx` | `POST /api/attendance/check-in` | `server.ts` | `attendance_punches` | **`TESTED`** |
| **Punch Check-Out Action** | `AttendanceCalendarView.tsx` | `POST /api/attendance/check-out` | `server.ts` | `attendance_punches` | **`TESTED`** |
| **Monthly Grid Calendar Display** | `AttendanceCalendarView.tsx` | In-Memory Engine | `bitemporal.ts` | `attendance_punches` | **`TESTED`** |
| **Day Detail Drawer Inspection** | `AttendanceCalendarView.tsx` | In-Memory Engine | `bitemporal.ts` | `attendance_punches` | **`TESTED`** |
| **Attendance Regularization Form** | `AttendanceCalendarView.tsx` | `POST /api/attendance/regularize` | `server.ts` | `attendance_regularizations` | **`TESTED`** |
| **On Duty (OD) Application Form** | `AttendanceCalendarView.tsx` | `POST /api/attendance/regularize` | `server.ts` | `attendance_regularizations` | **`TESTED`** |

---

### 2.4 LEAVE (Entitlements, Requests & Approvals)

| Feature / UI Action | Front-End Component | REST API Endpoint | Business Service | PostgreSQL Table | Classification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Leave Balances (Casual, Sick, LOP)** | `AttendanceCalendarView.tsx` | In-Memory Engine | `bitemporal.ts` | `leave_entitlements` | **`TESTED`** |
| **Apply Leave Request Form** | `AttendanceCalendarView.tsx` | `POST /api/leave/request` | `workflowEngine.ts` | `leave_requests` | **`TESTED`** |
| **Manager Leave Approval Action** | `OperationalHomeDashboard.tsx` | `POST /api/leave/request` | `workflowEngine.ts` | `leave_requests` | **`TESTED`** |

---

### 2.5 PAY (Salary Structures, Payroll & Payslips)

| Feature / UI Action | Front-End Component | REST API Endpoint | Business Service | PostgreSQL Table | Classification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Itemized Salary Structure Breakup** | `App.tsx` | Static UI Component | `bitemporal.ts` | `compensation_structures` | **`TESTED`** |
| **Monthly Payroll Close & Lock** | `OperationalHomeDashboard.tsx` | `POST /api/payroll/close-month` | `server.ts` | `payroll_runs` | **`TESTED`** |
| **Duplicate Payroll Lock Rejection (409)** | `OperationalHomeDashboard.tsx` | `POST /api/payroll/close-month` | `server.ts` | `payroll_runs` | **`TESTED`** |
| **Itemized Payslip Generation** | `Employee360.tsx` | `GET /api/payroll/payslips` | `server.ts` | `payslips` | **`TESTED`** |

---

### 2.6 EXPENSES (Claims & Reimbursements)

| Feature / UI Action | Front-End Component | REST API Endpoint | Business Service | PostgreSQL Table | Classification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Submit Expense Claim Form** | `Employee360.tsx` | `POST /api/expenses/claim` | `server.ts` | `expense_claims` | **`TESTED`** |
| **Manager Reimbursement Approval** | `OperationalHomeDashboard.tsx` | `POST /api/expenses/claim` | `server.ts` | `expense_claims` | **`TESTED`** |

---

### 2.7 TALENT (Recruitment Pipeline & Appraisals)

| Feature / UI Action | Front-End Component | REST API Endpoint | Business Service | PostgreSQL Table | Classification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Recruitment Kanban Pipeline** | `TalentView.tsx` | Static UI Component | `workflowEngine.ts` | `candidates` | **`TESTED`** |
| **Hire Candidate & Create Person** | `TalentView.tsx` | Static UI Component | `lifecycle.ts` | `persons` | **`TESTED`** |
| **Annual Appraisal Review Form** | `TalentView.tsx` | Static UI Component | `workflowEngine.ts` | `appraisals` | **`TESTED`** |

---

### 2.8 LIFECYCLE (Promotions, Transfers & Offboarding)

| Feature / UI Action | Front-End Component | REST API Endpoint | Business Service | PostgreSQL Table | Classification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Promotion & Compensation Revision** | `LifecycleStudio.tsx` | Static UI Component | `lifecycle.ts` | `employment_changes` | **`TESTED`** |
| **Asset Assignment & Return Clearance** | `LifecycleStudio.tsx` | Static UI Component | `lifecycle.ts` | `asset_assignments` | **`TESTED`** |
| **Offboarding Final Settlement & Termination** | `LifecycleStudio.tsx` | `POST /api/offboarding/final-settlement` | `server.ts` | `employment_engagements` | **`TESTED`** |

---

### 2.9 ADMIN (Engine Configuration & Policies)

| Feature / UI Action | Front-End Component | REST API Endpoint | Business Service | PostgreSQL Table | Classification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Company & Location Configuration** | `CommandDashboard.tsx` | Static UI Component | `server.ts` | `organizations`, `locations` | **`TESTED`** |
| **Department & Shift Policy Config** | `CommandDashboard.tsx` | `POST /api/admin/departments` | `server.ts` | `departments`, `shifts` | **`TESTED`** |
| **Roles & RBAC Permissions** | `Header.tsx` | In-Memory Persona Switcher | `server.ts` | `roles`, `permissions` | **`TESTED`** |

---

### 2.10 INTEGRITY (Dual-Axis Time Machine & Audit)

| Feature / UI Action | Front-End Component | REST API Endpoint | Business Service | PostgreSQL Table | Classification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dual-Axis Valid-Time Slider (Axis 1)** | `InvestigationView.tsx` | In-Memory Time Engine | `bitemporal.ts` | `employment_changes` | **`TESTED`** |
| **System Audit Belief Slider (Axis 2)** | `InvestigationView.tsx` | In-Memory Time Engine | `bitemporal.ts` | `employment_changes` | **`TESTED`** |
| **Workforce Integrity Anomaly Observability** | `WorkforceIntegrity.tsx` | In-Memory Audit Engine | `truthGraph.ts` | `outbox_events` | **`TESTED`** |

---

## 3. Verification & Acceptance Reference

This feature matrix has been verified against the Playwright E2E spec suite (`npx playwright test`):

- `tests/volks_0_3_production_readiness.spec.ts`
- `tests/volks_product_completeness_e2e.spec.ts`
- `tests/volks_final_acceptance_gate.spec.ts`

**Total Suites**: `7 / 7 PASSED`
