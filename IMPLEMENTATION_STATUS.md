# IMPLEMENTATION_STATUS.md

Live tracker of what's actually built, as opposed to what's planned. `PRD.md` §5 is the authoritative *plan* (phases, timeline, build order) — this doc is the reality check against it. Update this whenever an item's status changes; don't let it drift.

**Last updated:** 2026-11-03 (Slice 4 email implementation on feature branch; final CI/manual gates pending)

## Summary

| Phase | Done / Total |
|---|---|
| Phase 0 — Setup | 16 / 19 |
| Phase 1 — Teacher Tooling & Raw CV Pipeline | 26 / 26 |
| Between Phases — Calibration | 9 / 9 |
| Phase 2 — Calibrated Scoring & Full System | 13 / 14 |
| Phase 3 — Classroom-Style Activities | 3 / 6 slices verified |

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

**Design reference:** [Phase 3 proposal](docs/next_steps/PHASE_3_CLASSROOM_ACTIVITIES.md), especially §2 decisions, §8 slices, and §9 open details. Promoted contracts for implemented slices live in `docs/API_SPEC.md` and `docs/DATABASE.md`; later-slice sketches remain proposals.

**Implementation records:** [Slice ③ — In-app notifications](docs/superpowers/plans/2026-11-03-phase3-in-app-notifications.md), [Slice ② — Return and release](docs/superpowers/plans/2026-11-02-phase3-return-release.md) and [Slice ① — Assignment and deadlines](docs/superpowers/plans/2026-11-01-phase3-assignment-deadlines.md) are verified. Slice ④ email notifications is next.

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

**Dependency:** Slice ①. **Status: Verified.** After receiving the manual QA checklist and pinning instructions, the user reported Slice 2 was all good and explicitly requested closeout on 2026-11-02. This closes the portal QA gate as user-reported sign-off; the walkthrough was not independently observed by the agent.

**Authorization and design (2026-11-02):** User approved the [full return/release design](docs/superpowers/specs/2026-11-02-phase3-return-release-design.md) after confirming that Return keeps work Returned/Missing until a new completed upload or explicit teacher pin. Work is isolated on `feat/phase3-return-release` in `.worktrees/phase3-return-release`. Local Supabase startup confirmed Docker/Podman is absent. Automatic approval review initially rejected publishing to an unapproved destination; the user then explicitly authorized publishing this branch to `https://github.com/ryanestoque/writewise.git` and using its CI stack. No hosted database reset, migration, merge, or deployment was performed.

| Deliverable | Status | Evidence / remaining work |
|---|---|---|
| Returned submission lifecycle and retained rubric history | Verified | Enum migration `20261102112153_phase3_returned_status.sql`, lifecycle migration `20261102112156_phase3_return_release.sql`, typed lifecycle router and transactions. Return preserves scored history; new uploads are drafts. Backend/RLS cases passed in CI; user-reported portal QA signed off on 2026-11-02. |
| Student work, due override, pinning, active-attempt view | Verified | `student_work`, `active_submission`, and `activity_work_state` centralize selection/status. Per-student due, pin/unpin, historical metadata, dashboard/latest/trend consumers implemented. Deadline boundary/override, pin, rollback, section-move and lock-coordinated Return/release tests passed in CI; user-reported portal QA signed off on 2026-11-02. |
| Draft/released score authorization | Verified | Both score-table parent policies and parent upload response are gated. Existing results backfilled released; changed rubric bands redraft atomically. Direct/embedded/view isolation and synthetic release-upgrade proof passed in CI. |
| Return/release UI and verification | Verified | Teacher Return/single/bulk release/work-settings controls and parent returned/draft/released/history flows implemented. API/database types generated, production build passed, and static review findings fixed. User-reported portal QA signed off on 2026-11-02. |
| Calibration export compatibility | Verified | Authorized exporter retains scored returns and writes return/active flags to measurement and crop CSVs. Analysis/Stage 2 filter invalid return reasons by default with explicit opt-in and legacy CSV support. Builder, actual CSV writer, and real loader tests passed locally and in CI. |

