<div align="center">
  <img src="./frontend/public/images/app_icons/writewise-app-icon-192.png" alt="WriteWise Logo" width="88" />
  <h1>WriteWise</h1>
  <p><strong>Computer Vision & Deep Learning Diagnostic Cursive Handwriting Assessment</strong></p>
  <p>An automated diagnostic assessment and progress monitoring platform for basic education cursive handwriting.</p>
</div>

---

## Overview

**WriteWise** automates the evaluation of cursive handwriting worksheets by extracting physical stroke features with **OpenCV** and assessing character formation quality with a fine-tuned **MobileNetV2 CNN**. The system replaces subjective manual evaluation with transparent diagnostic feedback and tracks student progress over time across dedicated teacher and parent portals.

### Five Core Evaluation Criteria

1. **Letter Formation** — Character morphology and structural accuracy evaluated via a fine-tuned CNN.
2. **Size Consistency** — Uniformity of letter heights against baseline guidelines measured via OpenCV contours.
3. **Spacing** — Character and word gap regularity assessed through bounding-box horizontal distributions.
4. **Slant** — Cursive stroke angle adherence and consistency computed using Sobel gradients and moments.
5. **Baseline Alignment** — Stability of bottom strokes along the guideline detected via Hough Line transforms.

> [!NOTE]
> **Two-Phase Calibration Model:**
> To ensure pedagogical validity, scoring thresholds are derived from real paired data. **Phase 1** collects raw CV measurements paired with manual teacher rubric evaluations. In **Phase 2**, empirical thresholds and calibrated scoring models replace manual grading via backend configuration. See [`docs/CALIBRATION_SCORING_GUIDE.md`](./docs/CALIBRATION_SCORING_GUIDE.md).

---

## Key Highlights

- **Explainable Feedback:** Visual overlay annotations and criterion-level qualitative band breakdowns rather than opaque scores.
- **Dedicated Portals:** Separate teacher classroom management and parent progress tracking interfaces.
- **Paper-First Workflow:** Children write naturally on physical worksheets; submissions are digitized via standard smartphone cameras.
- **Privacy by Design:** Full compliance with the Philippine Data Privacy Act of 2012 (RA 10173), featuring unconditional EXIF metadata stripping and strict role-based access control.

---

## Architecture

WriteWise uses a synchronous, split-responsibility architecture:

```
┌─────────────────────────────────┐
│       Next.js 16 Frontend       │
│  Teacher & Parent Dashboards    │
└────────┬───────────────┬────────┘
         │ (Direct reads)│ (Uploads & writes)
         ▼               ▼
┌────────────────┐  ┌─────────────────────────────────┐
│ Supabase (RLS) │  │   FastAPI Backend (Python 3.13) │
│ - Postgres DB  │  │ - Quality Gate & EXIF Stripper  │
│ - Supabase Auth│  │ - OpenCV Feature Extraction     │
│ - Storage      │  │ - MobileNetV2 CNN Inference     │
└────────────────┘  └─────────────────────────────────┘
```

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, Recharts.
- **Backend:** FastAPI, Pydantic v2, OpenCV (`opencv-python-headless`), TensorFlow/Keras.
- **Database & Storage:** Supabase PostgreSQL with Row Level Security (RLS) and encrypted object storage.

For detailed architecture rationale and data flows, see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Quickstart

> [!TIP]
> For a complete setup walkthrough, prerequisite installations, and troubleshooting, refer to [`docs/QUICKSTART.md`](./docs/QUICKSTART.md).

