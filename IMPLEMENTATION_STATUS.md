# IMPLEMENTATION_STATUS.md

Live tracker of what's actually built, as opposed to what's planned. `PRD.md` §5 is the authoritative *plan* (phases, timeline, build order) — this doc is the reality check against it. Update this whenever an item's status changes; don't let it drift.

**Last updated:** 2026-11-02 (Phase 3 Slice 1 user sign-off and Slice 2 design draft; local Phase 2 teacher rubric UI gate)

## Summary

| Phase | Done / Total |
|---|---|
| Phase 0 — Setup | 16 / 19 |
| Phase 1 — Teacher Tooling & Raw CV Pipeline | 26 / 26 |
| Between Phases — Calibration | 9 / 9 |
| Phase 2 — Calibrated Scoring & Full System | 13 / 14 |
| Phase 3 — Classroom-Style Activities | 1 / 6 slices verified |

*Update this table whenever an item's status changes. Phase 0–2 counts reflect the existing detailed records, not a fresh verification of cloud provisioning, model artifacts, deployments, or research results. Some Done rows still have explicit verification caveats. Phase 3 uses the evidence and verification gates defined below.*

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
| Activate calibrated scoring; verify manual-score entry UI gating | Deployed scoring verified / UI gate deployment pending | Stage 2 training and artifact export are recorded Done above. User reported local UI checks and a worksheet upload with persisted scores visible in teacher and parent views working on 2026-11-02. User also reported the deployed `writewise.tech` upload and teacher/parent score flow working on 2026-11-02, and confirmed its `environment=dev` configuration is deliberate. Screenshots of local and public `/api/health` show `scoring_engine=calibrated` and `model_stub=false`. The new teacher UI gate is implemented and locally checked; deployment of that specific change is not yet evidenced. Preserve historical manual scores for calibration/export. | PRD §5, DATABASE §9.1 |

---

## Phase 3 — Classroom-Style Activities

**Audit date:** 2026-11-01. **Baseline:** local checkout at `3377875`; no Phase 3 application changes were present in the inspected files. This is a repository audit, not a hosted-database or deployment audit. The calendar date does not establish that the defense has happened or authorize a production rollout.

**Design reference:** [Phase 3 proposal](docs/next_steps/PHASE_3_CLASSROOM_ACTIVITIES.md), especially §2 decisions, §8 slices, and §9 open details. Its SQL and API surface remain sketches, not implemented contracts.

**Slice ① implementation plan:** [Assignment and deadlines](docs/superpowers/plans/2026-11-01-phase3-assignment-deadlines.md). Slice ② (Return and release) is next in the proposed build order.

### Status and evidence rules

- **Not started:** no implementation of the Phase 3 deliverable found in the inspected repository. Existing reusable infrastructure does not make a new feature Partial.
- **Partial:** some required behavior exists; list precisely what remains.
- **Implemented, verification pending:** code and contracts exist, but a required check or manual flow has not passed.
- **Verified:** relevant lint/type checks, backend tests against the ephemeral stack, generated types, documentation, and applicable teacher/parent manual QA have passed with dated evidence. Deployment is tracked separately; Verified does not imply deployed.

Only count a slice in the summary after all its deliverables are Verified. Update evidence with file paths and actual check results; do not infer Done from a plan, a checked design decision, or a migration file alone.

### Existing foundation (reuse, not Phase 3 completion)

| Capability | Repository evidence | Boundary |
|---|---|---|
| Teacher activity create/edit/archive/delete | `backend/app/api/activities.py`; `frontend/lib/hooks/use-activities.ts`; `frontend/components/activities/` | Create/edit payloads contain target text and take-home mode; archive is separate. No targeting, title, instructions, or deadline contract. |
| Sections and roster relationships | `supabase/migrations/0020_class_sections.sql`; `backend/app/api/sections.py`; `frontend/lib/hooks/use-sections.ts` | `student.section_id` is nullable. Sections alone do not assign activities. |
| Parent activity listing and uploads | `frontend/lib/hooks/use-parent-data.ts` (`useTakeHomeActivities`); `backend/app/api/submissions.py`; `supabase/migrations/0009_rls_policies.sql` | Activities are selected by the child's teacher, not by an assignment to that child/section. Parent uploads require take-home mode and roster/parent links. |
| Submission history, scoring, diagnostics, trends | `frontend/lib/hooks/use-submissions.ts`, `use-dashboard.ts`, `use-parent-data.ts`; `backend/app/scoring/provider.py` | No shared active-attempt view, Return state, release gate, or gradebook points. |
| CSV download and account email | `frontend/lib/utils/csv-export.ts`; `backend/app/api/students.py`; teacher/parent settings pages | Roster/activity exports and Auth invitation emails are not the Phase 3 gradebook export or notification email system. |
| Backend integration tests and CI | `backend/tests/api/test_activities.py`, `test_submissions.py`, `test_submissions_parent.py`; `.github/workflows/ci.yml` | Existing tests are reusable patterns; they do not verify new assignment or release policies. `tests/conftest.py` queries Supabase during collection. |

