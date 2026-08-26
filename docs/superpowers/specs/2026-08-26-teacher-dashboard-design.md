# Teacher Class-Wide Dashboard & Student Drill-Down

**Date:** 2026-08-26
**Status:** Pending review
**Implements:** IMPLEMENTATION_STATUS.md Phase 2 → "Class-wide dashboard" + "Per-student drill-down trend"
**Doc pointers:** PRD §7.1/§7.5, DESIGN §7.5–§7.8, DESIGN §8.2 (diagnostic notes), DATABASE §8–§9

---

## 1. Problem

Phase 1 teacher tooling is complete — teachers can manage rosters, create activities, upload submissions, view raw CV measurements, and enter manual rubric scores. But the `/dashboard` page is a placeholder. Teachers currently have no way to see class-wide patterns, identify which students need attention, or track an individual student's score trajectory over time.

This spec builds the two analytic views that complete the teacher's feedback loop:
1. **Class-wide dashboard** — summary cards + sortable student table (DESIGN §7.8)
2. **Per-student drill-down** — score history + trend chart in a slide-out drawer

**Phase-aware data source:** During Phase 1 (now), the only scores are from `manual_score` entries (teacher-assessed rubric bands with generated numeric midpoints: 12.5/37.5/62.5/87.5). The dashboard reads from `manual_score` now and will seamlessly switch to `measurement` calibrated scores when Phase 2's `SCORING_ENGINE=calibrated` flag is active. A visual indicator distinguishes "Teacher-assessed" from "System-generated" scores so the data source is never ambiguous.

**Dependency chain:** Roster ✅ → Activities ✅ → Submissions ✅ → CV Pipeline ✅ → Manual Rubric Entry ✅ → **Dashboard & Drill-Down**

---

## 2. Scope

### In scope

1. **Dashboard page** (`/dashboard`): replace placeholder with summary cards + class-wide student table
2. **Student drill-down drawer**: Sheet overlay opened from dashboard table rows, showing latest scores, trend chart, and submission history
3. **Shared band display components**: `BandBadge`, `BandPositionBar`, `ScoreSourceIndicator` — reusable for the Parent Portal later
4. **Dashboard data hook**: `useDashboardScores()` — aggregates student scores from `manual_score` (Phase 1) or `measurement` (Phase 2)
5. **Student history hook**: `useStudentScoreHistory()` — fetches a single student's submission + score history over time

### Explicitly out of scope

- Parent Portal (its own spec — will reuse shared components built here)
- Phase 2 diagnostic overlay / visual annotation layer
- Class-average trend chart over time (requires multiple time points; summary cards show current averages only)
- Backend changes — all reads are direct Supabase queries through `supabase-js`, RLS-gated (per API_SPEC §1)

---

## 3. Data Access

All dashboard data is fetched via direct `supabase-js` reads (per ARCHITECTURE §4 / API_SPEC §1). No new backend endpoints needed.

### 3.1 Dashboard query shape

The dashboard needs each student's **latest** scores across all their submissions. During Phase 1, scores come from `manual_score`; during Phase 2, from `measurement`.

**Phase 1 query (manual scores):**
```
student → teacher_student (filter by auth.uid())
  → submission (status = 'completed')
    → manual_score (band + generated score columns)
```

The query fetches all students on the teacher's roster, joined through `submission` → `manual_score`. Client-side aggregation computes:
- Per-student latest score per criterion (from their most recent graded submission)
- Per-student composite (average of 5 criterion scores)
- Class averages (mean of each criterion across all students who have scores)

RLS policies already handle access control — `is_teacher_of_student()` on `student`, `submission`, and `manual_score` tables (DATABASE §10.2).

### 3.2 Student history query shape

For the drill-down drawer, fetches a single student's full submission + score history:

```
submission (student_id = X, status = 'completed')
  → manual_score (all columns)
  → activity (target_text, for display)
```

Ordered by `submission.created_at` ascending, for chronological trend charting.

### 3.3 Phase switching

A simple runtime check determines which score source to use:

```typescript
// In the hook — not a build-time flag
const scoreSource = submission.measurement?.composite_score != null
  ? 'calibrated'   // Phase 2: measurement scores exist
  : 'manual';      // Phase 1: fall back to manual_score
```

