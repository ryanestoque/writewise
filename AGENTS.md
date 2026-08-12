# AGENTS.md

Operating instructions for any AI coding agent (Claude Code, Cursor, Codex, etc.) working in this repository. This file is agent-facing and intentionally lean — depth and rationale live in the 11 companion docs below; this file tells you what to run, what not to break, and where to look next.

---

## 1. Project Snapshot

**WriteWise** — a web-based system using OpenCV + a fine-tuned CNN to assess uploaded cursive handwriting worksheets against five criteria (letter formation, size consistency, spacing, slant, baseline alignment), generate explainable diagnostic feedback, and track a student's progress over time. Teacher and parent portals; no student login (students are minors, paper-only interaction).

Built in two functional phases running on a parallel timeline (full detail: `PRD.md` §5):
- **Phase 1** — teacher tooling, raw CV measurement display, manual rubric-score entry (collects paired data for calibration).
- **Phase 2** — calibrated auto-scoring, diagnostic feedback UI, parent portal, progress dashboards. Built concurrently against Phase 1's manual scores as placeholder data.

Team: Ryan Christopher B. Estoque, John Lawrence V. Monleon, James David B. Asoy, Saara Eliana G. Ibag — Holy Cross of Davao College, BSIT. Target technical defense: **October 2026**.

**Current build status is not tracked in this file.** Check `IMPLEMENTATION_STATUS.md` (once created) for what's actually built vs. still scaffolding before assuming either.

---

## 2. Repo Map

```
writewise/
├── frontend/               # Next.js app — Vercel deploy target
├── backend/
│   ├── app/
│   │   ├── api/             # route handlers
│   │   ├── cv/               # OpenCV pipeline + quality gate
│   │   ├── ml/                 # CNN inference wrapper, model loader
│   │   ├── scoring/             # ManualScoreProvider / CalibratedScoreProvider
│   │   └── core/                  # config, auth, error handling
│   └── tests/                # pytest suite, mirrors app/ structure
├── supabase/migrations/       # versioned SQL — schema + RLS + Storage policies
├── research/                  # offline scripts (dataset export/anonymization)
├── ml/                        # training notebooks/artifacts (CCC/C-Cube fine-tuning), never deployed
└── .github/workflows/         # CI (test-gating only, not deploy)
```

No workspace tooling (no Turborepo/pnpm workspaces) — `frontend/` and `backend/` are independently deployed apps, not a shared package boundary.

---

## 3. Setup & Commands

No Docker needed locally — dev connects directly to the hosted `writewise-dev` Supabase project.

```bash
# Frontend
cd frontend
nvm use                              # Node 24 via .nvmrc
npm install
cp .env.local.example .env.local     # fill in dev-Supabase values
npm run dev                          # http://localhost:3000

# Backend (separate terminal)
cd backend
uv python pin 3.13                   # one-time
uv sync
cp .env.example .env                 # fill in dev-Supabase values
uv run uvicorn app.main:app --reload # http://localhost:8000, docs at /docs

# Regenerate types — required after any migration or backend API change
supabase gen types typescript --project-id <dev-project-id> > frontend/src/types/database.ts
npx openapi-typescript http://localhost:8000/openapi.json -o frontend/src/types/api.ts
```

Lint/format: `uv run ruff check .` (backend), `npx eslint .` (frontend). Full setup rationale → `TECH_STACK.md` §9.

---

## 4. Code Conventions

- **TypeScript:** `strict: true`, kept strict — don't relax it. ESLint (flat config, `eslint-config-next`) + Prettier.
- **Python:** ruff for lint *and* format (replaces black/isort/flake8). Pydantic v2 + `pydantic-settings` for typed env config.
- **API errors:** every error response uses the envelope `{ error: { code, message, details } }`. Frontend branches on `error.code` only — never on `message` text. Adding a new error path means adding its code to `API_SPEC.md` §2.4's catalog.
- **DB schema:** SQL-first — migrations are `.sql` files in `supabase/migrations/`, the single source of truth. No ORM-owned migrations, no dashboard-only schema edits.
- **API types:** generated, not hand-maintained — `openapi-typescript` from FastAPI's OpenAPI schema, `supabase gen types` from the live DB schema.

Full detail → `TECH_STACK.md`, `API_SPEC.md` §2.

---

## 5. Testing Requirements

Run checks scoped to what you actually touched — don't reflexively run the full suite for a copy change.

