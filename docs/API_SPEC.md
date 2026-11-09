# WriteWise — API_SPEC.md

**FastAPI HTTP API — Build Guide**

- **Document type:** Internal engineering build guide (companion to PRD.md, ARCHITECTURE.md, DESIGN.md, CV_PIPELINE.md, ML_PIPELINE.md, DATABASE.md, TECH_STACK.md, SECURITY.md, TESTING.md, DEPLOYMENT.md)
- **Scope:** every HTTP endpoint FastAPI exposes to the frontend — request/response shapes, auth rules, error codes, and the conventions shared across all of them. Picks up from ARCHITECTURE.md §4's hybrid access-pattern decision and goes all the way to literal, implementable request/response contracts, the way DATABASE.md goes from ARCHITECTURE §6's entity summary to runnable DDL.
- **Status:** Draft v1

---

## 1. Scope & Boundary

ARCHITECTURE §4 splits data access into two paths: **direct reads** (`supabase-js` from the frontend, RLS-gated, no FastAPI involved) and **writes and business logic** (FastAPI, service-role key, Python-side authorization). DATABASE §1 explicitly notes that most tables have no `insert`/`update`/`delete` RLS policies — "writes... go through FastAPI... they're intentionally not here."

**This document is the other half of that split.** It documents the FastAPI HTTP surface *only* — every endpoint the frontend calls that isn't a direct Supabase table read. It deliberately does **not** re-list which tables/columns are readable directly; that contract already lives in DATABASE §10 (RLS policies), and duplicating it here would just be a second place for it to drift out of sync.

**Consequence:** there is no `GET /students`, `GET /activities`, or `GET /submissions` list/detail endpoint anywhere in this document. Dashboard tables, roster lists, trend charts, and submission history (DESIGN §6, screens 11–14) are all served by direct Supabase reads, protected by DATABASE §10's RLS policies. If a screen needs data and it's not listed here, it's a direct read — not a missing endpoint.

---

## 2. Conventions

Established once here so individual endpoint sections below don't repeat them.

### 2.1 Base Path & Versioning

Every endpoint is under `/api` — e.g. `/api/students`, `/api/submissions`. **No version prefix** (`/api/v1/...`). This is a single-frontend, single-backend pilot where Vercel and Railway auto-deploy in lockstep from the same monorepo on every merge to `main` (ARCHITECTURE §2/§14) — frontend and backend are always in sync by construction, so a version number would promise a backward-compatibility guarantee this project doesn't need. Add versioning later if the project ever outgrows "single pilot" status.

### 2.2 Authentication & Authorization

