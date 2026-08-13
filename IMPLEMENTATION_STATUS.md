# IMPLEMENTATION_STATUS.md

Live tracker of what's actually built, as opposed to what's planned. `PRD.md` §5 is the authoritative *plan* (phases, timeline, build order) — this doc is the reality check against it. Update this whenever an item's status changes; don't let it drift.

**Last updated:** 2026-08-13

## Summary

| Phase | Done / Total |
|---|---|
| Phase 0 — Setup | 4 / 17 |
| Phase 1 — Teacher Tooling & Raw CV Pipeline | 0 / 17 |
| Between Phases — Calibration | 0 / 6 |
| Phase 2 — Calibrated Scoring & Full System | 0 / 11 |

*(Update this table whenever you check off an item below.)*

---

## Phase 0 — Setup

One-time, shared-project-state facts. Not a place to track individual teammates' local `npm install`/`uv sync` — that's per-machine, not project state (see `AGENTS.md` §3 for local setup commands).

**Repo scaffolding**
- [x] GitHub repo created and pushed
- [x] Frontend skeleton (`create-next-app`)
- [ ] Backend skeleton (FastAPI app structure — `ARCHITECTURE.md` §2)
- [x] shadcn/ui components installed
- [ ] shadcn/ui theme tokens applied (`DESIGN.md` §2 — palette, type pairing, spacing scale)
- [ ] Frontend lint/format configs committed (ESLint flat config, Prettier)
- [ ] Backend lint/format configs committed (ruff)
- [ ] `.env.example` templates committed (frontend + backend)
- [x] Initial Supabase migration files written (schema skeleton — `DATABASE.md`)
- [ ] CI workflow committed (`.github/workflows/`)

**Cloud provisioning** (`DEPLOYMENT.md` provisioning order-of-operations)
- [ ] `writewise-dev` + `writewise-prod` Supabase projects created
- [ ] Railway project created (backend root, Nixpacks)
- [ ] Railway env vars filled, Railway URL obtained
- [ ] Vercel project created (frontend root), Preview/Production env vars set
- [ ] Railway + Supabase-prod access restricted to the two named key-holders
- [ ] Health-ping GitHub Action set up
- [ ] First CNN model artifact uploaded to Storage *(depends on Between-Phases training completing first — expect this to stay unchecked until then)*

---

## Phase 1 — Teacher Tooling & Raw CV Pipeline

*Target: live by September (`PRD.md` §5). No CNN-based auto-scoring yet — raw measurements + manual entry only.*

### Teacher Portal

| Item | Status | Blocked Reason | Doc Pointer |
|---|---|---|---|
| Class roster management (add/edit/remove student) | Not Started | | PRD §7.1, API_SPEC §3.1, DATABASE §5 |
| Activity creation (freeform target text) | Not Started | | PRD §7.1, API_SPEC §3.2 |
| Submission upload (single photo per activity) | Not Started | | PRD §7.1, API_SPEC §3.3 |
| Raw CV measurement display | Not Started | | PRD §7.1/§7.3, CV_PIPELINE §8, DESIGN §7.2 |
| Manual rubric score entry | Not Started | | PRD §7.1, DATABASE §9, DESIGN §7.9 |

### CV Pipeline

| Item | Status | Blocked Reason | Doc Pointer |
|---|---|---|---|
| Quality gate (blur/brightness/contrast/resolution) | Not Started | | CV_PIPELINE §2 |
| Preprocessing (grayscale, denoise, threshold) | Not Started | | CV_PIPELINE §3 |
| Guide-line detection & deskew | Not Started | | CV_PIPELINE §4 |
| Line segmentation | Not Started | | CV_PIPELINE §5.1 |
| Word segmentation | Not Started | | CV_PIPELINE §5.2 |
| Post-segmentation gate | Not Started | | CV_PIPELINE §5.3 |
| Feature extraction — slant angle | Not Started | | CV_PIPELINE §6.1 |
| Feature extraction — spacing | Not Started | | CV_PIPELINE §6.2 |
| Feature extraction — baseline alignment | Not Started | | CV_PIPELINE §6.3 |
| Feature extraction — size consistency | Not Started | | CV_PIPELINE §6.4 |
| CNN handoff crop generation | Not Started | | CV_PIPELINE §7 |
| Output schema persisted to `measurement` | Not Started | | CV_PIPELINE §8, DATABASE §8 |

---

## Between Phases — Calibration *(offline)*

*Runs in parallel with Phase 1 being live and Phase 2 UI being built against placeholder data (`PRD.md` §5).*

| Item | Status | Blocked Reason | Doc Pointer |
|---|---|---|---|
| Threshold/correlation analysis (Spearman's Rho per criterion) | Not Started | | PRD §5, PRD §11 |
| ML Stage 1 — CCC dataset prep (format conversion, split) | Not Started | | ML_PIPELINE §2 |
| ML Stage 1 — fine-tuning (two-phase) | Not Started | | ML_PIPELINE §4 |
| ML Stage 1 — evaluation (Accuracy/Precision/Recall/F1) | Not Started | | ML_PIPELINE §5 |
| ML Stage 2 — regression-head training/calibration | Not Started | | ML_PIPELINE §6 |
| Export combined inference artifact (`.keras`) | Not Started | | ML_PIPELINE §7 |

---

## Phase 2 — Calibrated Scoring & Full System

*Built concurrently with Phase 1 against placeholder/manual scores; integrated once calibration completes (`PRD.md` §5).*

### Teacher Portal

| Item | Status | Blocked Reason | Doc Pointer |
|---|---|---|---|
| Calibrated score, qualitative band, diagnostic feedback display | Not Started | | PRD §7.1, DESIGN §7.4–7.6 |
| Class-wide dashboard (sortable by weakest criterion, class-average trend) | Not Started | | PRD §7.1/§7.5, DESIGN §7.8 |
| Per-student drill-down trend | Not Started | | PRD §7.1/§7.5 |

### Parent Portal

| Item | Status | Blocked Reason | Doc Pointer |
|---|---|---|---|
| Parent login & own-child-only view | Not Started | | PRD §7.2, DATABASE §10 |
| Per-criterion trend chart + composite trend | Not Started | | PRD §7.2/§7.5, DESIGN §7.7 |
| Latest diagnostic feedback view | Not Started | | PRD §7.2 |
| Upload submission for teacher-assigned activity | Not Started | | PRD §7.2, API_SPEC §3.3 |

### Diagnostic Engine

| Item | Status | Blocked Reason | Doc Pointer |
|---|---|---|---|
| Numeric score → qualitative band conversion | Not Started | | PRD §7.4 |
| Visual overlay annotation generation | Not Started | | PRD §7.4, DESIGN §7.4 |
| Criterion-by-criterion text explanation | Not Started | | PRD §7.4, DESIGN §8.2 |

### Integration

| Item | Status | Blocked Reason | Doc Pointer |
|---|---|---|---|
| Flip `SCORING_ENGINE` flag to calibrated; remove manual-score field | Not Started | | PRD §5, DATABASE §9.1 |
