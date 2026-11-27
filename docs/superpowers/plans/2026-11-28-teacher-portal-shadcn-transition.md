# Teacher Portal shadcn/ui Transition Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` (or subagent-driven execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all remaining hand-rolled HTML controls, alert banners, cards, tables, accordions, tablists, selects, progress bars, and keyboard badges across the Teacher Portal (`/dashboard`, `/roster`, `/activities`, `/gradebook`, and global teacher modals) to the installed `base-luma` shadcn/ui primitives under `frontend/components/ui/`.

**Architecture:** Replace raw HTML primitives incrementally in four risk-ordered phases (A: Dashboard & Shell → B: Portal-wide Shared Primitives → C: Gradebook & Submission Review → D: Global Modals & Reference Guides) using only already-installed `@/components/ui/*` components backed by `@base-ui/react`. Domain-specific visualizations (4-zone rubric spectrum bars, multi-segment submission progress bars, CV range meters, SVG diagnostic overlays, and native hidden file inputs) remain custom by design.

**Tech Stack:** Next.js 16, React 19, TypeScript (`strict: true`), Tailwind CSS v4, shadcn/ui (`style: "base-luma"`, `@base-ui/react`), Lucide icons, ESLint, Impeccable design detector.

**Spec:** `DESIGN.md` (visual tokens, elevation, spacing, typography, color rules) & `docs/DESIGN.md` (teacher portal flows and accessibility targets).

---

## Global Constraints

- **Base UI (`base-luma`) composition:** Use the `render={<Element />}` prop on `@base-ui/react` triggers (`TooltipTrigger`, `SidebarMenuButton`, `DropdownMenuTrigger`, `CollapsibleTrigger`) — **never** `asChild`.
- **Preserve visual identity & accessibility:** Keep all existing `aria-*` attributes, keyboard shortcuts (`Alt+1/2/3`, `Alt+ArrowLeft/Right`, `/` search focus, `Ctrl/Cmd+K`, Gradebook grid arrow navigation), 44px mobile touch targets (`min-h-11` / `min-h-[44px]`), and `DESIGN.md` semantic tokens (`bg-band-*`, `shadow-warm`, `font-heading`, `tabular-nums`).
- **DESIGN.md bans:**
  - Never use standard red (`#EF4444`) on student scores, progress charts, or handwriting feedback.
  - Never add Lucide icons to non-interactive headers, pill badges, or stat cards.
  - Never add `max-w-*` or `container` width caps to portal layout wrappers or page roots.
  - Stay on the 4px spacing scale (`gap-1.5` / `6px` is the only exception for tight label-to-input proximity).
- **No automated frontend test suite by design (`AGENTS.md` §5):** Every task is verified via `npx eslint <changed-files>`, `npx tsc --noEmit`, `node .agent/skills/impeccable/scripts/detect.mjs --json <changed-files>`, and a targeted manual QA check against the relevant `DESIGN.md` flow.
- **No new npm packages or shadcn installs required:** All target primitives (`alert`, `accordion`, `avatar`, `badge`, `button`, `card`, `collapsible`, `empty`, `input`, `kbd`, `label`, `native-select`, `progress`, `sidebar`, `skeleton`, `table`, `tabs`, `toggle-group`) already exist in `frontend/components/ui/`.

---

## Explicitly Out of Scope (Keep Custom)

Do **not** force these domain-specific components into generic shadcn primitives:

| Component | Reason to Keep Custom |
|---|---|
| `frontend/components/shared/band-position-bar.tsx` | 4-zone rubric spectrum bar with positioned marker dot; single-track `Progress` cannot express 4 fixed zones. |
| `frontend/components/shared/diagnostic-overlay/*` | SVG canvas layers for handwriting bounding boxes, slant vectors, and baselines. |
| `frontend/components/activities/activity-card.tsx` (L347–L390) | Multi-segment stacked progress bar (`completed` + `processing` + `rejected`); single-indicator `Progress` would lose segment visibility. |
| `frontend/components/submissions/raw-measurements-table.tsx` (L435–L475) | `role="meter"` CV target-window range bar with shaded optimal window + tick marker. |
| Hidden `<input type="file">` controls (`quick-upload-dialog.tsx`, etc.) | Native mobile camera/photo capture trigger per `DESIGN.md` ("Don't build custom camera viewports"). |

---

## Progress Tracker

