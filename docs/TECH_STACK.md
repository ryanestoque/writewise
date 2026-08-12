# WriteWise — TECH_STACK.md

**A Computer Vision and CNN-Based Diagnostic Cursive Handwriting Assessment and Progress Monitoring System**

- **Document type:** Internal engineering operational reference (companion to PRD.md, ARCHITECTURE.md, DESIGN.md, CV_PIPELINE.md, ML_PIPELINE.md, DATABASE.md, API_SPEC.md, SECURITY.md, TESTING.md, DEPLOYMENT.md)
- **Team:** Ryan Christopher B. Estoque, John Lawrence V. Monleon, James David B. Asoy, Saara Eliana G. Ibag
- **Status:** Draft v1
- **Scope:** the concrete, operational half of "what runs this system" — exact version pins, package managers, linting/formatting tools, dependency management, environment-variable conventions, and a literal getting-started setup. This document answers **"what exact command do I run."** For **"why is it structured this way,"** see ARCHITECTURE.md — repo layout, CI/CD philosophy, data-access patterns, and testing strategy are not repeated here.

---

## 1. Toolchain at a Glance

| Layer | Choice | Version |
|---|---|---|
| Node.js | — | **24 (Active LTS)** |
| Frontend package manager | — | **npm** |
| Python | — | **3.13** |
| Backend dependency manager | — | **uv** (also manages the Python interpreter itself — no pyenv) |
| Frontend framework | Next.js | **16** |
| UI library | React | **19** |
| CSS framework | Tailwind CSS | **v4** |
| Component library | shadcn/ui | latest (Tailwind v4 / React 19 compatible) |
| Backend framework | FastAPI | latest 0.136.x |
| Validation | Pydantic | **v2** (+ `pydantic-settings` for typed env config) |
| Computer Vision | OpenCV | `opencv-python-headless` |
| Machine Learning | TensorFlow/Keras | latest stable compatible with Python 3.13 |
| Database/Auth/Storage | Supabase | — |
| Frontend lint/format | ESLint (flat config) + Prettier | — |
| Backend lint/format | ruff | — |
| Frontend type-safety (API) | `openapi-typescript` (generated from FastAPI's OpenAPI schema) | — |
| Frontend type-safety (DB) | `supabase gen types typescript` | — |
| IDE | Antigravity (VS Code-based) | — |
| Deployment | Vercel (frontend) / Railway (backend) | — |

**Why these pins matter:** TensorFlow does not yet officially support Python 3.14, and Next.js 15 exits Maintenance LTS in October 2026 — right around the technical defense. Every version above was chosen to still be actively supported through defense season, not just "whatever's newest today."

---

## 2. Frontend Stack

### 2.1 Core

- **Next.js 16**, App Router, **React 19**. Next.js 16 requires React 19 — these are not independent choices.
- Ships the stable **React Compiler** (auto-memoization) — one less manual performance concern for the team.
- **Note:** Next.js 16 **removed `next lint` entirely**. Linting is no longer bundled or run automatically during `next build` — see §4.1.

### 2.2 Package Manager — npm

Standard `npm install` / `npm run <script>`. No pnpm/yarn — chosen for zero learning-curve tax across a 4-person team, at the cost of npm's usual (here, harmless-at-this-scale) phantom-dependency looseness.

```bash
cd frontend
npm install
npm run dev
```

### 2.3 Node.js Version — 24 (LTS)

Pinned via a committed `.nvmrc`:

```
# frontend/.nvmrc
24
```

And mirrored in `package.json` so npm itself warns on a mismatch:

```json
{
  "engines": {
    "node": ">=24.0.0"
  }
}
```

Anyone using `nvm`, `fnm`, or Antigravity's own Node management picks this up automatically with `nvm use`.

### 2.4 TypeScript — strict mode

`strict: true` in `tsconfig.json` — this is Next.js's own scaffolded default; **do not relax it**. Strict mode is what actually makes §5's generated types (from both Supabase and FastAPI's OpenAPI schema) worth having — loosening it would let real frontend/backend type mismatches silently slip through despite the generation machinery being in place.

### 2.5 CSS — Tailwind CSS v4

Not just "the newer version" — shadcn/ui's Tailwind v4 integration is built specifically around the `@theme inline` directive and CSS variables, which is exactly the CSS-variable token architecture DESIGN.md already locked in (band-color gradient, dark-mode-ready token structure). Tailwind v4 is also required for the React 19 build of shadcn/ui components.

```bash
npm install tailwindcss @tailwindcss/postcss
npx shadcn@latest init
```

### 2.6 Key Frontend Dependencies

| Package | Purpose |
|---|---|
| `@tanstack/react-query` | Unified data-fetching layer for both direct Supabase reads and FastAPI calls (ARCHITECTURE §11) |
| `@supabase/supabase-js` | Direct RLS-gated reads, Auth |
| `recharts` | Trend charts, dashboard visualizations |
| `framer-motion` | Scoped motion (loading sequence, overlay drill-in, band badge reveal — DESIGN.md) |
| `lucide-react` | Icon set (matches shadcn/ui default pairing) |
| `openapi-typescript` (dev dependency) | Generates TS types from FastAPI's OpenAPI schema — see §5.1 |

---

## 3. Backend Stack

### 3.1 Core

- **Python 3.13** — the newest version TensorFlow (2.21, current stable) officially supports. Python 3.14 is not yet TensorFlow-compatible; do not upgrade past 3.13 until TensorFlow ships official 3.14 wheels.
- **FastAPI** (latest 0.136.x) on **Pydantic v2**. Pydantic v1 support was dropped upstream — this isn't a style choice.
- **`pydantic-settings`** for typed environment-variable configuration (avoids raw, untyped `os.environ.get()` calls scattered through the codebase).

### 3.2 Dependency & Python Version Manager — uv

`uv` handles **both** package management and Python interpreter management — no separate `pyenv`, one fewer tool for each teammate to install and keep updated.

```bash
cd backend
uv python pin 3.13   # writes .python-version
uv sync               # installs from pyproject.toml + uv.lock
uv run uvicorn app.main:app --reload   # local dev
```

`pyproject.toml` is the single source of truth for backend dependencies; `uv.lock` is committed for reproducible installs across all 4 machines and Railway's build.

### 3.3 Computer Vision — `opencv-python-headless`

Not `opencv-python`. Railway's container has no display server (no X11) — the full package bundles GUI bindings (`cv2.imshow`, Qt libraries) that pull in system dependencies which frequently fail to build or bloat the image in headless environments. CV_PIPELINE.md's pipeline is server-side feature extraction only (grayscale, thresholding, Hough transforms, segmentation) — no GUI dependency to lose.

```bash
uv add opencv-python-headless
```

### 3.4 Machine Learning — TensorFlow/Keras

Install the latest TensorFlow release compatible with Python 3.13 (check `pip index versions tensorflow` or the PyPI classifiers at install time — TensorFlow's Python-version support lags behind new Python releases by design, so this is worth a quick verification before each fresh environment setup rather than assuming). See ML_PIPELINE.md for the MobileNetV2 backbone and training regimen.

### 3.5 Backend Server Process — single Uvicorn worker

```bash
# production (Railway start command)
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

**No Gunicorn, no multi-worker setup.** ML_PIPELINE.md keeps the fine-tuned CNN model resident in memory per process (loaded once at container startup). Multiple workers would mean multiple full copies of that model loaded into RAM simultaneously — real memory cost for negligible benefit at this pilot's scale (5 teachers, 30 students, synchronous one-submission-at-a-time processing). Revisit only if Railway's structured logs (ARCHITECTURE §15) show single-worker is an actual concurrency bottleneck — not preemptively.

### 3.6 Key Backend Dependencies

| Package | Purpose |
|---|---|
| `fastapi`, `pydantic`, `pydantic-settings` | Core framework + config |
| `uvicorn` | ASGI server |
| `opencv-python-headless` | CV pipeline |
| `tensorflow` | CNN inference (Stage 1 + Stage 2 models, ML_PIPELINE.md) |
| `asyncpg` or `sqlalchemy` (Core only, no ORM-owned migrations) | Direct Postgres queries against Supabase (ARCHITECTURE §6) |
| `supabase` (Python client) | Storage access (submission images, model artifact download) |

---

## 4. Linting & Formatting

### 4.1 Frontend — ESLint (flat config) + Prettier

Next.js 16 removed `next lint` and no longer runs linting during `next build` — this is now standalone, required infrastructure, not optional polish.

```bash
npm run lint       # eslint .
npm run lint:fix   # eslint . --fix
npm run format     # prettier --write .
```

`eslint-config-next` (flat config, `eslint.config.mjs`) is used over Biome specifically because it includes Next.js-specific and accessibility (`jsx-a11y`) rules out of the box — relevant here since the teacher/parent portals serve real, non-technical users, and not everyone on a 4-person team may be equally deep in frontend tooling.

### 4.2 Backend — ruff

Single tool for both linting and formatting — replaces black/isort/flake8. Same Astral ecosystem as `uv`, so both install and configure with minimal friction.

```bash
uv run ruff check .     # lint
uv run ruff format .    # format
```

Config lives in `pyproject.toml` under `[tool.ruff]`.

### 4.3 Enforcement — CI only

**No local git hooks** (Husky, `pre-commit`). GitHub Actions (ARCHITECTURE §14) already gates every PR merge on lint/type-check/pytest passing — a second local enforcement layer is redundant setup friction for a 4-person team on a compressed runway. Format-on-save via the committed editor config (§6) covers the day-to-day experience; CI is the actual backstop.

### 4.4 Dependency Updates — manual only

No Dependabot/Renovate. Automated dependency-bump PRs are useful for long-lived production apps, but on a ~9-10 week runway, an unattended "bump React 19.x → 19.y" merge is exactly the kind of thing that could introduce a regression days before the October defense for very little benefit at this project's lifespan. Bump specific dependencies deliberately, when there's a reason to.

---

## 5. Type Safety Across the Stack

Two independent generation pipelines keep the frontend from ever hand-maintaining types that could drift from reality:

### 5.1 Frontend ↔ FastAPI — `openapi-typescript`

FastAPI auto-generates an OpenAPI schema at `/openapi.json`. `openapi-typescript` turns that into TypeScript types:

```bash
npx openapi-typescript http://localhost:8000/openapi.json -o frontend/src/types/api.ts
```

No hand-maintained parallel type files. Regenerate after any backend request/response shape change and commit the updated types file alongside that backend PR.

### 5.2 Frontend ↔ Supabase — `supabase gen types`

Per DATABASE.md/ARCHITECTURE §6, Postgres enums and table shapes flow straight to TypeScript via the Supabase CLI:

```bash
supabase gen types typescript --project-id <dev-project-id> > frontend/src/types/database.ts
```

**Workflow:** manual — whoever writes a migration runs this against the dev project and commits the regenerated types file **in the same PR** as the migration. Schema change and its generated types land together in one reviewable diff. (No CI-enforced freshness check — that would need a Supabase access token in GitHub Secrets and an extra CI step neither justified at this team size.)

---

## 6. Editor Setup — Antigravity (VS Code-based)

The team's primary IDE is **Antigravity**, Google's agentic IDE — built on the VS Code codebase, so it's fully compatible with standard `.vscode/` workspace settings and the VS Code extension ecosystem. (This supersedes PRD §10's plain "VS Code" listing — nothing about the stack choices above changes because of it.)

A committed `.vscode/settings.json` + `.vscode/extensions.json` at the repo root:

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "charliermarsh.ruff",
    "ms-python.python",
    "bradlc.vscode-tailwindcss"
  ]
}
```

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[python]": {
    "editor.defaultFormatter": "charliermarsh.ruff"
  },
  "eslint.useFlatConfig": true
}
```

This is zero-friction — just editor settings, nothing that can block a commit or fail to install (unlike §4.3's deliberately-skipped local git hooks). It's what actually makes "consistent formatting across 4 machines" true day-to-day, since CI only catches problems after the fact.

---

## 7. API Reference & Testing — Swagger UI

FastAPI auto-generates interactive docs at **`/docs`** (Swagger UI) from the same OpenAPI schema §5.1's type generation depends on. This is the primary API reference and manual-testing tool — not a committed Postman collection (supersedes PRD §10's Postman listing). A hand-maintained Postman collection is one more artifact that can drift from the real API shape — Swagger UI can't drift, since it's generated from the live schema every time. Postman can still be used ad hoc by importing the OpenAPI spec directly, if a specific workflow (e.g. multipart file-upload testing) calls for it.

---

## 8. Environment Variables

### 8.1 Convention

- **Local dev:** `frontend/.env.local` and `backend/.env` — both gitignored.
- **Onboarding:** committed `.env.local.example` / `.env.example` templates listing every required key with placeholder values. A new teammate copies the example, fills in the dev-Supabase project's real values, done — no "ask Ryan for the .env file" tribal knowledge.
- **Prod secrets:** never touch a file at all — entered directly into Vercel's and Railway's dashboard environment-variable settings, matching how the Supabase service-role key already has to be handled (ARCHITECTURE §4).

### 8.2 Frontend (`.env.local`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (dev or prod) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key — safe for client exposure, RLS enforces access |
| `NEXT_PUBLIC_API_BASE_URL` | FastAPI backend base URL (local: `http://localhost:8000`; prod: Railway URL) |

### 8.3 Backend (`.env`)

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS for writes/business logic (ARCHITECTURE §4) — **never** exposed to the frontend |
| `SUPABASE_DB_URL` | Direct Postgres connection string for raw SQL/asyncpg queries |
| `MODEL_STORAGE_BUCKET` / `MODEL_ARTIFACT_PATH` | Supabase Storage location of the CNN model artifact, downloaded at container startup (ARCHITECTURE §9) |
| `SCORING_ENGINE` | `manual` \| `calibrated` — the Phase 1→2 scoring-provider swap flag (ARCHITECTURE §10) |
| `CORS_ALLOWED_ORIGINS` | Vercel frontend URL(s) — dev preview + prod |
| `ENVIRONMENT` | `dev` \| `prod` \| `test` — tags structured logs (ARCHITECTURE §15). `test` is CI-only: set automatically by the GitHub Actions workflow (never in a local `.env` file), and skips the real CNN model download/load in favor of TESTING.md §3.2's mocked inference function |

---

## 9. Local Development — Getting Started

No Docker required anywhere in this workflow — dev connects directly to the hosted `writewise-dev` Supabase project (ARCHITECTURE §3), not a local emulated stack.

```bash
# 1. Clone
git clone <repo-url> && cd writewise

# 2. Frontend
cd frontend
nvm use                      # picks up .nvmrc (Node 24)
npm install
cp .env.local.example .env.local   # fill in dev-Supabase values
npm run dev

# 3. Backend (separate terminal)
cd backend
uv python pin 3.13           # one-time; writes .python-version
uv sync
cp .env.example .env         # fill in dev-Supabase values
uv run uvicorn app.main:app --reload

# 4. Generate types (after pulling new migrations or backend API changes)
supabase gen types typescript --project-id <dev-project-id> > frontend/src/types/database.ts
npx openapi-typescript http://localhost:8000/openapi.json -o frontend/src/types/api.ts
```

Frontend runs at `http://localhost:3000`, backend at `http://localhost:8000` (Swagger UI at `http://localhost:8000/docs`).

---

## 10. Open Items / Revisit List

- **TensorFlow ↔ Python 3.14:** once TensorFlow ships official Python 3.14 wheels, revisit whether upgrading is worth it — no rush, 3.13 is fully supported through the pilot and defense.
- **Uvicorn single-worker assumption (§3.5):** unvalidated against real concurrent load — the pilot's stated scale (5 teachers) is the basis for this call, not a benchmark. First candidate to revisit if Railway's logs ever show a real bottleneck.
- **`openapi-typescript` regeneration is manual (§5.1)**, same trust model as `supabase gen types` (§5.2) — both rely on the PR author remembering to regenerate. If this proves unreliable in practice, a CI freshness check is the fallback, at the cost of the extra infrastructure noted in §5.2.
