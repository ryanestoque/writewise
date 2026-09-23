# WriteWise — Submission Deletion & Attempt Management Design

- **Document type:** Feature Specification & Architectural Design
- **Companion docs:** `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API_SPEC.md`, `DESIGN.md`, `SECURITY.md`, `TESTING.md`
- **Target date:** September 23, 2026
- **Status:** Approved Design

---

## 1. Context & Motivation

### 1.1 Original Baseline
In initial architectural specifications (`DATABASE.md` §1, `API_SPEC.md` §3.2):
- `submission`, `measurement`, and `manual_score` rows were designated as immutable "Research Data" protected with `ON DELETE RESTRICT` foreign keys.
- Deletion was intentionally omitted to prevent accidental removal of calibration pairs and thesis evaluation metrics.
- `DELETE /api/activities/{id}` refused execution if any submissions existed (`API_SPEC.md` §3.2).

### 1.2 Real-World Problem
During classroom pilot testing and mobile photo uploads, practical realities arise:
1. **Misassigned Uploads:** A teacher on mobile inadvertently selects the wrong student from the roster dropdown (e.g., uploading Juan's physical worksheet under Maria's profile). Without deletion, Maria's record is permanently skewed.
2. **Accidental / Bad Photos:** A teacher or parent uploads an unintended photo (e.g., table surface, personal photo, or corrupted scan) that passed the basic quality checks or was rejected and clutters the feed.
3. **Student Re-takes & Practice:** An enrolled student repeats an activity to improve their cursive, and the teacher wishes to discard an earlier test/draft attempt to keep the profile tidy.
4. **Test Data Cleanup:** Clearing pilot onboarding test runs prior to real classroom evaluations.

To address these needs while maintaining academic and data integrity, WriteWise introduces **Teacher and Parent-Scoped Hard Delete** with strict role guardrails.

---

## 2. Authorization & Security Model

### 2.1 Role-Based Permissions
1. **Teachers:**
   - Can delete **any** submission for students currently enrolled in their roster (`teacher_student`).
   - Can delete regardless of whether the worksheet was uploaded by the teacher or a parent (for take-home assignments), and regardless of whether it has been manually graded or autoscored.
   - Cannot delete submissions for students not on their roster (`403 FORBIDDEN`).
2. **Parents:**
   - Can **only** delete submissions that they themselves uploaded (`submission.uploader_id == parent.id`).
   - Can **only** delete submissions for their own linked child (`student_parent`).
   - Can **only** delete if the submission is **un-graded** (no `manual_score` row exists). Once a teacher has reviewed and graded the worksheet, the parent cannot delete it (`409 SUBMISSION_ALREADY_GRADED`).
   - Cannot delete submissions uploaded by teachers or classroom work (`403 FORBIDDEN`).
3. **Unauthenticated:**
   - Returns `401 UNAUTHORIZED`.

---

## 3. Database Schema Changes

### 3.1 Migration: `0019_submission_cascade_delete.sql`
Existing constraints on child tables (`measurement`, `manual_score`) use `ON DELETE RESTRICT`, which blocks direct deletion of `submission` rows.

We modify the foreign keys on child tables to `CASCADE`:
```sql
-- migration: 0019_submission_cascade_delete.sql

-- 1. Alter measurement table foreign key to CASCADE
alter table public.measurement
  drop constraint if exists measurement_submission_id_fkey,
  add constraint measurement_submission_id_fkey
    foreign key (submission_id)
    references public.submission(id)
    on delete cascade;

-- 2. Alter manual_score table foreign key to CASCADE
alter table public.manual_score
  drop constraint if exists manual_score_submission_id_fkey,
  add constraint manual_score_submission_id_fkey
    foreign key (submission_id)
    references public.submission(id)
    on delete cascade;
```

> [!NOTE]
> Constraints on `student_id` and `activity_id` on the `submission` table **remain `ON DELETE RESTRICT`**. Deleting a student account or activity remains blocked if submissions still exist. Only an authorized deletion targeting a specific submission cascades into its measurement and score children.

---

## 4. Backend API Specification

### 4.1 Endpoint: `DELETE /api/submissions/{submission_id}`

- **Method:** `DELETE`
- **Path:** `/api/submissions/{submission_id}`
- **Auth:** Bearer JWT required (`get_current_user`).

#### Flow & Execution:
1. **Validate `submission_id`:** Must be a valid UUID. If invalid, return `400 VALIDATION_ERROR`.
2. **Fetch Submission:** Retrieve `submission` record with `id`, `student_id`, `uploader_id`, and `image_path`.
   - If not found: return `404 NOT_FOUND`.
3. **Authorization Check:**
   - **If Caller is Teacher:**
     - Query `teacher_student` join table where `teacher_id = caller_id` and `student_id = submission.student_id`.
     - If not found: return `403 FORBIDDEN` with code `NOT_ROSTER_TEACHER`.
   - **If Caller is Parent:**
     - Check `submission.uploader_id == caller_id`. If false: return `403 FORBIDDEN` with code `NOT_SUBMISSION_UPLOADER`.
     - Check `student_parent` join table where `parent_id = caller_id` and `student_id = submission.student_id`. If not found: return `403 FORBIDDEN` with code `NOT_CHILD_PARENT`.
     - Query `manual_score` where `submission_id = submission_id`. If a record exists: return `409 CONFLICT` with code `SUBMISSION_ALREADY_GRADED`.
