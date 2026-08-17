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
| `VALIDATION_ERROR` | 400 | Pydantic validation failure, normalized into this envelope via a custom exception handler |
| `UNSUPPORTED_FILE_TYPE` | 400 | Submission upload — file isn't `image/jpeg` or `image/png` (§3.3) |
| `FILE_TOO_LARGE` | 400 | Submission upload — file exceeds 15 MB (§3.3) |
| `UNAUTHORIZED` | 401 | Missing, invalid, or expired JWT |
| `FORBIDDEN` | 403 | Authenticated, but wrong role for this route |
| `MANUAL_SCORING_DISABLED` | 403 | `PATCH /submissions/{id}/manual-score` called while `SCORING_ENGINE=calibrated` (§3.3) |
| `NOT_FOUND` | 404 | Referenced `student_id` / `activity_id` / `submission_id` doesn't exist, or caller has no relationship to it (§2.2) |
| `QUALITY_GATE_BLUR` | 422 | CV_PIPELINE §2 |
| `QUALITY_GATE_BRIGHTNESS` | 422 | CV_PIPELINE §2 |
| `QUALITY_GATE_CONTRAST` | 422 | CV_PIPELINE §2 |
| `QUALITY_GATE_RESOLUTION` | 422 | CV_PIPELINE §2 |
| `SEGMENTATION_COUNT_MISMATCH` | 422 | CV_PIPELINE §5.3 (post-segmentation gate) |
| `MANUAL_SCORE_ALREADY_EXISTS` | 409 | `manual_score.submission_id` is `unique` (DATABASE §9) — no re-grade flow (§3.3) |
| `MODEL_INFERENCE_ERROR` | 500 | ML_PIPELINE §9's `ModelInferenceError` |
| `INTERNAL_ERROR` | 500 | Catch-all for unhandled failures |

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

Creates a roster entry, and optionally invites a parent (ARCHITECTURE §5) in the same request. The invite failing does **not** fail the whole request — a typo'd parent email shouldn't cost a teacher a correctly-entered student while moving through a class of 30.

Request:
```json
{
  "full_name": "Juan Dela Cruz",
  "section": "Grade 3 - Sampaguita",
  "parent_email": "parent@example.com"
}
```
`parent_email` is optional.

