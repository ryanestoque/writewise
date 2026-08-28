# Parent Portal — Design Spec

**Date:** 2026-08-28
**Status:** Approved
**Implements:** PRD §7.2, DESIGN §6 screens 13–15, DESIGN §5 parent nav, IMPLEMENTATION_STATUS Phase 2 Parent Portal items

---

## 1. Summary

Build the full parent portal: a single-page child progress dashboard with latest-submission diagnostic breakdown, trend charts, take-home activity list, and a simplified inline upload dialog. Uses a lightweight top nav with child switcher (no sidebar). All reads are direct Supabase queries gated by existing RLS; the only backend change is extending `POST /api/submissions` to also accept parent callers for take-home activities.

### Design Decisions

1. **Diagnostic notes without visual overlay.** The 20 template diagnostic notes and band-position bars already exist in `lib/utils/scoring.ts` and `components/shared/`. The visual overlay annotation engine (DESIGN §7.4) is a separate "Diagnostic Engine" feature — it can layer on later without rework.
2. **Single combined page.** DESIGN §5 says "the parent's world is effectively one screen." Screens 13 (progress dashboard) and 14 (diagnostic feedback) are merged into a single scrollable `/progress` page: latest scores at top, trends below.
3. **Inline upload dialog.** The upload action lives in a dialog triggered from the take-home activity cards or nav button — not a separate page. Keeps the parent in their single-screen world.
4. **No separate settings page.** Sign-out and profile display live in the nav dropdown. Password change can use Supabase Auth's built-in flow later if needed.

### Explicitly Out of Scope

- Visual overlay annotations (DESIGN §7.4) — separate Diagnostic Engine feature
- Separate parent settings page — sign-out lives in nav dropdown
- Parent invite flow — already built as part of roster management (API_SPEC §3.1)
- `manual_score` RLS for parents — DATABASE §10 explicitly has no parent policy for this table

---

## 2. Architecture & Data Flow

### Reads (Frontend Direct → Supabase, RLS-Gated)

No new backend endpoints for reads. All parent data is served by direct Supabase queries from the frontend, gated by existing RLS policies (DATABASE §10):

| Data need | Table(s) | Existing RLS policy |
|---|---|---|
| Linked children | `student_parent` → `student` | `parent can view own links` + `parent can view own child` |
| Take-home activities | `activity` (`is_take_home = true`) | `parent can view assigned take-home activities` |
| Child's submissions | `submission` | `parent can view own child's submissions` |
| Measurements / scores | `measurement` | `parent can view own child's measurements` |
| Submission images | `storage.objects` | `parent can read own child's submission images` |
| Parent profile | `parent` | `parent can view own profile` |

### Writes (Frontend → FastAPI)

One backend change: extend `POST /api/submissions` to accept `get_current_user` (either role) instead of `get_current_teacher` only.

**Parent-specific authorization checks (Python-side, not RLS — FastAPI uses service-role key):**

1. Parent is linked to the student: `student_parent` row exists where `parent_id = caller.sub` and `student_id = request.student_id`
2. Activity has `is_take_home = true`
3. Activity's `created_by` teacher is linked to the student: `teacher_student` row exists where `teacher_id = activity.created_by` and `student_id = request.student_id`

