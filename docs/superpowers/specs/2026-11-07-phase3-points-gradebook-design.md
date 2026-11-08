# Phase 3 Slice 5 — Points and gradebook design

**Date:** 2026-11-07 (Asia/Singapore)
**Status:** Approved for implementation planning on 2026-11-07. After reviewing this draft, the user requested the implementation plan. This document does not claim application implementation, verification, merge, migration, or deployment.

**Scope source:** [Phase 3 proposal](../../next_steps/PHASE_3_CLASSROOM_ACTIVITIES.md), especially Q11–Q15, Q17, §6, Slice ⑤ and Q-A. Existing assignment, active-attempt, rubric release and notification contracts remain authoritative outside the extensions described here.

## 1. Decisions confirmed in this conversation

1. Slice 5 may proceed while Slice 4 email manual QA remains pending. Slice 4 must retain its existing status; Phase 3 remains 3/6 verified until a further slice meets its verification gates.
2. Gradebook points use the existing numeric composite directly. Do not normalize manual bands to 25/50/75/100. This resolves Q-A in favor of raw existing scores and supersedes its recommended default in the proposal.
3. Teacher and parent assessment cutoffs stay shared: below 25 = Needs Improvement, 25 to below 50 = Developing, 50 to below 75 = Satisfactory, and 75–100 = Excellent.
4. Manual criterion values remain 12.5 / 37.5 / 62.5 / 87.5. Calibrated results retain their actual numeric values. Original rubric records, calibration data, model behavior and research export values are unchanged.
5. Assign 0 creates a draft grade. A teacher must explicitly release it before a parent can see it or it enters the parent's total, including when there is no upload. Do not fabricate a submission to support this.

Examples for an activity worth 20 points:

| Recorded composite | Derived points |
|---|---:|
| Calibrated 82 | 16.40 / 20 |
| Manual all-Excellent: 87.5 | 17.50 / 20 |
| Explicit Assign 0 | 0.00 / 20, draft until released |

## 2. Recommended architecture and alternatives

**Recommended:** one backend gradebook calculation shared by teacher reads, parent reads and CSV generation. Extend the ScoreProvider boundary to resolve the recorded score and derive points without any phase branch in the frontend or gradebook API. Read gradebook facts using the verified caller's database identity so RLS remains effective; route writes through FastAPI authorization and service-only transactional RPCs. This read contains business calculations, unlike the app's simple direct table reads.

Two alternatives were considered:

- Browser calculations would fit existing simple-read hooks, but CSV would need a second implementation of score selection, rounding and inclusion rules.
- Persisting every derived point value and total would make reads simple, but would require keeping them synchronized with attempts, rubric changes, activity points, overrides, assignment changes and release.

Store teacher overrides and publication metadata, and calculate derived points and totals when reading. Use the existing active selector; add no alternate latest-attempt algorithm. Keep derived rubric scores in their current tables.

## 3. Activity points and numeric rules

- Add optional `activity.points_possible`. Null means bands-only work; it contributes to neither gradebook sum. Existing activities start null.
- Accept positive decimal values up to 9999.99 with at most two fractional digits. Reject zero, negatives, non-finite values and excessive precision rather than silently rounding user input.
- An override is an explicit number from zero through the activity's points possible, with at most two fractional digits. This slice adds no extra-credit behavior. Null clears the override and restores automatic derivation.
- Derived points = points possible × recorded composite / 100. Use decimal arithmetic and round each cell to two fractional digits with ROUND_HALF_UP. Sum those same cell values for the overall percentage so the screen and CSV agree; round the displayed overall percentage to two fractional digits.
- Do not derive points from a rounded display label or a qualitative band. Use a complete recorded calibrated composite when available, otherwise the complete recorded manual rubric composite. Missing/incomplete scores remain unavailable. Keep recorded-source selection and conversion within ScoreProvider, including historical manual-only records after the configured engine changes.
- Points possible may be changed. A real change redrafts existing gradebook grades for that activity; it does not revoke already released rubric/diagnostic history. Reject a reduction below an existing override until the teacher clears or adjusts that override. Removing points makes the activity bands-only, clears its gradebook overrides/publication state atomically and requires an explicit confirmation in the edit UI. Restoring points starts fresh gradebook publication state.

## 4. Work grades and release privacy

The current `student_work` table is parent-readable. RLS filters rows, not individual values within an otherwise visible row, so draft point overrides must not be added to that row under its current grants.

Recommended storage:

- Add the public, non-score `student_work.excused` flag, default false.
- Add a separate `student_work_grade` relation keyed by activity/student and linked to `student_work` with cascade deletion. It holds the optional points override, selected source submission ID, monotonically increasing grade revision, released revision and release timestamp. It stores no names, image data, rubric copies or derived total.
- Teacher SELECT requires activity ownership plus the current roster relationship. Parent SELECT requires the child's relationship plus a current released grade revision. Browser writes are denied; FastAPI performs application authorization before invoking service-only mutations.
- Gradebook readers use this publication record as the sole authority for grade availability. A parent must never fall back to an older or automatically derived grade when the current grade record is draft or hidden by RLS. An unavailable grade returns null numeric values and is excluded from the parent total.
- Parent RLS must also validate the current source selection and source-release requirement for automatically derived grades. A stale publication row must fail closed. Explicit point overrides can be released independently of rubric scores, including without an upload; they never publish measurement/manual-score/diagnostic rows.

