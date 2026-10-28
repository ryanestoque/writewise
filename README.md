# WriteWise

<img src="./frontend/public/images/app_icons/writewise-app-icon-192.png" alt="WriteWise icon" width="80" />

**A Computer Vision and CNN-Based Diagnostic Cursive Handwriting Assessment and Progress Monitoring System**

WriteWise automatically assesses uploaded cursive handwriting worksheets against five measurable criteria — **letter formation, size consistency, spacing, slant, and baseline alignment** — using OpenCV feature extraction and a fine-tuned CNN, then turns those measurements into explainable diagnostic feedback and a progress-monitoring dashboard for teachers and parents.

| | |
|---|---|
| **Status** | Teacher and parent portals, CV pipeline, and scoring providers implemented; see [implementation status](./IMPLEMENTATION_STATUS.md) for pending integration and validation |
| **Team** | Ryan Christopher B. Estoque, John Lawrence V. Monleon, James David B. Asoy, Saara Eliana G. Ibag |
| **Institution** | Holy Cross of Davao College, BSIT |
| **Target setting** | School-agnostic — any basic-education classroom in the Philippines (no partner school at present) |
| **Technical defense** | October 2026 |

---

## 1. Why WriteWise

Cursive handwriting assessment in basic education is manual, time-consuming, and subjective — teachers judge letter formation, spacing, slant, baseline alignment, and size consistency by eye, across dozens of students, with no consistent standard. Parents often lack the reference knowledge to tell whether their child's handwriting is on track.

WriteWise gives teachers an objective, faster grading tool and gives parents visibility into their child's progress over time. Standard OCR is not a substitute — OCR transcribes *what* was written and discards the physical/structural quality of *how* it was written, which is exactly what this system evaluates.

Full problem statement, goals, and scope: [PRD.md](./docs/PRD.md).

## 2. Who Uses It

| Role | Who | What they do |
|---|---|---|
| **Teacher** | Basic education teacher | Creates handwriting activities, uploads/reviews submissions, views class-wide results and per-student diagnostics, manages their roster |
| **Parent/Guardian** | Parent of an enrolled student | Views their own child's progress and diagnostic feedback; can upload a completed sheet for a take-home activity |
| **Student** | Learner (minor) | No account, no direct access — exists only as a roster record; all interaction happens on paper |

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
Phase 1                            Between Phases (offline)          Phase 2 (built in parallel, integrated after calibration)
─────────────────────               ─────────────────────────         ──────────────────────────────────────────────────────
Teacher creates activity             Analyze paired raw-measurement /   Parent portal
   → student writes on paper           teacher-score dataset            Progress dashboard (both roles)
   → photo uploaded                  Derive per-criterion thresholds   Diagnostic feedback UI (overlay + text)
   → CV pipeline runs, shows         Validate via Spearman's Rho       Calibrated auto-scoring swapped in for
     RAW measurements only           Fine-tune + evaluate the CNN        manual entry (backend flag flip, not a
   → teacher manually enters                                             UI rebuild) — manual-score field removed
     their own rubric score