**Implementation evidence (2026-11-02):** [CI run for `d262007`](https://github.com/ryanestoque/writewise/actions/runs/41448467286) passed migration replay, both synthetic upgrade proofs, generated-contract comparison, security-advisor gating, and the full backend suite: **429 passed, 21 dependency warnings**. Coverage includes lock-coordinated Return/release, completion authorization revocation, deterministic ordering, pin cleanup/cross-child denial, incomplete-grade denial, and upload acceptance across the deadline. Security advisors reported no errors and one pre-existing warning: mutable search path on `public.set_updated_at`.

Earlier red runs proved draft-score exposure, missing lifecycle functions, and the processing-across-deadline bug before their fixes; a PL/pgSQL parameter ambiguity was corrected during implementation. The deadline fix captures the trusted server acceptance time before image processing and persists it for closure/lateness. A subsequent test correction explicitly selects the intended child rather than relying on an unordered multi-child result. The migrated CI stack generated database types (artifact `13138445152`), committed in `d1af1ef`; final OpenAPI regeneration produced no drift. Work is published as [draft PR #4](https://github.com/ryanestoque/writewise/pull/4).

Local database-free route/contract/deadline/research checks passed (**88 tests**, one upstream TestClient warning). Backend Ruff, changed research/calibration Ruff, whole-frontend ESLint/TypeScript, and the production build with dummy localhost configuration (`next build --webpack`) passed. An extra broad lint sweep found 75 existing issues in untouched Stage 1/HTR scripts and notebooks; see TESTING.md §13. Read-only code reviews covered API authorization/contracts, migrations, active/released UI, research compatibility, acceptance timestamps, and dialog focus. Material findings were fixed: historical parent work after reassignment, counted-score display after pinning, neutral deletion-conflict recovery, omission of untouched work fields, and actual crop CSV lifecycle columns. No real export or training run was performed.

**Verification closeout (2026-11-02):** The user subsequently reported QA was all good and requested Slice 2 closeout, superseding the earlier pending-QA record. [CI on PR head `7790687`](https://github.com/ryanestoque/writewise/actions/runs/41450044024) passed the full 429-test suite, migrations, both upgrade proofs, generated types and security-advisor error gate. Computer Use had stopped because it could not confidently determine the Windows browser URL; user sign-off does not imply an independently observed agent walkthrough. The temporary preview route/servers were removed/stopped. Local QA in this worktree uses `npm run dev -- --webpack` because its `node_modules` junction points outside Turbopack's inferred root. [PR #4](https://github.com/ryanestoque/writewise/pull/4) is the integration record; hosted migration and deployment are assessed separately. Preserve the worktree for the user's local environment.

### Slice ③ — In-app notifications

**Dependency:** Slices ①–② for assignment, effective due dates, return, release, and active-attempt events. **Status: Verified.** On 2026-11-03, after receiving the local setup and portal test checklist, the user reported the slice was all good. This closes the manual gate as user-reported overall sign-off; it is not an independently observed, itemized browser walkthrough. Hosted migration/deployment and PR integration remain separate.

| Deliverable | Status | Evidence / remaining work |
|---|---|---|
| Notification schema and recipient-only reads | Verified | Five migrations starting `20261103010000`; IDs-only public rows, private durable delivery receipts, recipient-only SELECT RLS, denied browser writes/helpers. Full ephemeral CI passed, including schema/RLS proofs, generated-type drift and the security-advisor error gate. User-reported portal QA sign-off received on 2026-11-03. |
| Event emitters and mark-read API | Verified | Explicit assignment/Return/rejection/release/completion RPC emission and verified-identity single/all-read endpoints; generated OpenAPI types. CI passed rollback for assignment and every lifecycle event, release/retry/pin, cross-parent delivery dedupe, read snapshots and both corrected roster races. User-reported portal QA sign-off received on 2026-11-03. |
| Due-soon/missing scheduler and deduplication | Verified | Private fixed-time sweep and one named 15-minute pg_cron job; exact effective deadline, live roster/assignment, archive and active-attempt predicates. Boundary, concurrent-sweep and completion-lock tests passed in CI. Excused suppression belongs to Slice 5, where that field is introduced. |
| Header bell, deep links, contracts, verification | Verified | Shared teacher/parent bell, 60-second foreground polling, retained keyset pages, read actions, account cleanup and exact child/activity/attempt destinations. Local lint/types/production build, controlled SDK race checks, final CI and all three upgrade proofs passed. Focused reviews found no remaining blocker after fixes. Overall portal QA sign-off received from the user on 2026-11-03. |

**Evidence (2026-11-03):** [Initial red run](https://github.com/ryanestoque/writewise/actions/runs/41486464310): 429 passed, nine new tests failed on absent storage. [Event run](https://github.com/ryanestoque/writewise/actions/runs/41490582078): 463 passed, one intentionally missing release-emitter case failed. [Race run](https://github.com/ryanestoque/writewise/actions/runs/41494149833): 473 passed, two concurrent-roster assignment cases failed; metadata edits now skip fanout and explicit target edits compare against one frozen roster snapshot. Final verification is recorded in the execution plan. Browser inventory exposed no connected browser for this slice's walkthrough; no signed-in portal QA is claimed. Keep the summary at **2/6 verified** until that gate closes.

**Automated closeout (2026-11-03):** [PR CI on `a13098a`](https://github.com/ryanestoque/writewise/actions/runs/41500638054) passed **481 tests**, all three legacy upgrade proofs, Ruff/ESLint/TypeScript, generated API/database comparisons and security advisors. Additional lock-observed cases cover activity-deadline and student-override edits committed before a waiting sweep. A raw-session rollback fixture was corrected to carry transaction-local service JWT claims, and cross-parent fixture teardown now deletes uploads before their Auth account. Both changes were reviewed. Local database-free tests passed 73 cases; production webpack build and controlled SDK/source race checks passed. [Draft PR #6](https://github.com/ryanestoque/writewise/pull/6) remains open for the manual portal gate; no hosted migrations or deployment were performed. The implementation worktree is `.worktrees/phase3-in-app-notifications` on `feat/phase3-notifications-implementation`.

**Verification closeout (2026-11-03):** The user's subsequent overall QA sign-off supersedes the pending manual-gate records above. [Final documentation-head CI on `d578116`](https://github.com/ryanestoque/writewise/actions/runs/41502563699) completed successfully, including the full suite and existing upgrade/contract/advisor gates. Phase 3 is now **3/6 verified**. [PR #6](https://github.com/ryanestoque/writewise/pull/6) is still open/draft and unmerged at this closeout; no merge or deployment is claimed. Preserve the implementation worktree and local env files for further testing.

**Integration follow-up (2026-11-03):** The local checkout's `main` now contains merge commit `c3369cd` for PR #6. This supersedes the earlier unmerged integration note; it does not establish hosted migration or deployment status.

### Slice ④ — Email notifications

**Dependency:** Slice ③. **Status: Partial — implemented on feature branch; final verification pending.**

**Implementation (2026-11-03):** The approved [email design](docs/superpowers/specs/2026-11-03-phase3-email-notifications-design.md) and [execution plan](docs/superpowers/plans/2026-11-03-phase3-email-notifications.md) are being implemented inline in `.worktrees/phase3-email-notifications`, branch `feat/phase3-email-notifications`. The user authorized branch pushes for GitHub's disposable-stack tests because Docker/Podman are absent locally. [Queue checkpoint CI](https://github.com/ryanestoque/writewise/actions/runs/41638422162) passed 612 tests, all three existing upgrade checks, API generation and security advisors; its expected DB drift was resolved with actual generated types from that exact head. Scheduler red tests then passed those 612 and failed nine absent-helper/pg_net tests before implementation. Local Ruff, ESLint, TypeScript, production webpack build and 150 unit tests passed; eight controlled preference transport checks passed. Full scheduler/fourth-upgrade/type/advisor CI and signed-in portal QA remain open. Phase 3 remains **3/6 verified**. A verified Resend domain is user-reported; sender details, hosted migration/configuration and actual email delivery are not established.

| Deliverable | Status | Evidence / remaining work |
|---|---|---|
| Service-only email outbox and preferences | Partial | Transactional two-event enqueue, default-on owner preferences, canonical recipient/event checks and bounded recoverable queue implemented; database tests pass. Settings controls built; signed-in portal QA pending. |
| Dispatcher and Resend integration | Partial | Async secret-authenticated internal route, fixed templates, stable key/digest, retry/timeout/quota handling and controlled-provider tests implemented. Final full CI pending. |
| Cron/pg_net/Vault configuration | Partial | Synthetic loopback callback and four upgrade proofs passed. CI found Supabase-owned network grants require owner provisioning; helper now refuses HTTP until safe. Final owner-provisioned CI/advisor gate pending; hosted owner setup and secrets remain unconfigured. |
| Privacy-safe templates and verification | Partial | Generic templates omit names, educational content and account tokens. Automated privacy/config/provider checks pass; final upgrade/contract/CI and portal gates remain open. |

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
- At audit baseline `3377875`, Phase 3 features and their integration/RLS/portal QA did not exist. Slice 1 is verified by user sign-off; Slice 2 implementation and remaining verification are recorded above. Slices ③–⑥ remain unimplemented.
- Documentation-change checks on 2026-11-01: Ruff, ESLint, and TypeScript type checking passed using `.venv/Scripts/ruff.exe check .` from `backend/` and `node node_modules/eslint/bin/eslint.js .` / `node node_modules/typescript/bin/tsc --noEmit --incremental false` from `frontend/`. These are equivalent installed-tool fallbacks: the `uv run` wrapper hit an inaccessible cache and PowerShell blocked `npx.ps1`. No execution-policy or global configuration changes were needed. These checks do not verify Phase 3 functionality.