This per-submission check means the dashboard works correctly even during the transition period when some submissions have calibrated scores and others only have manual scores. No config flag needed on the frontend — the data itself determines the source.

---

## 4. Dashboard Page (`/dashboard`)

### 4.1 Layout

Single scrollable page, two zones:

**Zone 1 — Summary Cards Row**

A responsive grid of 6 cards (5 criteria + 1 composite):

| Card | Label | Icon (Lucide) |
|---|---|---|
| Letter Formation | Letter Formation | `PenTool` |
| Size Consistency | Size Consistency | `Ruler` |
| Spacing | Spacing | `Space` |
| Slant | Slant | `Italic` |
| Baseline Alignment | Baseline | `AlignLeft` |
| Composite | Overall | `BarChart3` |

Each card shows:
- Criterion name + icon
- Class average score (numeric, one decimal place)
- `BandBadge` showing the band the average falls into
- `ScoreSourceIndicator` — small "Teacher-assessed" or "System-generated" label

Grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` — stacks to 2 columns on mobile, 3 on tablet, full row on desktop.

Card style: `rounded-xl shadow-warm border border-border bg-card` (DESIGN §2.4 — cards get rounded corners and soft shadows).

**Zone 2 — Class-Wide Student Table**

Standard sortable data table per DESIGN §7.8:

| Column | Content | Sortable |
|---|---|---|
| Student | Avatar + name (reuse `getAvatarColor`/`getInitials` from roster) | ✓ (alphabetical) |
| Section | Section name | ✓ |
| Letter Form. | Score + band dot | ✓ |
| Size Cons. | Score + band dot | ✓ |
| Spacing | Score + band dot | ✓ |
| Slant | Score + band dot | ✓ |
| Baseline | Score + band dot | ✓ |
| Composite | Score + band badge | ✓ |

**Score cell rendering:** Each criterion cell shows the numeric score (e.g. "62.5") alongside a small colored dot matching the band color. The composite column shows a `BandBadge` instead of just a dot, since it's the headline number.

**Sortable by weakest criterion:** Sorting a criterion column sorts ascending by that score — the lowest-scoring students float to the top, matching PRD §7.1's "sortable by weakest criterion" requirement.

**Search + filter:** Reuse existing `SearchInput` and `FilterPills` patterns from the roster page — filter by student name or section.

**Row interaction:** Clicking a row opens the student drill-down drawer. Cursor: `cursor-pointer`. Hover: subtle `bg-muted/40` highlight.

**Empty states:**
- No students on roster → "No students yet" with link to roster page
- Students exist but no submissions scored → "No scores yet. Upload and grade some worksheets to see class results here."

Table style: `rounded-none`–`rounded-sm`, 1px border only, no shadow (DESIGN §2.4 — data-dense surfaces stay sharp and flat).

### 4.2 Responsive behavior

Desktop-first design per DESIGN §4 (dashboards are desktop context). On mobile (<640px):
- Summary cards stack to 2-column grid
- Table switches to a card-based list (one card per student, stacked vertically) showing name + composite score + band badge, with criterion details collapsed behind a tap-to-expand. This avoids a horizontally-scrolling 8-column table on a phone screen.

---

## 5. Student Drill-Down Drawer

A `Sheet` (shadcn, slides from right) opened when a teacher clicks a student row in the dashboard table. Width: `sm:max-w-lg` (~32rem). Does not change the URL — teacher stays in dashboard context.

### 5.1 Sections

**A. Student Header**
- Avatar (reuse `getAvatarColor`/`getInitials`) + student name + section
- `ScoreSourceIndicator` label
- Close button (Sheet's built-in X)

**B. Latest Scores Panel**

Five rows (one per criterion), each showing:
- Criterion name
- `BandPositionBar` — the horizontal band-position indicator from DESIGN §7.5
- `BandBadge` showing the band label
- One-line diagnostic note from DESIGN §8.2's template table (matched by criterion + band)

One additional row for composite score with the same `BandPositionBar` treatment.

The diagnostic notes are the 20 static templates from DESIGN §8.2 — five criteria × four bands. They're defined as a lookup constant, not fetched from the backend.

**C. Trend Chart**

A Recharts `LineChart` with:
- X-axis: submission dates (formatted as short dates)
- Y-axis: score (0–100)
- One line per criterion (5 lines), color-coded using the existing `--chart-1` through `--chart-5` tokens
- Background reference areas for band zones (DESIGN §7.7): four horizontal bands shaded with `band-1` through `band-4` at low opacity (0.08–0.12), so a teacher can see which band each data point falls in by position alone
- Legend showing criterion names + their line colors
- Tooltip showing all 5 criterion scores + composite on hover

Minimum 2 data points to render the chart; with 0–1 points, show a friendly message: "Submit and score more worksheets to see trends here."

Uses shadcn's `ChartContainer` / `ChartTooltip` / `ChartTooltipContent` from `components/ui/chart.tsx` for consistent styling.

**D. Submission History**

Compact list below the chart. Each row:
- Date (relative: "2 days ago", "Aug 24")
- Activity target text (truncated to ~40 chars)
- Composite score + `BandBadge`
- Click → opens the existing `SubmissionDetailDialog` (reuse, no changes needed)

Ordered by most recent first. Capped at a reasonable display limit (last 20 submissions, with a "View all" expansion if more exist).

### 5.2 Loading & error states

- Skeleton loader while history data loads (consistent with existing patterns)
- Error state with retry button if the query fails

---

## 6. Shared Components

These live in `components/shared/` (or `components/dashboard/shared/`) and will be reusable for the Parent Portal, diagnostic views, and any future score display.

### 6.1 `BandBadge`

Small badge showing band name + band color. Props:
- `band: ScoreBand | null` — the enum value
- `size?: 'sm' | 'default'` — small for table cells, default for panels

Renders a `Badge` variant with:
- Background: tinted version of the band color (using existing patterns from `RUBRIC_BANDS` in `submission-detail-dialog.tsx`)
- Text: band label ("Needs Improvement", "Developing", "Satisfactory", "Excellent")
- Null/undefined: renders "Unrated" with muted styling

**Extracts and reuses** the `RUBRIC_BANDS` constant and `getBandMeta()` utility currently defined inline in `submission-detail-dialog.tsx` — these should be promoted to a shared location to avoid duplication.

### 6.2 `BandPositionBar`

Horizontal bar per DESIGN §7.5. Props:
- `score: number | null` — the numeric score (0–100)
- `showLabel?: boolean` — whether to show the numeric score alongside

Renders:
- A horizontal bar divided into 4 color zones (band-1 through band-4)
- A small marker/dot positioned at the score's location along the bar
- Optional numeric label beside the marker

The bar is purely visual — no interactive behavior.

### 6.3 `ScoreSourceIndicator`

Small label distinguishing score data source. Props:
- `source: 'manual' | 'calibrated'`

Renders:
- `manual` → small muted label "Teacher-assessed" with a `UserCheck` icon
- `calibrated` → small muted label "System-generated" with a `Cpu` icon

Subtle, non-intrusive — this is informational context, not a warning.

### 6.4 Shared utilities (`lib/utils/scoring.ts`)

Extract from `submission-detail-dialog.tsx` into a shared module:
- `RUBRIC_BANDS` constant (band metadata: colors, labels, classes)
- `RUBRIC_CRITERIA` constant (criterion keys, names, hints)
- `DIAGNOSTIC_NOTES` constant (20 templates from DESIGN §8.2)
- `getBandMeta(band)` — look up band display metadata
- `getScoreBand(score)` — convert numeric score to band
- `getBandFromScore(score: number): ScoreBand` — numeric score → band enum

---

## 7. New Hooks

### 7.1 `useDashboardScores()`

Location: `lib/hooks/use-dashboard.ts`

Fetches all students on the teacher's roster with their latest submission scores:

```typescript
const supabase = createClient();
const { data } = await supabase
  .from('student')
  .select(`
    id, full_name, section,
    submission(
      id, created_at, status,
      manual_score(
        letter_formation_band, letter_formation_score,
        size_consistency_band, size_consistency_score,
        spacing_band, spacing_score,
        slant_band, slant_score,
        baseline_alignment_band, baseline_alignment_score
      ),
      measurement(
        letter_formation_score, size_consistency_score,
        spacing_score, slant_score, baseline_alignment_score,
        composite_score
      )
    )
  `)
  .order('created_at', { referencedTable: 'submission', ascending: false });
