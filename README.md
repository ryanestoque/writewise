# WriteWise

**A Computer Vision and CNN-Based Diagnostic Cursive Handwriting Assessment and Progress Monitoring System**

WriteWise automatically assesses uploaded cursive handwriting worksheets against five measurable criteria — **letter formation, size consistency, spacing, slant, and baseline alignment** — using OpenCV feature extraction and a fine-tuned CNN, then turns those measurements into explainable diagnostic feedback and a progress-monitoring dashboard for teachers and parents.

| | |
|---|---|
| **Status** | Draft v1 · pre-Phase 1 |
| **Team** | Ryan Christopher B. Estoque, John Lawrence V. Monleon, James David B. Asoy, Saara Eliana G. Ibag |
| **Institution** | Holy Cross of Davao College, BSIT |
| **Research locale** | Matina Aplaya Elementary School, Talomo, Davao City |
| **Phase 1 target** | September 2026 (or earlier) |
| **Technical defense** | October 2026 |

---

## 1. Why WriteWise

Cursive handwriting assessment in basic education is manual, time-consuming, and subjective — teachers judge letter formation, spacing, slant, baseline alignment, and size consistency by eye, across dozens of students, with no consistent standard. Parents often lack the reference knowledge to tell whether their child's handwriting is on track.

WriteWise gives teachers an objective, faster grading tool and gives parents visibility into their child's progress over time. Standard OCR is not a substitute — OCR transcribes *what* was written and discards the physical/structural quality of *how* it was written, which is exactly what this system evaluates.

Full problem statement, goals, and scope: [`PRD.md`](./PRD.md).

## 2. Who Uses It

| Role | Who | What they do |
|---|---|---|
| **Teacher** | Basic education teacher | Creates handwriting activities, uploads/reviews submissions, views class-wide results and per-student diagnostics, manages their roster |
| **Parent/Guardian** | Parent of an enrolled student | Views their own child's progress and diagnostic feedback; can upload a completed sheet for a take-home activity |
| **Student** | Grade 3 learner (minor) | No account, no direct access — exists only as a roster record; all interaction happens on paper |

Access is strictly scoped: a parent only ever sees their own child's record, a teacher only their own class roster.

## 3. Key Features

- **Five-criterion assessment** — letter formation (CNN), size consistency, spacing, slant, and baseline alignment (OpenCV)
- **Explainable diagnostics** — qualitative bands (Needs Improvement → Excellent), visual overlay annotations on the original worksheet, criterion-by-criterion text feedback
- **Progress dashboards** — per-student and per-criterion trend lines for parents; a class-wide roster sortable by weakest criterion for teachers
- **Freeform activities** — teachers type any target text (letters, words, sentences), no fixed template library
- **Single-photo submission** — one photo of the whole worksheet; the system segments it internally

## 4. How Assessment Works

The system is built in two functional phases because the scoring rubric can't be designed up front — the thresholds have to be *derived* from real paired data (raw CV measurements vs. a teacher's manual score on the same worksheet).

```
Phase 1 (live Sept)                 Between Phases (offline)          Phase 2 (built in parallel, integrated after calibration)
─────────────────────               ─────────────────────────         ──────────────────────────────────────────────────────
Teacher creates activity             Analyze paired raw-measurement /   Parent portal
   → student writes on paper           teacher-score dataset            Progress dashboard (both roles)
   → photo uploaded                  Derive per-criterion thresholds   Diagnostic feedback UI (overlay + text)
   → CV pipeline runs, shows         Validate via Spearman's Rho       Calibrated auto-scoring swapped in for
     RAW measurements only           Fine-tune + evaluate the CNN        manual entry (backend flag flip, not a
   → teacher manually enters                                             UI rebuild) — manual-score field removed
     their own rubric score
```

Once calibration is done, the manual-entry step is swapped for the calibrated auto-scoring engine — a backend config change, not a UI rebuild (see `ARCHITECTURE.md` §10).

| Window | Focus |
|---|---|
| Now – early Sept | Phase 1 build (teacher tooling + raw CV pipeline); Phase 2 UI built in parallel against placeholder/manual data |
| September | Phase 1 live — 5 teachers / 30 students generating calibration data |
| Late Sept | Threshold/correlation analysis, CNN evaluation, calibrate scoring engine |
| Late Sept – early Oct | Integrate calibrated engine, remove manual-entry field, full system complete |
| Early–mid Oct | Full evaluation: 5 teachers, 30 parents, IT experts (ISO/IEC 25010) + diagnostic accuracy validation |
| October | Technical defense |