### Slice ① — Assignment and deadlines

**Dependency:** approved Slice ① contract and reproducible ephemeral-stack setup. **Status: Verified.** The user confirmed on 2026-11-02 that Slice 1 is all good, closing the signed-in portal QA requirement. This is user-reported sign-off; the portal walkthrough was not independently observed in this repository audit.

**Initial prerequisite record (2026-11-01, superseded by CI evidence below):** User approved proceeding after the defense milestone. Work is isolated on `feat/phase3-assignment-deadlines` in `.worktrees/phase3-assignment-deadlines`; the original checkout's pending changes were preserved. Supabase CLI 2.115.0 generated `supabase/config.toml`; CI anonymous-key capture and local reset configuration are prepared, with reproduction commands in `docs/TESTING.md` §3.1.1. Startup failed with `LegacyDockerLifecycleInspectError` because Docker/Podman is unavailable. At that point the migration baseline and feature work were pending. The user subsequently approved CI-only verification; current results follow below.

**Setup checks (2026-11-01):** Generated TOML parsed with Python `tomllib`; project ID, migration/seed enablement, and seed file path were checked. The documented PowerShell block passed syntax parsing. CLI 2.115.0 help confirmed `db reset --local` and `stop --no-backup`. `git diff --check` passed. Ruff, ESLint, and `tsc --noEmit --incremental false` passed using the original checkout's installed tools (application source has no changes in this worktree). These checks do not establish database, migration, Auth, Storage, RLS, or feature correctness.

| Deliverable | Status | Evidence / remaining work |
|---|---|---|
| Activity title, instructions, due date, close-after-due | Verified | Migration `20261101132822_phase3_assignments.sql`, `activity_contracts.py`, shared `activity-assignment-fields.tsx`; request models and date conversion smoke checks passed locally. CI migration replay passed; user signed off on Slice 1 portal behavior on 2026-11-02. |
| Section/student assignments and ownership validation | Verified | Assignment table, scoped helper and service-only transactional RPCs; Python validates ownership before writes. Signed-in RLS/rollback tests in `tests/rls/test_activity_assignments.py` passed in CI. |
| Backfill and RLS-scoped reads | Verified | Migration backfills owned sections plus direct targets for uncovered roster children. Parent policy includes assigned in-class metadata; `use-parent-data.ts` scopes targets to the selected child. Synthetic upgrade proof covers null/foreign-section and empty-roster cases and passed in CI. |
| Upload eligibility and deadline enforcement | Verified | `assignment_access.py` checks both-role assignment and parent-only closure after existing authorization and before image work. Real-route/SDK tests against controlled HTTP responses passed, including exact-boundary and denial-before-decode cases. Full backend suite passed in CI. |
| Teacher/parent UI, types, documentation, verification | Verified | Forms, duplicate clearing, assignment-filtered uploads, child-scoped listing and latest-completed work status are implemented. OpenAPI types regenerated locally; database types generated from the migrated CI stack and committed in `116818b`. Contract docs updated. Static review findings on stale targets/invalid prefills fixed; user signed off on Slice 1 portal behavior on 2026-11-02. Full Phase 3 status precedence waits for Slice ②. |

