# Submission Deletion & Attempt Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement secure, role-guarded hard deletion of worksheet submissions for teachers (all submissions on their roster) and parents (own un-graded take-home uploads), cleaning up database records and Supabase Storage assets while updating dashboards and lists in real time.

**Architecture:** A FastAPI endpoint `DELETE /api/submissions/{id}` validates caller role, roster link, uploader identity, and grading status. On approval, it removes the image from Supabase Storage (`submission-images` bucket) and deletes the database row, which cascades cleanly to `measurement` and `manual_score` via Postgres foreign keys. The frontend TanStack Query cache invalidates relevant queries, updating teacher and parent views instantly.

**Tech Stack:** Python 3.13, FastAPI, Supabase Storage & Postgres (pg SQL migrations), Next.js 15 (App Router), TypeScript, Tailwind CSS, TanStack React Query, Radix UI (AlertDialog).

**Spec:** [`docs/superpowers/specs/2026-09-23-submission-deletion-design.md`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/docs/superpowers/specs/2026-09-23-submission-deletion-design.md)

## Global Constraints

- Never bypass RLS from app code; service-role key is isolated to FastAPI backend.
- Storage bucket name is strictly `"submission-images"`.
- EXIF data must remain stripped (handled at upload time; deletion removes the image completely).
- Error responses follow `{ error: { code, message, details } }` envelope.
- Submissions table `student_id` and `activity_id` remain `ON DELETE RESTRICT`; only child tables (`measurement`, `manual_score`) cascade on submission deletion.
- Frontend strictly branches on `error.code`, never text.

---

### Task 1: Database Migration for Cascade Deletion

**Files:**
- Create: `supabase/migrations/0019_submission_cascade_delete.sql`

**Interfaces:**
- Consumes: Existing tables `submission`, `measurement`, `manual_score`.
- Produces: Cascading foreign keys on `measurement.submission_id` and `manual_score.submission_id`.

- [ ] **Step 1: Write migration file**

