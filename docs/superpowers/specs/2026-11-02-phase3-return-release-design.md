# Phase 3 Slice 2 — Return and release design

**Date:** 2026-11-02

**Status:** Proposed for user review; no Slice 2 application changes have been made.

**Baseline:** `5741734` on `main`, plus the Slice 1 sign-off recorded in `IMPLEMENTATION_STATUS.md`.

**Scope source:** [Phase 3 proposal](../../next_steps/PHASE_3_CLASSROOM_ACTIVITIES.md), §2 Q4–Q5/Q12/Q14/Q17–Q18, §3, §4.3–4.5/4.7, §7, and §8 Slice ②.

## 1. Outcome and boundaries

A teacher can return a completed worksheet with a reason and optional note, optionally change that child's resubmission deadline, choose which completed attempt counts, and release one result or all eligible results for an activity. Parents can see upload/return metadata and their child's photo immediately; scores, raw measurements, and diagnostics become available only after release. Existing released results remain accessible after migration.

This slice includes the shared active-attempt selection, status display, affected dashboards and trends, release authorization, and calibration-export compatibility. Notifications, email, points, excused work, the gradebook, and private comments remain in their later slices. The CV/CNN algorithms, ScoreProvider score calculations, deployment topology, and image hardening rules retain their existing contracts.

## 2. Repository findings that the implementation must address

1. `backend/app/api/submissions.py` returns measurements, scores, `raw_output`, and overlays directly after a parent upload. Restricting browser database reads alone would leave this disclosure path open.
2. Parent SELECT policies on both `measurement` and `manual_score` currently allow unreleased scores. Both policies need a release predicate; submission metadata remains readable under its existing family policy.
3. `use-dashboard.ts` and `use-parent-data.ts` independently choose completed attempts. Parent latest scores also impose a 20-attempt limit. Those queries must use shared active-attempt selection before choosing a latest score across activities.
4. `activity-work.ts` derives status from the latest completed attempt and the activity deadline. Slice 2 must incorporate the student's override, Return, draft/released state, and pinning consistently.
5. Parent deletion eligibility is currently inferred from visible `manual_score` rows. Once draft scores are hidden, that inference is unreliable; the existing backend deletion restriction remains authoritative.
6. `research/export_dataset.py` fetches and filters completed submissions only. It must retain scored returned attempts and export their return/active flags without exporting teacher notes or future gradebook values.
7. CI already resets an ephemeral stack, checks legacy assignment upgrades, generates database types, and rejects generated-contract drift. The new migration needs its own synthetic upgrade exercise while keeping that existing exercise working.

## 3. Design choices

Use the existing FastAPI authorization plus service-only transactional database RPC pattern. It keeps each lifecycle mutation atomic and lets database tests exercise the same state transitions as the API. Separate REST writes would permit a Return without its deadline/pin update; browser-owned mutations would duplicate authorization and create additional write policies.

Use an RLS-respecting `active_submission` view as the only selector of counted attempts. A second view, `activity_work_state`, supplies the assigned student's effective due date and role-appropriate status even when no upload or stored `student_work` row exists. A frontend-only selector would leave dashboards, exports, and release eligibility with different answers.

### 3.1 Proposed resolution of the return/fallback ambiguity

The original proposal combines latest-completed fallback with a Returned state. This design proposes the following explicit refinement, submitted to the user as a choice before implementation:

- A Return prevents automatic fallback to completed attempts uploaded before the returned attempt.
- A newer completed upload becomes active. A newer processing or rejected upload does not satisfy the resubmission request; its feedback appears separately.
- A valid explicit pin may select an older completed attempt. Returning that pinned attempt clears its pin. A pin to a different completed attempt remains an explicit teacher choice.
- Returning a historical attempt does not displace an already newer completed attempt.