| Phase | Task | Surface / Scope | Risk | Status |
|---|---|---|---|---|
| **A — Dashboard & Shell** | Task 1 | Dashboard error banner & `SummaryCards` (`Alert`, `Card`, `Badge`) | Low | [x] Done |
| **A — Dashboard & Shell** | Task 2 | `ClassTable` mobile sort bar, reset buttons & skeletons (`NativeSelect`, `Label`, `Button`, `Skeleton`) | Low | [x] Done |
| **A — Dashboard & Shell** | Task 3 | `StudentDrillDownDrawer` steppers, alerts, cards, badges & empty states | Low | [x] Done |
| **A — Dashboard & Shell** | Task 4 | `TeacherSidebar` CTAs, avatars & pending badges (`Button`, `Avatar`, `Badge`) | Low | [x] Done |
| **B — Portal Quick Wins** | Task 5 | Portal-wide `<kbd>` → `Kbd` and `<details>`/`<summary>` → `Collapsible` | Low | [x] Done |
| **B — Portal Quick Wins** | Task 6 | Portal-wide raw `role="alert"` banners → `Alert` & `SubmissionCard` single-value bars → `Progress` | Low | [x] Done |
| **B — Portal Quick Wins** | Task 7 | `FilterPills` & `SearchInput` internal raw `<button>` cleanup + `ActivityReviewToolbar` | Low | [x] Done |
| **C — Gradebook & Review** | Task 8 | `TeacherGradebook` sticky grid table (`Table` primitives without breaking `sticky` / `role="grid"`) | Medium | [x] Done |
| **C — Gradebook & Review** | Task 9 | `GradebookCellButton` inline editor (`Input`, `Button`, `Badge`, `Spinner`) | Medium | [x] Done |
| **C — Gradebook & Review** | Task 10 | `SubmissionDetailContent` hand-rolled tablist → `Tabs` & `RawMeasurementsTable` cards/badges | Medium | [x] Done |
| **C — Gradebook & Review** | Task 11 | `ManualRubricEntryForm` & `WorksheetImageInspector` raw buttons/inputs | Medium | [x] Done |
| **D — Global Modals** | Task 12 | `QuickUploadDialog`, `RubricReferenceDialog` (→ `Accordion` + `Card`) & `CursiveGuideDialog` (→ `SearchInput` + `ToggleGroup` + `Button`) | Medium | [x] Done |

---

## Phase A — Teacher Dashboard (`/dashboard`) & Shell

### Task 1: Dashboard Error Alert & SummaryCards

**Files:**
- Modify: `frontend/app/(teacher)/dashboard/page.tsx:20-27,267-291`
- Modify: `frontend/components/dashboard/summary-cards.tsx:1-161`

- [ ] **Step 1: Replace raw error `<div role="alert">` in `dashboard/page.tsx` with `Alert`**

Import `Alert`, `AlertTitle`, `AlertDescription` from `@/components/ui/alert` and replace lines 268–290:

```tsx
{error && (
  <Alert variant="destructive">
    <AlertCircle className="size-4" aria-hidden="true" />
    <AlertTitle className="text-xs font-semibold">
      Couldn&apos;t load class analytics
    </AlertTitle>
    <AlertDescription className="text-xs opacity-90 leading-relaxed space-y-2">
      <p>
        We couldn&apos;t load your class scores right now. Check your internet connection and try again.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => refetch()}
        disabled={isRefetching}
        className="min-h-[40px] sm:min-h-[32px] px-3 text-xs font-medium rounded-lg border-destructive/30 hover:bg-destructive/10 text-destructive cursor-pointer"
      >
        {isRefetching ? "Retrying…" : "Try again"}
      </Button>
    </AlertDescription>
  </Alert>
)}
```

- [ ] **Step 2: Migrate `SummaryCards` containers and "Focus" label to `Card` + `Badge`**

Import `Card`, `CardContent`, `CardFooter` from `@/components/ui/card` and `Badge` from `@/components/ui/badge`:
- Loading skeletons (L40, L47): wrap with `<Card size="sm" className="... shadow-warm">` + `<CardContent>`.
- Lead "Class Average" card (L76–L115): use `<Card size="sm" className="xl:col-span-4 border-brand-200/80 dark:border-brand-800 bg-gradient-to-b from-brand-50/40 via-card to-card dark:from-brand-950/30 dark:via-card dark:to-card ring-1 ring-brand-500/20 justify-between gap-3 py-4 sm:py-5">` with `<CardContent>` and `<CardFooter className="border-t border-border/60 pt-2.5 text-xs text-muted-foreground leading-relaxed">`.
- 5 Penmanship Criteria cards (L127–L156): use `<Card size="sm" className={cn("py-3.5 sm:py-4 justify-between gap-2 transition-colors hover:border-brand-300/60 dark:hover:border-brand-800", isFocus ? "border-band-1/40 dark:border-band-1/50" : "border-border")}>` with `<CardContent className="px-3.5 sm:px-4 flex flex-col justify-between gap-2 h-full">`.
- Replace raw `<span className="text-[11px] ...">Focus</span>` (L141) with:

```tsx
{isFocus && (
  <Badge
    variant="outline"
    className="h-auto px-1.5 py-0 text-[11px] font-semibold border-band-1/40 bg-band-1/10 text-band-1-text dark:text-amber-300 shrink-0"
  >
    Focus
  </Badge>
)}
```

- [ ] **Step 3: Verify lint, types, and detector**

```powershell
cd frontend; npx eslint "app/(teacher)/dashboard/page.tsx" "components/dashboard/summary-cards.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/app/(teacher)/dashboard/page.tsx" "frontend/components/dashboard/summary-cards.tsx"
```

- [ ] **Step 4: Manual QA & commit**
  - Verify `/dashboard` desktop + mobile: Class Average hero card, 5 criteria cards, "Focus" badge alignment, and loading skeleton parity.

```bash
git add frontend/app/\(teacher\)/dashboard/page.tsx frontend/components/dashboard/summary-cards.tsx
git commit -m "refactor(ui): migrate dashboard alert and summary cards to shadcn"
```

