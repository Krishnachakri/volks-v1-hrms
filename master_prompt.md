# VOLKS hrms — Master Build Prompt (Phase 1)

Paste this whole document as your first message to the coding agent, with
`hrms_core_schema.sql` and `continuum_prototype.jsx` attached alongside it.

---

## 1. Role

You are the founding engineer on **VOLKS**, an HRMS product. The founder
(me) has already made the hard architectural calls and built a schema and a
UI prototype. Your job is not to redesign the product — it's to build the
real, working version of what's already been decided. Treat the two attached
files as ground truth, not inspiration:

- `hrms_core_schema.sql` is the **data model**. Do not redesign it. Extend it
  only where Phase 1 scope below requires new tables.
- `continuum_prototype.jsx` is the **design system source**. Extract the
  color tokens, type choices, and layout patterns from it and reuse them
  everywhere — do not invent a new visual identity.

## 2. Product thesis (do not lose this)

> A person's identity is permanent. Their relationship with the
> organization — intern, on-roll, consultant — changes over time. The
> product's entire value is that this history is queryable, auditable, and
> never duplicated.

Two features are the actual differentiators, and both must work for real,
not as a demo:

1. **Time travel** — for any person, reconstruct their exact record
   (title, manager, comp, access, payroll) as of any past date.
2. **Anomaly detection** — surface records where employment status,
   payroll status, and system access are in an inconsistent combination,
   with a plain-English explanation of *why* it's flagged, not just a
   red badge.

## 3. Architectural rules — never violate these

- One `persons` row per human, ever. Converting intern → on-roll closes one
  `employment_engagements` row and opens a new one via `converted_from_id`.
  Never update employment type in place; never insert a second `persons` row
  for the same human.
- Never overwrite a historical fact. Title/comp/manager changes are new rows
  in `employment_changes` with an `effective_date` — never an `UPDATE` on an
  old row.
- Never delete history. Soft-close via `status` + `end_date`.
- Enforce "one active engagement per type per person" at the database level
  (see the unique index in the schema), not just in application code.
- Every write to `employment_engagements` or `employment_changes` produces an
  `audit_events` row with a human-readable diff, in the same transaction.
- Access control (`users`/`role_assignments`) stays decoupled from identity —
  never let a permissions bug corrupt employment data.

## 4. Tech stack for this build

- **Next.js (App Router, TypeScript)** — single repo, API routes double as
  the backend. Fastest path for a solo founder to ship something real.
- **Postgres** — use the attached schema as your migration source (via
  Prisma or Drizzle, your choice of ORM, but the tables/constraints must
  match the SQL file exactly, including the unique partial index).
- **Tailwind CSS**, using the token values pulled from the prototype (see
  §5) rather than default Tailwind colors.
- Auth: simple email/password or magic link is enough for Phase 1 — do not
  build SSO/SAML yet.

## 5. Design tokens to extract and reuse

Pull these directly out of `continuum_prototype.jsx`'s `<style>` block
rather than re-deriving them:
- Ink / paper / panel / line colors
- The teal / violet / steel-blue engagement-type colors and what they mean
  (`ON_ROLL`, `INTERN`, `CONSULTANT`)
- The amber / red severity colors for anomalies
- Type stack: Space Grotesk (display), Inter (body), IBM Plex Mono
  (dates, IDs, currency)
- The "stamp"-style record card and the segmented timeline rail — these are
  the product's signature visual elements; keep them recognizable as you
  rebuild them with real data.

## 6. Phase 1 scope — build exactly this, nothing more

Build these five things, in this order, each one working end-to-end before
moving to the next:

1. **People directory** — list of persons, backed by real `persons` +
   latest `employment_engagements` join. Search by name.
2. **Person detail — Time Travel view** — the scrubber from the prototype,
   now querying real `employment_changes` rows for point-in-time
   reconstruction, not seed data.
3. **Convert-role workflow** — a form that closes one engagement and opens
   another in a single transaction, with a **preview screen** showing
   exactly what will change before the user confirms. This is the one
   workflow that must feel bulletproof — it's the core proof of the whole
   architecture.
4. **Anomaly Watch dashboard** — runs the three consistency rules from the
   prototype (access-after-end, payroll-inactive-while-active,
   access-revoked-while-active) as real queries against current data, on
   page load.
5. **Audit trail view** — for any person, a plain list of every
   `audit_events` row affecting them, in the narrated style ("Access was
   revoked on X because Y"), not raw JSON diffs.

## 7. Explicitly out of scope for Phase 1 — do not build these yet

Payroll calculation, leave/attendance, performance reviews, recruitment,
benefits, learning, org chart visualization, notifications, integrations,
the command palette, multi-tenant/multi-org support. Flag if you're tempted
to add any of these — that's scope creep, not progress.

## 8. Definition of done for Phase 1

- Seed script recreates the six people from the prototype with real rows in
  a real Postgres database.
- A demo path exists: open the app, scrub Krishna Chakri N's timeline back to
  before his conversion, see intern data; convert Meera Nair from intern to
  on-roll through the real workflow and watch her Anomaly Watch status stay
  clean throughout; see Ananya Rao and Rahul Bose flagged on the dashboard
  with correct plain-English explanations.
- No duplicate `persons` rows exist anywhere after running the conversion
  workflow twice on different people.
- Every one of the "never violate" rules in §3 is enforced by a database
  constraint or a transaction, not just a UI check.

Start by scaffolding the repo and running the schema migration, then build
in the order listed in §6. Confirm the schema is applied and the seed data
loads correctly before writing any UI.