Grade rows are created on demand by a points-enabled activity's relevant completion, grading or teacher work action. Setting points on an existing activity materializes eligible work-grade records. An existing active, complete, released rubric can initially supply a released automatic grade when points are first enabled; an existing draft stays draft. Subsequent changes to points possible redraft grades as described in §3. A work pair with no score and no override has no numeric grade.

Editing an override, changing the selected active attempt, or changing a source rubric creates a new grade revision and clears gradebook release in the same transaction. Saving an identical value is a no-op and does not revoke release. Overrides belong to student × activity, so they persist until cleared; after a new active attempt they remain draft and visibly identified as overrides to the teacher. This prevents a previously released Assign 0 from silently publishing over a new upload.

Release supports two cases through one clear teacher action:

1. An automatic grade requires a completed, fully scored active attempt. Releasing that result can publish its rubric and current gradebook revision together.
2. An explicit override can be released without a scored attempt. Publish only the work grade when no eligible rubric exists.

Repeated release of the same revision is idempotent. Bulk release skips ineligible work and reports counts for released rubric results and work grades without changing the existing meaning of submission IDs in API responses. Returning an active result or switching the pin invalidates its gradebook publication. Existing released assessment history follows the Slice 2 contract.

## 5. Status, totals and assignment scope

- Excused takes precedence in the work status. Preserve attempts, history, rubrics, due override, pin and any grade override. Exclude excused work from both earned and possible sums. Unexcusing restores underlying coursework state and makes a retained numeric grade draft for review before republishing.
- Missing, Assigned and Returned work contribute nothing until an explicit override such as Assign 0 exists. A draft zero affects the teacher's total; only a released zero affects the parent's total.
- Completed work without a complete score or override contributes nothing. A graded draft contributes to the teacher total and is excluded from the parent total.
- Overall percentage = 100 × sum(final points) / sum(points possible) over included cells. Zero included possible points produces null, displayed as “—”, rather than 0%.
- Display coursework status and grade publication separately. Missing work with a released zero remains Missing and shows 0 points; releasing a zero does not claim a worksheet was submitted. Parent copy must not show Draft or disclose hidden point values.
- For a teacher's section grid, rows are current section students still on that teacher's roster. Columns are that teacher's activities relevant to those students through current assignment or retained submission/grade history. Non-applicable cells show “Not assigned” and do not affect totals.
- Assignment or section changes do not destroy retained submissions or explicit grade records. Current assignment controls new missing-work penalties; historical authorized grade records remain available. Losing the roster relationship ends the teacher's gradebook access.
- Archived activities retain their academic contribution. Hiding archived columns is a display filter and must not silently change the total; state this next to the filter. An available archived-work view exposes those contributing cells.
- Parent gradebooks are grouped by the activity's owning teacher, with only the selected child's permitted work. Do not silently combine different teachers into one section percentage.

## 6. Teacher actions and portal design

Teacher gradebook:

- Add a Gradebook destination using existing application tokens and navigation patterns. Choose a section; render students × relevant activities, newest activity first, with pinned student names and horizontally scrollable activity columns.
- Show per-cell points or status, draft/released state, override indication, and an overall percentage per student. Bands-only activities retain their status/band but do not enter the numeric total.
- A work panel reuses Return, active/pinned attempt and deadline controls. It adds Set points, Clear override, Assign 0, Excuse/Unexcuse and Release. The panel must show the automatic value alongside a teacher override and explain that changing points leaves assessment bands unchanged.
- Provide column actions Release eligible grades, Assign 0 to Missing and Excuse selected eligible students. Bulk actions show an eligibility/impact confirmation and return changed/skipped counts. Bulk Assign 0 rechecks current Missing status, current assignment, teacher ownership, roster membership, points and excused state inside its transaction; it does not overwrite existing grades or overrides.
- Optional points belong in activity create/edit. Clearing points after grades exist uses the explicit confirmation in §3.

Parent gradebook:

- Add a Grades view for the selected child, grouped by teacher. Show each relevant activity's points possible, status and released final points. Show released overall percentage and a short explanation that missing work affects it only after the teacher assigns and releases points.
- Keep handwriting diagnostic scores, bands and trends separate from activity points. The new view does not replace progress feedback or introduce parent grade editing.
- For a released zero without an upload, show the activity/work destination rather than a broken submission link.

Use the existing dialogs and component primitives. Provide keyboard access, labelled controls, visible mutation errors, pending states, focus restoration and a usable narrow-screen layout. A failed read must show a retry/error state rather than an empty gradebook or a zero total. Refresh all affected work, gradebook, activity, notification and assessment queries after mutations.

## 7. Notifications and email integration

