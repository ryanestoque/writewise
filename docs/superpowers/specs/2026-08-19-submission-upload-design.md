# Submission Upload (Phase 1 — Upload + Hardening Only)

**Date:** 2026-08-19
**Status:** Approved (in-chat design review)
**Implements:** IMPLEMENTATION_STATUS.md Phase 1 → "Submission upload (single photo per activity)"
**Doc pointers:** PRD §7.1, API_SPEC §3.3, ARCHITECTURE §8 (steps 1–2 only), DATABASE §7/§11, SECURITY §4, DESIGN §7.1–7.3

---

## 1. Problem

Activities are done. The next item in Phase 1's dependency chain is submission upload — teachers need to upload photos of student handwriting against an activity before anything downstream (CV pipeline, measurements, manual scoring) can proceed.

**Dependency chain:** Roster ✅ → Activities ✅ → **Submission Upload** → CV Pipeline → Raw Measurement Display → Manual Rubric Entry

---

## 2. Scope

**This spec covers upload + hardening only** — steps 1–2 of ARCHITECTURE §8's synchronous pipeline. The CV/ML pipeline (quality gate, preprocessing, segmentation, feature extraction, CNN inference) is a separate body of work; submissions created by this spec will have `status = 'processing'` until that pipeline is built.

**Teacher-only** for this iteration. API_SPEC §3.3 specs both teacher and parent uploaders, but the parent portal is a Phase 2 feature. The endpoint structure accommodates both roles by design (`uploader_id` / `uploader_role` from the JWT), so adding parent support later is a permission-check addition, not a structural change.

### Deliverables

1. **Backend:** `POST /api/submissions` endpoint — file validation, image hardening, Storage write, submission row creation
2. **Backend:** `app/core/image_hardening.py` — extracted utility for magic-byte check, decompression-bomb cap, EXIF strip
3. **Frontend:** Overhaul `QuickUploadDialog` into a full multi-step upload flow with student/activity selection, photo capture, preview + confirm, and uploading states
4. **Frontend:** `useSubmissions` / `useUploadSubmission` data hooks
5. **Frontend:** Submissions card grid on the activity detail page, replacing the current empty-state placeholder

### Explicitly out of scope

- CV pipeline (quality gate, preprocessing, segmentation, feature extraction) — all separate IMPLEMENTATION_STATUS items
- CNN inference — depends on Between-Phases model training
- Parent upload flow — Phase 2
- Submission editing or deletion — not specced anywhere in the docs
- Manual rubric score entry on submissions — its own IMPLEMENTATION_STATUS item, depends on raw measurement display

---

## 3. Backend

### 3.1 New file: `backend/app/core/image_hardening.py`

Three security checks extracted into one testable module, not inlined in the route handler. These are the SECURITY §4 controls — security/privacy, not data quality — and per AGENTS.md §6 rule 5, they run before Pillow/OpenCV touches the file.

```python
# Public API:
def validate_and_harden_image(file_bytes: bytes, content_type: str) -> bytes:
    """
    Runs all three security checks in order, returns hardened JPEG bytes.
    Raises HTTPException with the appropriate error code on failure.
    """
```

**Check 1 — Magic-byte file-signature validation:**
- JPEG: starts with `FF D8 FF`
- PNG: starts with `89 50 4E 47 0D 0A 1A 0A`
- Anything else → `400 UNSUPPORTED_FILE_TYPE`, regardless of what `Content-Type` header claimed (SECURITY §4.1 — MIME-type spoofing fix)

