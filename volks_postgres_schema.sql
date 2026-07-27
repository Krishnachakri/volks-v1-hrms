-- ============================================================
-- VOLKS HRMS 0.1 — Production Core Database Schema (18 Modules)
-- Standard: PostgreSQL 15+ Native
-- Layer 1: Basic HRMS Applications
-- Layer 2: Business Services
-- Layer 3: Workforce Truth Kernel
-- ============================================================

-- Enum Types
CREATE TYPE employment_type AS ENUM ('INTERN', 'ON_ROLL', 'CONSULTANT');
CREATE TYPE lifecycle_state AS ENUM ('CANDIDATE', 'PREBOARDING', 'JOINING', 'ONBOARDING', 'PROBATION', 'ACTIVE', 'NOTICE_PERIOD', 'CLEARANCE_PENDING', 'TERMINATED', 'ALUMNI');
CREATE TYPE outbox_status AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'RETRY', 'DEAD_LETTER');

-- ------------------------------------------------------------
-- 1. AUTHENTICATION & USERS
-- ------------------------------------------------------------
CREATE TABLE persons (
    person_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       TEXT NOT NULL,
    date_of_birth   DATE,
    personal_email  TEXT UNIQUE NOT NULL,
    phone           TEXT,
    national_id     TEXT UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL DEFAULT 'pbkdf2:sha256:10000$hash',
    role          TEXT NOT NULL DEFAULT 'EMPLOYEE', -- EMPLOYEE, MANAGER, HR_ADMIN, SYSTEM_ADMIN
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2. COMPANY SETUP & ORGANIZATION
-- ------------------------------------------------------------
CREATE TABLE organizations (
    org_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE departments (
    department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organizations(org_id),
    name          TEXT NOT NULL
);

CREATE TABLE positions (
    position_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(department_id),
    title         TEXT NOT NULL
);

-- ------------------------------------------------------------
-- 3. EMPLOYMENT & BITEMPORAL LEDGER
-- ------------------------------------------------------------
CREATE TABLE employment_engagements (
    engagement_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id         UUID NOT NULL REFERENCES persons(person_id),
    org_id            UUID NOT NULL REFERENCES organizations(org_id),
    employment_type   employment_type NOT NULL,
    state             lifecycle_state NOT NULL DEFAULT 'ACTIVE',
    start_date        DATE NOT NULL,
    end_date          DATE,
    converted_from_id UUID REFERENCES employment_engagements(engagement_id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employment_changes (
    change_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id  UUID NOT NULL REFERENCES employment_engagements(engagement_id),
    version        INT NOT NULL DEFAULT 1,
    valid_from     DATE NOT NULL,
    valid_to       DATE,
    system_from    TIMESTAMPTZ NOT NULL DEFAULT now(),
    system_to      TIMESTAMPTZ,
    position_id    UUID REFERENCES positions(position_id),
    department_id  UUID REFERENCES departments(department_id),
    manager_id     UUID REFERENCES persons(person_id),
    compensation   NUMERIC(12,2) NOT NULL,
    currency       TEXT DEFAULT 'INR',
    reason         TEXT NOT NULL,
    created_by     UUID
);

-- ------------------------------------------------------------
-- 4. EMPLOYEE DOCUMENTS
-- ------------------------------------------------------------
CREATE TABLE employee_documents (
    document_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    category      TEXT NOT NULL, -- ID_PROOF, OFFER_LETTER, DEGREE, CONTRACT
    file_name     TEXT NOT NULL,
    file_url      TEXT NOT NULL,
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 5. SHIFTS & ATTENDANCE
-- ------------------------------------------------------------
CREATE TABLE shifts (
    shift_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL, -- GENERAL, MORNING, NIGHT
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL
);

CREATE TABLE attendance_logs (
    attendance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    date          DATE NOT NULL,
    check_in      TIMESTAMPTZ,
    check_out     TIMESTAMPTZ,
    status        TEXT NOT NULL DEFAULT 'PRESENT', -- PRESENT, LATE, ABSENT, HALF_DAY
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_person_date UNIQUE (person_id, date)
);

-- ------------------------------------------------------------
-- 6. LEAVE MANAGEMENT
-- ------------------------------------------------------------
CREATE TABLE leave_balances (
    balance_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    leave_type    TEXT NOT NULL, -- CASUAL, SICK, EARNED
    total_allowed INT NOT NULL DEFAULT 12,
    used          INT NOT NULL DEFAULT 0,
    CONSTRAINT unique_person_leave_type UNIQUE (person_id, leave_type)
);

CREATE TABLE leave_requests (
    request_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    leave_type    TEXT NOT NULL,
    start_date    DATE NOT NULL,
    end_date      DATE NOT NULL,
    days          INT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, CANCELLED
    reason        TEXT,
    approved_by   UUID REFERENCES persons(person_id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 7. PAYROLL & SALARY STRUCTURE
-- ------------------------------------------------------------
CREATE TABLE salary_structures (
    salary_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID REFERENCES persons(person_id),
    engagement_id UUID REFERENCES employment_engagements(engagement_id),
    basic         NUMERIC(12,2) NOT NULL,
    hra           NUMERIC(12,2) NOT NULL,
    allowances    NUMERIC(12,2) NOT NULL,
    deductions    NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_salary    NUMERIC(12,2) NOT NULL DEFAULT 0,
    effective_from DATE NOT NULL DEFAULT '2026-01-01',
    effective_to   DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payroll_runs (
    run_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month                 TEXT NOT NULL UNIQUE, -- e.g. '2026-07'
    month_days            INT NOT NULL DEFAULT 31,
    total_employees       INT NOT NULL DEFAULT 0,
    total_gross_paise     BIGINT NOT NULL DEFAULT 0,
    total_deductions_paise BIGINT NOT NULL DEFAULT 0,
    total_net_paise       BIGINT NOT NULL DEFAULT 0,
    total_payout          NUMERIC(12,2) NOT NULL DEFAULT 0,
    status                TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, PREVIEWED, PROCESSED, LOCKED
    processed_by          UUID REFERENCES persons(person_id),
    processed_at          TIMESTAMPTZ,
    locked_by             UUID REFERENCES persons(person_id),
    locked_at             TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payslips (
    payslip_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id                UUID NOT NULL REFERENCES payroll_runs(run_id),
    person_id             UUID NOT NULL REFERENCES persons(person_id),
    month                 TEXT NOT NULL,
    basic_paise           BIGINT NOT NULL DEFAULT 0,
    hra_paise             BIGINT NOT NULL DEFAULT 0,
    allowances_paise      BIGINT NOT NULL DEFAULT 0,
    gross_paise           BIGINT NOT NULL DEFAULT 0,
    pf_deduction_paise    BIGINT NOT NULL DEFAULT 0,
    pt_deduction_paise    BIGINT NOT NULL DEFAULT 0,
    lop_days              INT NOT NULL DEFAULT 0,
    lop_deduction_paise   BIGINT NOT NULL DEFAULT 0,
    total_deductions_paise BIGINT NOT NULL DEFAULT 0,
    net_paise             BIGINT NOT NULL DEFAULT 0,
    gross_pay             NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_pay               NUMERIC(12,2) NOT NULL DEFAULT 0,
    status                TEXT NOT NULL DEFAULT 'GENERATED',
    pdf_url               TEXT DEFAULT '/payslips/sample.pdf',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_person_month_payslip UNIQUE (person_id, month)
);

CREATE TABLE payroll_records (
    payroll_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL REFERENCES employment_engagements(engagement_id),
    is_active     BOOLEAN NOT NULL DEFAULT true,
    bank_account_flagged BOOLEAN DEFAULT false,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 8. RECRUITMENT & ATS
-- ------------------------------------------------------------
CREATE TABLE job_postings (
    job_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_code    TEXT UNIQUE,
    title               TEXT NOT NULL,
    department_id       UUID NOT NULL REFERENCES departments(department_id),
    hiring_manager_id   UUID REFERENCES persons(person_id),
    requested_by        UUID REFERENCES persons(person_id),
    approved_by         UUID REFERENCES persons(person_id),
    headcount           INT NOT NULL DEFAULT 1,
    hired_count         INT NOT NULL DEFAULT 0,
    min_salary          NUMERIC(12,2),
    max_salary          NUMERIC(12,2),
    employment_type     TEXT DEFAULT 'ON_ROLL',
    status              TEXT NOT NULL DEFAULT 'OPEN', -- DRAFT, PENDING_APPROVAL, APPROVED, OPEN, ON_HOLD, CLOSED, CANCELLED
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_candidates (
    candidate_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id        UUID NOT NULL REFERENCES job_postings(job_id),
    full_name     TEXT NOT NULL,
    email         TEXT NOT NULL,
    phone         TEXT,
    stage         TEXT NOT NULL DEFAULT 'APPLIED', -- APPLIED, SCREENING, INTERVIEW, SELECTED, OFFER_DRAFT, OFFER_APPROVED, OFFER_SENT, ACCEPTED, HIRED, REJECTED
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE candidate_scorecards (
    scorecard_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id            UUID NOT NULL REFERENCES job_candidates(candidate_id),
    overall_score           INT NOT NULL DEFAULT 80,
    required_skills_percent INT DEFAULT 85,
    preferred_skills_percent INT DEFAULT 75,
    experience_percent      INT DEFAULT 90,
    education_percent       INT DEFAULT 90,
    matched_skills          TEXT[] DEFAULT '{}',
    missing_skills          TEXT[] DEFAULT '{}',
    resume_evidence         TEXT[] DEFAULT '{}',
    scoring_version         TEXT DEFAULT 'v1.0',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_offers (
    offer_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id        UUID NOT NULL REFERENCES job_candidates(candidate_id),
    requisition_id      UUID NOT NULL REFERENCES job_postings(job_id),
    basic               NUMERIC(12,2) NOT NULL,
    hra                 NUMERIC(12,2) NOT NULL,
    allowances          NUMERIC(12,2) NOT NULL,
    net_salary          NUMERIC(12,2) NOT NULL,
    proposed_start_date DATE NOT NULL,
    status              TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, APPROVED, SENT, ACCEPTED, DECLINED, EXPIRED
    approved_by         UUID REFERENCES persons(person_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 9. ONBOARDING & CHECKLISTS
-- ------------------------------------------------------------
CREATE TABLE onboarding_checklists (
    task_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    task_name     TEXT NOT NULL,
    category      TEXT NOT NULL DEFAULT 'GENERAL', -- IT, HR, FINANCE, COMPLIANCE
    assigned_by   UUID REFERENCES persons(person_id),
    due_date      DATE,
    is_completed  BOOLEAN NOT NULL DEFAULT false,
    completed_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE probation_reviews (
    review_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id    UUID REFERENCES employment_engagements(engagement_id),
    person_id        UUID NOT NULL REFERENCES persons(person_id),
    reviewer_id      UUID NOT NULL REFERENCES persons(person_id),
    decision         TEXT NOT NULL, -- CONFIRM, EXTEND_PROBATION, TERMINATE
    extension_months INT DEFAULT 0,
    feedback         TEXT NOT NULL,
    effective_date   DATE NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 10. PERFORMANCE & GOALS
-- ------------------------------------------------------------
CREATE TABLE performance_reviews (
    review_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    reviewer_id   UUID NOT NULL REFERENCES persons(person_id),
    cycle         TEXT NOT NULL, -- e.g. '2026-H1'
    rating        NUMERIC(3,1) NOT NULL, -- e.g. 4.5
    feedback      TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 11. EXPENSE REIMBURSEMENTS
-- ------------------------------------------------------------
CREATE TABLE expense_claims (
    claim_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    category      TEXT NOT NULL, -- TRAVEL, MEALS, SUPPLIES, EQUIPMENT, CLIENT_ENTERTAINMENT
    amount        NUMERIC(12,2) NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    receipt_url   TEXT,
    status        TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, REIMBURSED
    approved_by   UUID REFERENCES persons(person_id),
    approved_at   TIMESTAMPTZ,
    rejection_reason TEXT,
    reimbursed_by UUID REFERENCES persons(person_id),
    reimbursed_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 12. ASSETS
-- ------------------------------------------------------------
CREATE TABLE assets (
    asset_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_name      TEXT NOT NULL,
    category        TEXT NOT NULL,
    serial_number   TEXT UNIQUE NOT NULL,
    assigned_to     UUID REFERENCES persons(person_id),
    status          TEXT NOT NULL DEFAULT 'AVAILABLE',
    assigned_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 13. OFFBOARDING & CLEARANCE
-- ------------------------------------------------------------
CREATE TABLE offboarding_clearances (
    clearance_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id           UUID NOT NULL REFERENCES persons(person_id),
    notice_days         INT NOT NULL DEFAULT 30,
    resignation_date    DATE,
    requested_lwd       DATE,
    official_lwd        DATE,
    resignation_reason  TEXT,
    manager_handover    BOOLEAN NOT NULL DEFAULT false,
    it_access_cleared   BOOLEAN NOT NULL DEFAULT false,
    asset_returned      BOOLEAN NOT NULL DEFAULT false,
    finance_dues_cleared BOOLEAN NOT NULL DEFAULT false,
    leave_settled       BOOLEAN NOT NULL DEFAULT false,
    payroll_settled     BOOLEAN NOT NULL DEFAULT false,
    hr_docs_cleared     BOOLEAN NOT NULL DEFAULT false,
    status              TEXT NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, APPROVED, REJECTED, CLEARED
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 14. NOTIFICATIONS
-- ------------------------------------------------------------
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id       UUID NOT NULL REFERENCES persons(person_id),
    title           TEXT NOT NULL,
    message         TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 15. AUDIT & OUTBOX
-- ------------------------------------------------------------
CREATE TABLE audit_events (
    event_id      BIGSERIAL PRIMARY KEY,
    entity_table  TEXT NOT NULL,
    entity_id     UUID NOT NULL,
    action        TEXT NOT NULL,
    actor_user_id UUID REFERENCES users(user_id),
    narrative     TEXT NOT NULL,
    diff          JSONB NOT NULL,
    correlation_id UUID DEFAULT gen_random_uuid(),
    causation_id   UUID,
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE outbox_events (
    event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type  TEXT NOT NULL,
    aggregate_id    UUID NOT NULL,
    event_type      TEXT NOT NULL,
    payload         JSONB NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    status          outbox_status NOT NULL DEFAULT 'PENDING',
    attempt_count   INT NOT NULL DEFAULT 0,
    available_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at      TIMESTAMPTZ,
    claimed_by      TEXT,
    last_error      TEXT,
    delivered_at    TIMESTAMPTZ,
    correlation_id  UUID DEFAULT gen_random_uuid(),
    causation_id    UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