- Add excused suppression to the existing deadline sweep for due-soon and missing events.
- Add excused suppression to Slice 4 email preparation and final send authorization, so an unsent email for excused work is skipped before a new provider send. Retain the existing documented limit for already authorized/in-flight email.
- Do not delete delivered notification history or replay past reminders merely because work is unexcused. Preserve existing effective-deadline deduplication identities.
- Reuse `score_released` for a newly published grade revision, including a grade without a submission. Give it a stable activity/student/revision identity and a work/gradebook destination when no submission exists. A combined rubric/points release emits one user-facing notification per recipient for that release operation; idempotent repeats emit none. No additional email type is introduced.
- Excusing work itself sends no new notification in this slice.

Slice 4 remains a separately reviewable branch with its pending manual and operational gates. The Slice 5 implementation must carry the email eligibility extension without silently merging or activating email. At execution, use an isolated branch/worktree and reconcile its base with the actual current integration state; do not infer remote state from today's local records.

## 8. API and transaction boundaries

Extend the existing activity and student-work typed contracts for optional points and excused/override actions. Add work-grade release for pairs without a submission, bulk missing-zero, bulk excuse and gradebook reads. Exact route names and payload schemas belong to the implementation plan and promoted API_SPEC; do not silently repurpose a submission ID as a work ID.

Teacher section JSON reads, parent child JSON reads and teacher `GET /api/sections/{id}/gradebook.csv` all use the same calculation service and authorization rules. Browser-facing reads fetch RLS-filtered facts using the verified caller's identity. Never reuse a service-role read and describe it as RLS enforcement. Export teacher-owned section data only, generate CSV in memory, and return it directly without writing to Storage.

CSV uses the same cells, inclusion rules, precision and totals as the teacher gradebook. Include student name, activity labels, points possible, final points, coursework status, release state and overall percentage. Exclude parent contact details, teacher notes, comments, raw measurements and image references. Neutralize spreadsheet formula prefixes in user-controlled text. This is a teacher class-record export, separate from the authorized offline anonymized research exporter.

Mutations preserve activity-before-work locking and recheck actor, roster, assignment where applicable, active selection, source completeness and current grade revision inside the transaction. Coordinate activity-points edits, uploads/completion, return, pin, rubric changes, release, bulk actions and email eligibility so they cannot publish a stale grade or penalize work that completed first. No provider I/O or image processing runs under these locks.

Use the standard error envelope and error codes. Add distinct new gradebook conflict/validation codes to API_SPEC when concrete endpoint contracts are finalized. Frontend branches on codes only. Generate actual OpenAPI and migrated-schema types in the same delivery as their contracts.

## 9. Verification and documentation

Implementation requires:

- Decimal and overall-percentage cases for mixed maxima, manual/calibrated recorded sources, rounding boundaries, missing/incomplete results, zero denominator, draft/released points, overrides, zero and excused work.
- Full ephemeral-stack migration/API/backend suite because this changes API, scoring and schema. Run Ruff, ESLint and TypeScript; do not use hosted dev/prod for resets. If local Docker remains unavailable, establish an authorized disposable CI runner rather than weakening these gates.
- Signed-in database tests for another teacher, another family, sibling selection, unreleased override and derived-grade denial, raw-table/embedded/view routes, draft override over an already released rubric, and stale revision/source denial. Browser writes and service-only RPC calls must be denied.
- Lifecycle and rollback tests for no-upload zero/release, clear override, repeated release, bulk skips, changing maxima, returns, new completed attempts, pin changes, rubric edits, reassignments, archive handling and observed-lock races.
- Deterministic scheduler/email tests proving excused suppression and preservation of existing delivery identities; no real provider sends in automated tests.
- A synthetic pre-Slice-5 upgrade proof preserving existing assignments, notifications, preferences, rubric history, release visibility and bands-only defaults; real generated-contract drift checks.
- CSV authorization, formula-neutralization, filtering and total-agreement checks. Confirm gradebook fields never enter the research exporter.
- Teacher/parent manual QA covering both scoring sources, explicit zero with no upload, draft privacy, release, override clearing, Excuse/Unexcuse, bulk actions, narrow-screen interaction and CSV agreement. Record observed checks and user-reported sign-off separately.

Promote accepted behavior to API_SPEC, DATABASE, ARCHITECTURE, DESIGN, TESTING, SECURITY, DEPLOYMENT where relevant, the Phase 3 proposal and IMPLEMENTATION_STATUS. Resolve Q-A explicitly without rewriting the historical calibration midpoint contract. Keep Slice 4's pending gates and all deployment distinctions accurate.

## 10. Review and handoff

The two new decisions needing particular review are the separate gradebook publication boundary in §4 and the recommended behavior for edits/new attempts: points become draft again, while an explicit override stays attached to the work until cleared. Review also the proposed override limit (no extra credit), activity-points removal, historical/archive inclusion and released-only parent totals.

The user approved this design on 2026-11-07 by requesting the implementation plan. The [implementation plan](../plans/2026-11-07-phase3-points-gradebook.md) carries the concrete interfaces, tasks and verification gates. Preserve this approval and commit the planning documents on the implementation branch when execution establishes isolation. Application implementation and all verification gates remain outstanding.
