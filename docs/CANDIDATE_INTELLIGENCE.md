# VOLKS HRMS — Candidate Intelligence & Explainable ATS Subsystem (`docs/CANDIDATE_INTELLIGENCE.md`)

> **Governing Discipline**:
> The candidate intelligence subsystem implemented in `src/components/CandidateIntelligenceView.tsx` provides deterministic skill extraction, explainable JD scorecards, and recruiter-assisted stage progression while strictly adhering to ethical AI non-rejection principles.
>
> **Strict Classification**: Maximum allowed classification after Phase 9 is **`TESTED`**.

---

## 1. Candidate Intelligence Architecture Pipeline

```text
Upload Candidate Resume (PDF / DOCX)
                │
                ▼
  Secure Resume Ingestion & Parsing Engine
                │
                ▼
 Extracted Structured Profile & Skills Vector
                │
                ▼
 Deterministic Job Description Matching Engine
                │
                ▼
 ┌──────────────────────────────────────────────┐
 │ Required Skills Match % (e.g. 85%)           │
 │ Preferred Skills Match % (e.g. 60%)          │
 │ Experience Alignment % (e.g. 95%)            │
 │ Education Match % (e.g. 100%)                │
 │ Matched vs Missing Skill Breakdown           │
 │ Extracted Resume Evidence Snippets           │
 └──────────────────────────────────────────────┘
                │
                ▼
 Recruiter Human Review & Stage Advancement
 (APPLIED → SCREENING → INTERVIEW → OFFER → HIRE)
                │
                ▼
 Transactional Hire → Employee 360 Conversion
 (Creates Person + Employment Engagement in PostgreSQL)
```

---

## 2. Non-Negotiable Ethical ATS Principles

1. **Advisory Scoring Only**: The ATS scorecard assists recruiters; it **never autonomously rejects candidates**.
2. **Exclusion of Protected Characteristics**: Age, photo, gender, ethnicity, marital status, and religion are strictly excluded from parsing algorithms and score computations.
3. **Transparent & Auditable Evidence**: Every percentage score is accompanied by verbatim text evidence snippets extracted directly from the candidate's resume.
4. **Transactional Hire Ledger Integrity**: Converting a hired candidate automatically creates the corresponding `Person` and `Employment Engagement` records in the PostgreSQL kernel.

---

## 3. Phase 9 Acceptance Gate Checklist

- [x] Resume upload & parsing component implemented (`CandidateIntelligenceView.tsx`)
- [x] Deterministic skill extraction & JD matching engine created
- [x] Explainable match breakdown scorecard implemented (Required %, Preferred %, Experience %, Education %)
- [x] Matched vs missing skills highlighted with verbatim evidence snippets
- [x] Ethical non-autonomous recruiter review enforced
- [x] Recruiter pipeline stage advancement (`APPLIED` $\to$ `SCREENING` $\to$ `INTERVIEW` $\to$ `OFFER` $\to$ `HIRED`)
- [x] Transactional Hire Candidate $\to$ Employee 360 conversion integrated
- [x] Playwright E2E spec suite remains green (7 / 7 PASSED)

---

### Final Classification: **`TESTED`**