4. **Delete Storage Asset:**
   - Extract `image_path` from the submission row (e.g. `{student_id}/{submission_id}.jpg`).
   - Call `supabase_client.storage.from_("submissions").remove([image_path])`.
   - Log storage deletion outcome (non-fatal if file was already absent).
5. **Delete Database Record:**
   - Call `supabase_client.table("submission").delete().eq("id", submission_id).execute()`.
   - Postgres cascades deletion to `measurement` and `manual_score`.
6. **Return Response:** `200 OK`
   ```json
   {
     "id": "44444444-4444-4444-4444-444444444444",
     "deleted": true
   }
   ```

#### Error Responses Catalog:
| Status | Code | Condition |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Malformed UUID |
| `401` | `UNAUTHORIZED` | Missing or invalid auth token |
| `403` | `NOT_ROSTER_TEACHER` | Teacher does not teach this student |
| `403` | `NOT_SUBMISSION_UPLOADER` | Parent did not upload this submission |
| `403` | `NOT_CHILD_PARENT` | Student is not linked to calling parent |
| `404` | `NOT_FOUND` | Submission ID does not exist |
| `409` | `SUBMISSION_ALREADY_GRADED`| Parent attempted to delete graded submission |
| `500` | `INTERNAL_ERROR` | Database deletion failed |

---

## 5. Frontend UI & Interaction Design

### 5.1 Teacher Portal

#### A. Submission Detail (`submission-detail-content.tsx`)
- **Placement:** Top right header bar, alongside student navigation buttons.
- **Trigger:** Button with `Trash2` icon and tooltip / text: "Delete Attempt".
- **Confirmation:** Accessible `AlertDialog` modal:
  - **Title:** "Delete this attempt?"
  - **Description:** "This will permanently delete this worksheet photo, computer vision measurements, and rubric scores for {Student Name}. This action cannot be undone."
  - **Confirm Action:** Destructive button ("Delete Attempt") with loading state.
- **Post-Delete Behavior:**
  - Shows toast: *"Attempt deleted."*
  - If additional submissions exist in the current activity view: smoothly advances to the next submission.
  - If it was the only or last submission: closes the detail modal / navigates back to activity view.
  - Invalidates and refetches `submissions` cache.

#### B. Activity Submissions List (`app/(teacher)/activities/[id]/page.tsx`)
- In "All Scans" view and per-student cards, provide an item action to delete an attempt directly with confirmation.

### 5.2 Parent Portal

#### A. Worksheet View & Submission History
- **Components:** `worksheet-view-dialog.tsx` and `submission-history-dialog.tsx`.
- **Visibility Rules:**
  - **If parent uploaded and un-graded:** Render a red outline "Delete Upload" button.
  - **If graded by teacher:** Hide button or render disabled with tooltip: *"This worksheet has already been graded by the teacher and cannot be deleted."*
  - **If uploaded by teacher:** No delete button shown.
- **Confirmation:**
  - "Delete this uploaded worksheet? You will be able to take and upload a new photo for this activity."
- **Post-Delete Behavior:**
  - Closes dialog.
  - Reverts Take-Home activity card status on the parent dashboard to "Upload Worksheet".
  - Shows toast: *"Worksheet removed. You can upload a new photo anytime."*

---

## 6. Testing & Quality Assurance

### 6.1 Automated Integration Tests (`backend/tests/api/test_submissions.py`)
- `test_teacher_delete_submission_success`: Teacher deletes student's submission; verifies DB row gone, cascaded children gone, storage remove called.
- `test_teacher_delete_submission_forbidden`: Teacher attempts to delete submission for student belonging to another teacher; verifies `403`.
- `test_delete_submission_not_found`: Random UUID returns `404`.
- `test_delete_submission_invalid_uuid`: Malformed string returns `400`.
- `test_parent_delete_own_ungraded_submission_success`: Parent deletes their own un-graded submission; verifies success.
- `test_parent_delete_graded_submission_conflict`: Parent attempts to delete after manual score entered; verifies `409 SUBMISSION_ALREADY_GRADED`.
- `test_parent_delete_teacher_upload_forbidden`: Parent attempts to delete classroom upload; verifies `403`.
- `test_parent_delete_other_child_forbidden`: Parent attempts to delete another student's submission; verifies `403`.

### 6.2 Frontend & Manual Verification
- TypeScript compile check: `npx tsc --noEmit`.
- ESLint check: `npx eslint .`.
- End-to-end manual QA:
  1. Teacher uploads photo → opens detail dialog → clicks delete → confirms → verifies student count and metrics adjust.
  2. Parent uploads take-home photo → deletes before teacher grades → uploads revised photo.
  3. Teacher grades parent take-home submission → parent inspects → verifies delete option is disabled/unavailable.