```sql
-- supabase/migrations/0019_submission_cascade_delete.sql

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

- [ ] **Step 2: Commit migration**

```bash
git add supabase/migrations/0019_submission_cascade_delete.sql
git commit -m "feat(db): add cascade delete migration for submission children"
```

---

### Task 2: Backend API Endpoint (`DELETE /api/submissions/{id}`) & Automated Tests

**Files:**
- Modify: `backend/app/api/submissions.py`
- Modify: `backend/tests/api/test_submissions.py`
- Modify: `backend/tests/api/test_submissions_parent.py`

**Interfaces:**
- Consumes: `get_current_user` dependency from `app.api.deps`, `supabase_client` from `app.core.supabase`.
- Produces: `DELETE /api/submissions/{submission_id}` endpoint returning `{ "id": str, "deleted": True }`.

- [ ] **Step 1: Write backend tests for submission deletion**

Add the following test class to `backend/tests/api/test_submissions.py`:

```python
class TestDeleteSubmissionTeacher:
    def test_teacher_delete_submission_success(
        self, client, test_activity, test_student
    ):
        """Teacher can delete a submission for a student on their roster."""
        # 1. Create submission directly in DB
        sub_res = (
            supabase_client.table("submission")
            .insert(
                {
                    "activity_id": test_activity["id"],
                    "student_id": test_student["id"],
                    "image_path": f"{test_student['id']}/test_delete.jpg",
                    "status": "completed",
                    "uploader_id": TEST_TEACHER_ID,
                    "uploader_role": "teacher",
                }
            )
            .execute()
        )
        submission = sub_res.data[0]
        sub_id = submission["id"]

        # Insert dummy measurement
        supabase_client.table("measurement").insert(
            {
                "submission_id": sub_id,
                "raw_output": {},
            }
        ).execute()

        # 2. Call DELETE endpoint
        response = client.delete(f"/api/submissions/{sub_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sub_id
        assert data["deleted"] is True

        # 3. Verify submission and measurement are gone
        check_sub = (
            supabase_client.table("submission").select("id").eq("id", sub_id).execute()
        )
        assert len(check_sub.data) == 0

        check_meas = (
            supabase_client.table("measurement")
            .select("id")
            .eq("submission_id", sub_id)
            .execute()
        )
        assert len(check_meas.data) == 0

    def test_teacher_delete_non_roster_student_forbidden(
        self, client, test_activity
    ):
        """Teacher cannot delete a submission for a student not on their roster."""
        other_student_res = (
            supabase_client.table("student")
            .insert({"full_name": "Other Teacher Student", "section": "Other Section"})
            .execute()
        )
        other_student = other_student_res.data[0]

        sub_res = (
            supabase_client.table("submission")
            .insert(
                {
                    "activity_id": test_activity["id"],
                    "student_id": other_student["id"],
                    "image_path": f"{other_student['id']}/test_forbidden.jpg",
                    "status": "completed",
                    "uploader_id": str(uuid.uuid4()),
                    "uploader_role": "teacher",
                }
            )
            .execute()
        )
        sub_id = sub_res.data[0]["id"]

        try:
            response = client.delete(f"/api/submissions/{sub_id}")
            assert response.status_code == 403
            assert response.json()["error"]["code"] == "NOT_ROSTER_TEACHER"
        finally:
            supabase_client.table("submission").delete().eq("id", sub_id).execute()
            supabase_client.table("student").delete().eq("id", other_student["id"]).execute()

    def test_delete_submission_not_found(self, client):
        """Deleting a non-existent submission returns 404."""
        non_existent_id = str(uuid.uuid4())
        response = client.delete(f"/api/submissions/{non_existent_id}")
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"

    def test_delete_submission_invalid_uuid(self, client):
        """Deleting with malformed UUID returns 400."""
        response = client.delete("/api/submissions/not-a-uuid")
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"
```

Add parent tests to `backend/tests/api/test_submissions_parent.py`:

```python
class TestDeleteSubmissionParent:
    def test_parent_delete_own_ungraded_submission_success(
        self, parent_client, take_home_activity, linked_student
    ):
        """Parent can delete their own un-graded submission."""
        sub_res = (
            supabase_client.table("submission")
            .insert(
                {
                    "activity_id": take_home_activity["id"],
                    "student_id": linked_student["id"],
                    "image_path": f"{linked_student['id']}/parent_delete.jpg",
                    "status": "completed",
                    "uploader_id": TEST_PARENT_ID,
                    "uploader_role": "parent",
                }
            )
            .execute()
        )
        sub_id = sub_res.data[0]["id"]

        response = parent_client.delete(f"/api/submissions/{sub_id}")
        assert response.status_code == 200
        assert response.json()["deleted"] is True

        check = supabase_client.table("submission").select("id").eq("id", sub_id).execute()
        assert len(check.data) == 0

    def test_parent_delete_graded_submission_conflict(
        self, parent_client, take_home_activity, linked_student
    ):
        """Parent cannot delete a submission that has already been graded by a teacher."""
        sub_res = (
            supabase_client.table("submission")
            .insert(
                {
                    "activity_id": take_home_activity["id"],
                    "student_id": linked_student["id"],
                    "image_path": f"{linked_student['id']}/parent_graded.jpg",
                    "status": "completed",
                    "uploader_id": TEST_PARENT_ID,
                    "uploader_role": "parent",
                }
            )
            .execute()
        )
        sub_id = sub_res.data[0]["id"]

        # Insert manual score
        supabase_client.table("manual_score").insert(
            {
                "submission_id": sub_id,
                "graded_by": TEST_TEACHER_ID,
                "letter_formation_band": "satisfactory",
                "size_consistency_band": "satisfactory",
                "spacing_band": "satisfactory",
                "slant_band": "satisfactory",
                "baseline_alignment_band": "satisfactory",
            }
        ).execute()

        try:
            response = parent_client.delete(f"/api/submissions/{sub_id}")
            assert response.status_code == 409
            assert response.json()["error"]["code"] == "SUBMISSION_ALREADY_GRADED"
        finally:
            supabase_client.table("manual_score").delete().eq("submission_id", sub_id).execute()
            supabase_client.table("submission").delete().eq("id", sub_id).execute()

    def test_parent_delete_teacher_upload_forbidden(
        self, parent_client, take_home_activity, linked_student
    ):
        """Parent cannot delete a submission uploaded by a teacher."""
        sub_res = (
            supabase_client.table("submission")
            .insert(
                {
                    "activity_id": take_home_activity["id"],
                    "student_id": linked_student["id"],
                    "image_path": f"{linked_student['id']}/teacher_upload.jpg",
                    "status": "completed",
                    "uploader_id": TEST_TEACHER_ID,
                    "uploader_role": "teacher",
                }
            )
            .execute()
        )
        sub_id = sub_res.data[0]["id"]

        try:
            response = parent_client.delete(f"/api/submissions/{sub_id}")
            assert response.status_code == 403
            assert response.json()["error"]["code"] == "NOT_SUBMISSION_UPLOADER"
        finally:
            supabase_client.table("submission").delete().eq("id", sub_id).execute()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
uv run pytest tests/api/test_submissions.py -k "TestDeleteSubmission" -v
```
Expected: FAIL with 405 Method Not Allowed.

- [ ] **Step 3: Implement endpoint in `backend/app/api/submissions.py`**

Add the delete route handler:

```python
@router.delete("/{submission_id}", status_code=status.HTTP_200_OK)
async def delete_submission(
    submission_id: str,
    caller: dict = Depends(get_current_user),
):
    caller_id = caller.get("sub")
    caller_role = caller.get("role")

    # 1. Validate UUID format
    try:
        uuid.UUID(submission_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "submission_id must be a valid UUID.",
                "details": {},
            },
        )

    # 2. Fetch submission row
    sub_res = (
        supabase_client.table("submission")
        .select("id, student_id, uploader_id, uploader_role, image_path")
        .eq("id", submission_id)
        .execute()
    )
    if not sub_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_FOUND",
                "message": "Submission not found.",
                "details": {},
            },
        )
    submission = sub_res.data[0]
    student_id = submission["student_id"]
    uploader_id = submission["uploader_id"]
    image_path = submission["image_path"]

    # 3. Role-based authorization
    if caller_role == "teacher":
        # Check roster link: teacher must teach this student
        roster_check = (
            supabase_client.table("teacher_student")
            .select("teacher_id")
            .eq("teacher_id", caller_id)
            .eq("student_id", student_id)
            .execute()
        )
        if not roster_check.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "NOT_ROSTER_TEACHER",
                    "message": "You can only delete submissions for students on your roster.",
                    "details": {},
                },
            )
    elif caller_role == "parent":
        # Parent must be the uploader
        if uploader_id != caller_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "NOT_SUBMISSION_UPLOADER",
                    "message": "Parents can only delete submissions they personally uploaded.",
                    "details": {},
                },
            )
        # Parent must be linked to the child
        link_check = (
            supabase_client.table("student_parent")
            .select("parent_id")
            .eq("parent_id", caller_id)
            .eq("student_id", student_id)
            .execute()
        )
        if not link_check.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "NOT_CHILD_PARENT",
                    "message": "You are not linked to this student.",
                    "details": {},
                },
            )
        # Cannot delete if teacher has already entered manual_score
        score_check = (
            supabase_client.table("manual_score")
            .select("id")
            .eq("submission_id", submission_id)
            .execute()
        )
        if score_check.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "SUBMISSION_ALREADY_GRADED",
                    "message": "This worksheet has already been graded by the teacher and cannot be deleted.",
                    "details": {},
                },
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "FORBIDDEN",
                "message": "Unauthorized role for submission deletion.",
                "details": {},
            },
        )

    # 4. Delete Storage asset
    try:
        supabase_client.storage.from_("submission-images").remove([image_path])
    except Exception as exc:
        logger.warning(
            "Failed to delete storage asset %s for submission %s: %s",
            image_path,
            submission_id,
            exc,
        )

    # 5. Delete DB record (cascades to measurement and manual_score)
    try:
        # Also clean up child rows explicitly if migration not yet applied in environment
        supabase_client.table("manual_score").delete().eq("submission_id", submission_id).execute()
        supabase_client.table("measurement").delete().eq("submission_id", submission_id).execute()
        supabase_client.table("submission").delete().eq("id", submission_id).execute()
    except Exception as exc:
        logger.error("Failed to delete submission record %s: %s", submission_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Failed to delete submission.",
                "details": {"error": str(exc)},
            },
        )

    return {"id": submission_id, "deleted": True}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