The selection order is: a valid pinned completed attempt; otherwise the newest completed attempt newer than the newest returned attempt in upload order; otherwise no active attempt. Upload order is `(created_at DESC, id DESC)` and is deterministic when timestamps tie. The return barrier uses the returned attempt's upload order, rather than its `returned_at`, so returning an old upload cannot invalidate work uploaded afterward. All completed attempts qualify when no returned attempt exists.

This proposed rule is a product clarification, not a claim that §3.3 of the original proposal already states it. The user's written-spec approval will accept this rule or replace it with the alternative they select.

## 4. Data contract

### 4.1 Submission lifecycle

Add `returned` to `submission_status` in its own migration before a migration uses the value. Add `returned_at`, `returned_by`, `return_reason`, `return_note`, and `released_at` to `submission`.

Allowed return reasons are `wrong_worksheet`, `blurry_or_cropped`, `wrong_target_text`, `incomplete`, and `other`. Return metadata is complete when status is returned: timestamp, teacher, and reason are required. The optional note is trimmed, blank becomes null, and its maximum length is 2,000 characters. Notes are plain text, visible in the child's in-app history, and excluded from logs and research exports.

Only completed attempts can be returned; processing, rejected, and already returned attempts yield `SUBMISSION_NOT_RETURNABLE`. A Return retains the image, measurements, independent manual rubric, and any existing release timestamp. Therefore a previously released result can still be inspected in history after Return, but it no longer counts as the active result. A draft returned attempt remains hidden from parent score reads. Returned rubrics are preserved and cannot be edited through the existing completed-only scoring endpoint.

New completed uploads have `released_at = null`, regardless of uploader or score provider. Migrate all pre-existing submission rows to a non-null release timestamp using their existing `updated_at`, preserving historical parent visibility. This is a visibility migration, not a recalculation or replacement of old scores.

### 4.2 Student work

Create `student_work`, keyed by `(activity_id, student_id)`, with `due_at_override`, `pinned_submission_id`, and `updated_at`. Add only Slice 2 fields; subsequent slices introduce their own points, excused, or comment fields. Create rows on the first upload or teacher work mutation, not for every assignment.

Foreign keys cascade when the student or activity is removed. A deleted pinned submission clears the pin. Validate that a pin references a completed submission for this exact student and activity; returning the pinned submission clears it in the same transaction. Invalid pin references yield `INVALID_WORK_SELECTION` without exposing another family's identifiers. Add indexes for student-scoped work reads, pinned-submission cleanup, and submission selection by activity/student/upload order.

Effective due date is `coalesce(student_work.due_at_override, activity.due_at)`. A null override restores the activity's due date; it does not disable a non-null activity deadline. Date inputs must carry a UTC offset, are stored as `timestamptz`, and use the existing Asia/Manila display/input helpers. Past overrides are allowed, matching activity deadlines; the UI shows the resulting Missing/closed state before save.

### 4.3 Authoritative reads

`active_submission` is a read-only view using `security_invoker = true`. It returns the selected submission columns with their original identifiers so nested student/activity/measurement/manual-score queries can use existing relationships. Verify those relationships through PostgREST rather than assuming they are inferred. The view never copies scores or diagnostic JSON into an unprotected field.

Selection must not depend on whether a caller can see the score: an unreleased active attempt stays active for both roles. Parent queries must not fall back to an older released attempt for the same activity. Historical unassigned attempts remain available through the existing submission-history policies; the active selector must not silently erase them because their current assignment changed.

`activity_work_state` supplies one row per visible assigned activity/student pair, plus visible historical pairs needed by work/history screens. It resolves the active ID, effective due, latest attempt metadata, relevant return metadata, status, and Late badge. A role-appropriate status avoids exposing a draft's score existence to parents. Missing stored `student_work` rows behave like null overrides and no pin. The view derives pairs through visible roster/assignment/submission relationships, not an unrestricted activity-by-student cross join.

Status precedence for this slice is:

1. No active attempt after Return, effective due not passed: **Returned**.
2. No active attempt and effective due passed: **Missing**.
3. No active attempt and no expired deadline: **Assigned**.
4. Active graded unreleased attempt: **Draft** for teacher; **Turned in** for parent.
5. Active released attempt: **Released** when a visible result exists; legacy released but ungraded attempts remain **Turned in**.
6. Active completed ungraded attempt: **Turned in**.

Late is an additional badge when the active attempt's upload time is strictly after effective due. At the exact due instant, submissions remain accepted and work is not yet Missing. Processing and quality-gate rejection remain separately visible feedback and do not become competing stored work statuses.

## 5. Authorization and transactions

FastAPI establishes the current teacher, owning activity, and roster relationship before every write. An unowned or missing resource returns `NOT_FOUND`. Teacher actions on historical work may continue when a submission exists for that owned activity/student pair even if a section move removed the current assignment; otherwise the pair must currently be assigned. Parent uploads always retain the existing current-assignment and take-home requirements.

RPCs independently recheck the same actor/resource relationship inside the transaction. Use `SECURITY INVOKER`, a fixed empty search path, fully qualified identifiers, and EXECUTE granted only to `service_role`; revoke default PUBLIC, anon, and authenticated execution. Browser roles receive SELECT on the new table/views as required, with RLS on the table and no mutation policies.

Use short database transactions to create/lock the relevant work row and serialize lifecycle changes. Acquire locks in one documented order, including bulk release, and re-evaluate active selection and eligibility under the lock. Upload begin/finalization and manual-score writes must participate in this protocol so a Return, pin, or release cannot race a stale API precheck. Image processing and Storage calls occur outside these locks.

Return atomically sets status/metadata, clears a matching pin, and applies an explicitly provided resubmission override. Release atomically rechecks completed + graded + active before setting its timestamp. A graded result is a retained manual rubric or a measurement with all five criterion scores populated; no new phase-specific score computation is introduced outside ScoreProvider. Releasing an already released active result is idempotent. Editing a released manual rubric creates a new draft by clearing `released_at` in the same database transaction; a teacher must release the changed score again.

Bulk release considers only active graded completed attempts for the owned activity and the teacher's eligible students. It skips ineligible/already released results and returns the IDs actually released. It does not release rejected, returned, inactive, or ungraded work.

## 6. Release privacy and parent behavior

Replace parent SELECT policies on both `measurement` and `manual_score` with the existing child relationship plus `submission.released_at is not null`. Apply the predicate to all embedded, direct, and view-backed score reads. Preserve existing teacher reads and allow the activity's owning roster teacher to inspect the retained rubric before release. Manual rubric writes must check both activity ownership and the roster relationship. The active view must not bypass those table policies.

The parent `POST /api/submissions` success response returns submission ID, completed status, `released_at: null`, and `measurement: null`. Teacher upload responses retain the measurement payload. Define response models so generated OpenAPI types express the nullable measurement contract. Preserve quality-gate failure feedback and rejected-row persistence.

Parents see the submitted photo, teacher return reason/note, effective deadline, and upload controls when eligible. Draft UI says "Turned in" and explains that the teacher will share the result after review. Score cards, criterion feedback, raw measurements, and overlays render only from released data. Keep the current deletion rule enforced by FastAPI; a missing RLS-hidden rubric is not proof that deletion is permitted. A delete conflict uses neutral retryable UI copy and refreshes the work/history data. As with the existing delete API, this protects score content without promising to conceal every timing or permission inference.

Returning previously released work cannot revoke data that a parent already viewed. Retaining that released score in history is intentional. It remains excluded from active dashboards, trend series, and future gradebook calculations.

## 7. API contract

