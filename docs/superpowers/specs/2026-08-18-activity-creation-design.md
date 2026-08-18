# Activity Creation, List, and Detail Shell

**Date:** 2026-08-18
**Status:** Approved (in-chat design review)
**Implements:** IMPLEMENTATION_STATUS.md Phase 1 → "Activity creation (freeform target text)"
**Doc pointers:** PRD §7.1, API_SPEC §3.2, DATABASE §5 (0004_activity.sql), DESIGN §6 screens 5–6, DESIGN §7.1

---

## 1. Problem

Class roster management is done. The next item in Phase 1's dependency chain is Activity creation — teachers need to define handwriting activities (freeform target text) before they can upload student submissions against them. Without this, the entire submission → CV pipeline → measurement → manual scoring flow has no anchor.

**Dependency chain:** Roster ✅ → **Activities** → Submission Upload → CV Pipeline → Raw Measurement Display → Manual Rubric Entry

---

## 2. Scope

Three deliverables:

1. **Backend:** `POST /api/activities` endpoint per API_SPEC §3.2
2. **Frontend — Activities list page** (`/activities`): card grid of teacher's activities + Create Activity dialog
3. **Frontend — Activity detail page** (`/activities/[id]`): activity info header + empty-state submissions placeholder

### Explicitly out of scope

- Activity editing or deletion (not specced in API_SPEC — activities are immutable once created; target text is what the CV post-segmentation gate compares against)
- Submission upload flow (its own IMPLEMENTATION_STATUS item, depends on the CV pipeline)
- Submission list with real data on the detail page (placeholder empty state only)

---

## 3. Backend

### 3.1 New file: `backend/app/api/activities.py`

Follows the same patterns established in `backend/app/api/students.py`:

**Pydantic model:**

```python
class ActivityCreate(BaseModel):
    target_text: str
    is_take_home: bool = False
```

**Endpoint: `POST ""`**

- Dependency: `get_current_teacher` (from `app.api.deps`)
- Inserts into `activity` table: `target_text`, `is_take_home`, `created_by` (from JWT `sub` — per API_SPEC §2.5, never accepted from request body)
- Returns the bare resource (`201 Created`) — no `{ data: ... }` wrapper per API_SPEC §2.3
- Response shape matches API_SPEC §3.2 exactly:

```json
{
  "id": "uuid",
  "target_text": "the quick brown fox",
  "is_take_home": false,
  "created_by": "teacher-uuid",
  "created_at": "2026-08-18T09:00:00Z"
}
```

**Validation:**
- `target_text` must be non-empty after trimming (Pydantic validator)
- No explicit word-count field — computed at submission-processing time as `len(target_text.split())` per API_SPEC §3.2's note

### 3.2 Router registration: `backend/app/main.py`

Add `activities_router` import and `app.include_router(activities_router, prefix="/api/activities", tags=["activities"])`.

---

## 4. Frontend — Data Layer

### 4.1 New file: `frontend/lib/hooks/use-activities.ts`

Follows the exact patterns from `frontend/lib/hooks/use-students.ts`:

**Type:**

```typescript
export interface Activity {
  id: string;
  target_text: string;
  is_take_home: boolean;
  created_by: string;
  created_at: string;
}
```

**`useActivities()` — read hook:**
- Direct Supabase read (RLS-gated: `created_by = auth.uid()` policy in 0009_rls_policies.sql)
- Query key: `["activities"]`
- Ordered by `created_at` descending (newest first — teachers want to see recent activities at the top)
- Selects: `id, target_text, is_take_home, created_by, created_at`

**`useActivity(id)` — single-record read hook:**
- Direct Supabase read, `.eq("id", id).single()`
- Query key: `["activities", id]`
- Used by the detail page

**`useCreateActivity()` — mutation:**
- Calls `POST /api/activities` via fetch (same JWT-from-session pattern as `useCreateStudent`)
- Invalidates `["activities"]` on success