If any check fails → `404` (per API_SPEC §2.2's "no information leak" convention).

**Implementation detail:** The endpoint signature changes from `Depends(get_current_teacher)` to `Depends(get_current_user)`. The existing teacher authorization logic moves into a role-conditional branch. Parent branch adds the three checks above. `uploader_role` is set from the JWT's role claim, matching DATABASE §7's `uploader_id` + `uploader_role` design.

---

## 3. Navigation & Layout

Per DESIGN §5: **lightweight top nav, mobile-first** — no sidebar.

```
┌──────────────────────────────────────────────────────┐
│  [Logo WriteWise]      [Child Switcher ▾]     [👤 ▾] │
└──────────────────────────────────────────────────────┘
│                                                      │
│                   <main> content                     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Top Nav Components

- **Left:** Brand logo (reuses existing `BrandLogo` component)
- **Center:** Child switcher
  - Single child: displays child's name as static text (no dropdown chrome)
  - Multiple children: `Select` dropdown with child names + sections
  - Always present, not conditional UI (DESIGN §5)
  - Queries `student_parent` → `student` on mount
  - Stores `selectedChildId` in React state, defaults to first child
- **Right:** User menu — `DropdownMenu` with parent name, email display, and "Sign Out" trigger
  - Sign-out opens a confirmation `AlertDialog` (same pattern as teacher sidebar's sign-out modal)

### Parent Layout (`(parent)/layout.tsx`)

Replaces the current bare shell. Structure:

```tsx
<ParentNav user={{ fullName, email }} />
<main className="flex-1 min-w-0 w-full px-4 sm:px-6 py-6">
  {children}
</main>
```

No `SidebarProvider` — structurally different from the teacher layout. The parent nav is a simple `<header>` with flexbox, not a shadcn sidebar.

The layout fetches the parent profile from the `parent` table (server component, same pattern as teacher layout fetching from `teacher`). Passes `fullName` and `email` to `ParentNav`.

---

## 4. Progress Page (`/progress`)

Single scrollable page, four zones top-to-bottom. All data queries are scoped to `selectedChildId` from the child switcher.

### Zone 1: Child Header

```
[Child's Full Name]
[Section]
```

Simple `<h1>` + subtitle. Updates when child switcher changes.

### Zone 2: Latest Submission Summary Card

The parent's primary read — "how did my kid do most recently?"

**Layout (card with `rounded-xl shadow-warm`):**

- **Top:** Activity name + submission date (e.g., "Week 3 Cursive Practice · Aug 25, 2026")
- **Composite score:** Horizontal `BandPositionBar` with numeric score alongside
- **Criterion breakdown list** (DESIGN §7.6): Five rows, each showing:
  - Criterion name (Letter Formation, Size Consistency, Spacing, Slant, Baseline Alignment)
  - Small `BandPositionBar` (compact variant)
  - `BandBadge`
  - One-line diagnostic note from `DIAGNOSTIC_NOTES` in `scoring.ts`, matched to the criterion's current band
- **Score source indicator:** `ScoreSourceIndicator` showing whether scores are manual or calibrated

**Empty state:** If no scored submissions exist:
> "No assessment results yet. Once a worksheet is uploaded and scored, your child's progress will appear here."

Uses the standard empty-state pattern (DESIGN §8.3): Lucide icon in `bg-brand-100 text-brand-700` badge + title + description.

### Zone 3: Trend Charts

Reuses `CriterionTrendChart` with band-shaded background zones. Shows composite (solid, heavier line) + all five criteria (dashed, lighter lines) on one chart — same configuration as the teacher's student drill-down.

Data source: a parent-scoped hook (`useChildScoreHistory`) that runs the same Supabase query as `useStudentScoreHistory`. RLS handles the access scoping — the query is identical; the parent's JWT yields only their own child's data.

**Minimum data gate:** If fewer than 2 scored submissions → show a note instead of the chart:
> "Trend charts appear after two or more scored submissions."

### Zone 4: Take-Home Activities

A card list of assigned take-home activities (`activity` where `is_take_home = true`, visible via existing RLS policy `parent can view assigned take-home activities`).

Each card shows:
- Target text (the sentence/passage the child should write)
- Creation date
- **If no submission exists for this activity + child:** "Upload Worksheet" button (opens upload dialog, pre-fills activity)
- **If a submission exists:** Status badge (completed with composite band badge, or rejected with reason)

**Empty state:**
> "No take-home activities assigned yet. Your child's teacher will assign activities here when ready."

---

## 5. Upload Dialog

Triggered from:
1. **"Upload Worksheet" button** on a take-home activity card (pre-fills `activityId`)
2. **"Upload" button** in the top nav (shows activity picker step)

### Simplified 3-Step Flow

**Step 1: Select Activity** (skipped if pre-filled from a card)
- Flat list of take-home activities (not a combobox — the list is short enough for direct selection)
- Each item shows target text + date
- Tap to select → advance to step 2

**Step 2: Capture & Preview**
- Native file input (`<input type="file" accept="image/jpeg,image/png" capture>`)
- After selection: full-size preview image
- Confirmation text: "Student: [Child Name] · Activity: [Activity Text]"
- **Retake** and **Submit** buttons (DESIGN §7.1)

**Step 3: Processing & Result**
- Same staged spinner as teacher flow (DESIGN §7.2):
  > "Checking image quality…" → "Analyzing letters…" → "Calculating scores…"
- **On success:** Brief result summary with composite band + "View Progress" button (closes dialog, page data refetches via TanStack Query invalidation)
- **On rejection (quality gate):** Inline banner with error-code-specific copy from DESIGN §7.3, plus **Retake** button

### Backend Call

Same `POST /api/submissions` endpoint. The dialog sends:
- `image`: the photo file
- `activity_id`: selected take-home activity
- `student_id`: the currently selected child from the child switcher

Authorization header carries the parent's Supabase JWT. The backend's parent branch handles the ownership/take-home checks (§2 above).

---

## 6. New & Modified Files

### New Frontend Files

| File | Purpose |
|---|---|
| `components/parent-nav.tsx` | Top nav: logo, child switcher, user menu, upload button |
| `components/parent/latest-submission-card.tsx` | Zone 2: composite bar + criterion breakdown with diagnostic notes |
| `components/parent/criterion-feedback-row.tsx` | Single criterion row: name, band bar, badge, diagnostic note |
| `components/parent/take-home-activities.tsx` | Zone 4: take-home activity card list |
| `components/parent/parent-upload-dialog.tsx` | Simplified 3-step upload dialog |
| `lib/hooks/use-parent-data.ts` | Hooks: `useLinkedChildren`, `useChildScoreHistory`, `useChildLatestScores`, `useTakeHomeActivities`, `useChildSubmissionForActivity` |

### Modified Frontend Files

| File | Change |
|---|---|
| `app/(parent)/layout.tsx` | Replace bare shell with parent nav + content layout (server component fetching parent profile) |
| `app/(parent)/progress/page.tsx` | Replace placeholder with full progress page composing all four zones |
| `components/dashboard/criterion-trend-chart.tsx` | No code change needed — already generic. May move to `components/shared/` if it feels misplaced under `dashboard/` |

### Modified Backend Files

| File | Change |
|---|---|
| `backend/app/api/submissions.py` | Change `get_current_teacher` → `get_current_user`; add role-conditional authorization (teacher branch = existing logic, parent branch = new ownership + take-home checks) |

### Reused Shared Components (No Changes)

- `components/shared/band-badge.tsx`
- `components/shared/band-position-bar.tsx`
- `components/shared/score-source-indicator.tsx`
- `components/dashboard/criterion-trend-chart.tsx`
- `lib/utils/scoring.ts` (all band/diagnostic logic)
- `components/brand-logo.tsx`

---

## 7. Data Hooks Detail

### `useLinkedChildren()`
```
Query: student_parent → student (id, full_name, section)
Filter: RLS handles it (parent_id = auth.uid())
Returns: Array<{ id, fullName, section }>
```

### `useChildLatestScores(childId)`
```
Query: submission (where student_id = childId, status = 'completed')
  → measurement (score columns)
  → manual_score (band + score columns)
  → activity (target_text)
Order: created_at DESC, limit 1
Returns: { submissionId, submissionDate, activityText, scoreSource, scores, bands }
```

Uses the same score-resolution logic as `useDashboardScores`: prefer calibrated `measurement` scores, fall back to `manual_score` converted to numeric.

### `useChildScoreHistory(childId)`
Identical query to existing `useStudentScoreHistory(studentId)` — same tables, same score-resolution logic. RLS ensures a parent only sees their own child's data.

### `useTakeHomeActivities(childId)`
```
Query: activity (where is_take_home = true)
  RLS: parent can view assigned take-home activities
Returns: Array<{ id, targetText, createdAt }>
```

### `useChildSubmissionForActivity(childId, activityId)`
```
Query: submission (where student_id = childId, activity_id = activityId)
  → measurement (score columns for status display)
Returns: { submissionId, status, compositeScore, compositeBand } | null
```

---

## 8. Responsive Behavior

Per DESIGN §4: parent portal is **mobile-first** — phone is the primary device for a parent checking their child's progress.

- **Top nav:** Stacks horizontally at all sizes. Child switcher truncates long names with ellipsis on narrow screens.
- **Latest submission card:** Full-width on mobile, max-width constrained on desktop.
- **Criterion breakdown rows:** Stack vertically; band bar + badge sit on one line, diagnostic note wraps below on narrow screens.
- **Trend chart:** `ResponsiveContainer` (Recharts) handles resize. On mobile, the legend may stack below the chart.
- **Take-home activity cards:** Single column on mobile, 2-column grid on `md:` and above.
- **Upload dialog:** Full-screen on mobile (`DialogContent` with responsive sizing), standard dialog on desktop.
- **Touch targets:** All interactive controls maintain 40px minimum height on mobile (DESIGN §4).

---

## 9. Accessibility

Per DESIGN §9:

- Color is never the sole signal — all band indicators pair color with text label
- Accessible text contrast (WCAG 2.1 AA) — all foreground text ≥ 4.5:1 ratio
- Single `<main>` landmark per view — nav is `<header>` with `<nav aria-label="Parent navigation">`
- Child switcher: `aria-label="Select child"`, selected child announced
- Trend chart: band legend pairs shaded zone with band name text
- Upload dialog: focus trapped, `aria-describedby` for confirmation text
- Visible keyboard focus rings on all interactive elements