**Implementation evidence (2026-11-01):** User approved CI-only database verification and publishing the feature branch to public `ryanestoque/writewise`. [CI run for `116818b`](https://github.com/ryanestoque/writewise/actions/runs/41313820267) passed migration/reset, the synthetic old-schema upgrade proof (including empty-roster edits), generated types and the full backend suite: **363 passed, 15 dependency deprecation warnings**. Tests include authenticated parent/teacher isolation, denied browser/RPC writes, roster/section changes, atomic rollback and upload regressions. The initial run's test-module naming collision was fixed by packaging `tests/rls/`; it was a test-collection failure rather than a migration failure.

Local Ruff, ESLint and TypeScript checks passed using installed-tool equivalents; 28 database-free contract/SDK transport cases passed (one upstream TestClient warning). The production frontend build passed at `116818b` with dummy localhost settings; the later parent-dialog eligibility guard passed lint/type checking. Manual helper smoke checks passed under America/New_York and UTC, both displaying the same Manila deadline. Static schema/backend and UI reviews found no remaining material issue after fixing stale-target edits and invalid-prefill recovery.

**Verification closeout (2026-11-02):** The user confirmed Slice 1 is all good, providing sign-off for the remaining signed-in portal QA. The earlier computer-use attempt did not yield an independently observed browser pass. The temporary synthetic preview route/server were removed/stopped. Slice 1 was merged into `main` as `30d2a4e`; hosted migration and deployment were not assessed by this repository audit. The final push added parent-dialog eligibility feedback and a CI check requiring generated database types to match the committed contract.


### Slice ② — Return and release

**Dependency:** Slice ①. **Status: Not started.**

**Design preparation (2026-11-02):** User approved proceeding with Slice 2. The repository audit and [return/release design](docs/superpowers/specs/2026-11-02-phase3-return-release-design.md) are prepared for review. The draft covers parent upload-response redaction, both score-table release policies, shared active-attempt selection, atomic lifecycle changes, historical-result backfill, and research compatibility. It proposes an explicit resolution of older-attempt fallback after Return; application implementation and verification have not started.

| Deliverable | Status | Evidence / remaining work |
|---|---|---|
| Returned submission lifecycle and retained rubric history | Not started | Enum/types remain processing/completed/rejected; no return fields or route found. Preserve historical scores and rejected/returned attempts. |
| Student work, due override, pinning, active-attempt view | Not started | No `student_work` or `active_submission` implementation found. Centralize selection; update dashboard, latest-score, and history consumers. |
| Draft/released score authorization | Not started | No `released_at` found. Current measurement/manual-score parent policies have no release predicate. Cover every score/diagnostic read path; backfill old results as released. |
| Return/release UI and verification | Not started | Add Return dialog, single/bulk release actions, effective due-date controls, generated contracts, privacy/RLS tests, and teacher/parent manual QA. |
| Calibration export compatibility | Not started | `research/export_dataset.py` currently selects completed submissions only. Extend that authorized exporter and its tests for scored returns and active-attempt flags; never export gradebook points. |

### Slice ③ — In-app notifications

**Dependency:** Slices ①–② for assignment, effective due dates, return, release, and active-attempt events. **Status: Not started.**

| Deliverable | Status | Evidence / remaining work |
|---|---|---|
| Notification schema and recipient-only reads | Not started | No notification table/type in migrations or generated database types. Store IDs only; browser reads remain RLS-gated. |
| Event emitters and mark-read API | Not started | No notification routes/emitters registered in `backend/app/main.py`. Add the §5 event catalog and single/all read mutations. |
| Due-soon/missing scheduler and deduplication | Not started | No scheduler function or cron job found. Verify idempotency, effective-due-date re-arming, and exclusion of excused/completed work. |
| Header bell, deep links, contracts, verification | Not started | No bell flow in `frontend/components/teacher-header.tsx` or `parent-nav.tsx`. Add read state, polling, links, recipient-isolation tests, and manual QA. |

### Slice ④ — Email notifications

**Dependency:** Slice ③. **Status: Not started.**

| Deliverable | Status | Evidence / remaining work |
|---|---|---|
| Service-only email outbox and preferences | Not started | No `email_outbox` or `email_notifications` columns found. Existing profile/password settings do not implement this preference. |
| Dispatcher and Resend integration | Not started | No dispatcher endpoint or Resend configuration in backend source. Add authenticated internal dispatch, retry/claim behavior, and stubbed-provider tests. |
| Cron/pg_net/Vault configuration | Not started | No Phase 3 scheduled dispatch configuration found. Keep secrets outside migrations; document dev provisioning separately from production authorization. |
| Privacy-safe templates and verification | Not started | Add Returned/Due-soon email templates, preference checks, and tests proving no scores, images, teacher notes, comment text, or recipient PII in logs. |

### Slice ⑤ — Points and gradebook

**Dependency:** Slices ①–②; follows Slice ④ in the proposed delivery sequence. Resolve Q-A before implementation. **Status: Not started.**

| Deliverable | Status | Evidence / remaining work |
|---|---|---|
| Optional activity points, overrides, excused/Assign 0 | Not started | No points/excused fields or routes found. Keep these values separate from `manual_score` and research exports. |
| Provider-owned points and overall percentage | Not started | `backend/app/scoring/provider.py` provides rubric scores, not activity points. Resolve manual band-ladder vs raw-composite scaling behind ScoreProvider; test denominator/release edge cases. |
| Teacher section grid and parent child row | Not started | Existing dashboard/trend hooks are not a gradebook. Add active-attempt-aware cells and released-only parent totals. |
| FastAPI CSV export and verification | Not started | Existing CSV helpers are browser-side exports. Add teacher-owned-section gradebook CSV generated by FastAPI, contracts, authorization tests, and manual QA. |

### Slice ⑥ — Private comments

**Dependency:** Slices ②–③; gradebook unread dot also needs Slice ⑤. **Status: Not started.**

| Deliverable | Status | Evidence / remaining work |
|---|---|---|
| Student-work thread, participants, text-only comments | Not started | No `private_comment` or comment routes found. Thread belongs to student × activity and includes owning teacher plus all linked parents. |
| Transactional posting, author deletion, thread locking | Not started | Add participant checks, assignment checks, 1–1000 character validation, body scrubbing on delete, and teacher lock control. |
| Coalesced unread notifications and return timeline | Not started | Add `comment_posted`, one unread notification per recipient/thread, and read-only Return events ordered by return time. Never copy return events into comment rows. |
| Teacher/parent panels and privacy verification | Not started | Add side panel, parent thread, gradebook unread dot, deep links, RLS/coalescing/deletion tests, and checks that bodies are never logged or exported. |

### Findings to resolve before the affected slice

These are audit findings and planning recommendations, not silent amendments to the agreed design.

| ID | Slice | Finding | Recommended resolution / acceptance evidence |
|---|---|---|---|
| A1 | ① | Q18 says parents see no change, while §4.7 adds in-class activity visibility. | Preserve every previously visible take-home activity; explicitly document in-class metadata visibility as an intentional expansion. Keep parent upload limited to take-home work. Verify both roles and modes. |
| A2 | ① | Section-only backfill misses roster students with null or mismatched `section_id`. | Backfill all owned sections plus direct student targets for existing roster students not covered by those sections. Compare pre/post-upgrade take-home visibility sets using synthetic legacy fixtures. |
| A3 | ① | Parent RLS returns activities for any linked child; the existing selected-child hook filters only by teacher. | Filter assignment targets for the selected child before fetching activities. Test siblings in different sections under the same teacher. |
| A4 | ①–② | Slice ① promises status chips, but effective due overrides and the active-attempt view arrive in ②. | In ① derive only Assigned/Missing and a Late badge from the latest completed attempt and activity due date; retain processing/rejection feedback separately. In ② switch consumers to the shared view and full precedence table. |
| A5 | ① | Activity/target mutations use separate REST operations unless explicitly made transactional. | Add service-only database RPCs for create/update plus target replacement, with application authorization before every write and DB ownership validation in the transaction. Failure must preserve the previous activity and assignments. |
| A6 | ① | `supabase/config.toml` is absent although CI invokes `supabase start`; tests query a DB during collection. | Establish checked-in local configuration and seed prerequisites as part of Slice ① verification setup. Never point test resets at hosted dev/prod or interpret service-role API tests as RLS proof. |
| A7 | ⑤ | Q-A leaves manual-score-to-points scaling open. | Decide before points implementation; keep source selection/normalization inside ScoreProvider. This does not block Slice ①. |
| A8 | ⑥ | §4.8 says merged thread entries use `created_at`, but a Return occurs after upload. | Sort Return entries by `returned_at`, comments by `created_at`, with deterministic ID tie-breaking. Confirm this when specifying the thread contract. |

The proposal's Q-B–Q-F remain slice-specific decisions; carry them into the relevant plan rather than treating their recommended defaults as implemented behavior. Its post-defense scheduling statement remains a product constraint until explicitly revisited.

### Audit and verification record

- Inspected all 21 versioned migration files through `0021_harden_auth_metadata.sql`, activity/submission API paths, portal read hooks and forms, scoring/export boundaries, existing test modules, CI, and generated-type locations.
- A repository search across backend source/tests, frontend source/types, migrations, research, and workflows found none of the proposed `activity_assignment`, `student_work`, `active_submission`, `private_comment`, `email_outbox`, deadline, release, points, or dispatcher identifiers. This supports Not started in this checkout; it does not prove hosted environments match the repo.
- Generated files live at `frontend/types/database.ts` and `frontend/types/api.ts`; the setup examples naming `frontend/src/types/` do not match this checkout. Use the real paths in the Slice ① plan.
- Phase 0–2 summary arithmetic was reconciled with existing rows. No historical Done claim was upgraded to fresh verification. Calibration activation and cloud/artifact checklist inconsistencies still need owner/runtime evidence.
- At audit baseline `3377875`, Phase 3 features and their integration/RLS/portal QA did not exist. Slice 1 implementation and current evidence are recorded above; Slices ②–⑥ remain unimplemented.
- Documentation-change checks on 2026-11-01: Ruff, ESLint, and TypeScript type checking passed using `.venv/Scripts/ruff.exe check .` from `backend/` and `node node_modules/eslint/bin/eslint.js .` / `node node_modules/typescript/bin/tsc --noEmit --incremental false` from `frontend/`. These are equivalent installed-tool fallbacks: the `uv run` wrapper hit an inaccessible cache and PowerShell blocked `npx.ps1`. No execution-policy or global configuration changes were needed. These checks do not verify Phase 3 functionality.