- The frontend sends the Supabase-issued session JWT as `Authorization: Bearer <token>` on every request.
- A shared dependency, `get_current_user` (in `deps.py`, §6), verifies the JWT's signature locally against Supabase's JWT secret (no network round-trip to Supabase Auth) and extracts `sub` (→ `auth.users.id`, which per DATABASE §4 *is* `teacher.id`/`parent.id` directly) and the `role` claim (`teacher` | `parent`) set at account-creation time (DATABASE §4.1).
- Role-specific dependencies (`get_current_teacher`, `get_current_parent`) layer a role check on top. Individual endpoints below also perform **ownership checks** in Python (e.g. "is this student on this teacher's roster") — the same logic DATABASE §10.1's RLS helper functions express in SQL, re-expressed here because FastAPI's service-role key bypasses RLS by design (ARCHITECTURE §4).
- **Status codes:** `401` — missing/invalid/expired token. `403` — valid token, wrong role for this route entirely (e.g. a parent hitting a teacher-only endpoint). `404` — valid token, correct role, but no relationship to the referenced resource (e.g. a teacher referencing a real `student_id` that isn't on their roster).

> **Why `404`, not `403`, for ownership gaps:** returning `403` on an ID a caller has no relationship to confirms that ID exists, which is an unnecessary information leak. `404` is indistinguishable from "this ID doesn't exist at all" — the same principle RLS itself follows (a query simply returns no rows, not a permission error). `403` stays reserved for role-level mismatches, not per-resource ownership gaps.

### 2.3 Success Response Shape

Success responses are returned **bare** — the resource itself, no `{ "data": ... }` wrapper. ARCHITECTURE §12 only standardizes the *error* shape (§2.4 below), because that's the one place a generic, code-driven branch is needed across every screen. A success wrapper would add an unwrapping step at every call site for no behavioral benefit — TanStack Query (ARCHITECTURE §11) already normalizes loading/success/error state on the frontend.

### 2.4 Error Response Shape & Code Catalog

Every error response uses ARCHITECTURE §12's envelope exactly:

```json
{
  "error": {
    "code": "QUALITY_GATE_BLUR",
    "message": "Image is too blurry — please retake the photo.",
    "details": {}
  }
}
```

The frontend branches on `error.code`, never on parsing `message` text (ARCHITECTURE §12). The full catalog of codes this API can return:

| Code | HTTP status | Source |
|---|---|---|
| `VALIDATION_ERROR` | 400 / 422 | Pydantic validation failure or invalid payload format, normalized into envelope |
| `BAD_REQUEST` | 400 | Request violates business precondition (e.g. resend-invite on student without parent email) |
| `INVALID_SUBMISSION_STATUS` | 400 | Action attempted on invalid submission status (e.g. grading rejected submission) |
| `INVITE_FAILED` | 400 | Parent email invitation delivery failed via Supabase Auth admin API |
| `UNSUPPORTED_FILE_TYPE` | 400 | Submission upload — file isn't `image/jpeg` or `image/png` (§3.3) |
| `FILE_TOO_LARGE` | 400 | Submission upload — file exceeds 15 MB (§3.3) |
| `ACTIVITY_NOT_ASSIGNED` | 404 | Authorized work relationship exists, but the activity does not target this student for an upload or new comment |
| `SUBMISSIONS_CLOSED` | 409 | Assigned parent take-home upload after a closed due date |
| `INVALID_ASSIGNMENT_TARGET` | 422 | Empty assignment replacement or section/student outside the teacher's ownership |
| `ACTIVITY_HAS_SUBMISSIONS` | 400 | `DELETE /api/activities/{id}` — refused because student submissions already exist |
| `UNAUTHORIZED` | 401 | Missing, invalid, or expired JWT |
| `FORBIDDEN` | 403 | Authenticated, but wrong role for this route |
| `MANUAL_SCORING_DISABLED` | 403 | `PATCH /submissions/{id}/manual-score` called while `SCORING_ENGINE=calibrated` (§3.3) |
| `NOT_ROSTER_TEACHER` | 403 | Action refused — caller is a teacher, but the student is not on their roster (§3.3) |
| `NOT_SUBMISSION_UPLOADER` | 403 | Attempt deletion — caller is a parent, but was not the original uploader (§3.3) |
| `NOT_CHILD_PARENT` | 403 | Action refused — caller is a parent, but has no linked relationship to the student (§3.3) |
| `NOT_FOUND` | 404 | Referenced `student_id` / `activity_id` / `section_id` / `submission_id` doesn't exist or caller has no access |
| `SECTION_NAME_EXISTS` | 409 | Section creation/rename — teacher already has a section with that case-insensitive name |
| `SECTION_NOT_EMPTY` | 409 | Section deletion refused — students are currently assigned to the section |
| `MANUAL_SCORE_ALREADY_EXISTS` | 409 | Reserved legacy conflict code; current authorized manual rubric writes upsert the rubric |
| `SUBMISSION_ALREADY_GRADED` | 409 | Attempt deletion — parent attempted to delete an already graded submission (§3.3) |
| `SUBMISSION_NOT_RETURNABLE` | 409 | Return requested for a processing, rejected, or already returned attempt |
| `SUBMISSION_NOT_RELEASABLE` | 409 | Release requested for an inactive, ungraded, rejected, or returned attempt |
| `INVALID_WORK_SELECTION` | 422 | Pin does not reference a completed attempt for this student and activity |
| `GRADE_NOT_RELEASABLE` | 409 | Work is excused, points are disabled, or no numeric grade is available |
| `GRADE_REVISION_CONFLICT` | 409 | Work changed since the teacher reviewed its grade revision |
| `POINTS_OVERRIDE_CONFLICT` | 409 | A new activity maximum would be lower than an existing override |
| `POINTS_REMOVAL_CONFIRMATION_REQUIRED` | 409 | Removing points with retained grades needs explicit confirmation |
| `COMMENTS_LOCKED` | 409 | New comment requested while the teacher has locked the thread |
| `ACTIVITY_ARCHIVED` | 409 | New comment requested for an archived activity |
| `COMMENT_READ_CONFLICT` | 409 | A newer comment version exists than the recipient acknowledged; refresh without clearing it |
| `QUALITY_GATE_BLUR` | 422 | CV_PIPELINE §2 |
| `QUALITY_GATE_BRIGHTNESS` | 422 | CV_PIPELINE §2 |
| `QUALITY_GATE_CONTRAST` | 422 | CV_PIPELINE §2 |
| `QUALITY_GATE_RESOLUTION` | 422 | CV_PIPELINE §2 |
| `QUALITY_GATE_NO_GUIDELINES` | 422 | CV_PIPELINE §5.0 (unruled / blank paper with cursive writing but missing 3-line rulings) |
| `QUALITY_GATE_OFF_GUIDELINES` | 422 | CV_PIPELINE §5.2b (handwriting detected outside ruled penmanship guideline bands) |
| `QUALITY_GATE_SCRIPT_NOT_CURSIVE` | 422 | CV_PIPELINE §5.4 (post-segmentation cursive connectivity check: printed handwriting rejected) |
| `SEGMENTATION_COUNT_MISMATCH` | 422 | CV_PIPELINE §5.3 (post-segmentation gate) |
| `TARGET_TEXT_MISMATCH` | 422 | CV_PIPELINE §7b (HTR target text verification — detected text does not match activity target) |
| `RATE_LIMIT_EXCEEDED` | 429 | Upstream Supabase Auth email rate limit exceeded during parent invitation dispatch |
| `MODEL_INFERENCE_ERROR` | 500 | ML_PIPELINE §9's `ModelInferenceError` |
| `INTERNAL_ERROR` | 500 | Unhandled failures, or an incomplete submission deletion (Storage/database failure; retry the deletion) |
| `EMAIL_DISPATCH_UNAVAILABLE` | 503 | Authenticated internal email dispatch is disabled; no queue claims or sends occur |

### 2.5 Actor-Derived Fields

Any field describing *who did something* — `created_by` (activity), `uploader_id`/`uploader_role` (submission), `graded_by` (manual score) — is **derived entirely from the authenticated caller's JWT** (§2.2), never accepted as client input, even if a client happened to send it. This is a blanket rule stated once here rather than repeated in every endpoint section below.

### 2.6 CORS

- **Dev:** `https://*.vercel.app` (Vercel's per-branch/PR preview deployments, ARCHITECTURE §3) plus `http://localhost:3000`.
- **Prod:** the single production frontend origin only — no wildcard.
- Allowed methods: `GET, POST, PATCH, DELETE`. Allowed headers: `Authorization, Content-Type`. Credentials: off — the JWT travels in the `Authorization` header (§2.2), not a cookie, so `Access-Control-Allow-Credentials` is unnecessary.

---

## 3. Endpoints

### 3.1 Students

#### `POST /api/students`

**Caller:** Teacher only.

Creates a roster entry, and optionally invites a parent (ARCHITECTURE §5) in the same request. Either `section` (string) or `section_id` (UUID) may be passed; if `section_id` is supplied, `section` is populated from the linked record, or if a raw `section` string is given, the matching `public.section` is looked up or automatically provisioned (ADR 0004). The invite failing does **not** fail the whole request — a typo'd parent email shouldn't cost a teacher a correctly-entered student while moving through a class of 30.

Request:
```json
{
  "full_name": "Juan Dela Cruz",
  "section": "Sampaguita",
  "section_id": "55555555-5555-5555-5555-555555555555",
  "parent_email": "parent@example.com"
}
```
`parent_email` and `section_id` are optional.

Response (`201 Created`):
```json
{
  "id": "22222222-2222-2222-2222-222222222222",
  "full_name": "Juan Dela Cruz",
  "section": "Sampaguita",
  "section_id": "55555555-5555-5555-5555-555555555555",
  "parent_email": "parent@example.com",
  "parent_invited": true,
  "parent_invite_error": null,
  "created_at": "2026-08-08T09:00:00Z"
}
```

If `parent_email` was supplied, it is saved directly to the `student` record. If the invite call failed (malformed email, Supabase Auth error), the student is still created: `parent_invited: false`, `parent_invite_error` holds a short human-readable reason.

> **Invite mechanism (see §7 for the required DATABASE.md dependency):** this endpoint calls Supabase Auth's admin `inviteUserByEmail`, passing `{ role: "parent", full_name, student_id: <newly created student's id> }` in `raw_user_meta_data`. `handle_new_user()` (DATABASE §4.1) needs a small addition to also insert the matching `student_parent` row, atomically, when `role = "parent"` and `student_id` is present in the invite metadata — today it only creates the `parent` row, with no linking step.

#### `PATCH /api/students/{id}`

**Caller:** Teacher only, and only for a student on their own roster (§2.2 ownership check → `404` otherwise).

Partial update. Accepts `full_name`, `section`, `section_id`, and `parent_email`. When updating sections, passing `section_id` synchronizes `student.section` from `public.section.name`, and passing `section` links/creates the teacher's section (ADR 0004). Also supports adding/updating/clearing a parent email on an already-created student, saving to `student.parent_email` and triggering the invite mechanism.

Request (all fields optional):
```json
{
  "full_name": "Juan D. Cruz",
  "section": "Rosal",
  "section_id": "66666666-6666-6666-6666-666666666666",
  "parent_email": "parent@example.com"
}
```

Response (`200 OK`): same shape as `POST /students`'s response, reflecting the updated record.

#### `POST /api/students/{id}/resend-invite`

**Caller:** Teacher only, and only for a student on their own roster with an existing `parent_email`.

Re-triggers the parent invitation email via Supabase Auth admin API without modifying roster data. If upstream rate-limits occur on Supabase Auth, returns `429 RATE_LIMIT_EXCEEDED`. If the student has no linked email, returns `400 BAD_REQUEST`.

Response (`200 OK`):
```json
{
  "success": true,
  "student_id": "22222222-2222-2222-2222-222222222222",
  "parent_email": "parent@example.com",
  "parent_status": "pending",
  "message": "Parent invitation sent successfully"
}
```

#### `DELETE /api/students/{id}/teacher-link`

**Caller:** Teacher only, and only for their own `teacher_student` link — a teacher can never remove another teacher's link to a co-taught student.

Unenrolls a student from the calling teacher's roster. This is a hard delete of the `teacher_student` row only — matching DATABASE §5's framing of a roster change as "a row delete + insert." It touches **nothing else**: the `student` row, its `student_parent` link(s), and all historical `submission`/`measurement`/`manual_score` rows are untouched, both by design here and by DATABASE §1's `RESTRICT` policy on research data.

No request body — the link removed is implicitly `(caller's teacher_id, id)`.

Response (`200 OK`):
```json
{
  "student_id": "22222222-2222-2222-2222-222222222222",
  "teacher_id": "11111111-1111-1111-1111-111111111111",
  "unenrolled": true
}
```

If the link doesn't exist (already removed, or never existed), return `404` rather than a silent no-op — a double-click shouldn't quietly mask "this teacher never actually had this student."

> **Does not cascade to `student_parent`.** A parent stays linked to their child's historical progress even after a teacher unenrolls that child — parent access is independent of any specific teacher relationship. Worth stating explicitly since it's a non-obvious consequence of DATABASE §5's join-table design.

---

### 3.2 Sections

Manages relational classroom sections (`public.section`, migration `0020_class_sections.sql`, ADR 0004). Teacher-owned; section names must be unique per teacher.

#### `GET /api/sections`

**Caller:** Teacher only.

Lists all sections created by the authenticated teacher, ordered alphabetically by name, including the current count of enrolled students from the teacher's active roster.

Response (`200 OK`):
```json
[
  {
    "id": "55555555-5555-5555-5555-555555555555",
    "name": "Sampaguita",
    "student_count": 28,
    "created_at": "2026-08-08T09:00:00Z",
    "updated_at": "2026-08-08T09:00:00Z"
  }
]
```

#### `POST /api/sections`

**Caller:** Teacher only.

Creates a new class section. If the teacher already has a section with that case-insensitive name, returns `409 SECTION_NAME_EXISTS`.

Request:
```json
{
  "name": "Rosal"
}
```

Response (`200 OK`):
```json
{
  "id": "66666666-6666-6666-6666-666666666666",
  "name": "Rosal",
  "student_count": 0,
  "created_at": "2026-08-08T09:00:00Z",
  "updated_at": "2026-08-08T09:00:00Z"
}
```

#### `PATCH /api/sections/{id}`

**Caller:** Teacher only (ownership verified).

Renames a section. Updates `section.name` and automatically synchronizes the denormalized string column `student.section` for all students referencing this `section_id` (ADR 0004). If the new name collides with another of the teacher's sections, returns `409 SECTION_NAME_EXISTS`.

Request:
```json
{
  "name": "Rosal - Morning"
}
```

Response (`200 OK`): updated `SectionResponse` object.

#### `DELETE /api/sections/{id}`

**Caller:** Teacher only (ownership verified).

Permanently deletes a section. If students are currently assigned to this section (`student_count > 0`), deletion is refused with `409 SECTION_NOT_EMPTY` (referential safety).

Response (`200 OK`):
```json
{
  "success": true,
  "deleted_id": "66666666-6666-6666-6666-666666666666"
}
```

---

### 3.3 Activities

#### `POST /api/activities`

**Caller:** Teacher only. **Slice 1 contract:** implemented in the feature branch; integration verification and deployment are tracked separately in IMPLEMENTATION_STATUS.md.

Request example:

```json
{
  "title": "Loop and join practice",
  "target_text": "the quick brown fox jumps over the lazy dog",
  "instructions": "Copy each word carefully on ruled paper.",
  "is_take_home": true,
  "assignments": [{ "section_id": "55555555-5555-5555-5555-555555555555" }],
  "due_at": "2026-11-02T17:00:00+08:00",
  "close_after_due": false
}
```

Required fields: trimmed nonblank `title`, nonblank `target_text`, and a nonempty `assignments` array. Each target contains exactly one non-null UUID: `section_id` or `student_id`; unknown target keys and malformed UUIDs return `VALIDATION_ERROR` (422). Sections must belong to the caller; individual students must be on their roster. Empty/non-owned targets return `INVALID_ASSIGNMENT_TARGET` (422). Repeated exact targets are deduplicated; overlapping section/student targets are permitted.

`instructions` and `due_at` default to null; `is_take_home` and `close_after_due` default to false. Due timestamps require an explicit offset. Closure with no due date returns `VALIDATION_ERROR` (422).

Response (201) is `ActivityResponse`: `id`, `title`, `target_text`, `instructions`, `is_take_home`, `is_archived`, `assignments` (section/student UUID pairs), `due_at`, `close_after_due`, `created_by`, and `created_at`. Dates are ISO timestamps. `created_by` comes from the authenticated actor. Both fields and targets are saved in one database transaction through a service-only RPC, after Python ownership checks.

Expected word count remains computed at processing time as `len(target_text.split())`.

#### `PATCH /api/activities/{activity_id}`

**Caller:** Owning teacher; otherwise `404 NOT_FOUND`. Accepts the same editable fields as creation. Omitted fields are preserved. `instructions: null` and `due_at: null` clear those values. Explicit null for title/target text/assignments/mode/closure is invalid. Present assignments replace the entire set atomically and cannot be empty. A legacy activity with zero targets can still receive unrelated edits with assignments omitted. To clear a due date with closure enabled, also send `close_after_due: false`.

Response (200) is the same `ActivityResponse` contract. Failed validation/replacement preserves the previous fields and targets. Archive/bulk archive/delete routes are unchanged.

---

#### `PATCH /api/activities/{activity_id}/archive`

**Caller:** Teacher only.

Toggles the archive state of an activity owned by the caller. No request body — the response carries the new state.

Response (`200 OK`):
```json
{
  "id": "33333333-3333-3333-3333-333333333333",
  "is_archived": true
}
```

If the activity doesn't exist or isn't owned by the caller → `404 NOT_FOUND`.

> **Archive is soft, delete is hard.** Archiving hides an activity from the active list but keeps its submissions and measurements queryable; `DELETE /api/activities/{activity_id}` remains the only destructive path (and is refused while submissions exist). The archive flag lives in the DB (`activity.is_archived`, migration `0012_activity_archive.sql`), not in client storage — it syncs across devices and sessions.

---

#### `POST /api/activities/bulk-archive`

**Caller:** Teacher only.

Sets `is_archived` for multiple activities in one call. IDs the caller doesn't own (or that don't exist) are skipped, not errored on — partial success is the contract, and the response reports exactly what happened.

Request:
```json
{
  "ids": ["33333333-3333-3333-3333-333333333333"],
  "archived": true
}
```

Response (`200 OK`):
```json
{
  "updated": ["33333333-3333-3333-3333-333333333333"],
  "skipped": []
}
```

An empty `ids` array is a valid no-op (`updated: [], skipped: []`).

---

#### `DELETE /api/activities/{activity_id}`

**Caller:** Teacher only (ownership verified).

Permanently deletes an activity. If any student submissions exist for this activity, deletion is strictly refused with `400 ACTIVITY_HAS_SUBMISSIONS` to safeguard research data integrity.

Response (`200 OK`):
```json
{
  "id": "33333333-3333-3333-3333-333333333333",
  "deleted": true
}
```

---

### 3.4 Submissions

**Slice 2 result visibility:** New uploads are drafts. Teacher upload responses include measurements for review; parent upload responses contain `measurement: null` and `released_at: null`. Both roles still receive the submission ID and completed status. Existing rows are backfilled as released. Parent reads of measurements, manual rubrics, raw output and diagnostics require release, including embedded and view-backed reads.

#### `POST /api/submissions`

**Caller:** Teacher or Parent (parent only for assigned take-home work for their own child). Both roles require a current roster relationship and section/direct assignment. Parent uploads are additionally blocked when `close_after_due` is true and server UTC time is strictly greater than `due_at`; exactly at due is accepted. Teachers bypass closure only. Relationship denial stays `NOT_FOUND`; assignment denial is `ACTIVITY_NOT_ASSIGNED` and closure denial is `SUBMISSIONS_CLOSED`. These checks occur before image decoding/processing or Storage writes and create no photo-rejection record. Existing photo-quality/segmentation rejections remain persisted as before.

`multipart/form-data`:
```
image: <binary file>
activity_id: "33333333-..."
student_id: "22222222-..."
bypass_text_check: false (optional)
```

- **Accepted MIME types:** `image/jpeg`, `image/png` only. Anything else → `400 UNSUPPORTED_FILE_TYPE`, checked before the quality gate even runs (this is a format check, not a quality check — it doesn't share the quality-gate's error codes).
- **Max file size:** 15 MB. Over this → `400 FILE_TOO_LARGE`. Chosen as generous headroom above a typical phone photo (2–8 MB) without inviting a pathological upload that stalls the synchronous request past CV_PIPELINE §10 / ML_PIPELINE §8's combined ~8s processing budget.
- `bypass_text_check` (optional, boolean, default `false`): If `true`, skips HTR target text verification (CV_PIPELINE §7b) even if the HTR model detects a mismatch. Allows teachers to override false-positive HTR rejections when the handwriting is legitimate but the model misreads it. Ignored if the HTR model is in stub mode.
- `uploader_id` / `uploader_role` are derived from the caller's JWT (§2.5), never accepted from the request body.

This request runs the full synchronous pipeline: upload hardening (magic-byte check, decompression-bomb cap, EXIF strip — SECURITY.md §4) → quality gate → preprocessing → segmentation → post-segmentation gate → target text verification (HTR, CV_PIPELINE §7b) → CV feature extraction → CNN inference → score computation (ARCHITECTURE §8).

**Rejection (quality gate, post-segmentation gate, or HTR target text mismatch failure) — `422 Unprocessable Entity`:**

The request was well-formed, but the photo's *content* couldn't be processed. Per ARCHITECTURE §8, the submission is still persisted (`status = 'rejected'`) even though the HTTP call fails — `error.details.submission_id` gives the frontend a reference to that record.

For `TARGET_TEXT_MISMATCH`, details include `detected_text` and `similarity_score`. The teacher can retry the submission with `bypass_text_check=true` to force processing if the rejection was a false positive.

```json
{
  "error": {
    "code": "QUALITY_GATE_BLUR",
    "message": "This photo is too blurry to analyze. Hold the camera steady and try again.",
    "details": {
      "submission_id": "44444444-4444-4444-4444-444444444444",
      "measured_value": 42.1,
      "threshold": 100
    }
  }
}
```

**Success — `201 Created`.** Same shape regardless of which `ScoreProvider` (ARCHITECTURE §10) is active — only whether `scores` and `overlay` are populated differs:

```json
{
  "submission_id": "44444444-4444-4444-4444-444444444444",
  "status": "completed",
  "measurement": {
    "aggregate": {
      "slant": { "mean": 6.8, "std": 1.4 },
      "word_spacing": { "mean": 1.93, "std": 0.15 },
      "letter_spacing": { "mean": 0.33, "std": 0.06 },
      "baseline_deviation": { "mean": 0.05, "std": 0.02 },
      "size_consistency": { "mean": 0.89, "std": 0.08 },
      "letter_formation": { "mean": 74.2, "std": 9.6 }
    },
    "scores": {
      "letter_formation_score": null,
      "size_consistency_score": null,
      "spacing_score": null,
      "slant_score": null,
      "baseline_alignment_score": null,
      "composite_score": null
    },
    "raw_output": {
      "guide_lines": { "...": "full CV_PIPELINE §8 output" },
      "lines": [ "...ML_PIPELINE §11's per-word extension, included" ]
    },
    "overlay": null
  }
}
```

In Phase 1 (`SCORING_ENGINE=manual`), `scores.*` and `overlay` are always `null`, as shown. Once `CalibratedScoreProvider` is active, the identical shape returns with those fields populated. This is a **deliberate duplication**: `measurement.aggregate` mirrors data also present inside `measurement.raw_output.aggregate`, so Phase 1's raw-measurement display (PRD §7.1) has a stable, shallow field to bind to without reaching into `raw_output`'s deeper structure. `scores` is always present with `null` values rather than the key being absent — keeping frontend code phase-agnostic (`score ?? "pending"` rather than an `if (scores)` branch).

`manual_score` never appears in this response — manual grading is a separate step, entered after the teacher reviews these raw measurements, via the endpoint below.

For new `lsd_stems_v2` measurements, `aggregate.slant.mean` and `.std` may be null when no word supplies sustained stem evidence; `scores.slant_score` and the composite score are then null as well. The same nullable values are persisted in existing measurement columns. Unsupported words have `raw_output.lines[].words[].slant_deg: null` and no slant vector. `raw_output.slant_analysis` records the method version, `measured_words`, `total_words`, and `within_word_std_deg` (RMS across measurable words). Each measured word also records `slant_std_deg` and `slant_segment_count`. Existing records without these additions retain their original measurements. See `CV_PIPELINE.md` §6.1 for interpretation and provisional tolerances.

#### `PATCH /api/submissions/{id}/manual-score`

**Caller:** Teacher only, and only the teacher who owns the student on this submission.

Enters the teacher's independent rubric grade (PRD §5/§6) — Phase 1's calibration input. All five bands are required together in one call; DESIGN §7.9's segmented-button-group UI submits all five as one screen, and DATABASE §9's columns are all `not null`.

Request:
```json
{
  "letter_formation_band": "satisfactory",
  "size_consistency_band": "developing",
  "spacing_band": "satisfactory",
  "slant_band": "excellent",
  "baseline_alignment_band": "needs_improvement"
}
```
Each value is one of `needs_improvement` | `developing` | `satisfactory` | `excellent` (DATABASE §3's `score_band` enum).

Response (`200 OK`):
```json
{
  "submission_id": "44444444-4444-4444-4444-444444444444",
  "manual_score": {
    "letter_formation_band": "satisfactory",
    "letter_formation_score": 62.5,
    "size_consistency_band": "developing",
    "size_consistency_score": 37.5,
    "spacing_band": "satisfactory",
    "spacing_score": 62.5,
    "slant_band": "excellent",
    "slant_score": 87.5,
    "baseline_alignment_band": "needs_improvement",
    "baseline_alignment_score": 12.5
  },
  "graded_by": "11111111-1111-1111-1111-111111111111",
  "created_at": "2026-08-08T09:05:00Z"
}
```
Numeric `*_score` fields are DATABASE §9's generated columns (12.5 / 37.5 / 62.5 / 87.5 band anchors) — read back, never sent by the client.

**Behavior on existing score:**
- **Called for a previously scored submission** → Idempotent update: updates the teacher's rubric bands in the existing `manual_score` row, automatically recalculating generated numeric scores, and returns `200 OK`.

**Failure modes specific to this endpoint:**
- **Called while `SCORING_ENGINE=calibrated`** → `403 MANUAL_SCORING_DISABLED`. PRD §5 states the manual-entry step is *removed* from the live product once calibration ships, not merely optional. The route stays in the codebase (useful for debugging/backfill) but is unreachable in Phase 2.

---

#### `DELETE /api/submissions/{id}`

**Caller:**
- **Teacher:** Can delete any submission attempt for students currently on their roster.
- **Parent:** Can delete **only** take-home submissions they personally uploaded (`uploader_id == caller_id`) for their linked child, provided the submission has **not yet been graded** with a `manual_score` (otherwise `409 SUBMISSION_ALREADY_GRADED`).

**Behavior:**
Performs a permanent hard-deletion of the submission attempt and all associated artifacts:
1. Validates caller authorization and role-based deletion constraints.
2. Removes the image file from Supabase Storage (`submission-images` bucket).
3. Deletes the `submission` row in Postgres. Dependent child rows (`measurement`, `manual_score`) cascade automatically via `ON DELETE CASCADE` (DATABASE §8/§9, migration `0019_submission_cascade_delete.sql`).

The database deletion and its cascades are atomic. Storage and Postgres **do not share a transaction**. Any Storage error (including a timeout after possible partial progress) returns `500 INTERNAL_ERROR` without attempting database deletion. If photo removal succeeds but the database statement is rejected, the records remain and the photo may already be absent. Retry the same deletion: an already-absent photo is a successful no-op. If a database response is lost after commit, the request may return an error even though deletion completed; a single retry then returns `404 NOT_FOUND`. Success is returned only after both stages acknowledge completion. Errors contain a fixed retry message and empty `details`; provider errors and image paths are not returned or logged.

Response (`200 OK`):
```json
{
  "id": "44444444-4444-4444-4444-444444444444",
  "deleted": true
}
```

**Failure modes specific to this endpoint:**
- **Submission not found** → `404 NOT_FOUND`.
- **Teacher not linked to student** → `403 NOT_ROSTER_TEACHER`.
- **Parent not linked to student** → `403 NOT_CHILD_PARENT`.
- **Parent was not the uploader** → `403 NOT_SUBMISSION_UPLOADER`.
- **Parent attempts to delete an already graded submission** → `409 SUBMISSION_ALREADY_GRADED`.
- **Storage or database deletion fails** → `500 INTERNAL_ERROR`; retry as described above.

---

#### `POST /api/submissions/batch-delete`

**Caller:** Teacher or Parent (applies individual deletion authorization rules to each submission).

Deletes up to 100 submission attempts. Validates IDs and checks role permissions for the entire batch before deleting anything (refuses parent deletions on already-graded items). Removes the Storage images first, then deletes the matching `submission` rows in **one Postgres statement**, cascading to `measurement` and `manual_score` atomically. Migration `0019_submission_cascade_delete.sql` must be applied.

Storage and Postgres are separate operations, with the same failure/retry contract as single deletion above. A Storage failure does not attempt database deletion, even if some photos were removed before the error. A rejected database statement preserves all database records, although photos may already be gone. Either failure returns `500 INTERNAL_ERROR`; retry the batch. A lost database response can also return an error after a successful commit; the retry then ignores already-deleted rows. There is no background retry job.

Duplicate IDs are collapsed; IDs already absent are ignored. `deleted_ids` and `deleted_count` describe rows actually deleted by the database statement, not the number requested or fetched beforehand. An entirely absent batch succeeds with an empty list and count `0`.

Request:
```json
{
  "submission_ids": [
    "44444444-4444-4444-4444-444444444444",
    "44444444-4444-4444-4444-444444444445"
  ]
}
```

Response (`200 OK`):
```json
{
  "deleted_count": 2,
  "deleted_ids": [
    "44444444-4444-4444-4444-444444444444",
    "44444444-4444-4444-4444-444444444445"
  ]
}
```

---

#### `POST /api/submissions/{submission_id}/return`

Teacher only: the activity owner must still teach the student. A historical attempt can be returned after its current assignment changes. Body:

```json
{ "reason": "incomplete", "note": "Please finish the last line.", "resubmit_due_at": "2026-11-05T16:00:00+08:00" }
```

`reason` is `wrong_worksheet`, `blurry_or_cropped`, `wrong_target_text`, `incomplete`, or `other`. Optional notes are trimmed plain text, blank becomes null, maximum 2,000 characters. Omitting `resubmit_due_at` preserves the override; explicit null restores the activity deadline. Dates require a UTC offset. Only completed attempts are returnable (`409 SUBMISSION_NOT_RETURNABLE` otherwise).

The transaction retains the image, measurements, rubric and existing release timestamp, clears a matching pin, and applies the supplied deadline change. Success (`200`) contains `submission_id`, `status: returned`, `returned_at`, `returned_by`, `return_reason`, `return_note`, `released_at`, and `effective_due_at`. Return does not automatically count an older attempt: a newer completed upload or an explicit valid pin is required.

#### `POST /api/submissions/{submission_id}/release`

Teacher only, owning the activity and roster relationship. No body. The active completed attempt must have a manual rubric or all five calibrated criterion scores. Ineligible attempts return `409 SUBMISSION_NOT_RELEASABLE`; a repeated release of the same eligible result preserves its timestamp. Success: `{ "submission_id": "<uuid>", "released_at": "<timestamp>" }`.

#### `POST /api/activities/{activity_id}/release`

Teacher owner only. No body. Atomically releases active graded drafts for eligible roster students, skipping inactive, ungraded, returned and already released attempts. Success: `{ "released_count": 1, "submission_ids": ["<uuid>"] }`. This does not create notifications or send email in Slice 2.

#### `PUT /api/activities/{activity_id}/students/{student_id}/work`

Teacher owner/roster only; the pair must be currently assigned or have submission history. Accepts a partial update containing `due_at_override` and/or `pinned_submission_id`. Omitted properties are preserved; null clears an override or pin. Empty requests, unknown properties, malformed UUIDs, and naive dates return `VALIDATION_ERROR`. A pin must reference a completed attempt for this exact activity/student (`422 INVALID_WORK_SELECTION`).

Success contains `activity_id`, `student_id`, `due_at_override`, `pinned_submission_id`, `effective_due_at`, and `updated_at`. Effective due is the student override or the activity deadline. Parent close-after-due uses this same deadline; the exact due instant remains open. Teachers may upload after due.

Lifecycle operations recheck eligibility inside short transactions using activity-then-work locks. Manual rubric writes use the same lock protocol; changed bands clear `released_at`, while saving unchanged bands preserves it. Returned rubrics remain historical evidence. Score formulas and the manual/calibrated configuration gate are unchanged.

### 3.5 Health & Config

#### `GET /api/health`

**Caller:** Unauthenticated — must be reachable by Railway's infrastructure prober, not just logged-in app users.

Response (`200 OK`):
```json
{
  "status": "ok",
  "model_loaded": true,
  "scoring_engine": "manual"
}
```

- `model_loaded` reflects whether ML_PIPELINE §8's CNN artifact loaded successfully at startup. Per ML_PIPELINE §8, the container fails startup entirely if the model fails to load — so `model_loaded: false` should never actually be observable in practice, but the field is cheap, honest, and doubles as a citable signal for the ISO/IEC 25010 "Reliability" writeup (ARCHITECTURE §15).
- `scoring_engine` mirrors the `SCORING_ENGINE` config flag (ARCHITECTURE §10) directly — `"manual"` or `"calibrated"`, no new vocabulary invented. This is how the frontend knows, at app-load time, which phase is live: whether to show Phase 2-only nav items and screens (DESIGN §6, screens 11–15), and whether the manual-score-entry UI (DESIGN §7.9) should render at all. Reused from `/health` rather than a dedicated authenticated endpoint, since "which phase the pilot is in" isn't sensitive information and doesn't warrant an eighth endpoint for a single string.

---

### 3.6 Notifications

Notifications are read directly from `public.notification` through the authenticated recipient's Supabase client and RLS. The feed is account-wide across linked children, newest first by `(created_at DESC, id DESC)`, with 20-row keyset pages and a separate exact unread count. Labels are hydrated through current RLS-protected child/activity reads. No notification-list API or browser writes are added.

#### `POST /api/notifications/{notification_id}/read`

Both roles use a verified access-token identity; no recipient body/query parameter is accepted as authority. FastAPI checks `id` and `recipient_id` before invoking `mark_notification_read`, which repeats the ownership predicate transactionally. Success: `200 { "id": "<uuid>", "read_at": "<offset-aware timestamp>" }`. Preserve the first read timestamp on repeated calls. Foreign/missing/deleted rows all return `404 NOT_FOUND`; invalid UUIDs use `422 VALIDATION_ERROR`.

#### `POST /api/notifications/read-all`

Success: `200 { "updated_count": 3, "read_at": "<offset-aware timestamp>" }`. Marks only the caller's unread rows visible to the statement with `created_at` no later than its database cutoff. Existing read timestamps are preserved; rows arriving during the operation stay unread. Empty/repeated calls return count zero. Body/query recipient IDs never select another account.

Both endpoints use `401 UNAUTHORIZED` for missing/invalid authentication and generic `500 INTERNAL_ERROR` for unexpected database failures. Bearer authentication errors preserve the standard envelope and `WWW-Authenticate: Bearer` challenge. No new error code is introduced. Browser read mutations verify their exact submitted token against the expected account and abort on account changes.

Event types: `activity_assigned`, `due_soon`, `submission_returned`, `submission_rejected`, `score_released`, `activity_missing`, `resubmitted_after_return`. Rejections go only to the parent uploader; successful parent retries resolving Return go to the activity owner. Other current events fan out to all linked parents. Release retries are silent; genuine redraft/re-release can notify again. Event inserts share the coursework RPC transaction. Module: `backend/app/api/notifications.py`; response contracts: `notification_contracts.py`.

### 3.7 Internal classroom email dispatch

`POST /api/internal/dispatch-emails` uses `X-Dispatch-Secret`, not a teacher/parent bearer token. Authenticate a nonblank configured secret before queue access. Missing/wrong authentication gives `401 UNAUTHORIZED`; valid authentication with delivery disabled gives `503 EMAIL_DISPATCH_UNAVAILABLE`. Both use fixed messages and empty details.

The server selects at most ten rows and runs at most twenty seconds. Request bodies/query parameters cannot choose a recipient, outbox ID, provider URL, or limit. Success is `200 { claimed, sent, retried, failed, skipped }`, with nonnegative integer counts for this invocation's acknowledged outcomes. An empty queue returns all zeros. A released unused or lost claim can make claimed exceed the four outcome counters. Sent means provider acceptance, not inbox delivery.

Each send follows committed claim, current eligibility, and single-use authorization RPCs. Provider HTTP occurs outside database transactions. Transient failures use the same payload/idempotency key and bounded retries; quota/credential-wide failures stop this invocation after persisting the outcome. Unexpected infrastructure failure yields sanitized `500 INTERNAL_ERROR`; earlier committed outcomes remain durable, and uncertain reservations recover through their leases. No portal calls this endpoint. Operational activation/scheduling remains separate from the API contract.

---

### 3.8 Gradebook reads and class-record CSV

Activity POST/PATCH accepts optional `points_possible` (decimal string or number, greater than zero through 9999.99, at most two decimal places). PATCH preserves omitted points; explicit null removes them. If grades exist, removal requires `confirm_remove_points: true` and clears overrides/publication. A maximum below an override rolls the entire edit back. Unchanged numeric values preserve publication.

Work PUT additionally accepts `points_override` (zero through the activity maximum; omitted preserves, null clears) and `excused` (boolean). Responses add `excused` and a safe `grade` record without its private source signature. These edits preserve rubric values and attempt/deadline selection unless those existing fields are explicitly supplied.

Teacher-owned writes, all with `Cache-Control: no-store`:

| Route | Body | Success |
|---|---|---|
| `POST /api/activities/{id}/students/{student_id}/release-grade` | `{expected_revision: positive integer}` | Grade revision, release timestamp, optional source submission, and separate `grade_released`/`rubric_released` flags |
| `POST /api/activities/{id}/assign-zero-missing` | `{student_ids?: nonempty UUID[]}`; omit for all assigned candidates | `changed_student_ids` / `skipped_student_ids`; zeros remain draft |
| `POST /api/activities/{id}/excuse-students` | `{student_ids: nonempty UUID[], excused: boolean}` | `changed_student_ids` / `skipped_student_ids` |

The release route checks the reviewed revision after synchronizing live work. A conflict requires refreshing and reviewing; clients must not silently retry with a newer revision. Points-only release may have no submission, and never creates a worksheet or rubric. Bulk activity release retains submission-only `released_count`/`submission_ids` and adds `released_grade_count`/`grade_student_ids`.

`GET /api/sections/{section_id}/gradebook` and `GET /api/sections/{section_id}/gradebook.csv` require the owning teacher. `GET /api/students/{student_id}/gradebook` requires a linked parent and groups only the selected child's work by activity owner. All three use the exact verified Bearer token with the public `SUPABASE_ANON_KEY` to read one coherent snapshot from security-invoker database RPCs. No service-role client participates in this read path. Missing/inaccessible scopes return `404 NOT_FOUND`; wrong portal role is `403 FORBIDDEN`; missing/invalid identity is `401 UNAUTHORIZED`. Transport, missing-key and malformed-snapshot failures return sanitized `500 INTERNAL_ERROR`, never an empty successful book.

Teacher JSON contains section metadata, ordered relevant activities, ordered student rows, cells and totals. Parent JSON contains the selected student ID and teacher groups with one child row each. Decimal points/percentages serialize as two-place strings. Parent grades require a current released publication record; hidden/draft/stale points remain null and excluded, with no fallback to an older or automatically derived grade. Parent coursework Draft is presented as Turned in. A separately released assessment can still supply its original composite/band without publishing draft coursework points.

Teacher totals include eligible draft grades, while parent totals include only released grades. Bands-only, excused and ungraded work do not contribute. Missing work contributes only after an explicit override; zero possible included points yields percentage null. Archived activities retain their academic contribution. Source selection and point/percentage arithmetic live behind ScoreProvider, using existing recorded composites without manual-band normalization.

CSV uses the same teacher snapshot and assembler as JSON, returns UTF-8 with BOM directly in memory, and is never written to Storage. Its columns are `student_name,student_id,activity_title,activity_id,points_possible,final_points,coursework_status,publication,included,overall_percentage`. User-controlled text with spreadsheet formula prefixes is neutralized; original names/titles otherwise use CSV quoting. The attachment filename contains the section UUID only. All gradebook responses use `Cache-Control: no-store`. Request bodies/query fields cannot supply a role, teacher or alternate source score. This class-record export remains separate from the offline research exporter.

The Slice 5 execution record tracks schema/API verification and remaining write/UI work; this contract does not establish hosted deployment.

---

### 3.9 Private student-work comments

**Implementation:** FastAPI writes, caller-RLS reads and both portal integrations are implemented on `feat/phase3-private-comments`. Automated/browser evidence and remaining acceptance gates are recorded in IMPLEMENTATION_STATUS.md; this contract does not establish hosted deployment.

| Method/path | Request | Success |
|---|---|---|
| `POST /api/activities/{activity_id}/students/{student_id}/comments` | `{ "body": "plain text" }` | 201 `{id,activity_id,student_id,author_role,created_at,comment_version}`; no echoed body |
| `DELETE /api/comments/{comment_id}` | No body | 204, including repeated authorized deletion |
| `PUT /api/activities/{activity_id}/students/{student_id}/comments/lock` | `{ "locked": true }`, strict boolean | 200 `{activity_id,student_id,comments_locked}` |

Identity and author role derive from verified Auth identity plus current activity ownership/parent links, never user-editable role metadata or request fields. FastAPI checks the relationship and legitimate work/history pair before a service-only transaction repeats authorization. Only the activity owner may lock; only a currently authorized author may delete their comment. A different teacher teaching the child does not inherit access. Foreign/unavailable work or comment IDs use `404 NOT_FOUND`.

Text is trimmed Unicode plain text, 1–1000 code points, with internal line breaks preserved. Blank, NUL, invalid Unicode, non-text input, and extra posting/locking fields are rejected. Deletion scrubs the body rather than editing it. Comment-only lock changes must preserve grade publication. Comment input and SDK failures use fixed safe envelopes; private values and even user-supplied extra-field names are absent from validation responses/logs.

For `POST /api/notifications/{notification_id}/read`, a `comment_posted` row requires `{ "expected_comment_version": 2 }` with a positive strict 32-bit integer. The verified recipient and expected version are rechecked transactionally. A newer coalesced version returns `409 COMMENT_READ_CONFLICT` without clearing unread state. Ordinary notices retain their no-body request and `{id,read_at}` response. Missing/invalid comment versions return `422 VALIDATION_ERROR`. Notification request fields cannot select a different recipient.

Thread reads stay under caller RLS; no service-role conversation GET route is added. `read_private_comment_thread(target_activity_id,target_student_id,before_cursor?,page_size=50)` returns activity/pair IDs, title, actual actor role, assigned/archive/lock flags, `can_post`, `can_lock`, ordered `read_only_reasons`, entries, `next_cursor`, `seen_comment_version` and recipient-only `unread_notice:{id,comment_version}|null`. Reasons are ordered unassigned, archived, locked. An assigned empty read creates no work, grade or submission.

Comment entries contain `kind,id,event_at,author_role,is_mine,body,deleted_at,comment_version`; deleted text is null. Return entries contain only `kind,id,event_at,return_reason,return_note`. SQL pages are newest-first by `(event_at,kind,id)` (`comment < return`), with Return time taken from `returned_at`. The complete cursor uses those three fields; timestamps retain microseconds. Pages accept 1–100 entries. The watermark covers only returned comments, and automatic acknowledgment additionally requires the exact alerted version to be present in the loaded window.

`list_private_comment_threads(target_activity_id?,target_student_id?,before_cursor?,page_size=50)` requires exactly one scope: the owning teacher's activity or a currently linked parent's child. It returns `rows` with pair IDs, activity title, caller-visible student label (fallback `Student`), last comment time and assignment/archive/lock flags. Its complete cursor is `(last_comment_at,student_id,activity_id)`. Retained tombstones count as history; another child's history never follows from visible activity metadata alone.

Posting checks readable participant/work first, then assignment, archive and lock. Unassignment/archive retain readable history; unarchive/reassignment preserve an explicit teacher lock. Both roles are blocked by a lock; upload closure, due dates, in-class mode, draft results and excused work do not block comments. Authorized authors can delete while posting is disabled. All-read materializes notice IDs/versions before updating; a coalesced successor stays unread. Comment notices contain no text and never enqueue email. See the [approved design](superpowers/specs/2026-11-09-phase3-private-comments-design.md) and [execution record](superpowers/plans/2026-11-09-phase3-private-comments.md).

---

## 4. Cross-Reference: Endpoints ↔ PRD §7 Modules

| Endpoint | PRD module |
|---|---|
| `POST /api/students` | §7.1 Teacher Portal — class roster management |
| `PATCH /api/students/{id}` | §7.1 Teacher Portal — class roster management |
| `POST /api/students/{id}/resend-invite` | §7.1 Teacher Portal — parent invitation management |
| `DELETE /api/students/{id}/teacher-link` | §7.1 Teacher Portal — class roster management |
| `GET /api/sections` | §7.1 Teacher Portal — section management |
| `POST /api/sections` | §7.1 Teacher Portal — section management |
| `PATCH /api/sections/{id}` | §7.1 Teacher Portal — section management |
| `DELETE /api/sections/{id}` | §7.1 Teacher Portal — section management |
| `POST /api/activities` | §7.1 Teacher Portal — activity creation |
| `PATCH /api/activities/{id}` | §7.1 Teacher Portal — activity edit |
| `PATCH /api/activities/{id}/archive` | §7.1 Teacher Portal — activity archive |
| `POST /api/activities/bulk-archive` | §7.1 Teacher Portal — activity bulk archive |
| `DELETE /api/activities/{id}` | §7.1 Teacher Portal — activity deletion |
| `POST /api/submissions` | §7.1 submission upload; §7.2 Parent Portal — take-home upload |
| `PATCH /api/submissions/{id}/manual-score` | §7.1 Teacher Portal — Phase 1 manual rubric entry |
| `DELETE /api/submissions/{id}` | §7.1 Teacher Portal & §7.2 Parent Portal — attempt management & deletion |
| `POST /api/submissions/batch-delete` | §7.1 Teacher Portal & §7.2 Parent Portal — bulk attempt deletion |
| `GET /api/health` | Not a PRD feature — deploy/monitoring infrastructure (ARCHITECTURE §14/§15) |

Every endpoint here is organized by REST resource (§3), not by portal, since submission upload is shared by both roles (PRD §6) — this table gives the portal-oriented view without duplicating any endpoint's documentation under two headings.

---

## 5. Idempotency & Retry Behavior

`POST /submissions` is called from a phone, often in a classroom or at home over unreliable mobile data (DESIGN §7.1). If a request is sent but the response never arrives, a teacher's natural next action is to hit **Submit** again. DATABASE §7 confirms this is schema-safe — no `unique` constraint on `(activity_id, student_id)`, "multiple submissions per activity per student is a reasonable thing to allow" — so a genuine double-submit produces a false-duplicate record, not corrupted data.

**No server-side idempotency-key deduplication is built for this pilot.** At a small-cohort scale (size TBD; DATABASE §1), an occasional accidental double-submit is a minor annoyance — wasted processing time, one duplicate for a teacher to grade in Phase 1 — not a correctness threat to the Spearman's Rho dataset the way a mis-attributed or garbage-quality submission would be (which DESIGN §7.1's confirm-step and CV_PIPELINE §2's quality gate already specifically guard against). Idempotency-key infrastructure is real engineering surface not justified for a cosmetic problem on a 9-week runway.

**Mitigation is a frontend responsibility, not a backend one:** the frontend must disable the **Submit** button immediately on tap, re-enabling it only once a response (success or error) returns. This is stated explicitly here so it isn't silently assumed by whoever builds the upload screen.

---

## 6. Module Structure

Extends ARCHITECTURE §2's repo layout, which reserves `backend/app/api/` for "route handlers" without breaking it down further — filling that in here, matching the concrete module-structure sections CV_PIPELINE §9 and ML_PIPELINE §9 already establish for their own layers.

```
backend/app/api/
├── students.py       # POST /students, PATCH /students/{id}, POST /students/{id}/resend-invite, DELETE /students/{id}/teacher-link
├── sections.py       # GET/POST /sections, PATCH/DELETE /sections/{id}
├── activities.py     # POST /activities, PATCH/DELETE /activities/{id}, archive & bulk-archive
├── submissions.py    # POST /submissions, PATCH /submissions/{id}/manual-score, DELETE /submissions/{id}, POST /submissions/batch-delete
├── health.py         # GET /health
└── deps.py           # get_current_user, get_current_teacher, get_current_parent (§2.2)
```

One file per resource, matching §3's resource-based grouping. `deps.py` holds the shared auth/ownership-check dependencies in exactly one place — the same rationale DATABASE §10.1 gives for its shared RLS helper functions, just re-expressed in Python for the write path.

---

## 7. Dependencies on Other Documents

**Resolved:** `handle_new_user()` (DATABASE §4.1) now also inserts into `student_parent`, atomically, whenever the invite's `raw_user_meta_data` includes a `student_id` — which §3.1's `POST /students` / `PATCH /students/{id}` invite mechanism already passes at invite time. A parent who accepts an invite is now linked to their child's records in the same transaction that creates their account.

---

## 8. Known Risks & Open Items

- ~~The DATABASE.md `handle_new_user()` dependency (§7) is not yet implemented~~ — **Resolved**, see §7.
- **File-size/type limits (§3.3 — 15 MB, JPEG/PNG only) are starting defaults, not validated values** — chosen with zero real worksheet photos to test against, same caveat CV_PIPELINE §12 gives its own tunable constants. Revisit once real Phase 1 uploads are flowing.
- **No rate limiting anywhere in this spec** — reasonable at pilot scale (small cohort, ARCHITECTURE §15) but worth a deliberate note that it's an absence, not an oversight, in case this ever needs to scale beyond a single cohort or to multiple schools.
- **`MANUAL_SCORING_DISABLED` (§3.3) has no automated end-to-end test yet** — since `SCORING_ENGINE` hasn't actually flipped from `manual` to `calibrated` in any real environment. Worth an explicit test once calibration ships (PRD §5's "Between Phases" step) and the flag flips for the first time, not just a code review of the conditional.
- ~~`DELETE /students/{id}/teacher-link` is new scope beyond what PRD.md explicitly describes~~ — **Resolved**, PRD §7.1 now documents this capability.
