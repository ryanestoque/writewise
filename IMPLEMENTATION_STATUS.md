# IMPLEMENTATION_STATUS.md

Live tracker of what's actually built, as opposed to what's planned. `PRD.md` §5 is the authoritative *plan* (phases, timeline, build order) — this doc is the reality check against it. Update this whenever an item's status changes; don't let it drift.

**Last updated:** 2026-10-20

## Summary

| Phase | Done / Total |
|---|---|
| Phase 0 — Setup | 15 / 18 |
| Phase 1 — Teacher Tooling & Raw CV Pipeline | 25 / 25 |
| Between Phases — Calibration | 6 / 9 *(+3 code-ready)* |
| Phase 2 — Calibrated Scoring & Full System | 13 / 14 |

*(Update this table whenever you check off an item below.)*

---

## Phase 0 — Setup

One-time, shared-project-state facts. Not a place to track individual teammates' local `npm install`/`uv sync` — that's per-machine, not project state (see `AGENTS.md` §3 for local setup commands).

**Repo scaffolding**
- [x] GitHub repo created and pushed
- [x] Frontend skeleton (`create-next-app`)
- [x] Backend skeleton (FastAPI app structure — `ARCHITECTURE.md` §2)
- [x] shadcn/ui components installed
- [x] shadcn/ui theme tokens applied (`DESIGN.md` §2 — palette, type pairing, spacing scale)
- [x] Frontend lint/format configs committed (ESLint flat config, Prettier)
- [x] Backend lint/format configs committed (ruff)
- [x] `.env.example` templates committed (frontend + backend)
- [x] Initial Supabase migration files written (schema skeleton — `DATABASE.md`)
- [x] CI workflow committed (`.github/workflows/`)
- [x] Auth Portal Shell & Layout audited (Login, Teacher Sidebar, Sign-Out Modal, Rubric Dialog)
- [x] Self-service teacher & parent registration (`/signup`, email verification flow, role immutability, migration `0021_harden_auth_metadata.sql`)

**Cloud provisioning** (`DEPLOYMENT.md` provisioning order-of-operations)
- [x] `writewise-dev` + `writewise-prod` Supabase projects created
- [x] Railway project created (backend root, Nixpacks)
- [x] Railway env vars filled, Railway URL obtained
- [x] Vercel project created (frontend root), Preview/Production env vars set
- [ ] Railway + Supabase-prod access restricted to the two named key-holders
- [ ] Health-ping GitHub Action set up
- [ ] First CNN model artifact uploaded to Storage *(depends on Between-Phases training completing first — expect this to stay unchecked until then)*

---

## Phase 1 — Teacher Tooling & Raw CV Pipeline

*Target: live by September (`PRD.md` §5). No CNN-based auto-scoring yet — raw measurements + manual entry only.*

### Teacher Portal

| Item | Status | Blocked Reason | Doc Pointer |
|---|---|---|---|
| Class roster management (add/edit/remove student) | Done | | PRD §7.1, API_SPEC §3.1, DATABASE §5 |
| Class section relational subsystem (`public.section` CRUD, `ManageSectionsDialog`, `/api/sections`) | Done | | ADR 0004, DATABASE §5, API_SPEC §3.2, Migration `0020_class_sections.sql` |
| Parent invitation management & resend flow (`/api/students/{id}/resend-invite`, status tracking, sibling linking) | Done | | API_SPEC §3.1, DATABASE §4.1/§5, Migration `0015_parent_invite_status.sql` |
| Activity creation (freeform target text) | Done | | PRD §7.1, API_SPEC §3.3, DESIGN §6 screens 5–6 |
| Activity lifecycle & management (edit, archive/unarchive, bulk-archive, delete guard, CSV export) | Done | | API_SPEC §3.3, DESIGN §7.13, Migration `0012_activity_archive.sql` |
| Submission upload (single photo per activity) | Done | | PRD §7.1, API_SPEC §3.4 |
| Submission deletion & attempt management | Done | | API_SPEC §3.4, DESIGN §7.10 |
| Batch submission deletion (multi-select, confirmation dialog, Storage-first cleanup + atomic database delete) | Done | Failure paths covered with controlled SDK HTTP responses; real Storage/cascade integration tests added. Full ephemeral-stack verification of the failure-handling update remains pending. | API_SPEC §3.4, TESTING §5, DESIGN §7.10 |
| Raw CV measurement display | Done | | PRD §7.1/§7.3, CV_PIPELINE §8, DESIGN §7.2 |
| Manual rubric score entry | Done | | PRD §7.1, DATABASE §9, DESIGN §7.9 |
| Interactive pedagogical reference tools (Animated Cursive Stroke Canvas & Unified Rubric Reference Dialog) | Done | | DESIGN §7.11–§7.12, `frontend/components/cursive-stroke-canvas.tsx` |
| Teacher account settings (profile & in-session password update) | Done | | PRD §7.1, DESIGN §6 screen 3, DATABASE §4 |


### CV Pipeline