⚠️ Compressed ~9–10 week runway with a real statistical validation study embedded in it — see `PRD.md` §5/§12 for the risk breakdown.

## 5. Success Metrics

Proposed targets, literature-grounded, pending adviser sign-off (`PRD.md` §11):

| Metric | Target |
|---|---|
| CNN letter-formation model accuracy | ≥ 90% on the held-out CCC test split |
| Diagnostic correlation (system vs. teacher scores) | Spearman's Rho ≥ 0.70 per criterion |
| ISO/IEC 25010 evaluation | Mean rating ≥ 4.0 / 5.0 across all five quality characteristics |

## 6. Architecture at a Glance

One Next.js frontend, one FastAPI backend, Supabase for Postgres/Auth/Storage. No separate CV/inference microservice — the CV and CNN pipeline runs in-process inside FastAPI, called synchronously during submission upload.

```
┌─────────────────────────────┐
│  Next.js App (Vercel)        │
│  (teacher) / (parent)        │
│  route groups + middleware   │
└───────────┬───────────────────┘
            │
   ┌────────┴─────────┐
   │                   │
   ▼                   ▼
┌──────────────┐  ┌──────────────────────────────┐
│ Supabase      │  │ FastAPI Backend (Railway)     │
│ direct reads  │  │ - roster/activity CRUD        │
│ (supabase-js, │  │ - submission upload+process   │
│  RLS-gated)   │  │ - CV pipeline (in-process)     │
└──────┬────────┘  │ - CNN inference (in-process)   │
       │           └──────────┬─────────────────────┘
       │                      │
       ▼                      ▼
┌───────────────────────────────────────────────┐
│ Supabase (Postgres + Auth + Storage)           │
│ - RLS policies enforce role-based access       │
│ - Storage: submission images (private)         │
│ - Storage: CNN model artifact (private)        │
└─────────────────────────────────────────────────┘
```

Reads split from writes: dashboard/roster/trend data is read directly via RLS-gated `supabase-js`; anything with business logic (activity creation, submission upload + CV/CNN processing) goes through FastAPI with the service-role key. Full rationale in `ARCHITECTURE.md` §1–4.

## 7. Tech Stack

| Layer | Choice | Version |
|---|---|---|
| Frontend | Next.js, React, TypeScript | Next.js 16, React 19 |
| UI | Tailwind CSS, shadcn/ui | Tailwind v4 |
| Backend | Python, FastAPI, Pydantic | Python 3.13, FastAPI 0.136.x, Pydantic v2 |
| Computer Vision | OpenCV | `opencv-python-headless` |
| Machine Learning | TensorFlow/Keras | MobileNetV2 backbone, transfer-learned |
| Database / Auth / Storage | Supabase (PostgreSQL) | — |
| Data Visualization | Recharts | — |
| Frontend package manager | npm | Node 24 (LTS) |
| Backend dependency manager | uv | — |
| Deployment | Vercel (frontend) / Railway (backend) | — |
| IDE | Antigravity (VS Code-based) | — |

Full toolchain, exact pins, and rationale: [`TECH_STACK.md`](./TECH_STACK.md).

## 8. Repository Structure

```
writewise/
├── frontend/            # Next.js app (Vercel deploy target)
├── backend/
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
├── ml/                   # model training notebooks/artifacts (CCC/C-Cube fine-tuning)
└── .github/workflows/     # CI (test-gating, not deploy)
```

No workspace tooling (Turborepo/pnpm workspaces) — Vercel builds from `/frontend`, Railway from `/backend`. Full rationale: `ARCHITECTURE.md` §2.

## 9. Getting Started

No Docker required — local dev connects directly to the hosted `writewise-dev` Supabase project.