---

### Task 2: ClassTable Mobile Sort Bar, Filter Reset Buttons & Loading Skeletons

**Files:**
- Modify: `frontend/components/dashboard/class-table.tsx:13-30,348-425,541-570`

- [ ] **Step 1: Replace raw `<select>`, `<label>`, and `<button>` in the mobile sort bar (L363–L395)**

Import `Button` (alongside `buttonVariants`) from `@/components/ui/button`, `Label` from `@/components/ui/label`, `NativeSelect`, `NativeSelectOption` from `@/components/ui/native-select`, and `Skeleton` from `@/components/ui/skeleton`:

```tsx
<div className="flex items-center justify-between gap-2">
  <Label htmlFor="mobile-student-sort" className="text-xs font-medium text-muted-foreground shrink-0">
    Sort by
  </Label>
  <div className="flex items-center gap-1.5 flex-1 max-w-[240px]">
    <NativeSelect
      id="mobile-student-sort"
      size="sm"
      value={sortField}
      onChange={(e) => onSortChange(e.target.value as SortField, "asc")}
      className="flex-1 w-full"
    >
      {COLUMNS.map((col) => (
        <NativeSelectOption key={col.field} value={col.field}>
          {col.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => onSortChange(sortField, sortDirection === "asc" ? "desc" : "asc")}
      aria-label={`Sort direction: ${sortDirection === "asc" ? "ascending" : "descending"}. Click to toggle.`}
      className="min-h-[40px] min-w-[40px] rounded-lg cursor-pointer touch-manipulation"
    >
      {sortDirection === "asc" ? (
        <ArrowUp className="size-4 text-primary" aria-hidden="true" />
      ) : (
        <ArrowDown className="size-4 text-primary" aria-hidden="true" />
      )}
    </Button>
  </div>
</div>
```