| Item | Status | Blocked Reason | Doc Pointer |
|---|---|---|---|
| Quality gate (blur/brightness/contrast/resolution) | Done | | CV_PIPELINE §2 |
| Preprocessing (grayscale, denoise, threshold) | Done | | CV_PIPELINE §3 |
| Guide-line detection & deskew | Done | | CV_PIPELINE §4 |
| Line segmentation | Done | | CV_PIPELINE §5.1 |
| Word segmentation | Done | | CV_PIPELINE §5.2 |
| Post-segmentation gate | Done | | CV_PIPELINE §5.3 |
| Feature extraction — slant angle | Done | | CV_PIPELINE §6.1; `lsd_stems_v2` separates lean/within-word variation, records evidence coverage, and leaves unsupported angles null. Synthetic checks pass; real-worksheet validation and database integration verification remain pending. |
| Feature extraction — spacing | Done | | CV_PIPELINE §6.2 |
| Feature extraction — baseline alignment | Done | | CV_PIPELINE §6.3 |
| Feature extraction — size consistency | Done | | CV_PIPELINE §6.4 |
| CNN handoff crop generation | Done | | CV_PIPELINE §7 |
| Output schema persisted to `measurement` | Done | | CV_PIPELINE §8, DATABASE §8 |
| HTR target text verification | Done | | CV_PIPELINE §7b, ADR 0003 (CTC model + Levenshtein in `app/ml/htr.py`) |
| Stroke skeleton tracing & letter zoning | Done | | CV_PIPELINE §10 (`app/cv/tracing.py`) |

---

## Between Phases — Calibration *(offline)*

*Runs in parallel with Phase 1 being live and Phase 2 UI being built against placeholder data (`PRD.md` §5).*

| Item | Status | Blocked Reason | Doc Pointer |
|---|---|---|---|
| Threshold/correlation analysis (Spearman's Rho per criterion) | Done | Executed on N=52 paired pilot dataset (`research/output/correlation_analysis_report.md`) | PRD §5, PRD §11 |
| Calibration dataset export & anonymization (`research/export_dataset.py`) | Done | | ARCHITECTURE §16, SECURITY §6, training/README.md |
| Score maintenance & test seed utilities (`research/backfill_scores.py`, `research/reset_scores.py`) | Done | | AGENTS §6 Rule 11, research/README.md |
| ML Stage 1 — CCC dataset prep (format conversion, split) | Done | | ML_PIPELINE §2 |
| ML Stage 1 — fine-tuning (two-phase) | Done | | ML_PIPELINE §4 |
| ML Stage 1 — evaluation (Accuracy/Precision/Recall/F1) | Done | | ML_PIPELINE §5 |
| HTR model fine-tuning (SimpleHTR on IAM Words) | Done | | Training notebook `training/train_htr.ipynb`; artifact `simplehtr_iam.keras` uploaded to Storage | ML_PIPELINE §9, ADR 0003 |
| ML Stage 2 — regression-head training/calibration | Done | Trained on 611 word crops; best weights restored from epoch 24 (`checkpoints/stage2_calibrated.keras`) | ML_PIPELINE §6 |
| Export combined inference artifact (`.keras`) | Done | Exported `writewise-model.keras` (2.34M params), uploaded to Storage, and synced locally | ML_PIPELINE §7 |

---

## Phase 2 — Calibrated Scoring & Full System

*Built concurrently with Phase 1 against placeholder/manual scores; integrated once calibration completes (`PRD.md` §5).*

### Teacher Portal

| Item | Status | Blocked Reason | Doc Pointer |
|---|---|---|---|
| Calibrated score, qualitative band, diagnostic feedback display | Done | UI complete in `SubmissionDetailDialog` (5-criterion breakdown, band badges, coaching tips, diagnostic overlay); renders manual/placeholder scores until calibration | PRD §7.1, DESIGN §7.4–7.6 |
| Class-wide dashboard (sortable by weakest criterion, class-average trend) | Done | | PRD §7.1/§7.5, DESIGN §7.8 |
| Per-student drill-down trend | Done | | PRD §7.1/§7.5 |

### Parent Portal

| Item | Status | Blocked Reason | Doc Pointer |
|---|---|---|---|
| Parent login & own-child-only view | Done | | PRD §7.2, DATABASE §10 |
| Per-criterion trend chart + composite trend | Done | | PRD §7.2/§7.5, DESIGN §7.7 |
| Latest diagnostic feedback view | Done | | PRD §7.2 |
| Upload submission for teacher-assigned activity | Done | | PRD §7.2, API_SPEC §3.4 |
| Manage take-home submissions (delete un-graded upload to retry) | Done | | PRD §7.2, API_SPEC §3.4 |
| Parent account settings (profile & in-session password update) | Done | | DESIGN §6 screen 3, DATABASE §4 |

### Diagnostic Engine

| Item | Status | Blocked Reason | Doc Pointer |
|---|---|---|---|
| Numeric score → qualitative band conversion | Done | | PRD §7.4 |
| Visual overlay annotation generation | Done | Full backend generator (`app/diagnostic/`) + interactive SVG overlay in Teacher/Parent portals (uses vector stroke tracing; Grad-CAM saliency superseded) | PRD §7.4, DESIGN §7.4, ML_PIPELINE §6.6 |
| Criterion-by-criterion text explanation | Done | | PRD §7.4, DESIGN §8.2 |

### Integration

| Item | Status | Blocked Reason | Doc Pointer |
|---|---|---|---|
| ScoreProvider abstraction (`ManualScoreProvider` & `CalibratedScoreProvider`) | Done | Built in `backend/app/scoring/`, integrated with `create_submission` | ARCHITECTURE §10, ML_PIPELINE §6.5 |
| Flip `SCORING_ENGINE` flag to calibrated; remove manual-score field | Ready / Awaiting Calibration | Blocked on Stage 2 calibration completion | PRD §5, DATABASE §9.1 |
