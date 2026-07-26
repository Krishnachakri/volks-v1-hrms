-- ============================================================
-- Migration 002: Bitemporal & Production Query Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_changes_bitemporal
ON employment_changes (engagement_id, valid_from, valid_to);

CREATE INDEX IF NOT EXISTS idx_engagements_person_state
ON employment_engagements (person_id, state);

CREATE INDEX IF NOT EXISTS idx_attendance_person_date
ON attendance_logs (person_id, date);

CREATE INDEX IF NOT EXISTS idx_leave_requests_person_status
ON leave_requests (person_id, status);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_month
ON payroll_runs (month, status);
