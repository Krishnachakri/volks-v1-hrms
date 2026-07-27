# VOLKS HRMS — 30-Day Operational Shadow Pilot Plan (`docs/SHADOW_PILOT_PLAN.md`)

> **Governing Discipline**:
> This document details the 30-day operational shadow HR pilot protocol. Executing this pilot without manual developer database intervention or Postman calls is the mandatory prerequisite before VOLKS can be classified as `PRODUCTION-PROVEN`.
>
> **Current Status**: **`PILOT READY — NOT PRODUCTION-PROVEN`**

---

## 1. Pilot Mission & Operational Scope

The 30-Day Shadow HR Pilot runs VOLKS alongside existing legacy systems for one full operational HR month. A test cohort of 25 to 50 employees and HR managers will execute all daily HR tasks exclusively through the VOLKS UI.

---

## 2. 30-Day Operational Calendar & Workload Schedule

- **Days 1–5 (Onboarding & Identity)**: Employee onboarding, directory verification, bitemporal initial employment records.
- **Days 6–15 (Daily Time & Attendance)**: Morning 09:00 AM punch stampedes, attendance regularizations, On-Duty (OD) applications, manager approvals.
- **Days 16–22 (Leave & Expenses)**: Leave requests, holiday calendar validation, expense claim submissions & manager approvals.
- **Days 23–27 (Recruitment & Appraisals)**: Resume uploads via Candidate Intelligence ATS, JD match scoring, candidate hiring, annual appraisal reviews.
- **Days 28–30 (Month-End Payroll & Clearance)**: Offboarding settlement, session revocation verification, monthly payroll lock execution, payslip generation.

---

## 3. Incident Logging Template & Acceptance Criteria

Every operational incident during the 30-day pilot must be logged using the following schema:

```markdown
### Incident Log Entry
- **Timestamp**: `2026-08-05 09:14:22`
- **Persona / Actor**: `Employee (Arjun Mehta)`
- **Workflow**: `Attendance Punch / Check-In`
- **Request ID**: `req-1785100000000-xyz`
- **Expected Result**: Punch recorded cleanly with 200 OK.
- **Actual Result**: 500 Internal Error.
- **Developer Intervention Required?**: `No`
- **DB Manual Repair Required?**: `No`
- **Resolution**: Outbox retry worker auto-recovered transient lock.
- **Root Cause**: DB connection pool contention under 09:01 AM spike.
- **Regression Test Added?**: `Yes (tests/volks_0_8_spike.test.ts)`
```

---

## 4. Operational Acceptance Criteria for `PRODUCTION-PROVEN`

To earn the final classification of **`PRODUCTION-PROVEN`**, the 30-day pilot must satisfy:

1. **Zero Manual DB Repairs**: 0 direct SQL manual edits required to fix broken business state.
2. **Zero Postman / Developer Calls**: 100% of ordinary HR tasks completed exclusively through the React UI.
3. **Zero Cross-Tenant Violations**: 0 tenant isolation or role escalation breaches observed.
4. **100% Session Revocation Enforcement**: Immediate session token revocation verified on offboarding.
5. **100% Disaster Recovery Drill Survival**: Backup export & restoration verified without data loss.

---

### Current Classification: **`PILOT READY — NOT PRODUCTION-PROVEN`**