- [ ] **Step 2: Replace "Clear filters", "Reset filters", and `animate-pulse` loading divs**
  - L349 ("Clear filters"): replace raw `<button>` with `<Button type="button" variant="link" size="xs" onClick={onClearFilters} className="shrink-0 min-h-[36px] px-2 text-xs cursor-pointer">Clear filters</Button>`.
  - L412 & L557 ("Reset filters"): replace `<button className={cn(buttonVariants(...))}>` with `<Button type="button" variant="outline" size="sm" onClick={onClearFilters} ...>Reset filters</Button>`.
  - L400 (mobile loading cards) & L546 (desktop loading rows): replace `<div className="h-20 ... animate-pulse" />` and `<div className="h-6 bg-muted/60 rounded-md w-full" />` with `<Skeleton className="h-20 w-full rounded-xl" />` and `<Skeleton className="h-6 w-full rounded-md" />` (removing `animate-pulse` from `TableRow`).
  - L407 (mobile empty filter) & L553 (desktop empty filter): wrap with `<Empty>` / `<EmptyHeader>` / `<EmptyMedia>` / `<EmptyTitle>` / `<EmptyDescription>` / `<EmptyContent>` (already imported in this file).
  - *Note:* Keep the semantic row-click `<button>` inside the Student Name `TableCell` (L583) and mobile student row `<button>` (L439) as native `<button>` elements (or `Button variant="ghost"` only if it doesn't distort row layout — native semantic trigger button for full-card list rows is cleaner and preserves a11y).

- [ ] **Step 3: Verify lint, types, and detector**

```powershell
cd frontend; npx eslint "components/dashboard/class-table.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/dashboard/class-table.tsx"
```

- [ ] **Step 4: Manual QA & commit**
  - Verify mobile (`<640px`) sort dropdown + direction toggle, empty filter state, loading skeletons, and `/` shortcut focus.

```bash
git add frontend/components/dashboard/class-table.tsx
git commit -m "refactor(ui): migrate class table controls and skeletons to shadcn"
```

---

### Task 3: StudentDrillDownDrawer Primitives

**Files:**
- Modify: `frontend/components/dashboard/student-drill-down.tsx:1-822`

- [ ] **Step 1: Import `Alert`, `Badge`, `Card` primitives**

Add imports from `@/components/ui/alert`, `@/components/ui/badge`, `@/components/ui/card`.

- [ ] **Step 2: Replace non-shadcn elements in `StudentDrillDownDrawer`**
  - Prev/Next student stepper `<button>`s (L259–L282): replace with `<Button type="button" variant="outline" size="icon-sm" ... className="min-h-[36px] min-w-[36px] cursor-pointer touch-manipulation">`.
  - History tab count pill (L324): replace raw `<span>` with `<Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-xs font-bold tabular-nums">{history.length}</Badge>`.
  - Error panel (L343–L369): migrate to `<Alert variant="destructive">` or `<Empty>` with `role="alert"` so error presentation matches `DashboardPage`.
  - "Awaiting Assessment" pills (L418) and "Take-Home" pills (L620, L757): replace raw `<span>` pills with `<Badge variant="secondary" className="text-xs font-medium shrink-0">...</Badge>`.
  - Overall Performance hero card (L435–L491) and Trends chart wrapper card (L728): replace raw `<div>` card containers with `<Card size="sm">`<CardContent>...</CardContent></Card>.
  - "Expand all" (L501), "View all N" (L594), and "View latest breakdown in Overview →" (L719): replace raw `<button>`s with `<Button type="button" variant="link" size="xs" ...>`.
  - Trends `< 2` worksheets empty state (L707–L726): replace raw dashed `<div>` with `<Empty>` / `<EmptyMedia variant="icon">` / `<EmptyHeader>` / `<EmptyTitle>` / `<EmptyDescription>` / `<EmptyContent>` (already imported in this file).

- [ ] **Step 3: Verify lint, types, and detector**

```powershell
cd frontend; npx eslint "components/dashboard/student-drill-down.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/dashboard/student-drill-down.tsx"
```

- [ ] **Step 4: Manual QA & commit**
  - Open drawer for a student with 0, 1, and 2+ submissions; test `Alt+1/2/3`, `Alt+ArrowLeft/Right`, Expand/Collapse all, and clicking a recent worksheet.

```bash
git add frontend/components/dashboard/student-drill-down.tsx
git commit -m "refactor(ui): migrate student drill-down drawer elements to shadcn"
```

---

### Task 4: TeacherSidebar CTAs, Avatars & Pending Badges

**Files:**
- Modify: `frontend/components/teacher-sidebar.tsx:6-52,153-305,408-451`

- [ ] **Step 1: Import `Button`, `Badge`, `Avatar`, `AvatarFallback`, and `SidebarMenuBadge`**

Import `Button` from `@/components/ui/button`, `Badge` from `@/components/ui/badge`, `Avatar`, `AvatarFallback` from `@/components/ui/avatar`, and add `SidebarMenuBadge` to the `@/components/ui/sidebar` import.

- [ ] **Step 2: Replace raw buttons, avatar divs, and pending count spans**
  - Expanded Upload Worksheet CTA (L158–L174): replace raw `<button>` inside `TooltipTrigger render={...}` with `<Button type="button" id="quick-upload-worksheet" ... className="w-full h-11 md:h-10 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 shadow-xs cursor-pointer" />`.
  - Collapsed icon-rail Upload Worksheet CTA (L208–L223): replace raw `<button>` with `<Button type="button" size="icon" aria-label="Upload Worksheet" ... className="size-10 md:size-9 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 shadow-xs cursor-pointer" />`.
  - Expanded nav item pending count span (L292–L299): replace with `<SidebarMenuBadge className="bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border border-brand-200/60 dark:border-brand-900/60 rounded-full px-1.5 tabular-nums">{displayCount}</SidebarMenuBadge>` (or `<Badge variant="secondary">` inside the row flex container so collapsed rail mode still hides cleanly with `group-data-[collapsible=icon]:hidden`).
  - Teacher initials circles in footer trigger (L411) and dropdown header (L433): replace raw `<div>` with:

```tsx
<Avatar className="size-8 rounded-lg after:rounded-lg">
  <AvatarFallback className="rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-semibold text-xs border border-brand-200/60 dark:border-brand-900/60">
    {getInitials(user.fullName)}
  </AvatarFallback>
</Avatar>
```

- [ ] **Step 3: Verify lint, types, and detector**

```powershell
cd frontend; npx eslint "components/teacher-sidebar.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/teacher-sidebar.tsx"
```

- [ ] **Step 4: Manual QA & commit**
  - Test expanded sidebar, collapsed icon-rail (`Ctrl/Cmd+B`), mobile sheet drawer, Upload CTA tooltip + click, pending badge visibility in both states, and user dropdown menu.

```bash
git add frontend/components/teacher-sidebar.tsx
git commit -m "refactor(ui): migrate teacher sidebar CTAs, avatars, and badges to shadcn"
```

---

## Phase B — Portal-Wide Shared Primitives & Quick Wins

### Task 5: Replace All Raw `<kbd>` → `Kbd` and Raw `<details>`/`<summary>` → `Collapsible`

**Files:**
- Modify: `frontend/app/(teacher)/activities/page.tsx:415-425`
- Modify: `frontend/app/(teacher)/activities/[id]/page.tsx:1292-1305`
- Modify: `frontend/components/activities/activity-detail-hero.tsx` (raw `<kbd>`)
- Modify: `frontend/components/quick-upload-dialog.tsx:1310-1325`
- Modify: `frontend/components/submissions/quality-error-card.tsx` (raw `<kbd>`)
- Modify: `frontend/components/submissions/manual-rubric-entry-form.tsx:1000-1070`
- Modify: `frontend/components/shared/worksheet-image-inspector.tsx:605-650,1028-1040`
- Modify: `frontend/components/activities/activity-assignment-fields.tsx:169-190`
- Modify: `frontend/components/gradebook/work-grade-sheet.tsx:593-624`

- [ ] **Step 1: Replace raw `<kbd>` across all 7 files with `Kbd` from `@/components/ui/kbd`**

Import `{ Kbd } from "@/components/ui/kbd"` in each file and replace raw `<kbd className="...">...</kbd>` elements while preserving dark/light contrast overrides (e.g., on primary buttons use `className="bg-primary-foreground/15 text-primary-foreground border border-primary-foreground/30"`).

- [ ] **Step 2: Replace raw `<details>` / `<summary>` in `activity-assignment-fields.tsx` (L170–L188) and `work-grade-sheet.tsx` (L594–L620) with `Collapsible`**

`activity-assignment-fields.tsx` already imports `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`:

```tsx
{!!students?.length && (
  <Collapsible>
    <CollapsibleTrigger
      type="button"
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1 [&[data-panel-open]>svg]:rotate-180"
    >
      <ChevronDown className="size-4 transition-transform duration-200" aria-hidden="true" />
      <span>Individual students (optional)</span>
    </CollapsibleTrigger>
    <CollapsibleContent className="mt-2 flex max-h-44 flex-col gap-2 overflow-y-auto p-1">
      {/* existing student checkboxes */}
    </CollapsibleContent>
  </Collapsible>
)}
```

In `work-grade-sheet.tsx`, import `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `@/components/ui/collapsible` and wire `open={showLifecycleDetails} onOpenChange={setShowLifecycleDetails}` directly to `<Collapsible>`.

In `worksheet-image-inspector.tsx` (L608), replace the `<details>`/`<summary>` shortcut legend with `<Collapsible>` / `<CollapsibleTrigger>` / `<CollapsibleContent>`.

- [ ] **Step 3: Verify lint, types, and detector**

```powershell
cd frontend; npx eslint "app/(teacher)/activities/page.tsx" "app/(teacher)/activities/[id]/page.tsx" "components/activities/activity-detail-hero.tsx" "components/activities/activity-assignment-fields.tsx" "components/gradebook/work-grade-sheet.tsx" "components/quick-upload-dialog.tsx" "components/submissions/quality-error-card.tsx" "components/submissions/manual-rubric-entry-form.tsx" "components/shared/worksheet-image-inspector.tsx"; npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(teacher\)/activities/ frontend/components/activities/ frontend/components/gradebook/work-grade-sheet.tsx frontend/components/quick-upload-dialog.tsx frontend/components/submissions/ frontend/components/shared/worksheet-image-inspector.tsx
git commit -m "refactor(ui): unify raw kbd and details elements onto shadcn Kbd and Collapsible"
```

---

### Task 6: Portal-Wide Raw `role="alert"` Banners → `Alert` & `SubmissionCard` Bars → `Progress`

**Files:**
- Modify: `frontend/app/(teacher)/roster/page.tsx:330-355`
- Modify: `frontend/app/(teacher)/activities/page.tsx:373-395`
- Modify: `frontend/app/(teacher)/activities/[id]/page.tsx:1085-1105,1443-1465`
- Modify: `frontend/components/gradebook/teacher-gradebook.tsx:169-174`
- Modify: `frontend/components/submissions/manual-rubric-entry-form.tsx:1068-1085`
- Modify: `frontend/components/activities/submission-card.tsx:470-498`

- [ ] **Step 1: Replace raw `role="alert"` error banners with `Alert` (`variant="destructive"`)**

In `roster/page.tsx`, `activities/page.tsx`, `activities/[id]/page.tsx`, `teacher-gradebook.tsx` (L170), and `manual-rubric-entry-form.tsx` (L1071), replace hand-rolled `<div role="alert">` / `<p role="alert">` blocks with `<Alert variant="destructive">` + `<AlertTitle>` / `<AlertDescription>`.

- [ ] **Step 2: Migrate single-value 0–100% criterion bars in `submission-card.tsx` (L477–L494) to `Progress`**

Import `Progress`, `ProgressTrack`, `ProgressIndicator` from `@/components/ui/progress` (note: `@/components/ui/progress` uses `@base-ui/react/progress`, which supports custom indicator styling via `ProgressTrack` + `ProgressIndicator` directly or passing `value={score}`):

```tsx
<Progress
  value={Math.max(0, Math.min(100, score))}
  aria-label={`${c.name}: ${score}% (${c.band})`}
  className="gap-0"
>
  <ProgressTrack className="bg-muted/80 dark:bg-white/10 dark:ring-1 dark:ring-white/10 h-1.5">
    <ProgressIndicator className={cn("rounded-full motion-reduce:transition-none", c.barClass)} />
  </ProgressTrack>
</Progress>
```

*Note:* Do **not** wrap another `<ProgressTrack>` inside `<Progress>` if `Progress` already renders one internally — inspect `frontend/components/ui/progress.tsx:7-21`: `<Progress>` renders a default `<ProgressTrack><ProgressIndicator /></ProgressTrack>`, so either pass `[&_[data-slot=progress-track]]:h-1.5` + indicator color via `className` on `<Progress>`, **or** add an optional `indicatorClassName` / `trackClassName` prop to `frontend/components/ui/progress.tsx`. Adding `trackClassName` and `indicatorClassName` to `progress.tsx` keeps it clean and reusable!

- [ ] **Step 3: Verify lint, types, and detector**

```powershell
cd frontend; npx eslint "components/ui/progress.tsx" "app/(teacher)/roster/page.tsx" "app/(teacher)/activities/page.tsx" "app/(teacher)/activities/[id]/page.tsx" "components/gradebook/teacher-gradebook.tsx" "components/submissions/manual-rubric-entry-form.tsx" "components/activities/submission-card.tsx"; npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ui/progress.tsx frontend/app/\(teacher\)/ frontend/components/gradebook/teacher-gradebook.tsx frontend/components/submissions/manual-rubric-entry-form.tsx frontend/components/activities/submission-card.tsx
git commit -m "refactor(ui): migrate portal alert banners to Alert and criterion bars to Progress"
```

---

### Task 7: `FilterPills`, `SearchInput` Internals & `ActivityReviewToolbar`

**Files:**
- Modify: `frontend/components/ui/filter-pills.tsx:1-225`
- Modify: `frontend/components/ui/search-input.tsx:100-112`
- Modify: `frontend/components/activities/activity-review-toolbar.tsx`

- [ ] **Step 1: Clean up `SearchInput` clear button (L101–L110)**

Replace raw `<button>` with `<Button type="button" variant="ghost" size="icon-xs" ...>` from `@/components/ui/button`, keeping the expanded hit area `after:absolute after:-inset-2` and `tabIndex={-1}`.

- [ ] **Step 2: Clean up `FilterPills` scroll arrows & count badges (`filter-pills.tsx`)**

Keep `FilterPills`'s horizontal scroll fade mask and `scrollIntoView` behavior, and swap:
- Left/Right scroll chevrons (L140, L212) → `<Button type="button" variant="outline" size="icon-xs" ... className="... rounded-full size-7">`
- Pill buttons (L173) → `<Button type="button" variant={isSelected ? "default" : "outline"} size="sm" aria-pressed={isSelected} ...>`
- Count spans (L194) → `<Badge variant="secondary" ...>`

- [ ] **Step 3: Migrate raw `<button>`s and `<label>` in `activity-review-toolbar.tsx`**

Replace the 10 raw `<button>` controls with `<Button>` (appropriate `variant` / `size`) and raw `<label>` with `<Label>` from `@/components/ui/label`.

- [ ] **Step 4: Verify lint, types, and detector**

```powershell
cd frontend; npx eslint "components/ui/filter-pills.tsx" "components/ui/search-input.tsx" "components/activities/activity-review-toolbar.tsx"; npx tsc --noEmit
```

- [ ] **Step 5: Manual QA & commit**
  - Verify horizontal scrolling filter pills on `/dashboard`, `/roster`, `/activities`, and `/gradebook` (desktop + mobile) and review toolbar actions on `/activities/[id]`.

```bash
git add frontend/components/ui/filter-pills.tsx frontend/components/ui/search-input.tsx frontend/components/activities/activity-review-toolbar.tsx
git commit -m "refactor(ui): align FilterPills, SearchInput, and review toolbar with shadcn Button and Badge"
```

---

## Phase C — Gradebook & Submission Review (Medium Risk)

### Task 8: `TeacherGradebook` Sticky Grid Table Migration

**Files:**
- Modify: `frontend/components/ui/table.tsx:7-20`
- Modify: `frontend/components/gradebook/teacher-gradebook.tsx:650-780`

> **Critical CSS Sticky Guard:** `frontend/components/ui/table.tsx` currently wraps `<table>` in `<div data-slot="table-container" className="relative w-full overflow-x-auto">`. Wrapping `TeacherGradebook`'s `<table>` inside a second `overflow-x-auto` div breaks `thead.sticky.top-0` and `th.sticky.left-0` inside the gradebook's outer scroll container!

- [ ] **Step 1: Add opt-out `unstyledContainer` (or `disableContainer`) prop to `Table` in `frontend/components/ui/table.tsx`**

```tsx
function Table({
  className,
  disableContainer = false,
  ...props
}: React.ComponentProps<"table"> & { disableContainer?: boolean }) {
  const tableEl = (
    <table
      data-slot="table"
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  );

  if (disableContainer) return tableEl;

  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      {tableEl}
    </div>
  );
}
```

- [ ] **Step 2: Migrate raw `<table>` / `<caption>` / `<thead>` / `<tbody>` / `<tr>` / `<th>` / `<td>` / `<label>` in `teacher-gradebook.tsx` to `Table` primitives + `Label`**

Use `<Table disableContainer role="grid" aria-colcount={...} aria-rowcount={...} className="w-full border-collapse text-sm">`, `TableCaption`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, and `Label` — preserving every `sticky top-0`, `sticky left-0`, `role="row"`, `role="columnheader"`, `aria-rowindex`, `aria-colindex`, and `print:static` class verbatim.

- [ ] **Step 3: Verify lint, types, and detector**

```powershell
cd frontend; npx eslint "components/ui/table.tsx" "components/gradebook/teacher-gradebook.tsx"; npx tsc --noEmit
```

- [ ] **Step 4: Manual QA & commit**
  - Verify `/gradebook` with horizontal AND vertical scroll: sticky header row stays pinned at top, sticky Student column stays pinned on left, arrow keys (`ArrowUp/Down/Left/Right`) move focus between cells, `Enter` edits, `Space` opens sheet, and Print view (`print:static`) renders cleanly.

```bash
git add frontend/components/ui/table.tsx frontend/components/gradebook/teacher-gradebook.tsx
git commit -m "refactor(ui): migrate teacher gradebook grid to shadcn Table primitives"
```

---

### Task 9: `GradebookCellButton` Inline Score Editor & Actions

**Files:**
- Modify: `frontend/components/gradebook/gradebook-cell.tsx:1-560`

- [ ] **Step 1: Import `Button`, `Input`, `Badge`, and `Spinner`**

Import `Button` from `@/components/ui/button`, `Input` from `@/components/ui/input`, `Badge` from `@/components/ui/badge`, and `Spinner` from `@/components/ui/spinner`.

- [ ] **Step 2: Replace raw `<input>`, 6 raw `<button>`s, and status pills**
  - Inline editor `<input>` (L240): replace with `<Input ref={inputRef} type="text" inputMode="decimal" ... className={cn("h-8 w-16 rounded-sm px-1.5 text-center text-base sm:text-sm font-semibold tabular-nums", error && "border-destructive text-destructive")} aria-invalid={Boolean(error)} />`.
  - Save / Cancel `<button>`s (L261, L274): replace with `<Button type="button" variant="ghost" size="icon-xs" ... className="relative after:absolute after:-inset-1.5 size-7 cursor-pointer">`, using `<Spinner className="size-3.5" />` while `isSaving`.
  - Edit (`Pencil`) & Inspect (`SlidersHorizontal`) hover action `<button>`s in both `diagnostic` (L389, L401) and `points` (L476, L488) views: replace with `<Button type="button" variant="ghost" size="icon-xs" ... className="relative after:absolute after:-inset-1.5 size-6 text-muted-foreground hover:text-foreground hover:bg-background/80 cursor-pointer">`.
  - `"Teacher rubric" / "Calibrated"`, `"Late"`, and `"Excused"` status pills (L350, L364, L428, L451): replace raw `<span>` pills with `<Badge variant="outline" className="...">`.

- [ ] **Step 3: Verify lint, types, and detector**

```powershell
cd frontend; npx eslint "components/gradebook/gradebook-cell.tsx"; npx tsc --noEmit
```

- [ ] **Step 4: Manual QA & commit**
  - Test typing a digit directly on a focused cell, `Enter` to commit & advance down, `Escape` to cancel and restore cell focus, invalid range validation (`0–points_possible`), and touch-device action visibility.

```bash
git add frontend/components/gradebook/gradebook-cell.tsx
git commit -m "refactor(ui): migrate gradebook cell editor and actions to shadcn"
```

---

### Task 10: `SubmissionDetailContent` Tablist → `Tabs` & `RawMeasurementsTable`

**Files:**
- Modify: `frontend/components/submissions/submission-detail-content.tsx:1235-1360`
- Modify: `frontend/components/submissions/raw-measurements-table.tsx:376-499`

- [ ] **Step 1: Replace hand-rolled `role="tablist"` / `role="tab"` in `submission-detail-content.tsx` (L1250–L1296) with `Tabs`**

Import `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs` and replace the manual `ArrowLeft`/`ArrowRight`/`Home`/`End` `onKeyDown` handler and manual `role="tablist"` / `role="tab"` buttons with controlled `<Tabs value={effectiveTab} onValueChange={(v) => setRightPaneTab(v as "rubric" | "metrics" | "comments")}>`. Preserve the existing `"Unread"` badge inside the Comments `TabsTrigger` using `<Badge variant="secondary">` and keep `submission-tab-${tab.id}` / `submission-tabpanel-${tab.id}` IDs if referenced elsewhere.

- [ ] **Step 2: Migrate `RawMeasurementsTable` pending banner, cards, and benchmark pills**

In `raw-measurements-table.tsx`, import `Alert`, `AlertDescription` from `@/components/ui/alert` and `Badge` from `@/components/ui/badge`:
- Pending measurement notice (L378–L383) → `<Alert className="bg-muted/40 border-border/70 px-3 py-2 text-xs">`.
- Benchmark status pills (L420–L427) and primary value pill (L429–L431) → `<Badge variant="outline" ...>`.
- **Keep** the custom `role="meter"` target-window bar (L437–L469) untouched.

- [ ] **Step 3: Verify lint, types, and detector**

```powershell
cd frontend; npx eslint "components/submissions/submission-detail-content.tsx" "components/submissions/raw-measurements-table.tsx"; npx tsc --noEmit
```

- [ ] **Step 4: Manual QA & commit**
  - Open submission detail modal from `/dashboard` drill-down and `/activities/[id]`; switch between Assessment, Metrics, and Comments tabs via mouse and arrow keys; click criteria rows in `RawMeasurementsTable`.

```bash
git add frontend/components/submissions/submission-detail-content.tsx frontend/components/submissions/raw-measurements-table.tsx
git commit -m "refactor(ui): migrate submission detail tabs and raw measurement badges to shadcn"
```

---

### Task 11: `ManualRubricEntryForm` & `WorksheetImageInspector` Controls

**Files:**
- Modify: `frontend/components/submissions/manual-rubric-entry-form.tsx`
- Modify: `frontend/components/shared/worksheet-image-inspector.tsx`

- [ ] **Step 1: Migrate raw `<input>`, `<label>`, and `<button>` controls in `manual-rubric-entry-form.tsx`**

Import `Input` from `@/components/ui/input` and `Label` from `@/components/ui/label` (`Button` is already imported). Replace the raw `<input>` (L1508), raw `<label>`, and non-scoring utility `<button>`s with `Input`, `Label`, and `Button` (keeping rubric band selection keyboard shortcuts `1–4` and `aria-pressed`/`role` semantics intact).

- [ ] **Step 2: Migrate remaining raw `<button>` controls in `worksheet-image-inspector.tsx`**

Replace the 4 raw `<button>` controls with `Button` (`variant="outline"` / `variant="ghost"`, preserving touch target sizes and zoom/pan shortcut listeners).

- [ ] **Step 3: Verify lint, types, and detector**

```powershell
cd frontend; npx eslint "components/submissions/manual-rubric-entry-form.tsx" "components/shared/worksheet-image-inspector.tsx"; npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/components/submissions/manual-rubric-entry-form.tsx frontend/components/shared/worksheet-image-inspector.tsx
git commit -m "refactor(ui): migrate manual rubric form and worksheet inspector controls to shadcn"
```

---

## Phase D — Global Modals & Pedagogical Reference Guides

### Task 12: `QuickUploadDialog`, `RubricReferenceDialog` & `CursiveGuideDialog`

**Files:**
- Modify: `frontend/components/quick-upload-dialog.tsx:1012-1030,1148-1170,1425-1445`
- Modify: `frontend/components/rubric-reference-dialog.tsx:1-567`
- Modify: `frontend/components/cursive-guide-dialog.tsx:470-660`

- [ ] **Step 1: Migrate `QuickUploadDialog` camera `<select>`, alert banners, and raw buttons**
  - L1151–L1163: replace `<label>` + `<select>` / `<option>` with `<Label htmlFor="camera-select" className="sr-only">` + `<NativeSelect id="camera-select" size="sm">` + `<NativeSelectOption>`.
  - L1018 & L1431: replace raw `<div role="alert">` blocks with `<Alert variant="destructive">`.
  - Replace the 3 remaining raw `<button>` controls with `Button` (keep hidden `<input type="file">` raw).

- [ ] **Step 2: Migrate `RubricReferenceDialog` hand-rolled accordion & scoring band cards**
  - Import `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from `@/components/ui/accordion`, `Button` from `@/components/ui/button`, and `Card`, `CardContent` from `@/components/ui/card`.
  - Replace `expandedCriteria: Set<string>` + manual `h4 > button` + `role="region"` (L369–L513) with `<Accordion multiple value={expandedCriteria} onValueChange={(val) => setExpandedCriteria(Array.isArray(val) ? val as string[] : val ? [val as string] : [])}>`.
  - Replace "Expand all / Collapse all" raw `<button>` (L430) with `<Button type="button" variant="ghost" size="xs" ...>`.
  - Replace the 4 scoring band `<div>` boxes (L532–L560) with `<Card size="sm" className={cn("py-3.5 shadow-none", band.containerClass)}>`.

