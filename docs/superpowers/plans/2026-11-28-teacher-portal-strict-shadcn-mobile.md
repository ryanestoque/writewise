# Teacher Portal Strict shadcn/ui & Mobile UX Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve 100% strict `base-luma` (`@base-ui/react`) shadcn/ui compliance across every Teacher Portal page, subpage, dialog, sheet, drawer, and mobile viewport — including an app-wide `sonner` → Base UI `@/components/ui/toast` cut and a dedicated mobile `/gradebook` card view (`MobileGradebookList`).

**Architecture:** Execute the transition in 5 risk-ordered vertical waves (14 independently verifiable tasks) so each file is touched once (Tier 1 raw HTML + Tier 2 strict composition/styling + Mobile viewport upgrades together) and validated via `eslint`, `tsc --noEmit`, the Impeccable design detector, a strict compliance regex scan, and desktop (`≥1280px`) + mobile (`375px`) manual QA.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript (`strict: true`), Tailwind CSS v4, shadcn/ui (`style: "base-luma"`, `@base-ui/react ^1.6.0`), Lucide icons, Recharts, ESLint, Impeccable detector.

**Spec:** `docs/superpowers/specs/2026-11-28-teacher-portal-strict-shadcn-mobile-design.md`

## Global Constraints

- **Base UI (`base-luma`) composition:** Always use `render={<Element />}` on `@base-ui/react` triggers (`TooltipTrigger`, `DropdownMenuTrigger`, `PopoverTrigger`, `CollapsibleTrigger`, `SidebarMenuButton`, `Item`, `DialogTrigger`, `DialogClose`, `Button nativeButton={false} render={<Link />}`) — **never** `asChild`. Never use Radix `data-[state=checked]:` / `data-[state=open]:` selectors.
- **Groups & Accessibility:** Wrap every `DropdownMenuItem` and `DropdownMenuSub` in `DropdownMenuGroup` (or `DropdownMenuRadioGroup` + `DropdownMenuRadioItem` for single-select menus). Wrap every `SelectItem` in `SelectGroup`. Every `Dialog`, `Sheet`, `Drawer`, and `AlertDialog` must render its `*Title`. Every direct child of `MessageScrollerContent` must be wrapped in `MessageScrollerItem`.
- **Forms & Controls:** Wrap form fields in `FieldGroup` + `Field` (`data-invalid`, `data-disabled`) + `FieldLabel` + `FieldDescription` + `FieldError`. Use `InputGroup` for inputs with addons/buttons, `ToggleGroup` for 2–7 option sets (preventing empty deselection on exclusive groups), `Toggle` for standalone binary press controls, and `ButtonGroup` for grouped steppers/pagers/zoom controls.
- **Styling & Semantic Tokens (`DESIGN.md` + `shadcn`):** Zero `space-y-*` / `space-x-*` (use `flex flex-col gap-*` / `flex items-center gap-*` on the 4px scale; `gap-1.5` only for tight label-to-input proximity); `size-*` for equal `w-* h-*`; `cn()` for conditional classes; semantic tokens instead of manual `dark:` overrides or raw Tailwind palette hues (`amber-*`, `emerald-*`, `red-*`); never use standard red (`#EF4444`) on student scores, progress charts, or handwriting feedback; no manual `z-index` on overlay content; button icons use `data-icon="inline-start|inline-end"` without manual sizing classes; pending buttons compose `<Spinner data-icon="inline-start" />` + `disabled`; full `CardHeader`/`CardTitle`/`CardContent`/`CardFooter` anatomy; no Lucide icons on non-interactive headers, pill badges, or stat cards; no `max-w-*` or `container` width caps on portal shells or page roots; keep 44px (`min-h-11`) mobile touch targets and all existing keyboard shortcuts intact.
- **Explicitly Exempt (Keep Custom):** Hidden `<input type="file">` capture controls (`quick-upload-dialog.tsx`), pure SVG layers (`guide-line-overlay.tsx`, `diagnostic-overlay/layers/*`), `<svg>` stroke canvas inside `cursive-stroke-canvas.tsx`, `band-position-bar.tsx` 4-zone gauge geometry, `activity-card.tsx` multi-segment progress bar, `raw-measurements-table.tsx` `role="meter"` range bar, and desktop `<div data-gradecell>` focus container in `gradebook-cell.tsx`.
- **Scope Guard for Non-Teacher Files:** The 8 Auth/Parent files in Task 1 are touched **only** for the `sonner` → `@/components/ui/toast` cut.
- **No Automated Frontend Test Suite (`AGENTS.md` §5):** Every task verifies with `npx eslint`, `npx tsc --noEmit`, `detect.mjs --json`, and manual QA. No new packages or shadcn CLI installs are needed (Task 1 removes `sonner`).

---

## Progress Tracker

| Wave | Task | Surface / Scope | Status |
|---|---|---|---|
| **1 — Foundation** | Task 1 | App-wide `sonner` → Base UI `@/components/ui/toast` cut (30 callers + `providers.tsx` + uninstall `sonner`) | [ ] |
| **1 — Foundation** | Task 2 | Shared UI primitives (`filter-pills`, `floating-action-bar`, `search-input`, `band-badge`, `query-recovery`, `score-source-indicator`) | [ ] |
| **2 — Shell & Modals** | Task 3 | Teacher shell (`(teacher)/layout`, `teacher-sidebar`, `teacher-modals-provider`) | [ ] |
| **2 — Shell & Modals** | Task 4 | `CursiveStrokeCanvas` toolbar (0 → 100% shadcn) & `CursiveGuideDialog` (mobile filter `Drawer`) | [ ] |
| **2 — Shell & Modals** | Task 5 | `RubricReferenceDialog`, `ShortcutsDialog`, `QuickUploadDialog` & `notifications/*` | [ ] |
| **3 — Core Pages** | Task 6 | Dashboard page, `SummaryCards`, `ClassTable` (mobile `Item` + `Field`), `CriterionTrendChart` (`ChartTooltipContent` + `ToggleGroup`), `StudentDrillDownDrawer` | [ ] |
| **3 — Core Pages** | Task 7 | Roster page (mobile `Card` + `ToggleGroup` sort), `roster/*-dialog.tsx`, `FloatingBatchBar` | [ ] |
| **3 — Core Pages** | Task 8 | Settings page & `settings/{notification,profile,security}-settings-card.tsx` (`FieldGroup`/`Field`) | [ ] |
| **4 — Review Flow** | Task 9 | Activities routes (`activities/page`, `[id]/page`, `[submissionId]/page`) & activity modals (`delete-activity-dialog` → `AlertDialog`, `create/edit`, `attempt-deletion`, `batch-release`) | [ ] |
| **4 — Review Flow** | Task 10 | Activity cards, hero, review toolbar (`ScrollArea` + `ButtonGroup`), `SubmissionCard`, `WorksheetHistory` & helpers | [ ] |
| **4 — Review Flow** | Task 11 | Submissions suite (`manual-rubric-entry-form`, `submission-detail-content` mobile sticky preview, `submission-lifecycle-controls`, `quality-error-card`, `raw-measurements-table`, `submission-rejection-card`, `activity-release-grade-preview`) | [ ] |
| **4 — Review Flow** | Task 12 | `WorksheetImageInspector`, `diagnostic-overlay/*`, `CriterionFeedbackRow`, `BandPositionBar` & `components/comments/*` | [ ] |
| **5 — Gradebook** | Task 13 | Gradebook strict shadcn sweep (`teacher-gradebook`, `gradebook-cell`, `gradebook-bulk-dialog`, `points-field`, `work-grade-details`, `work-grade-sheet`) | [ ] |
| **5 — Gradebook** | Task 14 | Dedicated mobile Gradebook card view (`mobile-gradebook-list.tsx`) + responsive wiring + final compliance gate | [ ] |

---

## Wave 1 — App-Wide Base UI Toast Cut & Shared UI Primitives

### Task 1: App-Wide `sonner` → Base UI `@/components/ui/toast` Cut

**Files:**
- Modify: `frontend/components/ui/toast.tsx:1-16,156-158`
- Modify: `frontend/components/providers.tsx:1-28`
- Modify (22 Teacher/Shared callers):
  - `frontend/app/(teacher)/activities/page.tsx`
  - `frontend/app/(teacher)/dashboard/page.tsx`
  - `frontend/app/(teacher)/roster/page.tsx`
  - `frontend/components/activities/create-activity-dialog.tsx`
  - `frontend/components/activities/delete-activity-dialog.tsx`
  - `frontend/components/activities/edit-activity-dialog.tsx`
  - `frontend/components/activities/worksheet-history.tsx`
  - `frontend/components/gradebook/gradebook-cell.tsx`
  - `frontend/components/gradebook/teacher-gradebook.tsx`
  - `frontend/components/gradebook/work-grade-sheet.tsx`
  - `frontend/components/notifications/notification-bell.tsx`
  - `frontend/components/quick-upload-dialog.tsx`
  - `frontend/components/roster/batch-move-dialog.tsx`
  - `frontend/components/roster/bulk-student-dialog.tsx`
  - `frontend/components/roster/manage-sections-dialog.tsx`
  - `frontend/components/roster/student-dialog.tsx`
  - `frontend/components/settings/profile-settings-card.tsx`
  - `frontend/components/settings/security-settings-card.tsx`
  - `frontend/components/submissions/manual-rubric-entry-form.tsx`
  - `frontend/components/submissions/submission-detail-content.tsx`
  - `frontend/components/submissions/submission-lifecycle-controls.tsx`
  - `frontend/components/teacher-modals-provider.tsx`
- Modify (8 Auth/Parent callers — toast cut only):
  - `frontend/app/accept-invite/page.tsx`
  - `frontend/app/login/page.tsx`
  - `frontend/app/reset-password/page.tsx`
  - `frontend/components/parent-nav.tsx`
  - `frontend/components/parent/parent-upload-dialog.tsx`
  - `frontend/components/parent/take-home-activities.tsx`
  - `frontend/components/parent/worksheet-view-dialog.tsx`
  - `frontend/components/settings/parent-profile-settings-card.tsx`
- Delete: `frontend/components/ui/sonner.tsx`
- Modify: `frontend/package.json` & `frontend/package-lock.json` (remove `sonner`)

**Interfaces:**
- Consumes: `toast` (`ToastPrimitive.createToastManager()`) and `Toaster` from `@/components/ui/toast`.
- Produces: Single app-wide Base UI `<Toaster />` mounted in `Providers`; zero remaining `sonner` imports.

- [ ] **Step 1: Replace `Loader2Icon` in `frontend/components/ui/toast.tsx` with `Spinner` and swap `frontend/components/providers.tsx` to `@/components/ui/toast`**

In `frontend/components/ui/toast.tsx`, remove `Loader2Icon` from the `lucide-react` import, import `{ Spinner } from "@/components/ui/spinner"`, and update line 157:

```tsx
if (type === "loading") {
  icon = <Spinner aria-hidden="true" />;
}
```

In `frontend/components/providers.tsx`, replace `import { Toaster } from "@/components/ui/sonner";` with:

```tsx
import { Toaster } from "@/components/ui/toast";
```

- [ ] **Step 2: Migrate all 30 `sonner` callers to `import { toast } from "@/components/ui/toast"`**

Apply exact mechanical conversion across all 30 files:

```tsx
// Import replacement
import { toast } from "@/components/ui/toast";

// Call conversions
toast.success(msg); // -> toast.add({ type: "success", title: msg });
toast.error(msg);   // -> toast.add({ type: "error", title: msg });
toast.warning(msg); // -> toast.add({ type: "warning", title: msg });
toast.info(msg);    // -> toast.add({ type: "info", title: msg });
```

Handle the 2 callers with option objects explicitly:

```tsx
// frontend/app/accept-invite/page.tsx (L73)
toast.add({
  type: "success",
  title: "Request message copied to clipboard!",
  description: "Paste it in an email or message to your child's teacher.",
});

// frontend/components/submissions/manual-rubric-entry-form.tsx (L589)
toast.add({
  type: "success",
  title: "Rubric recorded — advancing to next student",
  actionProps: onNavigateBack
    ? {
        children: "Undo",
        onClick: onNavigateBack,
      }
    : undefined,
});
```

- [ ] **Step 3: Delete `frontend/components/ui/sonner.tsx` and uninstall `sonner`**

```powershell
Remove-Item frontend/components/ui/sonner.tsx
Set-Location frontend; npm uninstall sonner
```