```bash
# 1. Clone
git clone <repo-url> && cd writewise

# 2. Frontend
cd frontend
nvm use                            # picks up .nvmrc (Node 24)
npm install
cp .env.local.example .env.local   # fill in dev-Supabase values
npm run dev

# 3. Backend (separate terminal)
cd backend
uv python pin 3.13                 # one-time; writes .python-version
uv sync
cp .env.example .env               # fill in dev-Supabase values
uv run uvicorn app.main:app --reload

# 4. Generate types (after pulling new migrations or backend API changes)
supabase gen types typescript --project-id <dev-project-id> > frontend/src/types/database.ts
npx openapi-typescript http://localhost:8000/openapi.json -o frontend/src/types/api.ts
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000` (Swagger UI at `/docs`)

Environment variable reference (frontend `.env.local` and backend `.env`, plus prod secrets handling on Vercel/Railway): `TECH_STACK.md` §8, `DEPLOYMENT.md` §6.

## 10. Testing

```bash
# Backend
uv run ruff check .        # lint
uv run pytest              # unit + integration tests (ephemeral local Supabase stack, mocked CNN)

# Frontend
npm run lint
npx tsc --noEmit
```

CI (GitHub Actions) runs on every PR as a required merge-gate: lint, type-check, and the full backend `pytest` suite against a disposable `supabase start` stack. Deploys themselves are handled natively by Vercel/Railway on push to `main`, not by Actions. Full test matrix, manual QA checklist, and pre-launch/pre-defense checklists: [`TESTING.md`](./TESTING.md).

## 11. Documentation

This repo's docs form one connected build guide — `PRD.md` is the source of truth for *what* the system does, `ARCHITECTURE.md` for *how* it's built, and each other doc drills into one layer of that.

| Document | Covers |
|---|---|
| [`PRD.md`](./PRD.md) | Problem statement, scope, phased build roadmap, user flows, functional requirements, success metrics, risks |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System overview, repo structure, environments, data-access pattern, auth, submission pipeline, scoring engine, CI/CD, logging |
| [`DESIGN.md`](./DESIGN.md) | Design tokens, component strategy, 15-screen inventory, interaction patterns, content/voice, accessibility, branding |
| [`CV_PIPELINE.md`](./CV_PIPELINE.md) | Quality gate, preprocessing, guide-line detection/deskew, segmentation, OpenCV feature extraction (slant/spacing/baseline/size), CNN handoff, output schema |
| [`ML_PIPELINE.md`](./ML_PIPELINE.md) | CCC/C-Cube dataset, MobileNetV2 backbone, two-stage fine-tuning + regression head, training ops, deployed inference |
| [`DATABASE.md`](./DATABASE.md) | Full Postgres schema — tables, enums, constraints, RLS/Storage policies, indexes, migrations |
| [`API_SPEC.md`](./API_SPEC.md) | Every FastAPI HTTP endpoint — request/response shapes, auth rules, error-code catalog |
| [`TECH_STACK.md`](./TECH_STACK.md) | Exact version pins, package managers, lint/format tools, env-var conventions, local setup |
| [`SECURITY.md`](./SECURITY.md) | Threat model, secrets/access control, auth/session security, file-upload hardening, RA 10173 compliance |
| [`TESTING.md`](./TESTING.md) | Unit/integration/security tests, manual QA checklist, pre-launch and pre-defense checklists |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Platform setup, provisioning runbook, Railway/Vercel config, model versioning, backups, rollback, go-live, decommission |
| `AGENTS.md` | Agent-facing operating manual for AI coding agents (Claude Code/Cursor/Codex) working in this repo |
| `IMPLEMENTATION_STATUS.md` | Live "what's actually built" tracker against the `PRD.md` §5 roadmap |

## 12. Security & Privacy

Real student names are stored in-app (restricted by role-based RLS access); anonymization is applied only when exporting data for thesis analysis via a standalone, versioned script — never ad hoc. Submission images go through magic-byte validation, a decompression-bomb size cap, and unconditional EXIF/GPS stripping before storage. Compliant with the Data Privacy Act of 2012 (RA 10173); consent is collected via paper forms outside the app. Full threat model and controls: [`SECURITY.md`](./SECURITY.md).

## 13. Team

- Ryan Christopher B. Estoque
- John Lawrence V. Monleon
- James David B. Asoy
- Saara Eliana G. Ibag

Holy Cross of Davao College, BSIT — capstone project, research locale: Matina Aplaya Elementary School, Talomo, Davao City.