### Prerequisites
- **Node.js** `v24` (via `.nvmrc`)
- **Python** `3.13` (managed via [`uv`](https://docs.astral.sh/uv/))
- **Supabase CLI** and access to the `writewise-dev` project

### 1. Clone the Repository
```bash
git clone https://github.com/ryanestoque/writewise.git
cd writewise
```

### 2. Frontend Setup
```bash
cd frontend
npm install
cp .env.local.example .env.local    # Configure Supabase credentials
npm run dev                         # Starts at http://localhost:3000
```

### 3. Backend Setup
In a separate terminal:
```bash
cd backend
uv sync
cp .env.example .env                # Configure Supabase and model credentials
uv run uvicorn app.main:app --reload # Starts at http://localhost:8000 (API docs at /docs)
```

### 4. Regenerate Types (When schemas change)
```bash
supabase gen types typescript --project-id <dev-project-id> > frontend/types/database.ts
npx openapi-typescript http://localhost:8000/openapi.json -o frontend/types/api.ts
```

---

## Testing & Quality

Run code checks and unit tests before committing changes:

```bash
# Backend linting & tests
cd backend
uv run ruff check .
uv run pytest

# Frontend linting & type checks
cd frontend
npm run lint
npx tsc --noEmit
```

> [!IMPORTANT]
> Backend integration tests run against an ephemeral local Supabase stack (`supabase start`). See [`docs/TESTING.md`](./docs/TESTING.md) for full instructions and CI workflow details.

---

## Documentation Index

Detailed specifications, architecture decisions, and guides are organized in the [`docs/`](./docs/) directory:

| Domain | Document | Description |
|---|---|---|
| **Product & Vision** | [`docs/PRD.md`](./docs/PRD.md) | Product requirements, personas, scope, phased roadmap, and success criteria |
| **System Design** | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Architectural topology, hybrid read/write model, data flows, and boundaries |
| **Computer Vision** | [`docs/CV_PIPELINE.md`](./docs/CV_PIPELINE.md) | Image quality gates, guideline detection, segmentation, and feature extraction |
| **Machine Learning** | [`docs/ML_PIPELINE.md`](./docs/ML_PIPELINE.md) | MobileNetV2 CNN training, CCC dataset fine-tuning, regression head, and inference |
| **Score Calibration** | [`docs/CALIBRATION_SCORING_GUIDE.md`](./docs/CALIBRATION_SCORING_GUIDE.md) | Spearman's Rho correlation analysis, threshold derivation, and score mapping |
| **API Reference** | [`docs/API_SPEC.md`](./docs/API_SPEC.md) | FastAPI endpoint contracts, request/response models, and error catalog |
| **Database & Storage** | [`docs/DATABASE.md`](./docs/DATABASE.md) | PostgreSQL schema, RLS policies, migrations, and Supabase Storage structure |
| **UI & UX Design** | [`docs/DESIGN.md`](./docs/DESIGN.md) | Screen layouts, interaction flows, accessibility rules, and visual style |
| **Design Tokens** | [`DESIGN.md`](./DESIGN.md) | Active color palette, typography scales, spacing tokens, and CSS variables |
| **Tech Stack** | [`docs/TECH_STACK.md`](./docs/TECH_STACK.md) | Exact toolchain versions, framework rationales, and environment conventions |
| **Security & Privacy** | [`docs/SECURITY.md`](./docs/SECURITY.md) | RA 10173 data privacy compliance, EXIF stripping, auth security, and threat model |
| **Testing Strategy** | [`docs/TESTING.md`](./docs/TESTING.md) | Unit, integration, and security testing guides, test matrices, and QA checklists |
| **Deployment** | [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Vercel and Railway production setups, environment variables, and rollback steps |
| **Onboarding** | [`docs/QUICKSTART.md`](./docs/QUICKSTART.md) | Teammate setup guide, environment provisioning, and common troubleshooting |
| **Status Tracker** | [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) | Live feature implementation checklist and milestone tracking |
| **Agent Guidelines** | [`AGENTS.md`](./AGENTS.md) | Operational rules and coding conventions for AI assistants working in this repository |
| **Architecture Records** | [`docs/adr/`](./docs/adr/) | Architectural Decision Records (ADRs) covering CV, ML, HTR, and data modeling |
| **Training Workflows** | [`training/README.md`](./training/README.md) | Offline CNN and HTR model training, fine-tuning scripts, and model exports |
| **Research Scripts** | [`research/README.md`](./research/README.md) | Anonymized dataset export, calibration scripts, and score maintenance |

---

## Team & Context

**WriteWise** is a capstone project developed by BS Information Technology students at **Holy Cross of Davao College**:

- **Ryan Christopher B. Estoque**
- **John Lawrence V. Monleon**
- **James David B. Asoy**
- **Saara Eliana G. Ibag**

*WriteWise is school-agnostic and designed for basic education classrooms across the Philippines.*