- [ ] **Step 4: Verify zero `sonner` references, lint, and type-check**

```powershell
Select-String -Path (Get-ChildItem -Path frontend/app, frontend/components, frontend/lib, frontend/hooks -Recurse -File -Include *.ts,*.tsx) -Pattern 'sonner'
```
Expected: zero output.

```powershell
Set-Location frontend; npx eslint .; npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 5: Commit**

```powershell
git add -A; if ($?) { git commit -m "refactor(ui): migrate app-wide toasts from sonner to Base UI toast" }
```

---

### Task 2: Harden Shared UI Primitives (`components/ui/*` & `components/shared/*`)

**Files:**
- Modify: `frontend/components/ui/filter-pills.tsx`
- Modify: `frontend/components/ui/floating-action-bar.tsx`
- Modify: `frontend/components/ui/search-input.tsx`
- Modify: `frontend/components/shared/band-badge.tsx`
- Modify: `frontend/components/shared/query-recovery.tsx`
- Modify: `frontend/components/shared/score-source-indicator.tsx`

**Interfaces:**
- Produces: Clean `FilterPills` (using `ScrollArea` + `ScrollBar orientation="horizontal"`), `FloatingActionBar` (built-in mobile safe-area docking so callers never override `bottom-*`), `SearchInput` (keyboard-focusable clear `InputGroupButton`), `BandBadge`, `QueryRecovery` (`Spinner` while retrying), `ScoreSourceIndicator` (keyboard-focusable `TooltipTrigger render={<Button variant="link" size="xs" />}`).

- [ ] **Step 1: Upgrade `frontend/components/ui/filter-pills.tsx` to compose `ScrollArea` + semantic styling**

Import `{ ScrollArea, ScrollBar } from "@/components/ui/scroll-area"` and replace the custom `overflow-x-auto scrollbar-none` scroll strip with `<ScrollArea>` + `<ScrollBar orientation="horizontal" className="h-1.5" />` wrapping the `<ToggleGroup>`. Remove manual `dark:` color overrides (`bg-brand-700 dark:bg-primary text-white`, `bg-white/20 dark:bg-primary-foreground/20`) on `ToggleGroupItem` and `Badge` in favor of `data-pressed:bg-primary data-pressed:text-primary-foreground` / `variant="secondary"`. Remove manual `size-4` / `size-3.5` on icons inside `Button` / `ToggleGroupItem`.

- [ ] **Step 2: Harden `frontend/components/ui/floating-action-bar.tsx` & `frontend/components/ui/search-input.tsx`**

In `floating-action-bar.tsx`:
- Update mobile fixed docking to include safe-area inset natively: `fixed inset-x-0 bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:pb-2.5` (removing arbitrary `shadow-[...]` and manual `dark:` overrides in favor of `bg-popover text-popover-foreground border-border shadow-lg`).
- Drop redundant `bg-primary hover:bg-primary/90 text-primary-foreground` overrides on the default `<Badge>`.

In `search-input.tsx`:
- Remove manual `dark:bg-input/30` on `InputGroup`.
- Remove `tabIndex={-1}` from the clear `InputGroupButton` so keyboard users can Tab to Clear as well as press `Escape`.

- [ ] **Step 3: Clean up `band-badge.tsx`, `query-recovery.tsx`, and `score-source-indicator.tsx`**

- `band-badge.tsx:46`: Replace `w-1.5 h-1.5` / `w-2 h-2` with `size-1.5` / `size-2`.
- `query-recovery.tsx:34`: Render `{isRetrying ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" aria-hidden="true" />}` inside the retry `Button`.
- `score-source-indicator.tsx:26-43`: Replace the raw-styled `TooltipTrigger` (`tabIndex={-1}`) and `text-amber-600 dark:text-amber-400` with:

```tsx
<TooltipTrigger
  render={
    <Button
      type="button"
      variant="link"
      size="xs"
      className={cn(
        "h-auto p-0 text-xs font-medium",
        isCalibrated ? "text-primary" : "text-band-2-text",
        className
      )}
    />
  }
>
  {label}
</TooltipTrigger>
```

- [ ] **Step 4: Verify lint, type-check, and Impeccable detector**

```powershell
Set-Location frontend; npx eslint "components/ui/filter-pills.tsx" "components/ui/floating-action-bar.tsx" "components/ui/search-input.tsx" "components/shared/band-badge.tsx" "components/shared/query-recovery.tsx" "components/shared/score-source-indicator.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/ui/filter-pills.tsx" "frontend/components/ui/floating-action-bar.tsx" "frontend/components/ui/search-input.tsx" "frontend/components/shared/band-badge.tsx" "frontend/components/shared/query-recovery.tsx" "frontend/components/shared/score-source-indicator.tsx"
```

- [ ] **Step 5: Commit**

```powershell
git add frontend/components/ui/filter-pills.tsx frontend/components/ui/floating-action-bar.tsx frontend/components/ui/search-input.tsx frontend/components/shared/band-badge.tsx frontend/components/shared/query-recovery.tsx frontend/components/shared/score-source-indicator.tsx; if ($?) { git commit -m "refactor(ui): harden shared shadcn filter, search, action bar, and indicator primitives" }
```

---

## Wave 2 — Shell, Global Modals, Reference Guides & Notifications

### Task 3: Teacher Shell (`(teacher)/layout`, `TeacherSidebar`, `TeacherModalsProvider`)

**Files:**
- Modify: `frontend/app/(teacher)/layout.tsx:60`
- Modify: `frontend/components/teacher-sidebar.tsx`
- Modify: `frontend/components/teacher-modals-provider.tsx:210`

- [ ] **Step 1: Replace `space-y-6` in `frontend/app/(teacher)/layout.tsx` and fix `Spinner` in `frontend/components/teacher-modals-provider.tsx`**

- `layout.tsx:60`: Replace `space-y-6` with `flex flex-col gap-6`.
- `teacher-modals-provider.tsx:210`: Replace `<Spinner className="size-4" />` inside `AlertDialogAction` with `<Spinner data-icon="inline-start" />`.

- [ ] **Step 2: Clean up `frontend/components/teacher-sidebar.tsx`**

- Collapsed icon-rail pending count (L285–292): replace raw `<span>` pill with `<Badge className="hidden group-data-[collapsible=icon]:flex absolute -top-1.5 -right-2 min-w-4 h-4 px-1 tabular-nums">{displayCount}</Badge>`.
- Expanded pending-review notice (L188–205): compose `<SidebarMenuButton render={<Link href="/activities?status=needs_review" />} />` + `<SidebarMenuBadge>{pendingReviewCount}</SidebarMenuBadge>` (removing custom styled box + raw indicator dot).
- Footer dropdown menu (L438–495): wrap user profile header in `<DropdownMenuGroup><DropdownMenuLabel className="p-2 font-normal">...</DropdownMenuLabel></DropdownMenuGroup>`, and wrap `"Sign out"` `<DropdownMenuItem>` in `<DropdownMenuGroup>`.
- Replace `group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10` (L412) with `group-data-[collapsible=icon]:size-10`.
- Add `data-icon="inline-start"` to `<Upload />` inside the expanded CTA `Button`, remove manual icon sizing classes inside `Button`/`DropdownMenuItem`, and replace manual `dark:` overrides with semantic tokens.

- [ ] **Step 3: Verify lint, type-check, and detector**

```powershell
Set-Location frontend; npx eslint "app/(teacher)/layout.tsx" "components/teacher-sidebar.tsx" "components/teacher-modals-provider.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/app/(teacher)/layout.tsx" "frontend/components/teacher-sidebar.tsx" "frontend/components/teacher-modals-provider.tsx"
```

- [ ] **Step 4: Commit**

```powershell
git add frontend/app/\(teacher\)/layout.tsx frontend/components/teacher-sidebar.tsx frontend/components/teacher-modals-provider.tsx; if ($?) { git commit -m "refactor(ui): bring teacher shell and sidebar into strict Base UI shadcn compliance" }
```

---

### Task 4: `CursiveStrokeCanvas` (0 → 100% shadcn Toolbar) & `CursiveGuideDialog` (Mobile `Drawer`)

**Files:**
- Modify: `frontend/components/cursive-stroke-canvas.tsx:1-415`
- Modify: `frontend/components/cursive-guide-dialog.tsx`

**Interfaces:**
- Preserves exact props of `CursiveStrokeCanvas` (`letterId`, `className`, etc.) and `CursiveGuideDialog` (`open`, `onOpenChange`).

- [ ] **Step 1: Migrate `frontend/components/cursive-stroke-canvas.tsx` toolbar to `ToggleGroup`, `Button`, and `Separator`**

Import `{ Button } from "@/components/ui/button"`, `{ Separator } from "@/components/ui/separator"`, and `{ ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"`. Delete `caseModes` and `handleCaseKeyDown` (L275–289 — Base UI `ToggleGroup` handles roving tabindex and arrow/Home/End navigation natively). Replace L291–404 (keeping the `<svg>` canvas on L406+ intact, replacing `space-y-2.5` with `flex flex-col gap-2.5` and dropping `dark:bg-card/90` on L407):

```tsx
<div className={cn("flex w-full flex-col gap-2.5", className)}>
  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
    <ToggleGroup
      value={[caseMode]}
      multiple={false}
      onValueChange={(vals) => {
        if (vals.length > 0) handleCaseModeChange(vals[0] as AnimationCaseMode);
      }}
      aria-label="Cursive letter case mode"
      variant="outline"
      size="sm"
    >
      <ToggleGroupItem value="lower" className="min-h-10 sm:min-h-8">
        Lower ({strokesData.lower[0] ? letterId.toLowerCase() : ""})
      </ToggleGroupItem>
      <ToggleGroupItem value="upper" className="min-h-10 sm:min-h-8">
        Upper ({letterId?.toUpperCase()})
      </ToggleGroupItem>
      <ToggleGroupItem value="both" className="min-h-10 sm:min-h-8">
        Both (Aa)
      </ToggleGroupItem>
    </ToggleGroup>

    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={togglePlay}
        className="min-h-10 sm:min-h-8"
        title={isPlaying ? "Pause animation" : isCompleted ? "Replay animation" : "Play animation"}
        aria-label={isPlaying ? "Pause animation" : isCompleted ? "Replay animation" : "Play animation"}
      >
        {isPlaying ? (
          <>
            <PauseIcon data-icon="inline-start" className="fill-current" aria-hidden="true" />
            <span>Pause</span>
          </>
        ) : (
          <>
            <PlayIcon data-icon="inline-start" className="fill-current" aria-hidden="true" />
            <span>{isCompleted ? "Replay" : "Play"}</span>
          </>
        )}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={resetAnimation}
        className="size-10 sm:size-8"
        title="Replay from start"
        aria-label="Replay from start"
      >
        <RotateCcwIcon aria-hidden="true" />
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <div className="flex items-center gap-1">
        <GaugeIcon className="hidden size-3.5 text-muted-foreground sm:block" aria-hidden="true" />
        <ToggleGroup
          value={[String(speed)]}
          multiple={false}
          onValueChange={(vals) => {
            if (vals.length > 0) handleSpeedChange(Number(vals[0]));
          }}
          aria-label="Animation playback speed"
          variant="outline"
          size="sm"
        >
          {SPEEDS.map((sp) => (
            <ToggleGroupItem
              key={sp}
              value={String(sp)}
              aria-label={`Set animation speed to ${sp}x`}
              className="min-h-10 min-w-10 sm:min-h-8 sm:min-w-0"
            >
              {sp}x
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  </div>
  {/* existing SVG ruling canvas */}