- [ ] **Step 3: Migrate `CursiveGuideDialog` search bar, case/zone segmented selectors, and buttons**
  - Import `SearchInput` from `@/components/ui/search-input`, `Button` from `@/components/ui/button`, and `ToggleGroup`, `ToggleGroupItem` from `@/components/ui/toggle-group`.
  - Replace raw `<input type="search">` + clear button (L490–L528) with `<SearchInput ref={searchInputRef} ... />`.
  - Replace hand-rolled `role="radiogroup"` segmented controls (L531+) with `<ToggleGroup>` / `<ToggleGroupItem>` (preventing empty deselection when clicked on already-active item).
  - Replace remaining utility `<button>`s (playback, mobile back, clear search) with `<Button>`.

- [ ] **Step 4: Full frontend verification pass (Definition of Done)**

```powershell
cd frontend; npx eslint .; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/quick-upload-dialog.tsx" "frontend/components/rubric-reference-dialog.tsx" "frontend/components/cursive-guide-dialog.tsx"
```

- [ ] **Step 5: Manual QA & commit**
  - Open Quick Upload (`Ctrl/Cmd+K`), Scoring Rubric (`Alt+R`), and Cursive Guide (`Alt+C`) on desktop and mobile; confirm keyboard navigation, accordion expand/collapse, search + `/` shortcut, and camera selector.

```bash
git add frontend/components/quick-upload-dialog.tsx frontend/components/rubric-reference-dialog.tsx frontend/components/cursive-guide-dialog.tsx
git commit -m "refactor(ui): migrate global teacher dialogs to shadcn primitives"
```

---

## Final Verification Checklist (Before Merging)

- [x] `cd frontend && npx eslint .` passes with 0 errors.
- [x] `cd frontend && npx tsc --noEmit` passes with 0 errors.
- [x] `node .agent/skills/impeccable/scripts/detect.mjs --json` reports no new regressions on touched files.
- [ ] Manual QA completed across `/dashboard`, `/roster`, `/activities`, `/activities/[id]`, `/gradebook`, and all global modals on desktop and mobile viewports (`<640px`).
- [x] Re-run raw-element audit across `frontend/app/(teacher)` and `frontend/components/` to confirm only explicitly out-of-scope custom elements remain.