- **Always:** `uv run ruff check .`, `npx eslint .`, `npx tsc --noEmit`.
- **Backend logic changed** (`app/cv/`, `app/ml/`, `app/scoring/`): run the relevant `uv run pytest` module.
- **`app/api/`, `app/scoring/`, or a migration changed:** spin up the ephemeral stack and run the full suite — `supabase start` → `supabase db reset` → `uv run pytest` → `supabase stop`. This mirrors CI exactly (`TESTING.md` §3.1, §3.3).
- **Migration added/changed:** regenerate types (§3 commands above) in the same commit.
- **Frontend-only change:** no automated suite exists by design (`TESTING.md` §7) — do a manual pass against the relevant flow in `DESIGN.md` and note it in the PR description.
- CNN inference is stubbed in tests (`ENVIRONMENT=test`) — you never need the real model artifact locally. Details → `TESTING.md` §3.2.

Full detail → `TESTING.md`.

---

## 6. Hard Rules — Non-Negotiables

1. Never bypass RLS from app code. The service-role key is used only in `research/export_dataset.py` and manual backup scripts — never in the deployed API.
2. Frontend branches on `error.code`, never on `error.message` text.
3. EXIF stripping (GPS, timestamp, device info) is unconditional on every path that writes an image to Storage. Never make it conditional or skip it.
4. Logs may only contain opaque `student_id`/`submission_id` + pipeline metadata. Never `full_name`, raw image bytes, or measurement values tied to an identifiable child.
5. Magic-byte file-signature check and decode-time pixel-dimension cap must run before Pillow/OpenCV touches an uploaded file — ahead of the quality gate.
6. Schema changes are versioned SQL migrations only. No dashboard-only edits, no ORM-owned migrations. Regenerate types in the same PR.
7. Scoring logic changes go through the `ScoreProvider` abstraction behind the `SCORING_ENGINE` config flag — never hardcode a phase-specific branch elsewhere in the API/frontend contract.
8. Prod (`writewise-prod`) is touched only by the two named key-holders, only for debugging/export/incident-response. Everyone else works against `writewise-dev` seeded data.
9. Rejected submissions (failed quality gate or post-segmentation mismatch) are persisted as a `Submission` row with status `rejected` + reason — never silently discarded.
10. No automated dependency bots. Updates are manual and deliberate.
11. Dataset export/anonymization happens only via `research/export_dataset.py`, run locally with the service-role key — never an in-app endpoint, never ad hoc SQL.
12. No app-level rate limiting — this is a documented accepted risk at pilot scale, not a gap to opportunistically "fix."
13. The CNN model loads from Supabase Storage at container startup. Never bundle it in git; a failed load should crash startup loudly, not degrade silently.
14. The CV/CNN pipeline stays in-process inside the single FastAPI service — never split into a separate microservice.
15. Single Uvicorn worker only — never add multi-worker (would duplicate the resident CNN model in memory).

---

## 7. Where to Look

| Task involves... | Consult |
|---|---|
| Product scope, roles, phased roadmap | `PRD.md` |
| System design, data-access pattern, deploy targets, CI | `ARCHITECTURE.md` |
| Screens, visual system, copy voice | `DESIGN.md` |
| OpenCV quality gate, preprocessing, segmentation, feature extraction | `CV_PIPELINE.md` |
| CNN model, training regimen, inference | `ML_PIPELINE.md` |
| Schema, RLS policies, Storage policies | `DATABASE.md` |
| Endpoints, request/response shapes, error codes | `API_SPEC.md` |
| Exact versions, package managers, local dev setup | `TECH_STACK.md` |
| Threat model, secrets, RA 10173, PII rules | `SECURITY.md` |
| Test strategy, CI mechanics, pre-launch/pre-defense checklists | `TESTING.md` |
| Platform setup, env vars, rollback, go-live/decommission | `DEPLOYMENT.md` |
| What's actually built vs. still scaffolding | `IMPLEMENTATION_STATUS.md` (once created) |

---

## 8. Git / PR Workflow

- **Trunk-based:** short-lived feature branches off `main`, PR + Vercel preview + CI, merge straight to `main`. No `develop`/staging branch (`DEPLOYMENT.md` §3).
- **Conventional Commits:** `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:` prefixes.
- **PR description** should name what changed, which doc section it implements (e.g. "CV_PIPELINE.md §4 word segmentation"), and how it was tested (per §5 above).
- **CI** (GitHub Actions) is a required merge-gate — lint/type-check + full backend pytest against the ephemeral Supabase stack. It does not deploy; Vercel/Railway deploy natively on push to `main`.

---

## 9. Definition of Done

- [ ] Lint clean (`ruff` / `eslint`) and `tsc --noEmit` passes.
- [ ] If backend logic changed: the relevant `pytest` module passes locally.
- [ ] If `app/api/`, `app/scoring/`, or a migration changed: full `pytest` suite passes against the ephemeral Supabase stack.
- [ ] If a migration changed: types regenerated and committed in the same PR.
- [ ] If frontend-only: manual QA pass against the relevant `DESIGN.md` flow, noted in the PR.
- [ ] No rule in §6 violated.
- [ ] Commit messages follow Conventional Commits; PR description names the doc section implemented and how it was tested.