Response (`201 Created`):
```json
{
  "id": "22222222-2222-2222-2222-222222222222",
  "full_name": "Juan Dela Cruz",
  "section": "Grade 3 - Sampaguita",
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

Partial update. Also supports adding/updating/clearing a parent email on an already-created student, saving to `student.parent_email` and reusing the invite mechanism — covering the realistic gap where a teacher didn't have the parent's email at creation time.

Request (all fields optional):
```json
{
  "full_name": "Juan D. Cruz",
  "section": "Grade 3 - Rosal",
  "parent_email": "parent@example.com"
}
```

Response (`200 OK`): same shape as `POST /students`'s response, reflecting the updated record.

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

### 3.2 Activities

#### `POST /api/activities`

**Caller:** Teacher only.

Request:
```json
{
  "target_text": "the quick brown fox",
  "is_take_home": false
}
```

Response (`201 Created`):
```json
{
  "id": "33333333-3333-3333-3333-333333333333",
  "target_text": "the quick brown fox",
  "is_take_home": false,
  "created_by": "11111111-1111-1111-1111-111111111111",
  "created_at": "2026-08-08T09:00:00Z"
}
```

`created_by` is derived from the caller's JWT (§2.5), never accepted from the request body.

> **Expected word count is not a stored field.** CV_PIPELINE §5.3's post-segmentation gate needs "expected word count" to compare detected segmentation against — this is computed server-side at submission-processing time as `len(target_text.split())`, not stored redundantly on `activity` or entered separately by the teacher. It's a pure function of `target_text`; storing it separately would just be a second source of truth that could drift.

---

### 3.3 Submissions

#### `POST /api/submissions`

**Caller:** Teacher or Parent (parent only for a take-home activity assigned to their own child, per ARCHITECTURE §5's identity model — checked server-side).

`multipart/form-data`:
```
image: <binary file>
activity_id: "33333333-..."
student_id: "22222222-..."
```

- **Accepted MIME types:** `image/jpeg`, `image/png` only. Anything else → `400 UNSUPPORTED_FILE_TYPE`, checked before the quality gate even runs (this is a format check, not a quality check — it doesn't share the quality-gate's error codes).
- **Max file size:** 15 MB. Over this → `400 FILE_TOO_LARGE`. Chosen as generous headroom above a typical phone photo (2–8 MB) without inviting a pathological upload that stalls the synchronous request past CV_PIPELINE §10 / ML_PIPELINE §8's combined ~8s processing budget.
- `uploader_id` / `uploader_role` are derived from the caller's JWT (§2.5), never accepted from the request body.

This request runs the full synchronous pipeline: upload hardening (magic-byte check, decompression-bomb cap, EXIF strip — SECURITY.md §4) → quality gate → preprocessing → segmentation → post-segmentation gate → CV feature extraction → CNN inference → score computation (ARCHITECTURE §8).

**Rejection (quality gate or post-segmentation gate failure) — `422 Unprocessable Entity`:**

The request was well-formed, but the photo's *content* couldn't be processed. Per ARCHITECTURE §8, the submission is still persisted (`status = 'rejected'`) even though the HTTP call fails — `error.details.submission_id` gives the frontend a reference to that record.

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

**Failure modes specific to this endpoint:**
- **Called twice for the same submission** → `409 MANUAL_SCORE_ALREADY_EXISTS`. `manual_score.submission_id` is `unique` (DATABASE §9); this endpoint does not support re-grading or overwriting — no re-grade flow exists anywhere in the product, and silently allowing overwrites on data feeding the Spearman's Rho study is the wrong default.
- **Called while `SCORING_ENGINE=calibrated`** → `403 MANUAL_SCORING_DISABLED`. PRD §5 states the manual-entry step is *removed* from the live product once calibration ships, not merely optional. The route stays in the codebase (useful for debugging/backfill) but is unreachable in Phase 2.

---

### 3.4 Health & Config

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

## 4. Cross-Reference: Endpoints ↔ PRD §7 Modules

| Endpoint | PRD module |
|---|---|
| `POST /api/students` | §7.1 Teacher Portal — class roster management |
| `PATCH /api/students/{id}` | §7.1 Teacher Portal — class roster management |
| `DELETE /api/students/{id}/teacher-link` | §7.1 Teacher Portal — class roster management |
| `POST /api/activities` | §7.1 Teacher Portal — activity creation |
| `POST /api/submissions` | §7.1 submission upload; §7.2 Parent Portal — take-home upload |
| `PATCH /api/submissions/{id}/manual-score` | §7.1 Teacher Portal — Phase 1 manual rubric entry |
| `GET /api/health` | Not a PRD feature — deploy/monitoring infrastructure (ARCHITECTURE §14/§15) |

Every endpoint here is organized by REST resource (§3), not by portal, since submission upload is shared by both roles (PRD §6) — this table gives the portal-oriented view without duplicating any endpoint's documentation under two headings.

---

## 5. Idempotency & Retry Behavior

`POST /submissions` is called from a phone, often in a classroom or at home over unreliable mobile data (DESIGN §7.1). If a request is sent but the response never arrives, a teacher's natural next action is to hit **Submit** again. DATABASE §7 confirms this is schema-safe — no `unique` constraint on `(activity_id, student_id)`, "multiple submissions per activity per student is a reasonable thing to allow" — so a genuine double-submit produces a false-duplicate record, not corrupted data.

**No server-side idempotency-key deduplication is built for this pilot.** At 5 teachers / 30 students (DATABASE §1's stated scale), an occasional accidental double-submit is a minor annoyance — wasted processing time, one duplicate for a teacher to grade in Phase 1 — not a correctness threat to the Spearman's Rho dataset the way a mis-attributed or garbage-quality submission would be (which DESIGN §7.1's confirm-step and CV_PIPELINE §2's quality gate already specifically guard against). Idempotency-key infrastructure is real engineering surface not justified for a cosmetic problem on a 9-week runway.

**Mitigation is a frontend responsibility, not a backend one:** the frontend must disable the **Submit** button immediately on tap, re-enabling it only once a response (success or error) returns. This is stated explicitly here so it isn't silently assumed by whoever builds the upload screen.

---

## 6. Module Structure

Extends ARCHITECTURE §2's repo layout, which reserves `backend/app/api/` for "route handlers" without breaking it down further — filling that in here, matching the concrete module-structure sections CV_PIPELINE §9 and ML_PIPELINE §9 already establish for their own layers.

```
backend/app/api/
├── students.py       # POST /students, PATCH /students/{id}, DELETE /students/{id}/teacher-link
├── activities.py      # POST /activities
├── submissions.py      # POST /submissions, PATCH /submissions/{id}/manual-score
├── health.py            # GET /health
└── deps.py                # get_current_user, get_current_teacher, get_current_parent (§2.2)
```

One file per resource, matching §3's resource-based grouping. `deps.py` holds the shared auth/ownership-check dependencies in exactly one place — the same rationale DATABASE §10.1 gives for its shared RLS helper functions, just re-expressed in Python for the write path.

---

## 7. Dependencies on Other Documents

**Resolved:** `handle_new_user()` (DATABASE §4.1) now also inserts into `student_parent`, atomically, whenever the invite's `raw_user_meta_data` includes a `student_id` — which §3.1's `POST /students` / `PATCH /students/{id}` invite mechanism already passes at invite time. A parent who accepts an invite is now linked to their child's records in the same transaction that creates their account.

---

## 8. Known Risks & Open Items

- ~~The DATABASE.md `handle_new_user()` dependency (§7) is not yet implemented~~ — **Resolved**, see §7.
- **File-size/type limits (§3.3 — 15 MB, JPEG/PNG only) are starting defaults, not validated values** — chosen with zero real worksheet photos to test against, same caveat CV_PIPELINE §12 gives its own tunable constants. Revisit once real Phase 1 uploads are flowing.
- **No rate limiting anywhere in this spec** — reasonable at pilot scale (5 teachers, 30 students, ARCHITECTURE §15) but worth a deliberate note that it's an absence, not an oversight, in case this ever needs to scale beyond one school.
- **`MANUAL_SCORING_DISABLED` (§3.3) has no automated end-to-end test yet** — since `SCORING_ENGINE` hasn't actually flipped from `manual` to `calibrated` in any real environment. Worth an explicit test once calibration ships (PRD §5's "Between Phases" step) and the flag flips for the first time, not just a code review of the conditional.
- ~~`DELETE /students/{id}/teacher-link` is new scope beyond what PRD.md explicitly describes~~ — **Resolved**, PRD §7.1 now documents this capability.