---

## 5. Frontend — Activities List Page

### 5.1 File: `frontend/app/(teacher)/activities/page.tsx` (replace placeholder)

**Layout:**
- Page header: "Activities" title + "Create Activity" primary button (triggers dialog)
- Search bar filtering activities by target text (client-side, same pattern as roster's search)
- Responsive card grid: 1 column mobile → 2 columns tablet (`sm:`) → 3 columns desktop (`lg:`)

**Each activity card:**
- Truncated target text preview (2 lines max, CSS `line-clamp-2`)
- Word count badge (computed client-side: `activity.target_text.trim().split(/\s+/).length`)
- "Take-home" badge if `is_take_home === true`
- Relative created date (e.g., "2 days ago")
- Entire card is clickable → navigates to `/activities/[id]`
- Hover: subtle elevation lift (matching DESIGN §2.4's card shadow pattern)

**States:**
- **Loading:** skeleton card grid
- **Error:** error banner with retry, matching roster's pattern
- **Empty (no activities):** illustrated empty state — "No activities yet. Create your first handwriting activity to get started." with a CTA button
- **Empty (search, no results):** "No activities match your search" with clear-search action

### 5.2 New file: `frontend/components/activities/create-activity-dialog.tsx`

**Dialog form fields:**
- **Target text** — `<Textarea>` (multiline, since target text could be a sentence). Placeholder: "e.g., the quick brown fox jumps over the lazy dog"
- **Take-home toggle** — `<Switch>` with label "Take-home activity" and description "Allow parents to upload submissions for this activity"
- **Live word count** — displayed below textarea, derived from input: `text.trim().split(/\s+/).filter(Boolean).length`. Updates as teacher types.

**Behavior:**
- Submit button disabled while `target_text` is empty or mutation is pending
- On success: toast ("Activity created"), close dialog, list auto-refreshes via query invalidation
- On error: toast with error message, dialog stays open

---

## 6. Frontend — Activity Detail Page

### 6.1 New file: `frontend/app/(teacher)/activities/[id]/page.tsx`

**Data fetch:** `useActivity(id)` hook — single Supabase read

**Layout:**
- Back link/breadcrumb to `/activities`
- **Activity info header:**
  - Full target text (no truncation)
  - Word count
  - Take-home badge if applicable
  - Creation date
- **Submissions section:**
  - Section heading: "Submissions"
  - Empty state: "No submissions yet. Upload a student's handwriting to get started."
  - Disabled "Upload Submission" button (placeholder — will be wired up in the submission upload task)

**States:**
- **Loading:** skeleton layout
- **Not found:** if Supabase returns no data for the ID, show a "Activity not found" message with back link

---

## 7. Visual Design Notes

All decisions flow from DESIGN.md tokens — no new design decisions:

- Cards use `rounded-xl` + `shadow-warm` (DESIGN §2.4 — card/feedback class)
- Badges use existing shadcn Badge variants
- The take-home badge uses a distinct but non-diagnostic color (e.g., `brand-100` background, `brand-700` text)
- Word count badge is neutral/muted
- Dialog follows `rounded-2xl` + `shadow-warm` + `border` (DESIGN §2.4 — modal class)
- Empty states follow the same component pattern as roster's empty state

---

## 8. Testing & Verification

### Backend
- Lint: `uv run ruff check .`
- Endpoint testable via `/docs` (FastAPI Swagger UI at `http://localhost:8000/docs`)
- Manual test: create activity via Swagger, verify it appears in Supabase dashboard

### Frontend
- Lint: `npx eslint .`
- Type check: `npx tsc --noEmit`
- Manual QA:
  - Create activity via dialog → verify it appears in the card grid
  - Search/filter activities
  - Click card → navigate to detail page → verify activity info displays
  - Empty states render correctly (no activities, no search results)
  - Responsive behavior at mobile/tablet/desktop breakpoints
