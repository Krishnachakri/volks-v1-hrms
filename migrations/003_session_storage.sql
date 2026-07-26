-- ============================================================
-- Migration 003: PostgreSQL-Backed Session Storage Table
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
    session_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash   TEXT UNIQUE NOT NULL,
    person_id    UUID NOT NULL REFERENCES persons(person_id),
    org_id       TEXT NOT NULL,
    role         TEXT NOT NULL,
    email        TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_person_id ON sessions (person_id);
