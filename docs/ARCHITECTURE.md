# WriteWise — ARCHITECTURE.md

**A Computer Vision and CNN-Based Diagnostic Cursive Handwriting Assessment and Progress Monitoring System**

- **Document type:** Internal engineering architecture guide (companion to PRD.md, DESIGN.md, CV_PIPELINE.md, ML_PIPELINE.md, DATABASE.md, API_SPEC.md, TECH_STACK.md)
- **Team:** Ryan Christopher B. Estoque, John Lawrence V. Monleon, James David B. Asoy, Saara Eliana G. Ibag
- **Status:** Draft v1 — reflects decisions locked as of this document's creation. Update this file whenever an architecture decision changes; it should stay the single source of truth for "how the system is built," the way PRD.md is the source of truth for "what the system does."

---

## 1. System Overview

WriteWise is a single web application serving two roles (Teacher, Parent) through one Next.js frontend and one FastAPI backend, backed by Supabase (Postgres + Auth + Storage).

```
┌─────────────────────────────┐
│  Next.js App (Vercel)       │
│  (teacher) and (parent)     │
│  route groups + middleware  │
└───────────┬──────────────────┘
            │
   ┌────────┴─────────┐
   │                   │
   ▼                   ▼
┌──────────────┐  ┌─────────────────────────────┐
│ Supabase      │  │ FastAPI Backend (Railway)   │
│ direct reads  │  │ - roster/activity CRUD      │
│ (supabase-js, │  │ - submission upload+process │
│  RLS-gated)   │  │ - CV pipeline (in-process)  │
└──────┬────────┘  │ - CNN inference (in-process)│
       │           └──────────┬───────────────────┘
       │                      │
       ▼                      ▼
┌─────────────────────────────────────────────┐
│ Supabase (Postgres + Auth + Storage)         │
│ - RLS policies enforce role-based access     │
│ - Storage: submission images (private)       │
│ - Storage: CNN model artifact (private)      │
└───────────────────────────────────────────────┘
```

There is no separate CV/inference microservice — the CV/CNN pipeline is a Python module living inside the FastAPI process, called as a function during the synchronous submission-upload request. This keeps the pilot's deployment surface to two services (Vercel, Railway) plus Supabase, with no internal network hop for inference.

---

## 2. Repository Structure

Monorepo, single GitHub repo:

```
writewise/
├── frontend/           # Next.js app (Vercel deploy target)
├── backend/             # FastAPI app (Railway deploy target)
│   ├── app/
│   │   ├── api/          # route handlers
│   │   ├── cv/            # OpenCV pipeline + quality gate
│   │   ├── ml/             # CNN inference wrapper, model loader
│   │   ├── scoring/         # ManualScoreProvider / CalibratedScoreProvider
│   │   └── core/              # config, auth, error handling
│   └── tests/
├── supabase/            # SQL migrations (schema + RLS + Storage policies)
│   └── migrations/
├── research/             # offline scripts (dataset export/anonymization)
├── ml/                   # model training notebooks/artifacts (Kaggle fine-tuning)
└── .github/workflows/     # CI (test-gating, not deploy)
```

No workspace tooling (Turborepo/pnpm workspaces) — the two apps don't share a package boundary that needs enforcing at this scale. Vercel is configured to build from `/frontend`; Railway from `/backend`.

---

## 3. Environments

Two fully separate Supabase projects:

| Environment | Supabase project | Data | Used by |
|---|---|---|---|
| **dev** | `writewise-dev` | Seeded fake roster/students | Local development, manual testing |
| **prod** | `writewise-prod` | Real students (Matina Aplaya Elementary, once live) | The live pilot, starting Phase 1 |

There is no third staging environment. Vercel's automatic preview deployments (one per branch/PR, provided free by the platform) serve as the de facto pre-merge check for frontend changes, pointed at the dev Supabase project. Backend changes are tested locally against dev Supabase before merging.

**Why this split matters:** local development or experimentation must never be able to touch the prod database once the pilot starts — a corrupted or polluted Phase 1 record directly threatens the Spearman's Rho calibration study, which is the PRD's own top-flagged project risk.

---

## 4. Data Access Pattern

Hybrid — two paths, chosen per operation:

- **Direct reads** (`supabase-js` from the frontend): dashboard trend data, roster display, activity lists. Protected entirely by Postgres Row-Level Security — the frontend never needs role-checking logic of its own for these; if a query returns rows, the user is allowed to see them.
- **Writes and business logic** (FastAPI): creating an activity, uploading and processing a submission, roster changes, anything involving the CV/CNN pipeline. FastAPI holds the service-role key and does its own authorization checks in Python.

Auth itself (login, session/JWT) goes through Supabase Auth directly from the frontend — FastAPI never proxies login.

**Why hybrid, not one or the other:** doing everything through FastAPI (a cleaner single-authorization-boundary story) would mean hand-writing GET endpoints for every dashboard/roster screen; doing everything through direct Supabase access would mean the CV pipeline's business logic (which has to run synchronously as part of a write) would need to live client-side, which isn't viable. The hybrid line is drawn at "does this need business logic or heavy processing" — reads that are simple table queries go direct; anything that isn't goes through the API.

---

## 5. Authentication & Account Provisioning

- **Teacher accounts:** created directly (details TBD with the team — likely provisioned by whoever sets up the pilot, since there's no admin role).
- **Parent accounts:** teacher-invited. When a teacher adds a student to the roster with a parent's email, the app triggers a Supabase Auth invite email. The parent clicks the link, sets a password, and is automatically linked to that student record. No manual credential handling, no email-independent fallback — this assumes parent email reliability at Matina Aplaya Elementary holds up during the pilot; revisit if it doesn't.
- **No student accounts.** Students are minors and exist only as roster records a teacher creates.
- **No separate admin role** for the pilot — the teacher is the local admin for their own roster.

---

## 6. Database Schema (key entities)

Schema is authored SQL-first via Supabase CLI migrations (`supabase/migrations/*.sql`) — this is the single source of truth for both table structure and RLS/Storage policies. No ORM owns migrations (Alembic doesn't express `CREATE POLICY` cleanly); FastAPI queries via a lightweight layer (raw SQL / asyncpg, or SQLAlchemy Core purely as a query builder). Frontend TypeScript types are generated straight from the live schema via `supabase gen types typescript`, so frontend and backend never drift out of sync on shape.

| Entity | Notes |
|---|---|
| **teacher** | linked to `auth.users` |
| **parent** | linked to `auth.users` |
| **student** | name, section — no auth account |
| **teacher_student** | join table — many-to-many (supports co-taught sections, mid-year class changes) |
| **student_parent** | join table — many-to-many (supports multiple guardians per student) |
| **activity** | target text, creator (teacher), created date |
| **submission** | activity ref, student ref, image path (Storage), timestamp, uploader, **status**: `processing` \| `completed` \| `rejected` |
| **measurement** | per-submission, per-criterion raw CV values (Phase 1) or calibrated scores (Phase 2); overlay annotation coordinates stored here as JSON (not a baked image) |
| **manual_score** | Phase 1 only — teacher's independent rubric rating per criterion, per submission. **Removed from the schema after calibration ships**, per the PRD. |

**Rejected submissions are persisted, not discarded.** A submission that fails the quality gate still creates a `submission` row with `status = 'rejected'` and a failure reason, keeping the rejected image and reason for later analysis (e.g. "X% of Phase 1 uploads were rejected for blur" — real, citable usability data for the ISO/IEC 25010 writeup, not something bolted on after the fact).

---

## 7. File Storage

Private Supabase Storage bucket, access controlled by Storage-level RLS policies that mirror the same `auth.uid()`-based rules as the database (a teacher can fetch images for students on their roster; a parent only their own child's). No signed URLs, no public bucket — this is a deliberate call given RA 10173: these are real children's names and handwriting, and "unguessable URL" is not access control.

What's stored per submission: **the original uploaded photo only.** The Phase 2 diagnostic overlay (baseline drift line, spacing/size highlight boxes) is *not* a second baked image — its coordinates are stored as JSON on the `measurement` row, and the frontend renders it as an SVG layer on top of the original photo at view time. This roughly halves storage usage per submission and keeps the overlay flexible (togglable annotation types, no quality loss at zoom).

The CNN model artifact also lives in Storage (a separate, private location from submission images) — see §9.

---

## 8. Submission Processing Pipeline (synchronous)

Per the PRD, processing is synchronous — the teacher/parent waits in the same session, no background job queue at pilot scale. Flow, on `POST` to the submission endpoint:

1. **Upload received** — image bytes POSTed directly to FastAPI (not client-uploaded to Storage first). FastAPI writes the original to Storage using the service-role key as part of this same request.
2. **Quality gate** (cheap, runs first, before anything expensive):
   - Blur check (Laplacian variance)
   - Brightness/contrast range check
   - Minimum resolution check
   - **Fails fast** with a specific error if any check doesn't pass (e.g. "Image too blurry — please retake"); submission row is saved with `status = 'rejected'` and the reason. Nothing further runs.
3. **Preprocessing** — grayscale conversion, noise removal, thresholding, deskewing.
4. **Segmentation** — isolate individual letters/words from the full worksheet image.
5. **CNN inference** — fine-tuned model produces letter-formation output (raw in Phase 1, calibrated in Phase 2 via the scoring layer — see §10).
6. **OpenCV feature extraction** — slant angle, spacing, baseline deviation, size consistency, all in **relative/normalized units** (see below), not absolute mm.
7. **Score computation** — via the active `ScoreProvider` (see §10).
8. **Response** — measurements/scores (+ overlay coordinates in Phase 2) returned to the frontend; submission row updated to `status = 'completed'`.

**Why the quality gate matters here specifically:** Phase 1's entire purpose is collecting a *clean* paired dataset (raw measurements ↔ teacher scores) for calibration. A blurry photo that limps through the pipeline doesn't just give one teacher a bad result — it pollutes the dataset the whole Spearman's Rho validation depends on. The gate is a few milliseconds of OpenCV calls sitting in front of a pipeline you're already building; cheap insurance against the project's own top-flagged risk.

**Why no physical scale marker (ruler/ArUco marker) on the worksheet:** measurements stay in units relative to the handwriting itself (e.g. spacing as a ratio of average letter height in the same image) rather than converting to absolute mm. This sidesteps the problem of two teachers photographing the same worksheet from different distances/zoom producing different pixel-per-mm ratios for the same physical handwriting — and it means no dependency on a marker being present, undamaged, and correctly framed in every photo across the pilot.

---

## 9. CV/CNN Module

The fine-tuned Keras model (transfer-learned on the Kaggle cursive alphabet dataset) is **not committed to git.** It's stored in Supabase Storage (a private, model-specific location, separate from submission images) and downloaded once by FastAPI's startup/lifespan event into the container's local filesystem, then kept resident in memory for the life of the process — no per-request reload.

**Why Storage instead of git/Git LFS:** the model will likely be re-tuned or re-evaluated between now and the CNN evaluation step (target: late September). Storing it in Storage means updating the model is a file upload, not a code redeploy — and it avoids Git LFS setup/quota overhead in a repo an academic panel may end up reviewing.

---

## 10. Scoring Engine & the Phase 1 → Phase 2 Transition

This is the mechanism behind the PRD's claim that the Phase 2 swap is "a backend integration, not a UI rebuild."

A single backend interface, `compute_score(measurement)`, has two interchangeable implementations:

- **`ManualScoreProvider`** (active during Phase 1) — returns whatever the teacher manually entered for that submission's criteria.
- **`CalibratedScoreProvider`** (swapped in post-calibration) — applies the derived threshold formulas to the raw CV measurements.

Which one runs is controlled by a single backend config flag (e.g. `SCORING_ENGINE=manual|calibrated`). The API response shape — "a score per criterion" — never changes regardless of which provider is active, so the frontend has no idea (and doesn't need to know) which one is running.

**Consequence for build sequencing:** Phase 2 UI (dashboard, diagnostic feedback panel, overlay) can be built *now*, against the real manual scores already flowing in from Phase 1 submissions — no mock/placeholder data needed. When calibration finishes, flipping the flag and redeploying is the entire integration step. `manual_score` and `ManualScoreProvider` are removed once the swap is confirmed stable, per the PRD's explicit scope note.

---

## 11. Frontend Architecture

- **Single Next.js app**, one Vercel deployment — not two separate apps for Teacher/Parent.
- **Role-based route groups**: `(teacher)/...` and `(parent)/...`, with Next.js middleware checking the authenticated session's role after login and guarding/redirecting accordingly. Enforcing role separation once in middleware (rather than scattering `if (role === ...)` checks through components) matters here specifically because it's a security-relevant boundary — a parent must never render a teacher screen.
- **TanStack Query (React Query)** as the unified data-fetching layer for *both* direct Supabase reads and FastAPI calls. Since §4's hybrid pattern means data legitimately comes from two different places, TanStack Query is what keeps loading states, caching, and refetch behavior (e.g. dashboard trend charts updating after a new submission) consistent regardless of which backend actually served a given screen's data. No Redux/Zustand — there's no significant client-only UI state here that a global store would be solving for; the state that matters is server data.

---

## 12. API Conventions

**Error responses** use a standardized JSON envelope for every error, including FastAPI/Pydantic's default validation errors (normalized into the same shape via a custom exception handler):

```json
{
  "error": {
    "code": "QUALITY_GATE_BLUR",
    "message": "Image is too blurry — please retake the photo.",
    "details": {}
  }
}
```

The frontend branches on `error.code`, never on parsing `message` text — this matters specifically for the quality gate, where the UI needs to show a different message for "too blurry" vs. "too dark" vs. "couldn't segment enough letters" vs. a generic failure, and string-matching on human-readable text would silently break the moment wording changes.

---

## 13. Testing Strategy

Targeted, not exhaustive — chosen to protect the parts of the system whose *correctness* the thesis's own statistics depend on:

- **Unit tests** on the OpenCV feature-extraction functions and the CNN inference wrapper. A silent bug here (e.g. a slant-angle formula off by a systematic factor) doesn't just break a feature — it quietly invalidates the Spearman's Rho correlation study and the CNN accuracy/precision/recall/F1 figures the defense depends on.
- **Integration tests** on the core submission-upload endpoint (upload → quality gate → preprocess → segment → CNN → measurements) — the single most-hit critical path during the live pilot.
- **No frontend test suite.** UI is QA'd manually. Not worth the setup/maintenance cost for a 4-person team on a 9-week runway relative to what manual click-through testing already catches at this scale.

---

## 14. CI/CD

GitHub Actions runs on every PR: backend `pytest`, frontend type-check/lint. This is a **required check gating merges** — a PR can't merge if it broke the tests protecting the CV pipeline's correctness.

Actual deployment is **not** owned by Actions — Vercel and Railway's own native GitHub integrations handle it, auto-deploying on push to `main`:

- Feature branch pushed → Vercel preview deployment (pointed at dev Supabase) + Actions test run.
- Merge to `main` → Actions re-confirms tests pass → Vercel/Railway auto-deploy to prod (pointed at prod Supabase).

---

## 15. Logging & Observability

Structured JSON application logging (Python `logging` module) for key pipeline events — quality-gate pass/fail and reason, per-stage timing, total processing duration, errors — written to stdout and captured via Railway's built-in log viewer. No third-party service (e.g. Sentry) — unnecessary overhead for a pilot this size (5 teachers, 30 students).

**Why this is worth the setup:** beyond debugging during the live September pilot, this is the actual evidence base for the ISO/IEC 25010 "Reliability" and "Performance Efficiency" sections of the thesis writeup — without instrumenting it, those sections would have nothing concrete to cite.

---

## 16. Data Privacy & Export

- Real student names are stored in-app for practical teacher/parent use, access-restricted by RLS.
- **Anonymization happens only at export time**, via a standalone offline script (`research/export_dataset.py`, versioned in the repo) — run locally by a team member using the service-role key, pulling raw measurements + manual scores and replacing student identifiers with anonymized codes before writing out a CSV for statistical analysis (SPSS/R/pandas). This is deliberately *not* an in-app admin feature or ad hoc SQL — a reproducible, committed script gives a defensible, citable answer to "how exactly was the data anonymized" if a panel asks.
- Consent is collected via paper forms outside the app (unchanged from the PRD).

---

## 17. Open Items / Revisit List

Things this document deliberately left as assumptions worth checking as the build progresses:

- **Parent email reliability** (§5) — the teacher-invite flow assumes parents check and can act on an invite email. If this proves unreliable at Matina Aplaya Elementary during Phase 1, the provisioning flow will need revisiting.
- **Teacher account creation** (§5) — not yet fully specified; needs a decision on who provisions the first teacher accounts before Phase 1 launch.
- **Relative-unit measurement validity** (§8) — normalized/relative units avoid the camera-distance problem, but should be sanity-checked against the calibration data once Phase 1 is collecting it, to confirm the normalization approach doesn't introduce its own bias (e.g. sensitivity to which reference letter/measure is used for normalization).