uv run pytest tests/api/test_submissions.py tests/api/test_submissions_parent.py -v
```
Expected: PASS all tests.

- [ ] **Step 5: Run ruff check**

```bash
cd backend
uv run ruff check .
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/submissions.py backend/tests/api/test_submissions.py backend/tests/api/test_submissions_parent.py
git commit -m "feat(api): implement DELETE /api/submissions/{id} with role authorization"
```

---

### Task 3: Frontend Mutation Hook & Cache Invalidation

**Files:**
- Modify: `frontend/lib/hooks/use-submissions.ts`

**Interfaces:**
- Consumes: `/api/submissions/{submissionId}` via fetch.
- Produces: `useDeleteSubmission()` React Query mutation hook.

- [ ] **Step 1: Implement `useDeleteSubmission` in `frontend/lib/hooks/use-submissions.ts`**

Add to `frontend/lib/hooks/use-submissions.ts`:

```typescript
export function useDeleteSubmission() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submissionId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No active session");
      }

      const response = await fetch(`/api/submissions/${submissionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return handleApiResponse<{ id: string; deleted: boolean }>(response);
    },
    onSuccess: () => {
      // Invalidate all related teacher and parent queries
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-scores"] });
      queryClient.invalidateQueries({ queryKey: ["student-trend"] });
      queryClient.invalidateQueries({ queryKey: ["parent-child-latest-scores"] });
      queryClient.invalidateQueries({ queryKey: ["parent-child-score-history"] });
      queryClient.invalidateQueries({ queryKey: ["parent-take-home-activities"] });
      queryClient.invalidateQueries({ queryKey: ["parent-child-submission"] });
      queryClient.invalidateQueries({ queryKey: ["parent-all-submissions"] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/hooks/use-submissions.ts
git commit -m "feat(frontend): add useDeleteSubmission mutation hook with cache invalidation"
```

---

### Task 4: Teacher Portal UI Integration

**Files:**
- Modify: `frontend/components/submissions/submission-detail-content.tsx`
- Modify: `frontend/app/(teacher)/activities/[id]/page.tsx`

**Interfaces:**
- Consumes: `useDeleteSubmission` from `@/lib/hooks/use-submissions`.
- Produces: "Delete Attempt" button with confirmation `AlertDialog` in the submission detail header and scan rows.

- [ ] **Step 1: Add Delete Attempt button & confirmation dialog in `submission-detail-content.tsx`**

1. Import `AlertDialog` components and `Trash2` icon:
   ```typescript
   import {
     AlertDialog,
     AlertDialogAction,
     AlertDialogCancel,
     AlertDialogContent,
     AlertDialogDescription,
     AlertDialogFooter,
     AlertDialogHeader,
     AlertDialogTitle,
   } from "@/components/ui/alert-dialog";
   import { Trash2, Loader2 } from "lucide-react";
   import { useDeleteSubmission } from "@/lib/hooks/use-submissions";
   ```
2. In `SubmissionDetailContent`:
   - Add state: `const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);`
   - Instantiate mutation: `const deleteMutation = useDeleteSubmission();`
   - Handle delete action:
     ```typescript
     const handleDelete = async () => {
       try {
         await deleteMutation.mutateAsync(submission.id);
         setIsDeleteDialogOpen(false);
         if (hasMultipleSubmissions && submissions && onNavigate) {
           const nextIndex = canGoNext ? effectiveIndex + 1 : effectiveIndex - 1;
           if (nextIndex >= 0 && nextIndex < submissions.length) {
             onNavigate(submissions[nextIndex]);
           }
         }
       } catch (err) {
         console.error("Failed to delete submission:", err);
       }
     };
     ```
3. In `headerContent` right-hand controls:
   - Add a "Delete Attempt" button:
     ```tsx
     <Button
       variant="ghost"
       size="sm"
       onClick={() => setIsDeleteDialogOpen(true)}
       className="h-8.5 sm:h-9 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5 cursor-pointer rounded-xl border border-destructive/20"
       title="Delete this attempt"
     >
       <Trash2 className="size-3.5" aria-hidden="true" />
       <span className="hidden sm:inline">Delete</span>
     </Button>
     ```
4. Render the `AlertDialog`:
   ```tsx
   <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
     <AlertDialogContent>
       <AlertDialogHeader>
         <AlertDialogTitle>Delete this submission?</AlertDialogTitle>
         <AlertDialogDescription>
           This will permanently delete this worksheet photo, measurements, and rubric grades for{" "}
           <span className="font-semibold text-foreground">{submission.student?.full_name ?? "Student"}</span>. This action cannot be undone.
         </AlertDialogDescription>
       </AlertDialogHeader>
       <AlertDialogFooter>
         <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
         <AlertDialogAction
           onClick={(e) => {
             e.preventDefault();
             handleDelete();
           }}
           disabled={deleteMutation.isPending}
           className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
         >
           {deleteMutation.isPending ? (
             <>
               <Loader2 className="mr-2 size-4 animate-spin" />
               Deleting...
             </>
           ) : (
             "Delete Attempt"
           )}
         </AlertDialogAction>
       </AlertDialogFooter>
     </AlertDialogContent>
   </AlertDialog>
   ```

- [ ] **Step 2: Add Delete Action to Scans List in `app/(teacher)/activities/[id]/page.tsx`**

Allow teachers to delete an attempt from the scan row with an action trigger and confirmation.

- [ ] **Step 3: Run TypeScript compiler check**

```bash
cd frontend
npx tsc --noEmit
```
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/submissions/submission-detail-content.tsx frontend/app/(teacher)/activities/[id]/page.tsx
git commit -m "feat(teacher): integrate delete submission button and confirmation alert dialog"
```

---

### Task 5: Parent Portal UI Integration

**Files:**
- Modify: `frontend/components/parent/worksheet-view-dialog.tsx`
- Modify: `frontend/components/parent/submission-history-dialog.tsx`

**Interfaces:**
- Consumes: `useDeleteSubmission` from `@/lib/hooks/use-submissions`.
- Produces: "Delete Upload" button for un-graded take-home submissions uploaded by the parent.

- [ ] **Step 1: Integrate Delete Upload in `worksheet-view-dialog.tsx`**

1. Detect if the submission was uploaded by a parent and is un-graded (`!submission.manual_score` and `uploader_role === 'parent'`).
2. Add a red outline "Delete Upload" button in the dialog footer or actions bar.
3. Provide an `AlertDialog` confirming:
   *"Delete this uploaded worksheet? You will be able to take and upload a new photo for this activity."*
4. On delete, close the dialog and show a toast: *"Worksheet removed. You can upload a new photo anytime."*

- [ ] **Step 2: Integrate in `submission-history-dialog.tsx` if un-graded**

Same guard: only un-graded parent uploads display the delete option.

- [ ] **Step 3: Run TypeScript and ESLint checks**

```bash
cd frontend
npx tsc --noEmit
npx eslint .
```
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/parent/worksheet-view-dialog.tsx frontend/components/parent/submission-history-dialog.tsx
git commit -m "feat(parent): allow parents to delete their own un-graded take-home submissions"
```

---

### Task 6: End-to-End Verification & OpenAPI / Type Updates

**Files:**
- Modify: `frontend/src/types/api.ts` (if regenerated)
- Test: Full backend test suite

- [ ] **Step 1: Run full backend tests**

```bash
cd backend
uv run pytest -v
```
Expected: PASS all tests.

- [ ] **Step 2: Run frontend build / lint verification**

```bash
cd frontend
npx tsc --noEmit
npx eslint .
```
Expected: PASS.

- [ ] **Step 3: Update `IMPLEMENTATION_STATUS.md`**

Document the completed `DELETE /api/submissions/{id}` endpoint and UI capabilities.

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "docs: update implementation status for submission deletion feature"
```
