-- ============================================================
-- Migration 001: Initial Core Schema
-- ============================================================

CREATE TYPE employment_type AS ENUM ('INTERN', 'ON_ROLL', 'CONSULTANT');
CREATE TYPE lifecycle_state AS ENUM ('PRE_HIRE', 'ACTIVE', 'SUSPENDED', 'NOTICE', 'TERMINATED');
CREATE TYPE outbox_status AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'RETRY', 'DEAD_LETTER');

CREATE TABLE IF NOT EXISTS persons (
    person_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       TEXT NOT NULL,
    date_of_birth   DATE,
    personal_email  TEXT UNIQUE NOT NULL,
    phone           TEXT,
    national_id     TEXT UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL DEFAULT 'pbkdf2:sha256:10000$hash',
    role          TEXT NOT NULL DEFAULT 'EMPLOYEE',
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
    org_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departments (
    department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organizations(org_id),
    name          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
    position_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(department_id),
    title         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employment_engagements (
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

CREATE TABLE IF NOT EXISTS employment_changes (
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

CREATE TABLE IF NOT EXISTS employee_documents (
    document_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    category      TEXT NOT NULL,
    file_name     TEXT NOT NULL,
    file_url      TEXT NOT NULL,
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shifts (
    shift_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_logs (
    attendance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    date          DATE NOT NULL,
    check_in      TIMESTAMPTZ,
    check_out     TIMESTAMPTZ,
    status        TEXT NOT NULL DEFAULT 'PRESENT',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_person_date UNIQUE (person_id, date)
);

CREATE TABLE IF NOT EXISTS leave_balances (
    balance_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    leave_type    TEXT NOT NULL,
    total_allowed INT NOT NULL DEFAULT 12,
    used          INT NOT NULL DEFAULT 0,
    CONSTRAINT unique_person_leave_type UNIQUE (person_id, leave_type)
);

CREATE TABLE IF NOT EXISTS leave_requests (
    request_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    leave_type    TEXT NOT NULL,
    start_date    DATE NOT NULL,
    end_date      DATE NOT NULL,
    days          INT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'PENDING',
    reason        TEXT,
    approved_by   UUID REFERENCES persons(person_id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salary_structures (
    salary_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL REFERENCES employment_engagements(engagement_id),
    basic         NUMERIC(12,2) NOT NULL,
    hra           NUMERIC(12,2) NOT NULL,
    allowances    NUMERIC(12,2) NOT NULL,
    deductions    NUMERIC(12,2) NOT NULL,
    net_salary    NUMERIC(12,2) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_runs (
    run_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month         TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'PROCESSED',
    total_payout  NUMERIC(12,2) NOT NULL,
    processed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payslips (
    payslip_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id        UUID NOT NULL REFERENCES payroll_runs(run_id),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    month         TEXT NOT NULL,
    gross_pay     NUMERIC(12,2) NOT NULL,
    net_pay       NUMERIC(12,2) NOT NULL,
    pdf_url       TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_records (
    payroll_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL REFERENCES employment_engagements(engagement_id),
    is_active     BOOLEAN NOT NULL DEFAULT true,
    bank_account_flagged BOOLEAN DEFAULT false,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_postings (
    job_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         TEXT NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(department_id),
    status        TEXT NOT NULL DEFAULT 'OPEN',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_candidates (
    candidate_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id        UUID NOT NULL REFERENCES job_postings(job_id),
    full_name     TEXT NOT NULL,
    email         TEXT NOT NULL,
    stage         TEXT NOT NULL DEFAULT 'APPLIED',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboarding_checklists (
    task_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    task_name     TEXT NOT NULL,
    is_completed  BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS performance_reviews (
    review_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    reviewer_id   UUID NOT NULL REFERENCES persons(person_id),
    cycle         TEXT NOT NULL,
    rating        NUMERIC(3,1) NOT NULL,
    feedback      TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expense_claims (
    claim_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    category      TEXT NOT NULL,
    amount        NUMERIC(12,2) NOT NULL,
    receipt_url   TEXT,
    status        TEXT NOT NULL DEFAULT 'PENDING',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
    asset_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_name      TEXT NOT NULL,
    category        TEXT NOT NULL,
    serial_number   TEXT UNIQUE NOT NULL,
    assigned_to     UUID REFERENCES persons(person_id),
    status          TEXT NOT NULL DEFAULT 'AVAILABLE',
    assigned_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offboarding_clearances (
    clearance_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id     UUID NOT NULL REFERENCES persons(person_id),
    notice_days   INT NOT NULL DEFAULT 30,
    asset_returned BOOLEAN NOT NULL DEFAULT false,
    final_dues_cleared BOOLEAN NOT NULL DEFAULT false,
    status        TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id       UUID NOT NULL REFERENCES persons(person_id),
    title           TEXT NOT NULL,
    message         TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
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

CREATE TABLE IF NOT EXISTS outbox_events (
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