| Route | Request and behavior | Success |
|---|---|---|
| `POST /api/submissions/{id}/return` | Required `reason`; optional `note`; optional `resubmit_due_at`. Omitted deadline preserves the override; explicit null restores the activity deadline. | Submission ID, returned status, return metadata, retained `released_at`, effective due date. |
| `POST /api/submissions/{id}/release` | No payload. Teacher owns the activity and eligible student; result must be active, completed, and graded. | Submission ID and `released_at`. |
| `POST /api/activities/{id}/release` | No payload. Release the eligible active drafts in one transaction. | `released_count` and `submission_ids`. |
| `PUT /api/activities/{id}/students/{student_id}/work` | Partial field update: `due_at_override` and/or `pinned_submission_id`. Omission preserves, null clears. Reject an empty request or unknown fields, including later-slice fields. | Updated work row and effective due date. |

Use typed UUID path/body fields and timezone-aware datetimes. Malformed values use `VALIDATION_ERROR`. Register new paths in the existing FastAPI app through a focused lifecycle router, retaining the public routes above. Every error keeps the existing `{ error: { code, message, details } }` envelope.

Add `SUBMISSION_NOT_RETURNABLE` (409), `SUBMISSION_NOT_RELEASABLE` (409), and `INVALID_WORK_SELECTION` (422) to `docs/API_SPEC.md` §2.4. RPC errors use dedicated SQLSTATE values mapped by code; database exception prose is neither authorization logic nor a client response. Parent callers cannot invoke teacher routes.

## 8. Portal integration

Teacher submission detail gets a Return dialog (reason, optional note, optional resubmission deadline), release state/action, and active/pinned indicators. Activity detail gets Release results with a confirmation count and per-student due/pin controls. The teacher can inspect every attempt and retained returned scores. Return and release are separate actions.

Parent activity cards and upload dialogs use the effective deadline and shared work state. A returned take-home activity provides a resubmission action when currently assigned/open. In-class metadata remains visible but offers no parent upload. A past activity deadline with a future student override reopens the child's upload when close-after-due is enabled; the backend makes the same decision before image decoding.

Dashboards, latest-score cards, and trend charts consume only selected active attempts; parent score consumers additionally require release. Keep complete attempt history separate from counted trend points, preserving rejected/returned/inactive attempts and their permitted details. Remove the parent latest-result 20-attempt cutoff. Batch visible IDs and score queries to avoid per-child/per-activity requests. Lifecycle/upload/score/delete mutations invalidate all affected teacher and parent work, history, dashboard, and detail query keys.

Reuse the existing shadcn dialogs, buttons, labels, date helpers, and visual tokens. Provide visible mutation errors, pending button states, labels, keyboard focus restoration, and phone-width layouts. Notes render as escaped plain text.

## 9. Research compatibility

Only `research/export_dataset.py` performs dataset export. Include completed and returned submissions that have both measurement and independent manual score. Add `return_reason` and `is_active_attempt` to anonymized measurement/crop metadata; determine active flags from the authoritative selector, not only from exported paired rows, since a newer active attempt may lack a manual rubric.

Exclude `wrong_worksheet`, `blurry_or_cropped`, and `wrong_target_text` returns by default in calibration analysis. Exports retain those samples and flags; `research/analyze_correlations.py::load_measurements_csv` and `training/stage2_calibrate.py::load_paired_dataset` must honor the flags, with an explicit offline option to include excluded reasons. Preserve backward compatibility for older exports without those fields. Never export return notes, names, gradebook points, or add an application export endpoint.

## 10. Files and responsibility boundaries