```

Once calibration is done, the manual-entry step is swapped for the calibrated auto-scoring engine — a backend config change, not a UI rebuild (see [ARCHITECTURE.md](./docs/ARCHITECTURE.md) §10).

| Workstream | Scope |
|---|---|
| Phase 1 | Teacher tooling, raw CV measurements, and manual rubric scores for paired calibration data |
| Calibration | Dataset export, threshold/correlation analysis, CNN training, and inference artifact export |
| Phase 2 | Teacher and parent dashboards, diagnostic feedback, and calibrated scoring integration |
| Evaluation | Teacher/parent evaluation, IT expert review (ISO/IEC 25010), and diagnostic accuracy validation |

See [implementation status](./IMPLEMENTATION_STATUS.md) for item-level progress and pending verification. The tracker records completed training/export work but still lists the calibrated-scoring switch as pending; deployed model and scoring configuration must be verified separately. The original roadmap and risks remain in [PRD.md](./docs/PRD.md) §5/§12.

## 5. Success Metrics

Proposed targets, literature-grounded, pending adviser sign-off ([PRD.md](./docs/PRD.md) §11):

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
│ (supabase-js, │  │ - submission upload/delete    │
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

Reads split from writes: dashboard/roster/trend data is read directly via RLS-gated `supabase-js`; anything with business logic (activity creation, submission upload/deletion + CV/CNN processing) goes through FastAPI with the service-role key. Full rationale in [ARCHITECTURE.md](./docs/ARCHITECTURE.md) §1–4.

## 7. Tech Stack

| Layer | Choice | Version |
|---|---|---|
| Frontend | Next.js, React, TypeScript | Next.js 16, React 19 |
| UI | Tailwind CSS, shadcn/ui | Tailwind v4 |
| Backend | Python, FastAPI, Pydantic | Python 3.13, FastAPI ≥ 0.141.1, Pydantic v2 |
| Computer Vision | OpenCV | `opencv-python-headless` |
| Machine Learning | TensorFlow/Keras | MobileNetV2 backbone, transfer-learned |
| Database / Auth / Storage | Supabase (PostgreSQL) | — |
| Data Visualization | Recharts | — |
| Frontend package manager | npm | Node 24 (LTS) |
| Backend dependency manager | uv | — |
| Deployment | Vercel (frontend) / Railway (backend) | — |
| IDE | Antigravity (VS Code-based) | — |

Full toolchain, exact pins, and rationale: [TECH_STACK.md](./docs/TECH_STACK.md).

## 8. Repository Structure

```
writewise/
├── frontend/            # Next.js app (Vercel deploy target)
├── backend/
│   ├── app/
│   │   ├── api/          # route handlers
│   │   ├── cv/            # OpenCV pipeline + quality gate
│   │   ├── diagnostic/     # diagnostic overlays and feedback
│   │   ├── ml/             # CNN inference, HTR verification, model loaders
│   │   ├── scoring/         # ManualScoreProvider / CalibratedScoreProvider
│   │   └── core/              # config, auth, error handling
│   └── tests/
├── supabase/            # SQL migrations (schema + RLS + Storage policies)
│   └── migrations/
├── research/             # offline scripts (dataset export/anonymization)
├── training/             # offline CNN/HTR training and evaluation
├── docs/                 # engineering specs, onboarding, ADRs, and validation guides
├── DESIGN.md             # active design tokens and theme specification
├── IMPLEMENTATION_STATUS.md # item-level build and verification status
└── .github/workflows/     # CI (test-gating, not deploy)
```

No workspace tooling (Turborepo/pnpm workspaces) — Vercel builds from `/frontend`, Railway from `/backend`. Full rationale: [ARCHITECTURE.md](./docs/ARCHITECTURE.md) §2.

## 9. Getting Started

> 🚀 **New to the team?** Follow the step-by-step teammate onboarding guide in [`docs/QUICKSTART.md`](./docs/QUICKSTART.md) to get your machine configured with Node, `uv`, and dev environment credentials.

Use Node 24, Python 3.13 (managed by `uv`), and the hosted `writewise-dev` Supabase project. Docker is needed only when running the ephemeral Supabase test stack locally.

Clone the repository:

```bash
git clone https://github.com/ryanestoque/writewise.git
cd writewise
```

Start the frontend from the repository root:

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in dev-Supabase values
npm run dev
```

In a separate terminal, start the backend from the repository root:

```bash
cd backend
uv sync
cp .env.example .env               # fill in dev-Supabase values
uv run uvicorn app.main:app --reload
```

After a migration or backend API shape change, regenerate the relevant types from the repository root (the backend must be running for OpenAPI generation):

```bash
supabase gen types typescript --project-id <dev-project-id> > frontend/types/database.ts
npx openapi-typescript http://localhost:8000/openapi.json -o frontend/types/api.ts
```

Commit regenerated types alongside the corresponding schema or API change. The setup commands use Bash syntax; PowerShell also supports `cp` as an alias for `Copy-Item`.

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000` (Swagger UI at `/docs`)

Environment variable reference (frontend `.env.local` and backend `.env`, plus prod secrets handling on Vercel/Railway): [TECH_STACK.md](./docs/TECH_STACK.md) §8, [DEPLOYMENT.md](./docs/DEPLOYMENT.md) §6.

The backend example defaults to `SCORING_ENGINE=manual` with empty model paths. An empty `MODEL_ARTIFACT_PATH` enables stub CNN inference; a configured CNN artifact that fails to load stops startup. `HTR_MODEL_ARTIFACT_PATH` controls optional target-text verification. Keep the service-role key in the backend environment only.

## 10. Testing

```bash
# From backend/
uv run ruff check .        # lint