**Check 2 — Decompression-bomb pixel-dimension cap:**
- Before Pillow decodes the image, set `Image.MAX_IMAGE_PIXELS` to a reasonable ceiling (e.g. 178_956_970, Pillow's default) to prevent a small file decoding into an enormous in-memory bitmap (SECURITY §4.2)
- If `Image.open()` raises `DecompressionBombError` → `400 FILE_TOO_LARGE`

**Check 3 — Unconditional EXIF metadata stripping:**
- Per AGENTS.md §6 rule 3 and SECURITY §4.3: EXIF stripping (GPS, timestamp, device info) is unconditional on every path that writes an image to Storage. Never conditional, never skipped.
- Implementation: decode with Pillow, re-save to a new bytes buffer as JPEG with no EXIF data (`image.save(buf, format="JPEG", exif=b"")`)
- PNG inputs are converted to JPEG during this step (the CV pipeline expects JPEG downstream per DATABASE §7's `image_path` convention `{student_id}/{submission_id}.jpg`)
- Output: clean JPEG bytes, no EXIF, ready for Storage upload

### 3.2 New file: `backend/app/api/submissions.py`

Follows the same patterns established in `activities.py` and `students.py`.

**Endpoint: `POST ""`**

- **Auth dependency:** `get_current_teacher` (teacher-only for now)
- **Input:** `multipart/form-data` via FastAPI's `File` and `Form` parameters:
  - `image: UploadFile` — the photo file
  - `activity_id: str` — UUID of the activity
  - `student_id: str` — UUID of the student

**Validation sequence (before any processing):**

1. Parse `activity_id` and `student_id` as UUIDs (Pydantic/manual validation → `400 VALIDATION_ERROR`)
2. Check file size ≤ 15 MB (from `UploadFile.size` or reading bytes) → `400 FILE_TOO_LARGE`
3. Verify `activity_id` exists and `created_by = caller's teacher ID` (service-role query to `activity` table) → `404 NOT_FOUND` otherwise
4. Verify `student_id` exists on this teacher's roster (service-role query to `teacher_student` where `teacher_id = caller` and `student_id = param`) → `404 NOT_FOUND` otherwise
5. Call `validate_and_harden_image(file_bytes, content_type)` — magic bytes, decompression bomb, EXIF strip → `400 UNSUPPORTED_FILE_TYPE` or `400 FILE_TOO_LARGE` on failure

**After validation passes:**

6. Generate a submission UUID (Python-side `uuid4()`, not DB-generated, so we have it before the DB insert for the Storage path)
7. Construct `image_path` = `{student_id}/{submission_id}.jpg` (DATABASE §7/§11 convention)
8. Upload hardened JPEG bytes to Supabase Storage bucket `submission-images` at that path, using the service-role client (no RLS on writes — DATABASE §11)
9. Insert `submission` row:
   - `id`: the pre-generated UUID
   - `activity_id`, `student_id`: from request
   - `image_path`: the constructed path
   - `status`: `'processing'` (default — honest about current state, no CV pipeline yet)
   - `uploader_id`: from JWT `sub`
   - `uploader_role`: `'teacher'`
   - `rejection_code`, `rejection_details`: `null`
10. Return `201 Created`:

```json
{
  "submission_id": "44444444-...",
  "status": "processing",
  "image_path": "22222222-.../44444444-....jpg",
  "student_id": "22222222-...",
  "activity_id": "33333333-...",
  "created_at": "2026-08-19T09:00:00Z"
}
```

> **Why pre-generate the UUID:** the Storage path includes `submission_id` (DATABASE §11's convention). We need the ID before the DB insert so the image upload and row creation reference the same ID. If the Storage upload succeeds but the DB insert fails, we have an orphaned file — acceptable at pilot scale (and detectable via a simple Storage-vs-DB reconciliation query), versus the alternative of inserting first with a placeholder `image_path` and updating it post-upload, which adds a second DB round-trip and a transient invalid state.

### 3.3 Modify: `backend/app/main.py`

Add `submissions_router` import and `app.include_router(submissions_router, prefix="/api/submissions", tags=["submissions"])`.

---

## 4. Frontend — Data Layer

### 4.1 New file: `frontend/lib/hooks/use-submissions.ts`

Follows the exact patterns from `use-activities.ts`.

**Type:**

```typescript
export interface Submission {
  id: string;
  activity_id: string;
  student_id: string;
  image_path: string;
  status: "processing" | "completed" | "rejected";
  uploader_id: string;
  uploader_role: "teacher" | "parent";
  rejection_code: string | null;
  created_at: string;
  updated_at: string;
  // Joined from student table for display
  student: {
    full_name: string;
  };
}
```

**`useSubmissions(activityId)` — read hook:**
- Direct Supabase read (RLS-gated: `is_teacher_of_student(student_id)` policy in 0009_rls_policies.sql)
- Query key: `["submissions", activityId]`
- Selects: `id, activity_id, student_id, image_path, status, uploader_id, uploader_role, rejection_code, created_at, updated_at, student:student_id(full_name)`
- Ordered by `created_at` descending (newest first)

**`useUploadSubmission()` — mutation:**
- Builds a `FormData` with `image`, `activity_id`, `student_id`
- Calls `POST /api/submissions` via fetch (same JWT-from-session pattern as `useCreateActivity`)
- **No `Content-Type` header** — let the browser set `multipart/form-data` with the correct boundary
- Invalidates `["submissions"]` (all activities' submission lists) on success
- Returns the response body

**`useSubmissionImageUrl(imagePath)` — signed URL hook:**
- Calls `supabase.storage.from('submission-images').createSignedUrl(imagePath, 3600)` (1-hour signed URL)
- Uses `useQuery` with query key `["submission-image", imagePath]` and `staleTime: 30 * 60 * 1000` (30 min — well within the 1-hour signing window)
- Returns the signed URL string for use in `<img src={...}>`

---

## 5. Frontend — Upload Dialog

### 5.1 Overhaul: `frontend/components/quick-upload-dialog.tsx`

The existing `QuickUploadDialog` is a scaffold with file selection and a "Proceed to Activity" button. This overhaul replaces it with a **functional multi-step upload flow** that actually submits to the backend.

**The dialog already has:**
- File input with drag-and-drop
- Client-side MIME type and file size validation
- Image preview
- Wiring into `TeacherModalsProvider` (global state, keyboard shortcut ⌘K)

**What changes:**

The dialog becomes a multi-step flow with an internal step state:

**Step 1 — Select student & activity:**
- **Activity selector:** combobox/searchable dropdown, populated from `useActivities()`. If the dialog receives a pre-filled `activityId` prop (opened from the activity detail page), this is pre-selected and read-only.
- **Student selector:** combobox/searchable dropdown, populated from the teacher's roster (`useStudents()`). Shows `full_name` and `section`.
- Both selectors are required before proceeding.
- "Next" button advances to step 2.

**Step 2 — Capture photo:**
- The existing file input / drag-and-drop zone (already built)
- `<input type="file" accept="image/jpeg,image/png" capture="environment">` — `capture="environment"` opens the rear camera on mobile devices (DESIGN §7.1). Note: the existing scaffold accepts WebP; this is narrowed to JPEG/PNG only per API_SPEC §3.3.
- The existing client-side validations (MIME, 15 MB cap) stay as early-exit guards, updated to reject WebP
- Selecting a file advances to step 3

**Step 3 — Preview + confirm:**
- The existing photo preview (already built — the `previewUrl` / `aspect-4/3` container)
- **Confirmation text** above the preview: "Student: **Juan Dela Cruz** · Activity: **the quick brown fox**" — explicitly re-displays context to catch mis-attribution (DESIGN §7.1's confirm-step rationale)
- **Retake** button → clears file, returns to step 2
- **Submit** button → calls `useUploadSubmission().mutate()`, immediately disables on tap (API_SPEC §5 double-submit mitigation)

**Step 4 — Uploading state:**
- Replaces the dialog content with a centered spinner + "Uploading worksheet…" text
- On success: toast ("Submission uploaded"), close dialog, query invalidation refreshes any visible submission list
- On error: inline error banner inside the dialog with the error message (branches on `error.code` per AGENTS.md §6 rule) and a "Try Again" button that returns to step 3 with the photo still loaded

**Props change:**

```typescript
interface QuickUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill activity when opened from an activity detail page */
  prefilledActivityId?: string;
  /** Pre-fill student when opened from a context that knows the student */
  prefilledStudentId?: string;
}
```

**Entry points (both already wired):**

1. **Sidebar "Quick Upload" / ⌘K hotkey** — opens with no pre-fills (teacher selects both activity and student in step 1)
2. **Activity detail page "Upload Submission" button** — passes `prefilledActivityId={activity.id}`, so step 1 shows the activity pre-selected and read-only; teacher only picks a student

### 5.2 Update `TeacherModalsProvider`

The provider's context type gains optional pre-fill props:

```typescript
openUpload: (opts?: { activityId?: string; studentId?: string }) => void;
```

The `openUpload` callback stores the pre-fill values in state and passes them as props to `QuickUploadDialog`. When the dialog closes, the pre-fill state resets.

---

## 6. Frontend — Submissions List on Activity Detail Page

### 6.1 Modify: `frontend/app/(teacher)/activities/[id]/page.tsx`

Replace the placeholder submissions section (lines 214–247) with a real data-driven submissions list.

**Data fetch:** `useSubmissions(activity.id)` hook

**Layout:**
- Section heading: "Submissions" with a count badge (e.g., "12")
- "Upload Submission" button in the section header → calls `openUpload({ activityId: activity.id })`
- Responsive card grid: 1 column mobile → 2 columns tablet → 3 columns desktop (same responsive pattern as the activities list page)

**Each submission card:**
- **Photo thumbnail:** loaded from Supabase Storage via signed URL (`useSubmissionImageUrl`). Aspect ratio `4:3`, `object-cover`, rounded corners.
- **Student name:** from the joined `student.full_name`
- **Status badge:** color-coded — `processing` (amber/yellow), `completed` (green), `rejected` (red)
- **Relative date:** e.g. "2 hours ago"
- Cards are not clickable yet — the submission detail/result view is a separate IMPLEMENTATION_STATUS item (raw measurement display)

**States:**
- **Loading:** skeleton card grid (same pattern as activities list)
- **Empty (no submissions):** the existing empty state, but with the "Upload Submission" button now enabled and wired
- **Error:** error banner with retry (same pattern as activities list)

---

## 7. Visual Design Notes

All decisions flow from DESIGN.md tokens — no new design decisions:

- Upload dialog uses `rounded-2xl` + `shadow-warm` + `border` (DESIGN §2.4 — modal class)
- Step transitions within the dialog are instant (no slide animation — keeping it simple for this iteration)
- Submission cards use `rounded-xl` + `shadow-warm` (DESIGN §2.4 — card/feedback class)
- Status badges:
  - `processing`: amber background, amber text (matching the "in-progress" semantic)
  - `completed`: green background, green text
  - `rejected`: red/destructive background, red text
- Photo thumbnails have `rounded-lg` corners inside the card
- The confirmation text in step 3 uses `font-medium` for student/activity names to make them visually distinct from the surrounding copy
- Quality guidelines callout (already in the existing dialog) is preserved in step 2

---

## 8. Testing & Verification

### Backend

- Lint: `uv run ruff check .`
- Unit test `image_hardening.py`:
  - Valid JPEG passes magic-byte check
  - Valid PNG passes magic-byte check and converts to JPEG
  - Non-image file (e.g. a text file with `.jpg` extension) → `UNSUPPORTED_FILE_TYPE`
  - EXIF-containing JPEG → output bytes have no EXIF
  - Oversized pixel dimensions → `FILE_TOO_LARGE`
- Endpoint testable via `/docs` (FastAPI Swagger UI — multipart upload form)
- Manual test: upload via Swagger → verify image appears in Storage bucket at `{student_id}/{submission_id}.jpg` → verify `submission` row in Supabase dashboard → verify EXIF is stripped (download from Storage, check with `exiftool` or Pillow)
- Verify rejection: upload a non-image file → `400 UNSUPPORTED_FILE_TYPE`
- Verify rejection: upload with a `student_id` not on the teacher's roster → `404 NOT_FOUND`

### Frontend

- Lint: `npx eslint .`
- Type check: `npx tsc --noEmit`
- Manual QA:
  - Open Quick Upload from sidebar (⌘K) → select activity + student → pick photo → preview shows with confirmation text → submit → toast + dialog closes → submission appears in activity detail page card grid
  - Open Upload from activity detail page → activity is pre-selected → pick student → photo → submit → card appears
  - Verify "Submit" button is disabled during upload (double-submit prevention)
  - Verify error state: disconnect backend, attempt upload → error banner appears in dialog
  - Verify submission card shows student name, status badge ("Processing"), thumbnail, date
  - Verify empty state still renders when no submissions exist
  - Test at mobile, tablet, desktop breakpoints

---

## 9. Files Summary

| Layer | File | Action | Description |
|-------|------|--------|-------------|
| Backend | `app/core/image_hardening.py` | NEW | Magic-byte, decompression-bomb, EXIF strip utility |
| Backend | `app/api/submissions.py` | NEW | `POST /api/submissions` endpoint |
| Backend | `app/main.py` | MODIFY | Register submissions router |
| Frontend | `lib/hooks/use-submissions.ts` | NEW | `useSubmissions`, `useUploadSubmission`, `useSubmissionImageUrl` hooks |
| Frontend | `components/quick-upload-dialog.tsx` | OVERHAUL | Multi-step upload flow replacing the scaffold |
| Frontend | `components/teacher-modals-provider.tsx` | MODIFY | Add pre-fill props to `openUpload` |
| Frontend | `app/(teacher)/activities/[id]/page.tsx` | MODIFY | Wire real submissions list + upload button |