</div>
```

- [ ] **Step 2: Upgrade `frontend/components/cursive-guide-dialog.tsx` (Mobile filter `Drawer`, `ScrollArea`, `Alert`, `Badge`, `Empty`)**

Import `{ Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"`, `{ Badge } from "@/components/ui/badge"`, `{ Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer"`, `{ Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"`, `{ ScrollArea, ScrollBar } from "@/components/ui/scroll-area"`:
- **Mobile (`sm:hidden`) filters (L514–629):** Replace `isFiltersOpen` collapsible div, raw `×` active-filter `<span>`, and custom mobile scroll rail with `<Drawer showSwipeHandle>`:
  - `<DrawerTrigger render={<Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0" />} />` containing `<SlidersHorizontalIcon data-icon="inline-start" />`, `Filters`, and (when active filters exist) `<Badge variant="secondary">{activeFilterCount}</Badge>`.
  - `<DrawerContent>` with `<DrawerHeader><DrawerTitle>Filter Letters</DrawerTitle><DrawerDescription>Filter by letter case and writing zone.</DrawerDescription></DrawerHeader>`, a `<div className="flex flex-col gap-4 p-4">` containing the Case and Zone `<ToggleGroup>`s, and `<DrawerFooter>` with Reset `<Button variant="outline">` + `<DrawerClose render={<Button>Done</Button>} />`.
  - Render active filter summary chips (when a zone/case filter is active) using `<Badge variant="secondary">` + `<Button variant="ghost" size="icon-xs" aria-label="Clear filter"><XIcon /></Button>` (no raw `×`).
- **Desktop (`hidden sm:flex`) zone strip (L608):** Wrap `<ToggleGroup>` inside `<ScrollArea className="w-full">` + `<ScrollBar orientation="horizontal" />`.
- **Callouts, badges & empty state:** Replace Coaching Tip (L338–346) & Watch Out (L348–356) `<div>`s with `<Alert>` + `<AlertTitle>` + `<AlertDescription>`; replace Practice Words `<span>`s (L366–372) with `<Badge variant="outline">`; replace zero-match `<div>` (L661–674) with `<Empty>`.
- Replace all `space-y-*` with `flex flex-col gap-*`, add `data-icon` on button icons without manual sizing, and remove manual `dark:` overrides.

- [ ] **Step 3: Verify lint, type-check, and detector**

```powershell
Set-Location frontend; npx eslint "components/cursive-stroke-canvas.tsx" "components/cursive-guide-dialog.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/cursive-stroke-canvas.tsx" "frontend/components/cursive-guide-dialog.tsx"
```

- [ ] **Step 4: Commit**

```powershell
git add frontend/components/cursive-stroke-canvas.tsx frontend/components/cursive-guide-dialog.tsx; if ($?) { git commit -m "refactor(ui): migrate cursive stroke canvas toolbar and mobile guide filters to shadcn" }
```

---

### Task 5: `RubricReferenceDialog`, `ShortcutsDialog`, `QuickUploadDialog` & Notifications

**Files:**
- Modify: `frontend/components/rubric-reference-dialog.tsx`
- Modify: `frontend/components/shortcuts-dialog.tsx`
- Modify: `frontend/components/quick-upload-dialog.tsx`
- Modify: `frontend/components/notifications/notification-bell.tsx`
- Modify: `frontend/components/notifications/notification-list.tsx`
- Modify: `frontend/components/notifications/notification-row.tsx`

- [ ] **Step 1: Clean up `rubric-reference-dialog.tsx` and `shortcuts-dialog.tsx`**

- `rubric-reference-dialog.tsx`: Replace L489 `border-t` divider with `<Separator />`; refactor scoring band cards (L505–533) to use `<CardHeader><CardTitle>{band.label}</CardTitle><CardAction><Badge variant="outline">{band.range}</Badge></CardAction></CardHeader><CardContent>...</CardContent>`; replace `space-y-*` with `flex flex-col gap-*`, add `data-icon="inline-start"` on `ChevronsUpDownIcon`, and replace manual `dark:` overrides with semantic band tokens (`bg-band-1..4/10`, `text-band-1..4-text`).
- `shortcuts-dialog.tsx`: Replace `space-y-*` with `flex flex-col gap-*`; replace custom `rounded-xl border divide-y` shortcut lists (L129) with `<ItemGroup className="gap-0 rounded-xl border border-border bg-card">` + `<Item size="xs">` + `<ItemSeparator className="my-0" />`.

- [ ] **Step 2: Complete strict shadcn sweep of `quick-upload-dialog.tsx`**

Keep hidden `<input type="file">` capture elements (L1077, L1088) raw per `AGENTS.md` §4. Migrate everything else:
- Wrap Activity & Student `<Field>` blocks in `<FieldGroup>` (removing `space-y-4` on L815).
- Replace prefilled read-only `<div role="textbox" aria-readonly="true">` blocks (L842–862, L915–935) with `<InputGroup><InputGroupInput readOnly value={...} /><InputGroupAddon align="inline-end"><Badge variant="secondary">Locked</Badge></InputGroupAddon></InputGroup>`.
- Wrap camera `<NativeSelect>` (L1141–1158) in `<Field><FieldLabel htmlFor="camera-select" className="sr-only">Camera</FieldLabel><NativeSelect ... /></Field>`.
- Replace manual `showTips` Photo Quality Tips toggle (L1320–1391) with `<Collapsible open={showTips} onOpenChange={setShowTips}><CollapsibleTrigger render={<Button type="button" variant="ghost" size="sm" />} />...<CollapsibleContent>...</CollapsibleContent></Collapsible>`.
- Replace status `<p role="status">` (L819), prerequisite `<div role="status">` (L985), and retake warning `<div>` (L1054) with `<Alert>` + `<AlertTitle>` / `<AlertDescription>`.
- Replace raw footer `border-t` `<div>` (L1594–1646) with `<DialogFooter className="border-t border-border bg-muted/20 px-4 py-3 sm:px-6 sm:justify-between">`.
- Replace spinning `RotateCwIcon` during `isRotating` (L1474) with `<Spinner data-icon="inline-start" />`, replace template-literal ternaries with `cn()`, replace `space-y-*` with `flex flex-col gap-*`, and add `data-icon` on button icons without manual sizing.

- [ ] **Step 3: Clean up `components/notifications/{notification-bell,notification-list,notification-row}.tsx`**

- `notification-bell.tsx`: Add `<Spinner data-icon="inline-start" />` to `"Mark all read"` `Button` when pending (L220 mobile, L261 desktop); drop redundant `bg-primary text-primary-foreground` overrides on default `<Badge>` (L166).
- `notification-list.tsx`: Wrap scrollable list (L302) in `<ScrollArea>` (removing raw `[&::-webkit-scrollbar]` CSS); add `<Spinner data-icon="inline-start" />` to pending load-more buttons (L257, L335); drop `dark:bg-primary/20` on `<Badge>` (L190).
- `notification-row.tsx`: Remove manual `size-3.5` on `<Check />` inside `Button size="icon"` (L178) and replace manual `dark:` overrides with semantic tokens.

- [ ] **Step 4: Verify lint, type-check, and detector**

```powershell
Set-Location frontend; npx eslint "components/rubric-reference-dialog.tsx" "components/shortcuts-dialog.tsx" "components/quick-upload-dialog.tsx" "components/notifications/notification-bell.tsx" "components/notifications/notification-list.tsx" "components/notifications/notification-row.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/rubric-reference-dialog.tsx" "frontend/components/shortcuts-dialog.tsx" "frontend/components/quick-upload-dialog.tsx" "frontend/components/notifications/notification-bell.tsx" "frontend/components/notifications/notification-list.tsx" "frontend/components/notifications/notification-row.tsx"
```

- [ ] **Step 5: Commit**

```powershell
git add frontend/components/rubric-reference-dialog.tsx frontend/components/shortcuts-dialog.tsx frontend/components/quick-upload-dialog.tsx frontend/components/notifications/; if ($?) { git commit -m "refactor(ui): complete strict shadcn migration for global dialogs and notifications" }
```

---

## Wave 3 — Dashboard, Roster & Settings (Desktop + Mobile)

### Task 6: Dashboard Page, `SummaryCards`, `ClassTable`, `CriterionTrendChart` & `StudentDrillDownDrawer`

**Files:**
- Modify: `frontend/app/(teacher)/dashboard/page.tsx`
- Modify: `frontend/components/dashboard/summary-cards.tsx`
- Modify: `frontend/components/dashboard/class-table.tsx`
- Modify: `frontend/components/dashboard/criterion-trend-chart.tsx`
- Modify: `frontend/components/dashboard/student-drill-down.tsx`

- [ ] **Step 1: Clean up `dashboard/page.tsx` and `summary-cards.tsx`**

- `dashboard/page.tsx`: Replace `space-y-*` with `flex flex-col gap-*`, add `data-icon="inline-start"` on button icons (removing manual `w-4 h-4 mr-2`), swap spinning `RotateCcw` / retry text with `<Spinner data-icon="inline-start" />`, remove manual `size-4` on `AlertCircle` inside `Alert` and color overrides on `Button`.
- `summary-cards.tsx`: Compose full `<CardHeader><CardTitle>...</CardTitle><CardAction>...</CardAction></CardHeader><CardContent>...</CardContent><CardFooter>...</CardFooter>` on lead and 5 criteria cards; replace `dark:text-amber-300` / manual `dark:` overrides with semantic `text-band-1-text` / `bg-card`; replace `space-y-*` with `flex flex-col gap-*`.

- [ ] **Step 2: Upgrade `class-table.tsx` (Desktop + Mobile `Item` rows & `Field` sort bar)**

Import `{ Card, CardContent, CardFooter } from "@/components/ui/card"`, `{ Field, FieldLabel } from "@/components/ui/field"`, `{ Item, ItemContent, ItemDescription, ItemGroup, ItemTitle, ItemActions } from "@/components/ui/item"`, `{ Separator } from "@/components/ui/separator"`:
- **Mobile (`sm:hidden`) sort bar (L368–401):** Wrap `<FieldLabel htmlFor="mobile-student-sort">Sort by</FieldLabel>` + `<NativeSelect>` + direction toggle `<Button>` in `<Field orientation="horizontal">`.
- **Mobile (`sm:hidden`) student rows (L449–487):** Replace raw `<button>` cards with `<ItemGroup className="gap-2.5 sm:hidden">` rendering `<Item key={student.student_id} variant="outline" size="sm" render={<button type="button" onClick={() => onSelectStudent(student)} className="min-h-11 w-full bg-card text-left hover:bg-muted/50 cursor-pointer" />} />` using `<ItemContent>`, `<ItemTitle>`, `<ItemDescription>`, `<ItemActions>`.
- **Desktop:** Replace raw `<button>` student name trigger (L600) with `<Button type="button" variant="link" size="xs" onClick={() => onSelectStudent(student)} className="h-auto p-0 text-left font-semibold text-foreground">`; replace raw-styled `<TooltipTrigger>` sort headers (L524) with `<TooltipTrigger render={<Button type="button" variant="ghost" size="xs" onClick={...} />} />`; replace `<Link className={buttonVariants(...)}>` (L296) with `<Button nativeButton={false} render={<Link href="/roster" />}><Users data-icon="inline-start" aria-hidden="true" />Manage roster</Button>`; wrap table and empty states in `<Card>` + `<CardContent>` + `<Separator />` + `<CardFooter>`; replace `w-2 h-2` → `size-2`, `space-y-*` → `flex flex-col gap-*`, and drop manual `dark:` overrides.

- [ ] **Step 3: Upgrade `criterion-trend-chart.tsx` (`ChartTooltipContent`, `ToggleGroup`, `Card` anatomy)**

Import `{ ChartTooltipContent } from "@/components/ui/chart"`, `{ CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"`, `{ Separator } from "@/components/ui/separator"`, `{ ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"`:
- Replace custom `TrendChartTooltip` (L103–157) with `<ChartTooltip content={<ChartTooltipContent indicator="dot" />} />` (preserving developmental band formatting via `formatter` prop, removing manual `z-50` and `border-b`).
- Replace the 6 looped `<Toggle>` components (L496–543) with `<ToggleGroup multiple value={[...visibleSeries]} onValueChange={(vals) => { if (vals.length > 0) setVisibleSeries(new Set(vals)); }} aria-label="Visible handwriting criteria">` + `<ToggleGroupItem>`.
- Use `<CardHeader><CardTitle>...</CardTitle><CardDescription>...</CardDescription></CardHeader>` for the chart header, `<Card size="sm">` + `<Separator />` for the trajectory summary (L551–605), `<Separator />` for controls/legend dividers, and `<CardFooter className="sm:hidden ...">` for the mobile scroll hint. Replace `w-2 h-2`, `space-y-*`, manual icon sizes, and manual `dark:` overrides.

- [ ] **Step 4: Upgrade `student-drill-down.tsx` (`Item`, `SheetFooter`, `Alert`, `Card`, `Spinner`)**

Import `{ Item, ItemGroup, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@/components/ui/item"`, `{ SheetFooter } from "@/components/ui/sheet"`, `{ Separator } from "@/components/ui/separator"`, `{ Spinner } from "@/components/ui/spinner"`:
- Replace both raw `<button>` submission lists (Overview L617–652, History L763–798) with `<ItemGroup className="gap-2.5">` + `<Item variant="outline" size="sm" render={<button type="button" onClick={() => onOpenSubmission(...)} className="min-h-11 w-full bg-card text-left hover:bg-muted/50 cursor-pointer" />} />`.
- Replace Diagnostic Criteria Framework `<ul>` (L414–430) with `<Card size="sm"><CardContent className="p-0"><ItemGroup className="gap-0">...</ItemGroup></CardContent></Card>`.
- Replace Diagnostic Note `<div>` (L579–584) with `<Alert><AlertTitle>Diagnostic note</AlertTitle><AlertDescription>...</AlertDescription></Alert>`.
- Replace raw `<footer>` (L808–831) with `<Separator />` + `<SheetFooter className="shrink-0">`.
- Add `<CardHeader><CardTitle>` to Overall Performance & Trends cards; swap spinning `RefreshCw` on retry (L368) with `<Spinner data-icon="inline-start" />`; sweep all `space-y-*` → `flex flex-col gap-*` and add `data-icon`.

- [ ] **Step 5: Verify lint, type-check, and detector**

```powershell
Set-Location frontend; npx eslint "app/(teacher)/dashboard/page.tsx" "components/dashboard/summary-cards.tsx" "components/dashboard/class-table.tsx" "components/dashboard/criterion-trend-chart.tsx" "components/dashboard/student-drill-down.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/app/(teacher)/dashboard/page.tsx" "frontend/components/dashboard/summary-cards.tsx" "frontend/components/dashboard/class-table.tsx" "frontend/components/dashboard/criterion-trend-chart.tsx" "frontend/components/dashboard/student-drill-down.tsx"
```

- [ ] **Step 6: Commit**

```powershell
git add frontend/app/\(teacher\)/dashboard/page.tsx frontend/components/dashboard/; if ($?) { git commit -m "refactor(ui): complete strict shadcn and mobile upgrades across teacher dashboard" }
```

---

### Task 7: Roster Page (Mobile `Card` + `ToggleGroup` Sort), Roster Dialogs & `FloatingBatchBar`

**Files:**
- Modify: `frontend/app/(teacher)/roster/page.tsx`
- Modify: `frontend/components/roster/batch-move-dialog.tsx`
- Modify: `frontend/components/roster/bulk-student-dialog.tsx`
- Modify: `frontend/components/roster/floating-batch-bar.tsx`
- Modify: `frontend/components/roster/manage-sections-dialog.tsx`
- Modify: `frontend/components/roster/student-dialog.tsx`

- [ ] **Step 1: Upgrade `frontend/app/(teacher)/roster/page.tsx` (Desktop + Mobile)**

Import `{ Card, CardHeader, CardTitle, CardAction, CardContent, CardFooter } from "@/components/ui/card"`, `{ Separator } from "@/components/ui/separator"`, `{ ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"`, `{ DropdownMenuGroup } from "@/components/ui/dropdown-menu"`:
- **Mobile sort controls (L709–762):** Replace the 2 manual `Button`s (`Name`, `Section`) with `<ToggleGroup multiple={false} value={[sortField]} onValueChange={(vals) => { if (vals.length > 0) handleSort(vals[0] as SortField); }} variant="outline" size="sm">` + `<ToggleGroupItem value="full_name">` / `<ToggleGroupItem value="section_name">`, paired with a separate sort-direction toggle `<Button variant="outline" size="icon-sm">`.
- **Mobile student cards (`block md:hidden`, L766–860):** Replace raw `<div>` cards + `border-t` footers with `<Card size="sm">` + `<CardHeader>` (checkbox + student name + `RowActions` in `<CardAction>`) + `<CardContent>` (section & parent email status `Badge`) + `<Separator />` + `<CardFooter>`.
- **Both:** Wrap `RowActions` `DropdownMenuItem`s (L983–996) in `<DropdownMenuGroup>`; replace raw `bg-emerald-50` / `bg-amber-50` & manual `dark:` badge classes with semantic `bg-band-4/15 text-band-4-text border-band-4/30` / `bg-band-2/15 text-band-2-text border-band-2/30`; replace `h-9 w-9 sm:h-8 sm:w-8` → `size-9 sm:size-8`, template-literal ternaries → `cn()`, `space-y-*` → `flex flex-col gap-*`, and add `data-icon` on button/menu icons & `Spinner`.

- [ ] **Step 2: Upgrade `batch-move-dialog`, `bulk-student-dialog`, `student-dialog`, `manage-sections-dialog`, and `floating-batch-bar`**

- `batch-move-dialog.tsx`: Replace selected student `<span>` chips (L213) with `<Badge variant="outline">`, hint `<p>` (L199) with `<FieldDescription>`, raw footer `<div>` (L238) with `<DialogFooter>`; sweep `space-y-*`, `data-icon`, and manual `dark:`.
- `bulk-student-dialog.tsx`: Replace detected-count `<span>` (L244) with `<Badge variant="secondary">`, duplicate & status `amber-50` `<div>` callouts (L273, L301) with `<Alert><AlertDescription>...</AlertDescription></Alert>`, hint `<p>`s with `<FieldDescription>`, raw footer `<div>` (L308) with `<DialogFooter>`; sweep `space-y-*`, `data-icon`, and manual `dark:` / button color overrides.
- `student-dialog.tsx`: Replace hint `<p>`s (L332, L363) with `<FieldDescription>`, raw footer `<div>` (L371) with `<DialogFooter>`; sweep `data-icon`, `dark:bg-card`, and `bg-primary hover:bg-brand-700`.
- `manage-sections-dialog.tsx`: Replace raw error box (L232) with `<Alert variant="destructive">`, raw empty state (L246) with `<Empty>`, wrap inline rename `<Input>` + error `<p role="alert">` (L268–328) in `<Field data-invalid={Boolean(renameError) || undefined}>` + `<FieldError>`, wrap add-section `<Field>` (L179) in `<FieldGroup>`, replace `h-10 w-10 sm:h-9 sm:w-9` → `size-10 sm:size-9`, `space-y-*` → `flex flex-col gap-*`, and add `data-icon`.
- `floating-batch-bar.tsx`: Fix conflicting mobile visibility classes (`sm:hidden hidden min-[360px]:inline` → `hidden min-[360px]:inline sm:hidden`), add `data-icon="inline-start"` on icons (removing `w-3.5 h-3.5 sm:mr-1.5`), and use `<Button variant="destructive">` without manual hover color overrides.

- [ ] **Step 3: Verify lint, type-check, and detector**

```powershell
Set-Location frontend; npx eslint "app/(teacher)/roster/page.tsx" "components/roster/batch-move-dialog.tsx" "components/roster/bulk-student-dialog.tsx" "components/roster/floating-batch-bar.tsx" "components/roster/manage-sections-dialog.tsx" "components/roster/student-dialog.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/app/(teacher)/roster/page.tsx" "frontend/components/roster/batch-move-dialog.tsx" "frontend/components/roster/bulk-student-dialog.tsx" "frontend/components/roster/floating-batch-bar.tsx" "frontend/components/roster/manage-sections-dialog.tsx" "frontend/components/roster/student-dialog.tsx"
```

- [ ] **Step 4: Commit**

```powershell
git add frontend/app/\(teacher\)/roster/page.tsx frontend/components/roster/; if ($?) { git commit -m "refactor(ui): complete strict shadcn and mobile upgrades across teacher roster" }
```

---

### Task 8: Settings Page & Teacher Settings Cards

**Files:**
- Modify: `frontend/app/(teacher)/settings/page.tsx`
- Modify: `frontend/components/settings/notification-settings-card.tsx`
- Modify: `frontend/components/settings/profile-settings-card.tsx`
- Modify: `frontend/components/settings/security-settings-card.tsx`

- [ ] **Step 1: Fix `settings/page.tsx`, `notification-settings-card.tsx`, and `profile-settings-card.tsx`**

- `settings/page.tsx`: Replace L36 `space-y-10` with `flex flex-col gap-10` and L52 `<div className="border-border border-t" />` with `<Separator />`.
- `notification-settings-card.tsx`: Remove `ring-0 border border-border rounded-xl` override on `<Card>` (L175) and replace `<p role="status">Email settings saved.</p>` (L240) with `<Alert role="status"><Check aria-hidden="true" /><AlertDescription>Email settings saved.</AlertDescription></Alert>`.
- `profile-settings-card.tsx`: Add `<CardHeader><CardTitle>Profile</CardTitle><CardDescription>...</CardDescription></CardHeader>`, propagate `data-disabled={isSaving || undefined}` on `<Field>`s, and remove manual `size-3` on `<Lock>` inside `<Badge>`.

- [ ] **Step 2: Refactor `security-settings-card.tsx` password form onto `FieldGroup` + `Field` + `FieldLabel` + `FieldDescription` + `FieldError`**

Import `{ FieldGroup, Field, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field"` and `{ CardHeader, CardTitle, CardDescription } from "@/components/ui/card"`:
- Add `<CardHeader><CardTitle>Password & Security</CardTitle><CardDescription>...</CardDescription></CardHeader>` inside `<Card>`.
- Replace all 3 raw `<div className="flex flex-col gap-1.5">` + `<Label>` password blocks (Current, New, Confirm — L302–554) with `<FieldGroup>` containing `<Field data-invalid={...} data-disabled={isUpdating || undefined}>`, `<FieldLabel htmlFor="...">`, existing `<InputGroup>` password input + toggle addon, `<FieldDescription>`, and `<FieldError>` (replacing raw `<p id="current-password-error" role="alert">` and `<p id="confirm-password-status" role="status">`).
- Sweep `cn()` (replacing 6 template-literal ternaries), `flex flex-col gap-4` (replacing `space-y-4`), `data-icon="inline-start"` on button icons/`Spinner`, and remove manual `dark:` color overrides.

- [ ] **Step 3: Verify lint, type-check, and detector**

```powershell
Set-Location frontend; npx eslint "app/(teacher)/settings/page.tsx" "components/settings/notification-settings-card.tsx" "components/settings/profile-settings-card.tsx" "components/settings/security-settings-card.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/app/(teacher)/settings/page.tsx" "frontend/components/settings/notification-settings-card.tsx" "frontend/components/settings/profile-settings-card.tsx" "frontend/components/settings/security-settings-card.tsx"
```

- [ ] **Step 4: Commit**

```powershell
git add frontend/app/\(teacher\)/settings/page.tsx frontend/components/settings/notification-settings-card.tsx frontend/components/settings/profile-settings-card.tsx frontend/components/settings/security-settings-card.tsx; if ($?) { git commit -m "refactor(ui): migrate teacher settings cards and password form to strict shadcn" }
```

---

## Wave 4 — Activities, Submissions, Diagnostic Overlay & Comments (Desktop + Mobile)

### Task 9: Activities Routes & Activity Dialogs

**Files:**
- Modify: `frontend/app/(teacher)/activities/page.tsx`
- Modify: `frontend/app/(teacher)/activities/[id]/page.tsx`
- Modify: `frontend/app/(teacher)/activities/[id]/submissions/[submissionId]/page.tsx`
- Modify: `frontend/components/activities/create-activity-dialog.tsx`
- Modify: `frontend/components/activities/edit-activity-dialog.tsx`
- Modify: `frontend/components/activities/delete-activity-dialog.tsx`
- Modify: `frontend/components/activities/attempt-deletion-dialogs.tsx`
- Modify: `frontend/components/activities/batch-release-dialog.tsx`

- [ ] **Step 1: Clean up `activities/page.tsx`, `activities/[id]/page.tsx`, and `submissions/[submissionId]/page.tsx`**

- `activities/page.tsx`:
  - Replace raw `<button>` `"Clear search"` (L526) with `<Button type="button" variant="link" size="xs">`.
  - Replace bare `DropdownMenuTrigger` (L456) with `<DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" />} />` and replace manual `✓` items (L466–501) with `<DropdownMenuRadioGroup value={sortBy} onValueChange={...}>` + `<DropdownMenuRadioItem>`.
  - Wrap loading skeleton cards (L541–551) in `<Card size="sm"><CardContent>...</CardContent></Card>`.
  - Sweep `space-y-*` → `flex flex-col gap-*`, `data-icon`, and manual `dark:` overrides.
- `activities/[id]/page.tsx`:
  - Replace raw `<button>` `"Clear hidden"` (L1667) with `<Button type="button" variant="link" size="xs">`; replace custom amber warning div (L1661) with `<Badge variant="outline" className="gap-1.5 border-band-2/40 bg-band-2/15 text-band-2-text">` (or `<Alert>`); replace `<div role="status">` banner (L1248) with `<Alert role="status"><AlertDescription>...</AlertDescription><AlertAction>...</AlertAction></Alert>`; replace hand-styled back `<Link>`s (L1078, L1146, L1205) with `<Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/activities" />} />`; replace `border-t` on `Collapsible` (L1596) with `<Separator />`; add `<Spinner data-icon="inline-start" />` on `isBatchExcusing` `AlertDialogAction` (L1776); sweep `space-y-*`, `data-icon`, and `dark:`.
- `activities/[id]/submissions/[submissionId]/page.tsx`:
  - Replace all 3 hand-rolled fallback boxes (`Invalid Conversation Link` L148–166, `Unable to Load Submission` L208–239, `Submission Not Found` L253–271) with `<Empty>` (using `<EmptyMedia>`, `<EmptyHeader>`, `<EmptyTitle>`, `<EmptyDescription>`, `<EmptyContent>`) and `<Button nativeButton={false} render={<Link href={activityHref} />} />`; sweep `space-y-*` and `data-icon`.

- [ ] **Step 2: Migrate `delete-activity-dialog.tsx` to `AlertDialog` and clean up `create/edit-activity-dialog`, `attempt-deletion-dialogs`, and `batch-release-dialog`**

- `delete-activity-dialog.tsx`: Replace `Dialog` imports with `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction` from `@/components/ui/alert-dialog`; replace amber warning div (L65) with `<Alert><AlertTriangle aria-hidden="true" /><AlertDescription>...</AlertDescription></Alert>`; replace raw footer div (L83) with `<AlertDialogFooter>`; add `<Spinner data-icon="inline-start" />` / `<Trash2 data-icon="inline-start" />`.
- `create-activity-dialog.tsx` & `edit-activity-dialog.tsx`: Replace raw `<button>` prompt suggestion chips (`create-activity-dialog.tsx:236`) with `<Button type="button" variant="outline" size="xs">`; replace amber warning callouts with `<Alert>`; replace raw hint `<p>`s with `<FieldDescription>`; refactor take-home toggle to `<Field orientation="horizontal"><FieldContent><FieldLabel>...</FieldLabel><FieldDescription>...</FieldDescription></FieldContent><Switch ... /></Field>`; replace raw footer `border-t` divs with `<DialogFooter>`; sweep `space-y-*` and `data-icon`.
- `attempt-deletion-dialogs.tsx`: Replace amber callout (L101) with `<Alert><AlertDescription>...</AlertDescription><AlertAction>...</AlertAction></Alert>`, wrap scrollable attempt list in `<ScrollArea>` + `<Separator />`, add `data-icon="inline-start"` on `<Spinner />` (L179, L217, L259).
- `batch-release-dialog.tsx`: Replace custom band pill `<span>` (L168) with `<Badge variant="outline">`, amber warning div (L179) with `<Alert>`, sweep `space-y-*`, `data-icon`, and manual color override on `AlertDialogAction`.

- [ ] **Step 3: Verify lint, type-check, and detector**

```powershell
Set-Location frontend; npx eslint "app/(teacher)/activities/page.tsx" "app/(teacher)/activities/[id]/page.tsx" "app/(teacher)/activities/[id]/submissions/[submissionId]/page.tsx" "components/activities/create-activity-dialog.tsx" "components/activities/edit-activity-dialog.tsx" "components/activities/delete-activity-dialog.tsx" "components/activities/attempt-deletion-dialogs.tsx" "components/activities/batch-release-dialog.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/app/(teacher)/activities/page.tsx" "frontend/app/(teacher)/activities/[id]/page.tsx" "frontend/app/(teacher)/activities/[id]/submissions/[submissionId]/page.tsx" "frontend/components/activities/create-activity-dialog.tsx" "frontend/components/activities/edit-activity-dialog.tsx" "frontend/components/activities/delete-activity-dialog.tsx" "frontend/components/activities/attempt-deletion-dialogs.tsx" "frontend/components/activities/batch-release-dialog.tsx"
```

- [ ] **Step 4: Commit**

```powershell
git add frontend/app/\(teacher\)/activities/ frontend/components/activities/create-activity-dialog.tsx frontend/components/activities/edit-activity-dialog.tsx frontend/components/activities/delete-activity-dialog.tsx frontend/components/activities/attempt-deletion-dialogs.tsx frontend/components/activities/batch-release-dialog.tsx; if ($?) { git commit -m "refactor(ui): migrate activities pages and dialogs to strict shadcn primitives" }
```

---

### Task 10: Activity Cards, Hero, Review Toolbar, `SubmissionCard` & Activity Helpers

**Files:**
- Modify: `frontend/components/activities/activity-card.tsx`
- Modify: `frontend/components/activities/activity-detail-hero.tsx`
- Modify: `frontend/components/activities/activity-review-empty-states.tsx`
- Modify: `frontend/components/activities/activity-review-toolbar.tsx`
- Modify: `frontend/components/activities/activity-assignment-fields.tsx`
- Modify: `frontend/components/activities/activity-work-status.tsx`
- Modify: `frontend/components/activities/attempt-selection-preview.tsx`
- Modify: `frontend/components/activities/scoring-guide-popover.tsx`
- Modify: `frontend/components/activities/student-work-summary.tsx`
- Modify: `frontend/components/activities/submission-card.tsx`
- Modify: `frontend/components/activities/worksheet-history.tsx`
- Modify: `frontend/components/activities/worksheet-prompt.tsx`

- [ ] **Step 1: Upgrade `submission-card.tsx` (5 raw `<button>`s + 1 raw `<label>` + cards/alerts/badges)**

- Replace all 5 raw `<button>` elements (L247/257 history triggers, L582 `"View latest"`, L799 photo preview trigger, L961 `UnsubmittedCard` 4:3 upload dropzone) with `<Button type="button" ...>` (keeping `variant="ghost"` / `variant="link"` / `variant="outline"` and full-area click ergonomics).
- Replace raw `<label>` + `Checkbox` (L292) with `<Field orientation="horizontal"><Checkbox ... /><FieldLabel htmlFor={...}>...</FieldLabel></Field>`.
- Replace hand-rolled rejection alert (L560) and newer-attempt callout (L611) with `<Alert variant="destructive">` / `<Alert>`.
- Replace pulsing `<Clock>` (L602) with `<Spinner />`.
- Migrate `<article>` wrappers in `SubmissionCard` & `UnsubmittedCard` (L755, L922, L958) to `<Card>` + `<CardHeader>` + `<CardContent>` + `<Separator />` + `<CardFooter>`.
- Replace `"Parent upload"` pill `<span>` (L834) with `<Badge variant="secondary">`.
- Use `render={<Button ... />}` on `TooltipTrigger` & `PopoverTrigger`, remove manual `z-50` on `PopoverContent`, wrap `DropdownMenuItem`s in `<DropdownMenuGroup>`, and sweep `space-y-*` / `data-icon`.

- [ ] **Step 2: Upgrade `activity-card.tsx`, `activity-detail-hero.tsx`, `activity-review-toolbar.tsx`, and `activity-review-empty-states.tsx`**

- `activity-card.tsx`: Keep multi-segment `role="progressbar"` (L350–387) custom per spec. Wrap card container in `<Card>` + `<CardHeader>` + `<CardContent>` + `<Separator />` + `<CardFooter>`; replace `Complete` and tooltip ratio `<span>`s with `<Badge>`; use `<DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />} />` + `<DropdownMenuGroup>`; sweep `space-y-*` and `data-icon`.
- `activity-detail-hero.tsx`: Wrap outer section in `<Card>`; replace archived `<p role="status">` with `<Alert role="status">`; replace `isPromptExpanded` manual toggle (L336–355) with `<Collapsible>`; replace all desktop & mobile stacked `border-t` dividers with `<Separator />`; use `render={<Button />}` on `DropdownMenuTrigger` & `PopoverTrigger` (no manual `z-50`), wrap `DropdownMenuItem`s in `<DropdownMenuGroup>`, place retry button in `<AlertAction>`, and sweep `space-y-*` / `data-icon`.
- `activity-review-toolbar.tsx`: Wrap outer toolbar in `<Card size="sm"><CardContent>`; wrap horizontal filter strip in `<ScrollArea>` + `<ScrollBar orientation="horizontal" />`; group split filter trigger + clear button in `<ButtonGroup>`; replace `activeSecondaryCount` `<span>` (L444) with `<Badge variant="secondary">`; replace `#review-filter-help` `border-t` with `<Separator />`; replace amber hidden-selection banner (L632) with `<Alert>`; wrap checkbox + label (L613) in `<Field orientation="horizontal">`; remove manual `dark:` / color overrides on `ToggleGroupItem` and add `data-icon`.
- `activity-review-empty-states.tsx`: Wrap outer empty container in `<Card>`, drop primary color override on `<Button>`, and use `<Upload data-icon="inline-start" aria-hidden="true" />`.

- [ ] **Step 3: Clean up remaining activity helpers**

- `activity-assignment-fields.tsx`: Replace `<p role="status">Loading your roster…</p>` (L126) with `<Skeleton className="h-9 w-full" />`; replace `border-t` on `CollapsibleContent` with `<Separator />`; use `render={<Button variant="ghost" size="sm" />}` on `CollapsibleTrigger`s; replace `space-y-*` with `flex flex-col gap-*` and add `data-icon`.
- `activity-work-status.tsx` & `student-work-summary.tsx`: Replace loading `<p role="status">` / inline loading text with `<Skeleton className="h-5 w-24" />`; replace ternary className with `cn()` and drop manual `dark:` overrides.
- `attempt-selection-preview.tsx`: Replace `<p role="alert">` with `<Alert variant="destructive">` and raw `overflow-y-auto` div with `<ScrollArea>`.
- `scoring-guide-popover.tsx`: Replace bare `PopoverTrigger` with `render={<Button type="button" variant="outline" size="sm" className="min-h-11 sm:min-h-9" />}`, remove manual `z-50`, replace `border-t` dividers with `<Separator />`, and replace `space-y-3` with `flex flex-col gap-3`.
- `worksheet-history.tsx` & `worksheet-prompt.tsx`: Wrap history items in `<Card size="sm">`, replace alert/note boxes with `<Alert>`, replace `border-t` footers with `<Separator />`, use `cn()` on `<Badge>`, and add `data-icon="inline-start"` on icons/`Spinner`.

- [ ] **Step 4: Verify lint, type-check, and detector**

```powershell
Set-Location frontend; npx eslint "components/activities/activity-card.tsx" "components/activities/activity-detail-hero.tsx" "components/activities/activity-review-empty-states.tsx" "components/activities/activity-review-toolbar.tsx" "components/activities/activity-assignment-fields.tsx" "components/activities/activity-work-status.tsx" "components/activities/attempt-selection-preview.tsx" "components/activities/scoring-guide-popover.tsx" "components/activities/student-work-summary.tsx" "components/activities/submission-card.tsx" "components/activities/worksheet-history.tsx" "components/activities/worksheet-prompt.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/activities/activity-card.tsx" "frontend/components/activities/activity-detail-hero.tsx" "frontend/components/activities/activity-review-toolbar.tsx" "frontend/components/activities/submission-card.tsx"
```

- [ ] **Step 5: Commit**

```powershell
git add frontend/components/activities/; if ($?) { git commit -m "refactor(ui): complete strict shadcn migration across activity cards, hero, toolbar, and submission cards" }
```

---

### Task 11: Submissions Suite (`components/submissions/*`)

**Files:**
- Modify: `frontend/components/submissions/activity-release-grade-preview.tsx`
- Modify: `frontend/components/submissions/manual-rubric-entry-form.tsx`
- Modify: `frontend/components/submissions/quality-error-card.tsx`
- Modify: `frontend/components/submissions/raw-measurements-table.tsx`
- Modify: `frontend/components/submissions/submission-detail-content.tsx`
- Modify: `frontend/components/submissions/submission-detail-dialog.tsx`
- Modify: `frontend/components/submissions/submission-lifecycle-controls.tsx`
- Modify: `frontend/components/submissions/submission-rejection-card.tsx`

- [ ] **Step 1: Upgrade `manual-rubric-entry-form.tsx`**

- Wrap outer panel in `<Card>` + `<Separator />` (replacing `border-b`/`border-t` dividers on L915, L1241, L1443).
- Replace Focus vs All(5) 2-button toggle (L971–1002) and 5-criterion step bar (L1049–1099) with `<ToggleGroup multiple={false}>` + `<ToggleGroupItem>` (preventing empty deselection, keeping `1–4`, `Alt+1–4`, `Ctrl+Enter` shortcuts intact).
- Replace `showKeyboardHelp` disclosure (L1004–1033) with `<Collapsible open={showKeyboardHelp} onOpenChange={setShowKeyboardHelp}>`.
- Wrap `DropdownMenuLabel` / `DropdownMenuItem` (L950–968) in `<DropdownMenuGroup>`.
- Replace `<Label><Checkbox />...</Label>` (L1462) with `<Field orientation="horizontal"><Checkbox ... /><FieldLabel>...</FieldLabel></Field>`.
- Sweep all template-literal ternaries → `cn()`, `space-y-*` → `flex flex-col gap-*`, primary color overrides on `Button`, and add `data-icon="inline-start"` on icons/`Spinner`.

- [ ] **Step 2: Upgrade `submission-detail-content.tsx` (Desktop + Mobile Sticky Preview Bar) & `submission-detail-dialog.tsx`**

- `submission-detail-dialog.tsx:46`: Remove manual `dark:bg-card` on `DialogContent`.
- `submission-detail-content.tsx`:
  - **Mobile (`lg:hidden`) sticky preview bar (L1047–1109):** Rebuild using `<Card size="sm" className="sticky top-0 z-20 lg:hidden">` + `<CardContent className="flex items-center justify-between gap-3 py-2">` + `<Button variant="outline" size="sm">` (preserving 44px touch target and jump-to-image scroll).
  - Replace student pager container (L848–888) with `<ButtonGroup>`.
  - Replace header/footer `border-b`/`border-t` dividers (L1023, L1027, L1719) with `<Separator />`.
  - Replace Target Prompt box (L1204), Capitalization Note (L1213), Desktop Diagnostic Guide (L1253), raw callout `<p>` (L1642), and `Need another photo?` box (L1698) with `<Card>` / `<Alert>`.
  - Replace Analyzing Handwriting pulsing `<Clock>` box (L1351–1365) with `<Empty><EmptyMedia variant="icon"><Spinner /></EmptyMedia><EmptyHeader><EmptyTitle>Analyzing Handwriting</EmptyTitle>...</EmptyHeader></Empty>`.
  - Complete `CardHeader` / `CardTitle` / `CardContent` anatomy on inner cards (L1373, L1415, L1470, L1532); replace metric pill `<span>` (L1567) with `<Badge variant="outline">`; wrap `DropdownMenuItem` (L908) in `<DropdownMenuGroup>`; sweep `space-y-*` and `data-icon`.

- [ ] **Step 3: Upgrade `submission-lifecycle-controls.tsx`, `activity-release-grade-preview.tsx`, `quality-error-card.tsx`, `raw-measurements-table.tsx`, and `submission-rejection-card.tsx`**

- `submission-lifecycle-controls.tsx`: Replace all 9 raw `role="alert"` `<p>`/`<span>` elements with `<Alert variant="destructive">` or `<FieldError>`; migrate `SubmissionReturnedAlert` (L618) and filtered-view warning (L1149, replacing `⚠️` emoji with `<AlertTriangle aria-hidden="true" />`) to `<Alert>`; wrap completion/card/selected-attempt panels (L328, L360, L503, L887) in `<Card>` / `<Alert>`; wrap `SelectItem`s (L845–880) in `<SelectGroup>`; group quick-extend buttons (L735–780) in `<ButtonGroup>`; wrap scrollable attempt list (L1162) in `<ScrollArea>` + `<Separator />`; add `<Spinner data-icon="inline-start" />` to all pending buttons (L170, L543, L954, L1110, L1270) and `data-icon` to all icons.
- `activity-release-grade-preview.tsx`: Replace raw `<p role="alert">` (L104, L108) with `<Alert variant="destructive">`, `<p role="status">` (L115) with `<Skeleton className="h-5 w-48" />`, and scrollable `ul` (L125–143) with `<ScrollArea>` + `<Separator />`.
- `quality-error-card.tsx`: Wrap outer region & nested sections in `<Card>` / `<Alert>`; replace raw thumbnail `<button>` (L768) with `<Button type="button" variant="ghost">`; replace `showAllTips` toggle (L1039) with `<Collapsible>`; group zoom buttons (L1135) in `<ButtonGroup>` using `size-11 sm:size-7`; replace image load error fallback (L1203) with `<Empty>`; replace floating hint pill (L1237) with `<Badge>`; replace `border-t` with `<Separator />`, `w-full h-full` → `size-full`, `space-y-*` → `flex flex-col gap-*`, and add `data-icon`.
- `raw-measurements-table.tsx`: Keep `role="meter"` range bar (L451–483) custom per spec. Wrap metric rows in `<Card size="sm">` and replace **mobile** (`lg:hidden`) coaching tip div (L493–508) with `<Alert className="lg:hidden"><AlertDescription>...</AlertDescription></Alert>`; sweep `space-y-*` and `cn()`.
- `submission-rejection-card.tsx`: Remove `block` grid override on `<Alert>` (pass `<AlertCircle aria-hidden="true" />` as direct child, use `<AlertTitle>` + `<AlertDescription>` cleanly); replace word-count pill div (L245) with `<Badge variant="outline">`; wrap Teacher Action & Photo Guidelines panels (L285, L310) in `<Card>` (`CardHeader`, `CardTitle`, `CardContent`); sweep `space-y-*`, `data-icon`, and primary button color override.

- [ ] **Step 4: Verify lint, type-check, and detector**

```powershell
Set-Location frontend; npx eslint "components/submissions/activity-release-grade-preview.tsx" "components/submissions/manual-rubric-entry-form.tsx" "components/submissions/quality-error-card.tsx" "components/submissions/raw-measurements-table.tsx" "components/submissions/submission-detail-content.tsx" "components/submissions/submission-detail-dialog.tsx" "components/submissions/submission-lifecycle-controls.tsx" "components/submissions/submission-rejection-card.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/submissions/manual-rubric-entry-form.tsx" "frontend/components/submissions/submission-detail-content.tsx" "frontend/components/submissions/submission-lifecycle-controls.tsx" "frontend/components/submissions/quality-error-card.tsx" "frontend/components/submissions/raw-measurements-table.tsx" "frontend/components/submissions/submission-rejection-card.tsx"
```

- [ ] **Step 5: Commit**

```powershell
git add frontend/components/submissions/; if ($?) { git commit -m "refactor(ui): complete strict shadcn and mobile upgrades across submission review components" }
```

---

### Task 12: `WorksheetImageInspector`, Diagnostic Overlay, Shared Rows & Comments

**Files:**
- Modify: `frontend/components/shared/band-position-bar.tsx`
- Modify: `frontend/components/shared/criterion-feedback-row.tsx`
- Modify: `frontend/components/shared/worksheet-image-inspector.tsx`
- Modify: `frontend/components/shared/diagnostic-overlay/annotation-tooltip.tsx`
- Modify: `frontend/components/shared/diagnostic-overlay/calm-overlay-toolbar.tsx`
- Modify: `frontend/components/shared/diagnostic-overlay/diagnostic-fallback-banner.tsx`
- Modify: `frontend/components/shared/diagnostic-overlay/diagnostic-overlay.tsx`
- Modify: `frontend/components/shared/diagnostic-overlay/overlay-toolbar.tsx`
- Modify: `frontend/components/comments/activity-threads.tsx`
- Modify: `frontend/components/comments/comment-composer.tsx`
- Modify: `frontend/components/comments/submission-comment-destination.tsx`
- Modify: `frontend/components/comments/submission-comment-picker-sheet.tsx`
- Modify: `frontend/components/comments/submission-comment-picker.tsx`
- Modify: `frontend/components/comments/submission-comment-tabs.tsx`
- Modify: `frontend/components/comments/submission-comment-thread.tsx`
- Modify: `frontend/components/comments/thread-entry.tsx`

- [ ] **Step 1: Upgrade `worksheet-image-inspector.tsx`, `criterion-feedback-row.tsx`, and `band-position-bar.tsx`**

- `worksheet-image-inspector.tsx`: Migrate `collapsibleImageTools` (`imageToolsExpanded`, L585–640) to `<Collapsible>`; replace active summary `<span>` (L598) with `<Badge variant="secondary">`; replace Ink Contrast & Magnify `Button`s (L641, L782) with `<Toggle variant="outline" size="sm">`; wrap zoom controls (L681, L822) in `<ButtonGroup>`; replace unavailable photo fallback (L974) with `<Empty>`; use `render={<Button variant="ghost" size="sm" />}` on `CollapsibleTrigger` (L755); sweep `space-y-*` and `data-icon`.
- `criterion-feedback-row.tsx`: Use `render={<Button variant="ghost" />}` on `CollapsibleTrigger` (L170), replace `space-y-2` with `flex flex-col gap-2`, remove manual `dark:` overrides.
- `band-position-bar.tsx`: Keep 4-zone marker geometry custom; replace `space-y-1` → `flex flex-col gap-1`, `w-2.5 h-2.5`/`w-3.5 h-3.5` → `size-2.5`/`size-3.5`, and replace manual `dark:` overrides with semantic tokens.

- [ ] **Step 2: Upgrade `components/shared/diagnostic-overlay/*` (keeping SVG layers untouched)**

- `annotation-tooltip.tsx`: Replace raw close `<button>` (L380) with `<Button type="button" variant="ghost" size="icon-xs" aria-label="Close annotation"><X aria-hidden="true" /></Button>`, replace `border-t` (L417) with `<Separator />`, and replace manual `dark:` overrides with semantic tokens.
- `diagnostic-overlay.tsx`: Replace custom 3-line `animate-pulse` loading placeholder (L342–357) with `<div role="status" className="absolute inset-x-8 top-1/4 bottom-1/4 flex flex-col justify-around pointer-events-none"><Skeleton className="h-1 w-full" /><Skeleton className="h-1 w-5/6" /><Skeleton className="h-1 w-4/5" /></div>`.
- `calm-overlay-toolbar.tsx`: Replace focus stepper div (L223) with `<ButtonGroup>`, wrap `Switch`+`Label` (L176) in `<Field orientation="horizontal">`, add `<PopoverHeader><PopoverTitle>...</PopoverTitle></PopoverHeader>` inside `PopoverContent` (L286), sweep `space-y-*`, `data-icon`, and manual `dark:`.
- `diagnostic-fallback-banner.tsx`: Compose proper `<AlertTitle>` and `<AlertDescription>` inside `<Alert>` (removing flex override and manual `dark:` classes).
- `overlay-toolbar.tsx`: Wrap **mobile** (`@min-[640px]:hidden`) horizontal chip strip (L431–540) in `<ScrollArea>` + `<ScrollBar orientation="horizontal" />`; replace mobile `border-t` & desktop `border-l` dividers (L557, L650) with `<Separator />`; replace focus stepper (L560) with `<ButtonGroup>`; replace `Lines` `Button` (L604) with `<Toggle variant="outline" size="sm">`; replace `showLegend` panel (L628–776) with `<Collapsible>` + `<Separator />`; wrap desktop `Switch`+`Label` (L650) in `<Field orientation="horizontal">` using `<Switch size="sm" />` (removing `scale-90`/`scale-75`); replace bare `DropdownMenuTrigger` (L350) with `render={<Button variant="outline" size="sm" />}` + `<DropdownMenuGroup>`; sweep `data-icon` and manual `dark:`.

- [ ] **Step 3: Upgrade `components/comments/*`**

- `activity-threads.tsx`: Wrap section in `<Card><CardHeader><CardTitle>...</CardTitle></CardHeader><CardContent>...</CardContent></Card>`, replace `Unread` span (L99) with `<Badge variant="secondary">`, remove wrapper `<div role="status">` around `<Alert>`, remove manual `size-4` inside `<Alert>`, replace `space-y-*` with `flex flex-col gap-*`.
- `comment-composer.tsx`: Replace raw `<p role="status|alert">` errors (L115, L120) with `<FieldError>`, add `data-disabled={disabled || pending || busy || undefined}` on `<Field>`, and add `<Spinner data-icon="inline-start" />` on pending Send `Button`.
- `submission-comment-picker.tsx`: Replace `Unread` span (L174) with `<Badge variant="secondary">`, raw `<p role="status">` fallback (L285) with `<Empty>`, and remove manual `size-4` inside `<Alert>`.
- `submission-comment-thread.tsx`: Wrap Load-older button (L387) and `<Empty>` (L401) inside `<MessageScrollerContent>` with `<MessageScrollerItem>`; replace read-only footer div (L455) with `<Marker>` or `<Alert role="status">`; add `<Spinner data-icon="inline-start" />` on pending Saving / Load-older buttons; remove manual `size-4`/`size-3.5` on icons inside `Alert`/`Button`.
- `thread-entry.tsx`: Replace inline `<Alert role="group">` delete confirmation (L118) with `<AlertDialog>` (`AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction` with `<Spinner data-icon="inline-start" />` while deleting), and replace raw `<span role="alert">` (L123) with `<Alert variant="destructive">`.
- `submission-comment-destination.tsx`, `submission-comment-picker-sheet.tsx`, `submission-comment-tabs.tsx`: Replace `<Link className={buttonVariants(...)}>` with `<Button nativeButton={false} render={<Link />} />`, remove `<div role="status">` around `<Alert>`, remove manual icon sizes (`size-3.5` alongside `data-icon`), sweep `space-y-*` and manual `dark:` overrides.

- [ ] **Step 4: Verify lint, type-check, and detector**

```powershell
Set-Location frontend; npx eslint "components/shared/band-position-bar.tsx" "components/shared/criterion-feedback-row.tsx" "components/shared/worksheet-image-inspector.tsx" "components/shared/diagnostic-overlay/annotation-tooltip.tsx" "components/shared/diagnostic-overlay/calm-overlay-toolbar.tsx" "components/shared/diagnostic-overlay/diagnostic-fallback-banner.tsx" "components/shared/diagnostic-overlay/diagnostic-overlay.tsx" "components/shared/diagnostic-overlay/overlay-toolbar.tsx" "components/comments/activity-threads.tsx" "components/comments/comment-composer.tsx" "components/comments/submission-comment-destination.tsx" "components/comments/submission-comment-picker-sheet.tsx" "components/comments/submission-comment-picker.tsx" "components/comments/submission-comment-tabs.tsx" "components/comments/submission-comment-thread.tsx" "components/comments/thread-entry.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/shared/worksheet-image-inspector.tsx" "frontend/components/shared/diagnostic-overlay/overlay-toolbar.tsx" "frontend/components/comments/submission-comment-thread.tsx" "frontend/components/comments/thread-entry.tsx"
```

- [ ] **Step 5: Commit**

```powershell
git add frontend/components/shared/ frontend/components/comments/; if ($?) { git commit -m "refactor(ui): complete strict shadcn migration across inspector, diagnostic overlay, and comments" }
```

---

## Wave 5 — Gradebook Full Sweep & Dedicated Mobile Card View

### Task 13: Strict shadcn Sweep of Existing Gradebook Components

**Files:**
- Modify: `frontend/components/gradebook/teacher-gradebook.tsx`
- Modify: `frontend/components/gradebook/gradebook-cell.tsx`
- Modify: `frontend/components/gradebook/gradebook-bulk-dialog.tsx`
- Modify: `frontend/components/gradebook/points-field.tsx`
- Modify: `frontend/components/gradebook/work-grade-details.tsx`
- Modify: `frontend/components/gradebook/work-grade-sheet.tsx`

- [ ] **Step 1: Clean up `teacher-gradebook.tsx`**

- Replace `"Sign in again to view grades."` `<p role="status">` (L157, L313) with `<Alert role="status"><AlertDescription>Sign in again to view grades.</AlertDescription></Alert>`.
- Wrap toolbar (L482) and Section Readiness Summary Bar (L564) in `<Card size="sm"><CardContent>...</CardContent></Card>`.
- Replace `"All current grades released"` raw `<span>` (L587) with `<Badge variant="outline" className="h-auto gap-1.5 rounded-full bg-band-4/15 border-band-4/30 px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-medium text-band-4-text">`.
- Convert activity filter dropdown (L495–517) to `<DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" className="min-h-11 sm:min-h-9" />} />` + `<DropdownMenuRadioGroup value={filter} onValueChange={setFilter}>` + `<DropdownMenuRadioItem>` (removing manual `✓` span).
- Replace bare `DropdownMenuTrigger`s in activity headers (L720) and `FloatingActionBar` batch menu (L931) with `render={<Button ... />}`, and wrap `"View activity details"` `DropdownMenuItem` (L753) and both `DropdownMenuSub`s (L941, L970) inside `<DropdownMenuGroup>`.
- Replace search empty state `<div>` (L880–887) with `<Empty>` + `"Clear search"` `<Button>`, and empty-state `<Link className={buttonVariants(...)}>` (L222, L613) with `<Button nativeButton={false} variant="outline" size="sm" render={<Link href="/roster" />} />`.
- Remove `className="bottom-4 mb-[env(safe-area-inset-bottom,0px)]"` on `<FloatingActionBar>` (L901 — now built into `FloatingActionBar` from Task 2).
- Sweep `space-y-*` → `flex flex-col gap-*`, `data-icon`, and manual `dark:` overrides on `ToggleGroupItem` (L548, L555).

- [ ] **Step 2: Clean up `gradebook-cell.tsx`, `gradebook-bulk-dialog.tsx`, `points-field.tsx`, `work-grade-details.tsx`, and `work-grade-sheet.tsx`**

- `gradebook-cell.tsx`: Wrap inline edit `<Input>` + validation message (L244–298) in `<Field data-invalid={Boolean(error) || undefined}>` + `<FieldError>`; replace `Unread` spans (L381, L478) with `<Badge variant="secondary">Unread</Badge>`; replace footer `border-t` (L544) with `<Separator />`; remove manual icon sizing inside `Button` and `space-y-*`. (Keep desktop `<div data-gradecell>` container intact.)
- `gradebook-bulk-dialog.tsx`: Replace `Viewing` & `ready to publish` spans (L263, L276) with `<Badge>`; replace info/success boxes (L306, L367) with `<Alert>`; replace standalone `<FieldError>` (L377) with `<Alert variant="destructive">`; remove Radix `data-[state=checked]:` override on Base UI `Checkbox` (L342); sweep `cn()`, `space-y-*`, and manual `dark:`.
- `points-field.tsx`: Replace raw `<p id={`${id}-hint`}>` (L45–53) with `{error ? <FieldError>{error}</FieldError> : hint ? <FieldDescription>{hint}</FieldDescription> : null}` and add `data-disabled={disabled || undefined}` on `<Field>`.
- `work-grade-details.tsx`: Replace `border-t` (L94) with `<Separator />` and `space-y-3` with `flex flex-col gap-3`.
- `work-grade-sheet.tsx`: Replace score & status card divs (L280, L346) with `<Card size="sm">` + `<Separator />`; replace `Teacher rubric` & `Late` spans (L294, L368) with `<Badge variant="outline">`; replace styled `<Link>` (L301) with `<Button nativeButton={false} variant="outline" size="sm" render={<Link ... />} />`; replace inline `"Set 0 pts?"` (L475) and release confirm box (L538) with `<AlertDialog>` (`AlertDialogTrigger render={<Button ... />}`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`); replace raw `amber-600` warning `<p>` (L532) with `<Alert>`; add `<Spinner data-icon="inline-start" />` on pending `"Releasing…"` buttons; sweep `space-y-*` and `data-icon`.

- [ ] **Step 3: Verify lint, type-check, and detector**

```powershell
Set-Location frontend; npx eslint "components/gradebook/teacher-gradebook.tsx" "components/gradebook/gradebook-cell.tsx" "components/gradebook/gradebook-bulk-dialog.tsx" "components/gradebook/points-field.tsx" "components/gradebook/work-grade-details.tsx" "components/gradebook/work-grade-sheet.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/gradebook/teacher-gradebook.tsx" "frontend/components/gradebook/gradebook-cell.tsx" "frontend/components/gradebook/work-grade-sheet.tsx"
```

- [ ] **Step 4: Commit**

```powershell
git add frontend/components/gradebook/; if ($?) { git commit -m "refactor(ui): complete strict shadcn migration across teacher gradebook components" }
```

---

### Task 14: Dedicated Mobile Gradebook Card View (`MobileGradebookList`) & Final Portal Compliance Gate

**Files:**
- Create: `frontend/components/gradebook/mobile-gradebook-list.tsx`
- Modify: `frontend/components/gradebook/teacher-gradebook.tsx`

**Interfaces:**
- Consumes: `SectionGradebook`, `GradebookCell` from `@/lib/hooks/use-gradebook`; `UnreadCommentThreads` from `@/lib/comments/types`; `hasUnreadWorkComments` from `@/lib/comments/selection`; `BandBadge` from `@/components/shared/band-badge`.
- Produces: `MobileGradebookList` component rendered exclusively on `<768px` (`block md:hidden print:hidden`) inside `SectionGrid`, sharing all filter, selection, bulk-action, and `WorkGradeSheet` state with the desktop/print `<Table>` (`hidden md:block print:block`).

- [ ] **Step 1: Create `frontend/components/gradebook/mobile-gradebook-list.tsx`**

```tsx
"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileX,
  MoreHorizontal,
  Send,
} from "lucide-react";
import type { GradebookCell, SectionGradebook } from "@/lib/hooks/use-gradebook";
import type { UnreadCommentThreads } from "@/lib/comments/types";
import { hasUnreadWorkComments } from "@/lib/comments/selection";
import { BandBadge } from "@/components/shared/band-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { cn } from "@/lib/utils";

type GradebookRow = SectionGradebook["rows"][number];
type GradebookActivity = SectionGradebook["activities"][number];

const INLINE_ACTIVITY_LIMIT = 3;

export interface MobileGradebookListProps {
  rows: GradebookRow[];
  activities: GradebookActivity[];
  viewMode: "points" | "diagnostic";
  selectedStudentIds: ReadonlySet<string>;
  unreadThreads: UnreadCommentThreads | undefined;
  search: string;
  isSingleActivityFiltered: boolean;
  onToggleStudent: (studentId: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onOpenCell: (cell: GradebookCell) => void;
  onBeginBulk: (activityId: string, operation: "zero" | "excuse" | "release") => void;
  onViewActivity: (activityId: string) => void;
  onClearSearch: () => void;
}

function formatMobileStatus(status: string) {
  return status === "Missing" ? "Awaiting scan" : status;
}

function MobileActivityRow({
  activity,
  work,
  viewMode,
  hasUnread,
  onOpenCell,
}: {
  activity: GradebookActivity;
  work: GradebookCell | undefined;
  viewMode: "points" | "diagnostic";
  hasUnread: boolean;
  onOpenCell: (cell: GradebookCell) => void;
}) {
  const subtitle = `${
    activity.points_possible ? `${activity.points_possible} pts` : "Bands only"
  }${activity.is_archived ? " · Archived" : ""}`;

  if (!work) {
    return (
      <Item variant="muted" size="sm">
        <ItemContent>
          <ItemTitle>{activity.title}</ItemTitle>
          <ItemDescription>{subtitle}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Badge variant="outline">Not assigned</Badge>
        </ItemActions>
      </Item>
    );
  }

  const statusLabel = formatMobileStatus(work.coursework_status);
  const showDraft =
    work.publication !== "released" &&
    (work.final_points !== null ||
      (work.points_possible === null && work.coursework_status === "Draft"));

  return (
    <Item
      variant="outline"
      size="sm"
      render={
        <button
          type="button"
          onClick={() => onOpenCell(work)}
          className="min-h-11 w-full cursor-pointer bg-card text-left hover:bg-muted/50"
        />
      }
    >
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">{activity.title}</ItemTitle>
        <ItemDescription>{subtitle}</ItemDescription>
      </ItemContent>

      <ItemActions className="shrink-0 flex-wrap justify-end gap-1.5">
        {viewMode === "diagnostic" ? (
          work.assessment_composite !== null ? (
            <div className="flex items-center gap-1.5">
              <BandBadge score={Number(work.assessment_composite)} size="sm" />
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {Math.round(Number(work.assessment_composite))}%
              </span>
            </div>
          ) : (
            <Badge variant="outline">{statusLabel}</Badge>
          )
        ) : work.final_points !== null ? (
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {work.final_points}
            {work.points_possible !== null ? ` / ${work.points_possible}` : ""}
          </span>
        ) : (
          <Badge variant="outline">{statusLabel}</Badge>
        )}

        {showDraft && <Badge variant="secondary">Draft</Badge>}
        {work.late && (
          <Badge variant="outline" className="border-band-2/30 bg-band-2/15 text-band-2-text">
            Late
          </Badge>
        )}
        {hasUnread && <Badge variant="secondary">Unread</Badge>}
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </ItemActions>
    </Item>
  );
}

function MobileStudentGradeCard({
  row,
  activities,
  viewMode,
  isSelected,
  unreadThreads,
  isSingleActivityFiltered,
  onToggleStudent,
  onOpenCell,
}: {
  row: GradebookRow;
  activities: GradebookActivity[];
  viewMode: "points" | "diagnostic";
  isSelected: boolean;
  unreadThreads: UnreadCommentThreads | undefined;
  isSingleActivityFiltered: boolean;
  onToggleStudent: (studentId: string, checked: boolean) => void;
  onOpenCell: (cell: GradebookCell) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = !isSingleActivityFiltered && activities.length > INLINE_ACTIVITY_LIMIT;
  const primaryActivities = shouldCollapse
    ? activities.slice(0, INLINE_ACTIVITY_LIMIT)
    : activities;
  const overflowActivities = shouldCollapse ? activities.slice(INLINE_ACTIVITY_LIMIT) : [];

  return (
    <Card size="sm">
      <CardHeader className="items-center">
        <div className="flex min-w-0 items-center gap-2.5">
          <Checkbox
            id={`mobile-gradebook-select-${row.student_id}`}
            checked={isSelected}
            onCheckedChange={(checked) => onToggleStudent(row.student_id, Boolean(checked))}
            aria-label={`Select ${row.student_name}`}
          />
          <CardTitle className="truncate text-sm">{row.student_name}</CardTitle>
        </div>
        <CardAction className="flex items-center gap-1.5">
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {row.totals.earned} / {row.totals.possible}
          </span>
          <Badge variant="secondary" className="tabular-nums">
            {row.totals.percentage === null ? "No grades" : `${row.totals.percentage}%`}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-2">
        <ItemGroup className="gap-2">
          {primaryActivities.map((act) => {
            const work = row.cells.find((entry) => entry.activity_id === act.id);
            return (
              <MobileActivityRow
                key={act.id}
                activity={act}
                work={work}
                viewMode={viewMode}
                hasUnread={
                  work
                    ? hasUnreadWorkComments(unreadThreads, {
                        activityId: work.activity_id,
                        studentId: work.student_id,
                      })
                    : false
                }
                onOpenCell={onOpenCell}
              />
            );
          })}
        </ItemGroup>

        {overflowActivities.length > 0 && (
          <Collapsible open={expanded} onOpenChange={setExpanded} className="flex flex-col gap-2">
            <CollapsibleContent>
              <ItemGroup className="gap-2">
                {overflowActivities.map((act) => {
                  const work = row.cells.find((entry) => entry.activity_id === act.id);
                  return (
                    <MobileActivityRow
                      key={act.id}
                      activity={act}
                      work={work}
                      viewMode={viewMode}
                      hasUnread={
                        work
                          ? hasUnreadWorkComments(unreadThreads, {
                              activityId: work.activity_id,
                              studentId: work.student_id,
                            })
                          : false
                      }
                      onOpenCell={onOpenCell}
                    />
                  );
                })}
              </ItemGroup>
            </CollapsibleContent>
            <CollapsibleTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 w-full justify-between text-muted-foreground"
                />
              }
            >
              <span>
                {expanded
                  ? "Show fewer activities"
                  : `Show ${overflowActivities.length} more ${
                      overflowActivities.length === 1 ? "activity" : "activities"
                    }`}
              </span>
              <ChevronDown
                data-icon="inline-end"
                className={cn("transition-transform duration-200", expanded && "rotate-180")}
                aria-hidden="true"
              />
            </CollapsibleTrigger>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

export function MobileGradebookList({
  rows,
  activities,
  viewMode,
  selectedStudentIds,
  unreadThreads,
  search,
  isSingleActivityFiltered,
  onToggleStudent,
  onToggleSelectAll,
  onOpenCell,
  onBeginBulk,
  onViewActivity,
  onClearSearch,
}: MobileGradebookListProps) {
  if (!rows.length) {
    return (
      <Empty className="rounded-xl border border-border bg-card p-6">
        <EmptyHeader>
          <EmptyTitle>No students match “{search}”</EmptyTitle>
          <EmptyDescription>Try a different student name or clear the search filter.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" variant="outline" size="sm" onClick={onClearSearch}>
            Clear search
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  const allSelected = rows.length > 0 && rows.every((row) => selectedStudentIds.has(row.student_id));
  const selectedCount = selectedStudentIds.size;

  const renderActivityActionItems = (act: GradebookActivity) => (
    <>
      <DropdownMenuGroup>
        <DropdownMenuItem onClick={() => onBeginBulk(act.id, "release")}>
          <Send data-icon="inline-start" aria-hidden="true" />
          Release grades to parents
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onBeginBulk(act.id, "zero")}
          disabled={act.points_possible === null}
        >
          <FileX data-icon="inline-start" aria-hidden="true" />
          {selectedCount
            ? `Mark uncollected (0) for ${selectedCount}`
            : "Mark uncollected (0 pts)"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onBeginBulk(act.id, "excuse")}>
          <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
          {selectedCount ? `Excuse ${selectedCount} selected` : "Excuse all in section"}
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem onClick={() => onViewActivity(act.id)}>
          <ExternalLink data-icon="inline-start" aria-hidden="true" />
          View activity details
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  );

  return (
    <div className={cn("flex flex-col gap-3", selectedCount > 0 && "pb-24")}>
      <div className="flex items-center justify-between gap-2">
        <Field orientation="horizontal" className="w-auto min-h-11 items-center gap-2.5">
          <Checkbox
            id="mobile-gradebook-select-all"
            checked={allSelected}
            onCheckedChange={(checked) => onToggleSelectAll(Boolean(checked))}
            aria-label="Select shown students"
          />
          <FieldLabel htmlFor="mobile-gradebook-select-all" className="cursor-pointer text-xs">
            Select all ({rows.length})
          </FieldLabel>
        </Field>

        {activities.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0" />
              }
            >
              <span>Activity actions</span>
              <MoreHorizontal data-icon="inline-end" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {activities.length === 1 ? (
                <>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="truncate">
                      {activities[0].title}
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  {renderActivityActionItems(activities[0])}
                </>
              ) : (
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Choose an activity</DropdownMenuLabel>
                  {activities.map((act) => (
                    <DropdownMenuSub key={act.id}>
                      <DropdownMenuSubTrigger className="min-h-10">
                        <span className="truncate">{act.title}</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-56">
                        {renderActivityActionItems(act)}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ))}
                </DropdownMenuGroup>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <MobileStudentGradeCard
            key={row.student_id}
            row={row}
            activities={activities}
            viewMode={viewMode}
            isSelected={selectedStudentIds.has(row.student_id)}
            unreadThreads={unreadThreads}
            isSingleActivityFiltered={isSingleActivityFiltered}
            onToggleStudent={onToggleStudent}
            onOpenCell={onOpenCell}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire `MobileGradebookList` into `frontend/components/gradebook/teacher-gradebook.tsx`**

Import `{ MobileGradebookList } from "./mobile-gradebook-list"`. Inside `SectionGrid`, wrap the existing `<div ref={tableRef} ...>` inside `<div className="hidden md:block print:block">...</div>` and render `<div className="block md:hidden print:hidden">` right above it:

```tsx
<div className="block md:hidden print:hidden">
  <MobileGradebookList
    rows={rows}
    activities={activities}
    viewMode={viewMode}
    selectedStudentIds={selected}
    unreadThreads={unread.data}
    search={search}
    isSingleActivityFiltered={Boolean(activityId)}
    onToggleStudent={toggle}
    onToggleSelectAll={(checked) =>
      setSelected((old) => {
        const next = new Set(old);
        rows.forEach((row) => {
          if (checked) next.add(row.student_id);
          else next.delete(row.student_id);
        });
        return next;
      })
    }
    onOpenCell={(work) => setCell(work)}
    onBeginBulk={beginBulk}
    onViewActivity={(id) => router.push(`/activities/${id}`)}
    onClearSearch={() => setSearch("")}
  />
</div>
```

- [ ] **Step 3: Run Full Portal-Wide Verification & Strict Compliance Audit**

1. Lint & TypeScript strict check:
```powershell
Set-Location frontend; npx eslint .; npx tsc --noEmit
```
Expected: 0 errors, 0 new warnings.

2. Impeccable design detector on new & high-churn files:
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/gradebook/mobile-gradebook-list.tsx" "frontend/components/gradebook/teacher-gradebook.tsx" "frontend/components/cursive-stroke-canvas.tsx" "frontend/components/cursive-guide-dialog.tsx" "frontend/components/settings/security-settings-card.tsx"
```
Expected: 0 new design regressions.

3. Strict case-sensitive shadcn compliance scan across the entire Teacher Portal:
```powershell
$dirs = @(
  'frontend/app/(teacher)',
  'frontend/components/teacher-header.tsx',
  'frontend/components/teacher-sidebar.tsx',
  'frontend/components/teacher-modals-provider.tsx',
  'frontend/components/quick-upload-dialog.tsx',
  'frontend/components/rubric-reference-dialog.tsx',
  'frontend/components/shortcuts-dialog.tsx',
  'frontend/components/cursive-guide-dialog.tsx',
  'frontend/components/cursive-stroke-canvas.tsx',
  'frontend/components/activities',
  'frontend/components/comments',
  'frontend/components/dashboard',
  'frontend/components/gradebook',
  'frontend/components/notifications',
  'frontend/components/roster',
  'frontend/components/settings',
  'frontend/components/shared',
  'frontend/components/submissions',
  'frontend/components/ui/filter-pills.tsx',
  'frontend/components/ui/floating-action-bar.tsx',
  'frontend/components/ui/search-input.tsx'
)
$files = foreach ($d in $dirs) {
  if (Test-Path $d -PathType Leaf) { Get-Item $d }
  elseif (Test-Path $d -PathType Container) { Get-ChildItem -Path $d -Recurse -File -Include *.tsx }
}
$files = $files | Where-Object { $_.FullName -notmatch 'parent-grades|parent-profile-settings|diagnostic-overlay\\layers|guide-line-overlay' }
$pattern = '<(button|input|select|textarea|label|fieldset|legend|table|thead|tbody|tr|th|td|hr|details|summary|kbd)\b|role="(radiogroup|tablist|tab)"|\bspace-[xy]-|Loader2|sonner'
$files | Select-String -CaseSensitive -Pattern $pattern | ForEach-Object { "$($_.Path -replace '.*\\writewise\\',''):L$($_.LineNumber): $($_.Line.Trim())" }
```
Expected: ONLY explicitly exempt matches — `quick-upload-dialog.tsx` `<input type="file">` (2 matches) and `<button>` inside Base UI `render={<button ... />}` props on `Item` (`class-table.tsx`, `student-drill-down.tsx`, `mobile-gradebook-list.tsx`). Zero other hits!

- [ ] **Step 4: Manual QA Pass (Desktop `≥1280px` & Mobile `375px`, Light & Dark)**

Complete the full manual QA matrix in `docs/superpowers/specs/2026-11-28-teacher-portal-strict-shadcn-mobile-design.md` §4 (Base UI toasts including description & Undo action, mobile sidebar `Sheet`, `CursiveGuideDialog` mobile filter `Drawer`, `/dashboard` mobile `Item` rows & `ChartTooltipContent`, `/roster` mobile `Card` list & `ToggleGroup` sort, `/settings` `FieldError` validation, `/activities` & `/activities/[id]` review flow + `AlertDialog` delete + mobile sticky preview bar, and `/gradebook` desktop sticky grid + Print view + mobile `MobileGradebookList` cards, `Select all`, `FloatingActionBar`, `Activity actions`, collapsible overflow, and `WorkGradeSheet`).

- [ ] **Step 5: Commit**

```powershell
git add frontend/components/gradebook/mobile-gradebook-list.tsx frontend/components/gradebook/teacher-gradebook.tsx; if ($?) { git commit -m "feat(gradebook): add dedicated mobile card view using shadcn primitives" }
```
