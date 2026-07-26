-- ============================================================
-- HRMS CORE SCHEMA (Phase 1: Identity + Employment Lifecycle)
-- Postgres 15+
-- Design goal: ONE person can have MANY employment engagements
-- (intern, on-roll, consultant) over time, with ZERO duplicate
-- identity rows, and full effective-dated history for audits.
-- ============================================================

CREATE TYPE employment_type AS ENUM ('INTERN', 'ON_ROLL', 'CONSULTANT');
CREATE TYPE employment_status AS ENUM ('ACTIVE', 'ENDED', 'TERMINATED', 'CONVERTED');

-- ------------------------------------------------------------
-- 1. PERSON — the one immutable human identity. Created ONCE,
--    ever, no matter how many roles they hold over their life.
-- ------------------------------------------------------------
CREATE TABLE persons (
    person_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       TEXT NOT NULL,
    date_of_birth   DATE,
    personal_email  TEXT UNIQUE,           -- used to de-dupe on re-application
    phone           TEXT,
    national_id     TEXT UNIQUE,           -- Aadhaar/PAN/passport etc, hashed in prod
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
-- 2. EMPLOYMENT ENGAGEMENT — a SPAN of time this person had
--    a relationship with the org. This is what "converting"
--    actually does: it CLOSES one engagement and OPENS another,
--    linked together. The person row is never touched.
-- ------------------------------------------------------------
CREATE TABLE employment_engagements (
    engagement_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id         UUID NOT NULL REFERENCES persons(person_id),
    org_id            UUID NOT NULL REFERENCES organizations(org_id),
    employment_type   employment_type NOT NULL,
    status            employment_status NOT NULL DEFAULT 'ACTIVE',
    start_date        DATE NOT NULL,
    end_date          DATE,                       -- NULL = ongoing
    converted_from_id UUID REFERENCES employment_engagements(engagement_id),
    -- ^ this is the whole trick: when an intern converts to on-roll,
    --   we close the INTERN row (status=CONVERTED, end_date=X)
    --   and insert a new ON_ROLL row with converted_from_id
    --   pointing back at it. Same person_id both times.
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce: a person can only have ONE active engagement of a given
-- type at a time (no accidental double-hire in the same role)
CREATE UNIQUE INDEX one_active_engagement_per_type
    ON employment_engagements (person_id, employment_type)
    WHERE status = 'ACTIVE';

-- ------------------------------------------------------------
-- 3. EMPLOYMENT CHANGES — effective-dated facts (title, salary,
--    manager, department) that change WITHIN an engagement.
--    This is how "what was their salary on 14 Oct 2026" gets
--    answered without overwriting history.
-- ------------------------------------------------------------
CREATE TABLE employment_changes (
    change_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id  UUID NOT NULL REFERENCES employment_engagements(engagement_id),
    effective_date DATE NOT NULL,
    position_id    UUID REFERENCES positions(position_id),
    manager_id     UUID REFERENCES persons(person_id),
    compensation   NUMERIC(12,2),
    currency       TEXT DEFAULT 'INR',
    reason         TEXT,                          -- 'promotion','conversion','correction'...
    created_by     UUID,                           -- references users(user_id)
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Point-in-time query: "what was P-001's status on a given date?"
-- SELECT ec.* FROM employment_changes ec
-- JOIN employment_engagements ee ON ee.engagement_id = ec.engagement_id
-- WHERE ee.person_id = :person_id AND ec.effective_date <= :as_of_date
-- ORDER BY ec.effective_date DESC LIMIT 1;

-- ------------------------------------------------------------
-- 4. ACCESS CONTROL (kept OUT of the person/employment tables
--    on purpose — access is a separate concern from identity)
-- ------------------------------------------------------------
CREATE TABLE users (
    user_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id  UUID NOT NULL REFERENCES persons(person_id),
    email      TEXT UNIQUE NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE roles (
    role_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name      TEXT UNIQUE NOT NULL          -- 'HR_ADMIN','MANAGER','EMPLOYEE','FINANCE'
);

CREATE TABLE role_assignments (
    user_id  UUID NOT NULL REFERENCES users(user_id),
    role_id  UUID NOT NULL REFERENCES roles(role_id),
    PRIMARY KEY (user_id, role_id)
);

-- ------------------------------------------------------------
-- 5. AUDIT — every mutation to engagements/changes gets logged.
--    Never delete history; only append.
-- ------------------------------------------------------------
CREATE TABLE audit_events (
    event_id     BIGSERIAL PRIMARY KEY,
    entity_table TEXT NOT NULL,
    entity_id    UUID NOT NULL,
    action       TEXT NOT NULL,               -- 'CREATE','UPDATE','CONVERT'
    actor_user_id UUID REFERENCES users(user_id),
    diff         JSONB,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Example: converting Krishna Chakri N from intern to on-roll
-- ------------------------------------------------------------
-- BEGIN;
--   UPDATE employment_engagements
--     SET status = 'CONVERTED', end_date = '2026-12-20'
--     WHERE engagement_id = :intern_engagement_id;
--
--   INSERT INTO employment_engagements
--     (person_id, org_id, employment_type, start_date, converted_from_id)
--   VALUES
--     (:person_id, :org_id, 'ON_ROLL', '2026-12-21', :intern_engagement_id);
-- COMMIT;
-- Same person_id throughout. Zero duplicate rows. Full history intact.