# From frontend/
npm run lint
npx tsc --noEmit
```

For backend tests, use the disposable local Supabase stack rather than the shared hosted dev project. From the repository root, run `supabase start` and `supabase db reset`; configure the backend test environment with that stack's URL, service-role key, JWT secret, and database URL, plus `ENVIRONMENT=test`. Run `uv run pytest` from `backend/`, then `supabase stop` from the repository root. This requires Docker and the Supabase CLI. See [the CI workflow](./.github/workflows/ci.yml) for the exact environment wiring and [TESTING.md](./docs/TESTING.md) §3 for the test strategy. CNN inference is stubbed in tests; no trained artifact is required.

Frontend flow checks are manual; use [the screen and interaction guide](./docs/DESIGN.md) and [TESTING.md](./docs/TESTING.md) §7.

CI (GitHub Actions) runs on every PR as a required merge-gate: lint, type-check, and the full backend `pytest` suite against a disposable `supabase start` stack. Deploys themselves are handled natively by Vercel/Railway on push to `main`, not by Actions. Full test matrix, manual QA checklist, and pre-launch/pre-defense checklists: [TESTING.md](./docs/TESTING.md).

## 11. Documentation

This repo's docs form one connected build guide — [PRD.md](./docs/PRD.md) is the source of truth for *what* the system does, [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for *how* it's built, and each other doc drills into one layer of that.

| Document | Covers |
|---|---|
| [PRD.md](./docs/PRD.md) | Problem statement, scope, phased build roadmap, user flows, functional requirements, success metrics, risks |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System overview, repo structure, environments, data-access pattern, auth, submission pipeline, scoring engine, CI/CD, logging |
| [`docs/DESIGN.md`](./docs/DESIGN.md) | Screen inventory, user flows, interaction patterns, content/voice, accessibility, branding |
| [`DESIGN.md`](./DESIGN.md) | Active design tokens, theme values, and visual specifications |
| [CV_PIPELINE.md](./docs/CV_PIPELINE.md) | Quality gate, preprocessing, guide-line detection/deskew, segmentation, OpenCV feature extraction (slant/spacing/baseline/size), CNN handoff, output schema |
| [ML_PIPELINE.md](./docs/ML_PIPELINE.md) | CCC/C-Cube dataset, MobileNetV2 backbone, two-stage fine-tuning + regression head, training ops, deployed inference |
| [DATABASE.md](./docs/DATABASE.md) | Full Postgres schema — tables, enums, constraints, RLS/Storage policies, indexes, migrations |
| [API_SPEC.md](./docs/API_SPEC.md) | Every FastAPI HTTP endpoint — request/response shapes, auth rules, error-code catalog |
| [TECH_STACK.md](./docs/TECH_STACK.md) | Exact version pins, package managers, lint/format tools, env-var conventions, local setup |
| [SECURITY.md](./docs/SECURITY.md) | Threat model, secrets/access control, auth/session security, file-upload hardening, RA 10173 compliance |
| [TESTING.md](./docs/TESTING.md) | Unit/integration/security tests, manual QA checklist, pre-launch and pre-defense checklists |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Platform setup, provisioning runbook, Railway/Vercel config, model versioning, backups, rollback, go-live, decommission |
| [`QUICKSTART.md`](./docs/QUICKSTART.md) | Zero-to-running local setup guide for teammates — prerequisites, installation commands, env config, troubleshooting |
| [`CALIBRATION_SCORING_GUIDE.md`](./docs/CALIBRATION_SCORING_GUIDE.md) | Spearman correlation analysis, threshold derivation, and scoring integration |
| [Architecture decisions](./docs/adr/) | CV pipeline, CNN architecture, HTR verification, and class sections |
| [`training/README.md`](./training/README.md) | Offline CNN and HTR training, evaluation, and model export workflows |
| [`research/README.md`](./research/README.md) | Dataset export/anonymization, correlation analysis, and score maintenance |
| [`AGENTS.md`](./AGENTS.md) | Agent-facing operating manual for AI coding agents (Claude Code/Cursor/Codex) working in this repo |
| [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) | Live "what's actually built" tracker against the PRD §5 roadmap |

## 12. Security & Privacy

Real student names are stored in-app (restricted by role-based RLS access); anonymization is applied only when exporting data for thesis analysis via a standalone, versioned script — never ad hoc. Submission images go through magic-byte validation, a decompression-bomb size cap, and unconditional EXIF/GPS stripping before storage. Compliant with the Data Privacy Act of 2012 (RA 10173); consent is collected via paper forms outside the app. Full threat model and controls: [SECURITY.md](./docs/SECURITY.md).

## 13. Team

- Ryan Christopher B. Estoque
- John Lawrence V. Monleon
- James David B. Asoy
- Saara Eliana G. Ibag

Holy Cross of Davao College, BSIT — capstone project. WriteWise is school-agnostic and is not tied to any partner institution.