| Area | Planned files |
|---|---|
| Schema/RLS/transactions | New CLI-created migrations under `supabase/migrations/`; retain the current assignment migration as history. |
| API contracts | New `backend/app/api/submission_contracts.py` for lifecycle requests/responses and upload response typing. |
| API authorization/mutations | New `backend/app/api/submission_lifecycle.py` contains all four lifecycle routes; register it in `app/main.py` under `/api`. |
| Upload/scoring integration | `backend/app/api/submissions.py`, `assignment_access.py`; transactional begin/finalize/manual-score writes and role-safe upload response. |
| Backend verification | New lifecycle API, signed-in RLS, unit-contract, and synthetic release-upgrade tests; extend parent-upload and exporter/analysis tests. |
| Shared browser reads/writes | New `frontend/lib/hooks/use-activity-work.ts`; update `use-submissions.ts`, `use-dashboard.ts`, `use-parent-data.ts`, and work-status utilities. |
| Teacher UI | Focused lifecycle controls/dialog components under `frontend/components/submissions/`; existing submission detail and teacher activity page. |
| Parent UI | `frontend/components/parent/take-home-activities.tsx`, `parent-upload-dialog.tsx`, and affected progress/history consumers. |
| Research | `research/export_dataset.py`, `research/analyze_correlations.py`, `training/stage2_calibrate.py`, `research/README.md`, and `training/README.md`. |
| Contracts/docs/CI | Generated `frontend/types/database.ts` and `api.ts`; `docs/API_SPEC.md`, `DATABASE.md`, `DESIGN.md`, `PRD.md`, `TESTING.md`, `SECURITY.md`; the Phase 3 proposal, `IMPLEMENTATION_STATUS.md`, and `.github/workflows/ci.yml`. |

## 11. Required evidence

- Tests written and observed failing before production changes for lifecycle transitions, request validation, parent response redaction, effective deadlines, and research flags/filtering.
- Signed-in anon-key clients prove that the correct parent can read submission/return metadata, cannot read unreleased measurement/manual-score/diagnostic data by direct or embedded/view paths, can read released results, and cannot access another family. Browser writes/RPC invocation are denied.
- API tests cover owner/roster isolation, all non-returnable states, draft/released retained rubric history, pin mismatch, inactive/ungraded release denial, idempotent and bulk release, changed-rubric redrafting, atomic rollback, stable ordering, and concurrent upload/return/pin/release behavior.
- Deadline tests cover missing work rows, null reset, future/past overrides, exact boundary, in-class parent denial, and authorization/closure denial before decode.
- A synthetic pre-Slice-2 upgrade fixture proves that previously visible measurement/manual-score results stay visible, existing assignment/RLS behavior survives, and the first post-upgrade upload remains draft.
- Full Ruff, ESLint, TypeScript, migration/reset, backend pytest, and generated-contract checks. Regenerate database types from the migrated ephemeral database and API types from FastAPI OpenAPI; never hand-maintain generated contracts.
- Signed-in teacher and parent manual QA covers Return → parent note/deadline → resubmission draft → single/bulk release → visible result, a pin/unpin, a sibling isolation case, retained history, and mobile dialogs. Record dated evidence and separate it from deployment evidence.

No standalone Docker/Podman or Supabase CLI was found on this host during the initial inspection. Before implementation verification, use the pinned CLI through the documented `npx.cmd` fallback and recheck container availability. If local containers remain unavailable, CI must supply migration/RLS/full-suite/type-generation evidence; static checks alone cannot mark this slice Verified. Keep resets restricted to an ephemeral localhost stack.

## 12. References checked

- [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security): table policies, view security, and role grants.
- [PostgreSQL CREATE VIEW](https://www.postgresql.org/docs/current/sql-createview.html): `security_invoker` checks underlying relations with caller privileges.
- [Supabase changelog](https://supabase.com/changelog): reviewed on 2026-11-02; the markdown endpoint could not be read by the web tool, so the HTML index was used. No library or platform upgrade is part of this design.

## 13. Review and implementation handoff

Review this written contract, particularly §3.1 (Return prevents automatic older-attempt fallback), §4.1 (previously released returned scores remain readable in history), §5 (editing a released rubric creates a draft), and §6 (the existing deletion rule remains authoritative).

After user approval, create the detailed implementation plan using `writing-plans`, arrange feature-branch isolation without losing the pending Slice 1 status update, then implement and verify each dependency in order. This design file does not claim implementation, database verification, merge, or deployment.