```

Client-side processing:
1. For each student, find their latest completed submission with scores
2. Determine score source (manual vs. calibrated) per §3.3
3. Compute class averages across all students
4. Return `{ students: StudentScore[], classAverages: CriterionAverages, scoreSource: 'manual' | 'calibrated' }`

Query key: `["dashboard-scores"]`

### 7.2 `useStudentScoreHistory(studentId)`

Location: `lib/hooks/use-dashboard.ts`

Fetches a single student's full scored submission history:

```typescript
const { data } = await supabase
  .from('submission')
  .select(`
    id, created_at, status,
    activity:activity_id(target_text),
    manual_score(...),
    measurement(...)
  `)
  .eq('student_id', studentId)
  .eq('status', 'completed')
  .order('created_at', { ascending: true });
```

Returns: `SubmissionScoreHistory[]` — each entry has the submission date, activity text, and 5 criterion scores + composite + band + source.

Query key: `["student-score-history", studentId]`
Enabled: only when `studentId` is non-null (drawer is open).

---

## 8. File Inventory

### New files

| File | Purpose |
|---|---|
| `lib/utils/scoring.ts` | Shared band constants, criteria metadata, diagnostic note templates, conversion utilities |
| `lib/hooks/use-dashboard.ts` | `useDashboardScores()` + `useStudentScoreHistory()` hooks |
| `components/shared/band-badge.tsx` | `BandBadge` — colored band label component |
| `components/shared/band-position-bar.tsx` | `BandPositionBar` — horizontal score position indicator |
| `components/shared/score-source-indicator.tsx` | `ScoreSourceIndicator` — "Teacher-assessed" / "System-generated" label |
| `components/dashboard/summary-cards.tsx` | Summary cards row (5 criteria + composite) |
| `components/dashboard/class-table.tsx` | Sortable student × criterion score table |
| `components/dashboard/student-drill-down.tsx` | Sheet drawer with latest scores, trend chart, submission history |
| `components/dashboard/criterion-trend-chart.tsx` | Recharts line chart with band-zone background shading |

### Modified files

| File | Change |
|---|---|
| `app/(teacher)/dashboard/page.tsx` | Replace placeholder with real dashboard (imports + composes above components) |
| `components/submissions/submission-detail-dialog.tsx` | Extract `RUBRIC_BANDS`, `RUBRIC_CRITERIA`, `getBandMeta()`, `getScoreBand()` into `lib/utils/scoring.ts`; import from there instead of inlining |

### No changes to

- Backend (no new endpoints)
- Database/migrations (no schema changes)
- RLS policies (existing policies already grant the needed access)
- Other existing pages/components

---

## 9. Design Token Usage

All visual decisions follow established tokens (DESIGN §2):

| Element | Token/Class |
|---|---|
| Summary cards | `rounded-xl shadow-warm border-border bg-card` |
| Data table | `rounded-sm` border only, no shadow |
| Band colors | `band-1` through `band-4` (already in `globals.css`) |
| Chart line colors | `--chart-1` through `--chart-5` |
| Score numbers | `font-sans` (Inter — tabular figures for data) |
| Section headings | `font-heading` (Poppins) |
| Drill-down drawer | `Sheet` from shadcn, `rounded-2xl` |

---

## 10. Accessibility

Per DESIGN §9:
- Band indicators always pair color with text label — never color alone
- Table headers are properly scoped `<th scope="col">`
- Table rows have `aria-label` for screen readers ("Scores for [Student Name]")
- Chart includes a text-based alternative (the scores panel above it) for screen reader users
- Keyboard navigation: table rows are focusable and activatable via Enter/Space
- Drawer is a standard shadcn `Sheet` with built-in focus trap and Escape-to-close
- All interactive elements meet 40px minimum touch target on mobile (DESIGN §4)
