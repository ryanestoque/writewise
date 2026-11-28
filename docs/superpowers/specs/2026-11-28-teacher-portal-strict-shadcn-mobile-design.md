# Teacher Portal Strict shadcn/ui & Mobile UX Transition — Design Spec

**Date:** 2026-11-28
**Status:** Draft for User Review
**Related Prior Plan:** `docs/superpowers/plans/2026-11-28-teacher-portal-shadcn-transition.md` (commit `533506d`)
**Design System References:** `DESIGN.md` (visual tokens, spacing, developmental 4-band colors, shadcn-first policy), `docs/DESIGN.md` (teacher portal flows & accessibility targets), `AGENTS.md` §4–§6, `.agents/skills/shadcn/SKILL.md` (`base-luma` / Base UI preset).

---

## 1. Objective & Scope

Bring **100% of Teacher Portal pages, subpages, dialogs, sheets, drawers, and shared Teacher-used components** into strict compliance with the installed `base-luma` (`@base-ui/react`) shadcn/ui component system across **both desktop (`≥1280px`) and mobile (`<640px` / `375px`) viewports**.

This follow-up sweep completes everything remaining after the initial transition pass (`533506d`):
1. **App-wide Base UI Toast Cut:** Replace `sonner` with the installed Base UI `@/components/ui/toast` across all 30 callers (22 Teacher/Shared + 8 Auth/Parent) so `providers.tsx` mounts a single native Base UI `<Toaster />`, removing `components/ui/sonner.tsx` and the `sonner` dependency (`^2.0.8`).
2. **Tier 1 — Zero Remaining Raw HTML Controls & Hand-Rolled Widgets:** Eliminate every remaining raw `<button>`, `<label>`, hand-rolled `role="radiogroup"`, hand-rolled collapsible, custom alert/status/warning banner, hand-rolled empty state, custom card/dialog/sheet footer, custom tooltip (`TrendChartTooltip`), custom pill `<span>`, raw form layout, and `animate-pulse` loading placeholder.
3. **Tier 2 — Strict `shadcn` Composition & Styling Hygiene:** Sweep `DropdownMenuGroup` / `SelectGroup` wrappers, Base UI `render={<Button />}` triggers and `Button nativeButton={false} render={<Link />}` links, `space-y-*` / `space-x-*` → `flex flex-col gap-*`, `w-N h-N` → `size-N`, template-literal ternaries → `cn()`, manual `dark:` overrides → semantic tokens, button icons → `data-icon="inline-start|inline-end"` without manual sizing classes, pending buttons → `<Spinner data-icon="inline-start" />`, and full `CardHeader`/`CardTitle`/`CardContent`/`CardFooter` anatomy.
4. **Mobile Viewport UX Upgrades:** Upgrade every Teacher Portal mobile surface (`ClassTable`, `RosterPage`, `CursiveGuideDialog`, `SubmissionDetailContent`, `RawMeasurementsTable`, `OverlayToolbar`, `ActivityReviewToolbar`, `FilterPills`, `FloatingActionBar`, `FloatingBatchBar`) and add a **dedicated mobile card view for `/gradebook`** (`components/gradebook/mobile-gradebook-list.tsx`).

### Out-of-Scope / Explicitly Exempt (Keep Custom)
Per `AGENTS.md` §4 and `DESIGN.md`, the following domain-specific elements remain custom by design:
- Hidden `<input type="file">` native mobile camera/photo capture inputs (`quick-upload-dialog.tsx`).
- Pure SVG handwriting overlays (`components/shared/guide-line-overlay.tsx`, `components/shared/diagnostic-overlay/layers/*`).
- Pure `<svg>` stroke animation canvas inside `components/cursive-stroke-canvas.tsx` (its control toolbar above the SVG **is** migrated to shadcn).
- `components/shared/band-position-bar.tsx` 4-zone rubric spectrum gauge (only minor `space-y-1` / `w-N h-N` / `dark:` hygiene is applied; the 4-zone marker geometry stays custom).
- `components/activities/activity-card.tsx` multi-segment stacked progress bar (`completed` + `processing` + `rejected` segments).
- `components/submissions/raw-measurements-table.tsx` `role="meter"` CV target-window range bar.
- Desktop `<div data-gradecell tabIndex={...}>` spreadsheet gridcell focus container in `gradebook-cell.tsx` (required to prevent invalid nested `<button>` elements inside `<button>` for the inner Edit/Inspect actions while keeping keyboard arrow-key navigation).
- Note: The 8 non-Teacher files (`login`, `accept-invite`, `reset-password`, `parent-nav`, `parent-profile-settings-card`, `parent-upload-dialog`, `take-home-activities`, `worksheet-view-dialog`) are touched **strictly for Wave 1's `sonner` → `@/components/ui/toast` import/call cut** and no other UI edits.

---

## 2. Global Constraints & Conventions

Every wave must enforce all of the following without exception:

1. **Base UI (`base-luma`) composition:**
   - Use `render={<Element />}` on `@base-ui/react` triggers (`TooltipTrigger`, `DropdownMenuTrigger`, `PopoverTrigger`, `CollapsibleTrigger`, `SidebarMenuButton`, `Item`, `DialogTrigger`, `DialogClose`, `Button nativeButton={false} render={<Link />}`). Never use Radix `asChild`.
   - Never use Radix `data-[state=checked]:` / `data-[state=open]:` selectors on Base UI primitives; rely on Base UI's built-in styles or `data-checked:` / `data-panel-open:` / `data-active:`.
   - Wrap all `DropdownMenuItem`s and `DropdownMenuSub`s in `DropdownMenuGroup` (or `DropdownMenuRadioGroup` + `DropdownMenuRadioItem` for single-select menus with checkmarks). Wrap all `SelectItem`s in `SelectGroup`.
   - Every `Dialog`, `Sheet`, `Drawer`, and `AlertDialog` must include its corresponding `*Title` (`sr-only` if visually hidden).
   - Every direct child of `MessageScrollerContent` must be a `MessageScrollerItem`.
2. **Forms & Option Sets:**
   - Wrap form controls in `FieldGroup` + `Field` + `FieldLabel` + `FieldDescription` + `FieldError`. Propagate `data-invalid={Boolean(error) || undefined}` and `data-disabled={disabled || undefined}` on `Field`, paired with `aria-invalid` / `disabled` on the control.
   - Use `InputGroup` + `InputGroupInput` / `InputGroupTextarea` + `InputGroupAddon` + `InputGroupButton` whenever an input has an embedded icon, badge, or button.
   - Use `ToggleGroup` + `ToggleGroupItem` for 2–7 option sets (`multiple={false}` for exclusive, `multiple` for multi-select). Prevent accidental empty deselection on exclusive `ToggleGroup`s (`if (vals.length > 0) ...`).
   - Use `Toggle` for standalone binary press controls (`Ink Contrast`, `Magnify`, `Lines`), and `ButtonGroup` for grouped steppers/pagers/zoom clusters.
3. **Styling & Semantic Tokens (`DESIGN.md` + `shadcn` rules):**
   - Replace `space-y-*` / `space-x-*` with `flex flex-col gap-*` / `flex items-center gap-*` (staying on the 4px spacing scale; `gap-1.5` allowed only for tight label-to-input proximity).
   - Replace equal `w-N h-N` with `size-N`.
   - Use `cn()` for conditional class strings (no manual template-literal ternaries).
   - Remove manual `dark:` color overrides in favor of semantic tokens (`bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary`, `bg-destructive`, `text-destructive`, and `DESIGN.md` semantic band/status tokens `bg-band-1..4`, `text-band-1..4-text`, `bg-warning`, `bg-success`). Never use raw Tailwind palette hues (`amber-*`, `emerald-*`, `red-*`) or standard red (`#EF4444`) on student scores, progress charts, or handwriting feedback.
   - Remove manual `z-index` overrides on overlay content (`DropdownMenuContent`, `PopoverContent`, `DialogContent`, `SheetContent`, `DrawerContent`).
   - Inside `Button`, `AlertDialogAction`, `DropdownMenuItem`, and `Alert`, use `data-icon="inline-start"` or `data-icon="inline-end"` without manual `size-*` / `w-* h-*` / `mr-*` sizing classes.
   - Replace pending text-only or spinning-icon buttons with `<Spinner data-icon="inline-start" />` + `disabled`.
   - Preserve `DESIGN.md` layout rules: never add `max-w-*` or `container` caps on portal shells or page roots; keep 44px (`min-h-11`) mobile touch targets on interactive controls; keep all keyboard shortcuts (`Ctrl/Cmd+B`, `Ctrl/Cmd+K`, `Alt+C`, `Alt+R`, `Alt+1–4`, `Alt+ArrowLeft/Right`, `/`, `J/K`, `C`, `L`, `+/- /0`, `Ctrl+Enter`, Gradebook grid arrow keys) intact.
   - Do not add Lucide icons to non-interactive headers, pill badges, or stat cards (`DESIGN.md` ban).
4. **No new npm packages or shadcn CLI installs required:** All target primitives (`accordion`, `alert`, `alert-dialog`, `avatar`, `badge`, `breadcrumb`, `bubble`, `button`, `button-group`, `card`, `chart`, `checkbox`, `collapsible`, `combobox`, `dialog`, `drawer`, `dropdown-menu`, `empty`, `field`, `input`, `input-group`, `item`, `kbd`, `label`, `marker`, `message`, `message-scroller`, `native-select`, `popover`, `progress`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `spinner`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toggle`, `toggle-group`, `tooltip`) are already installed in `frontend/components/ui/`.

---

## 3. Five-Wave Architecture & Detailed Surface Changes

### Wave 1 — App-Wide Base UI Toast Cut & Shared UI Primitives

**Goal:** Establish a single Base UI toast bus app-wide and harden shared UI primitives before touching portal pages.

1. **Base UI Toast Migration (`providers.tsx`, `toast.tsx`, 30 callers, `package.json`):**
   - Replace `Loader2Icon` on `frontend/components/ui/toast.tsx:14,157` with `<Spinner aria-hidden="true" />` from `@/components/ui/spinner`.
   - Swap `frontend/components/providers.tsx` from `import { Toaster } from "@/components/ui/sonner"` to `import { Toaster } from "@/components/ui/toast"`.
   - Migrate all **30 callers** from `import { toast } from "sonner"` to `import { toast } from "@/components/ui/toast"`:
     - `toast.success(msg)` → `toast.add({ type: "success", title: msg })`
     - `toast.error(msg)` → `toast.add({ type: "error", title: msg })`
     - `toast.warning(msg)` → `toast.add({ type: "warning", title: msg })`
     - `toast.info(msg)` → `toast.add({ type: "info", title: msg })`
     - `frontend/app/accept-invite/page.tsx:73` → `toast.add({ type: "success", title: "Request message copied to clipboard!", description: "Paste it in an email or message to your child's teacher." })`
     - `frontend/components/submissions/manual-rubric-entry-form.tsx:589` → `toast.add({ type: "success", title: "Rubric recorded — advancing to next student", actionProps: { children: "Undo", onClick: ... } })`
   - Complete caller list (30 files):
     - *Teacher / Shared (22):* `app/(teacher)/activities/page.tsx`, `app/(teacher)/dashboard/page.tsx`, `app/(teacher)/roster/page.tsx`, `components/activities/create-activity-dialog.tsx`, `components/activities/delete-activity-dialog.tsx`, `components/activities/edit-activity-dialog.tsx`, `components/activities/worksheet-history.tsx`, `components/gradebook/gradebook-cell.tsx`, `components/gradebook/teacher-gradebook.tsx`, `components/gradebook/work-grade-sheet.tsx`, `components/notifications/notification-bell.tsx`, `components/quick-upload-dialog.tsx`, `components/roster/batch-move-dialog.tsx`, `components/roster/bulk-student-dialog.tsx`, `components/roster/manage-sections-dialog.tsx`, `components/roster/student-dialog.tsx`, `components/settings/profile-settings-card.tsx`, `components/settings/security-settings-card.tsx`, `components/submissions/manual-rubric-entry-form.tsx`, `components/submissions/submission-detail-content.tsx`, `components/submissions/submission-lifecycle-controls.tsx`, `components/teacher-modals-provider.tsx`.
     - *Auth / Parent (8 — toast cut only):* `app/accept-invite/page.tsx`, `app/login/page.tsx`, `app/reset-password/page.tsx`, `components/parent-nav.tsx`, `components/parent/parent-upload-dialog.tsx`, `components/parent/take-home-activities.tsx`, `components/parent/worksheet-view-dialog.tsx`, `components/settings/parent-profile-settings-card.tsx`.
   - Delete `frontend/components/ui/sonner.tsx` and remove `"sonner"` from `frontend/package.json` + lockfile (`npm uninstall sonner`).

2. **Shared Primitives (`components/ui/*` & `components/shared/*`):**
   - `frontend/components/ui/filter-pills.tsx`: Wrap horizontal `ToggleGroup` track inside `<ScrollArea>` + `<ScrollBar orientation="horizontal" />`, remove manual `dark:` and `bg-brand-700`/`bg-white/20` overrides on `ToggleGroupItem` / `Badge`, and remove manual icon sizing classes inside `Button` / `ToggleGroupItem`.
   - `frontend/components/ui/floating-action-bar.tsx`: Remove manual `dark:` overrides, arbitrary shadow values, and redundant `Badge` color classes; apply consistent safe-area bottom inset on mobile (`bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:bottom-6 md:pb-2.5`) so callers never need to override `bottom-*`.
   - `frontend/components/ui/search-input.tsx`: Remove manual `dark:bg-input/30` override on `InputGroup`; remove `tabIndex={-1}` on the clear `InputGroupButton` so keyboard users can tab to Clear as well as press `Escape`.
   - `frontend/components/shared/band-badge.tsx`: Replace `w-1.5 h-1.5` / `w-2 h-2` with `size-1.5` / `size-2`.
   - `frontend/components/shared/query-recovery.tsx`: Swap static `<RefreshCw>` for `<Spinner data-icon="inline-start" />` when `isRetrying` is true.
   - `frontend/components/shared/score-source-indicator.tsx`: Replace raw-styled `TooltipTrigger` (`tabIndex={-1}`) with `<TooltipTrigger render={<Button type="button" variant="link" size="xs" />} />` and replace `text-amber-600 dark:text-amber-400` with semantic `text-band-2-text`.

---

### Wave 2 — Shell, Global Modals, Reference Guides & Notifications

**Files (11):** `app/(teacher)/layout.tsx`, `components/teacher-sidebar.tsx`, `components/teacher-modals-provider.tsx`, `components/cursive-stroke-canvas.tsx`, `components/cursive-guide-dialog.tsx`, `components/rubric-reference-dialog.tsx`, `components/shortcuts-dialog.tsx`, `components/quick-upload-dialog.tsx`, `components/notifications/notification-bell.tsx`, `components/notifications/notification-list.tsx`, `components/notifications/notification-row.tsx`.

- **Shell:**
  - `app/(teacher)/layout.tsx`: Replace `space-y-6` with `flex flex-col gap-6`.
  - `teacher-sidebar.tsx`: Replace collapsed icon-rail pending `<span>` with `<Badge>`; move expanded pending-review `<Link>` banner onto `SidebarMenuButton render={<Link />}` + `SidebarMenuBadge`; use `<DropdownMenuLabel>` for the footer user profile header; wrap `"Sign out"` `DropdownMenuItem` inside `<DropdownMenuGroup>`; replace `h-10 w-10` with `size-10`, add `data-icon="inline-start"`, and remove manual `dark:` overrides.
  - `teacher-modals-provider.tsx`: Replace `<Spinner className="size-4" />` inside `AlertDialogAction` with `<Spinner data-icon="inline-start" />`.
- **Cursive Stroke Canvas & Guide:**
  - `cursive-stroke-canvas.tsx`: Replace hand-rolled `role="radiogroup"` + 3 `<button role="radio">` + `handleCaseKeyDown` with `<ToggleGroup multiple={false}>` + `<ToggleGroupItem>` (`lower` / `upper` / `both`); replace Play/Pause/Replay raw `<button>`s with `<Button variant="outline" size="sm">` / `<Button variant="outline" size="icon-sm">`; replace `border-l` with `<Separator orientation="vertical" />`; replace 3 looped speed `<button>`s with `<ToggleGroup multiple={false}>` + `<ToggleGroupItem>`. Keep `<svg>` animation canvas untouched.
  - `cursive-guide-dialog.tsx` (**Mobile UX upgrade**): Replace mobile (`sm:hidden`) hand-rolled collapsible filter panel, raw `×` active-filter `<span>`, and custom horizontal chip rail with a shadcn `<Drawer>` (trigger `<Button variant="outline" size="sm">` + `<Badge variant="secondary">` active count; `<DrawerHeader>` with `<DrawerTitle>` / `<DrawerDescription>`; `<DrawerContent>` housing Case and Zone `<ToggleGroup>`s + Clear Filters `<Button>`). Wrap desktop zone strip in `<ScrollArea>` + `<ScrollBar orientation="horizontal" />`. Replace Coaching Tip / Watch Out `<div>`s with `<Alert>` + `<AlertTitle>` + `<AlertDescription>`; replace Practice Words `<span>`s with `<Badge variant="outline">`; replace zero-match `<div>` with `<Empty>`; sweep `space-y-*`, `data-icon`, and manual `dark:` overrides.
- **Rubric Reference & Shortcuts:**
  - `rubric-reference-dialog.tsx`: Replace `border-t` section divider with `<Separator />`; refactor 4 scoring band cards to full `CardHeader` / `CardTitle` / `CardAction` / `CardContent`; sweep `space-y-*`, `data-icon`, and manual `dark:` overrides.
  - `shortcuts-dialog.tsx`: Replace `space-y-*` with `flex flex-col gap-*` and custom `divide-y` box with `ItemGroup` + `Item` + `ItemSeparator`.
- **Quick Upload Dialog:**
  - `quick-upload-dialog.tsx`: Wrap form fields in `FieldGroup`; replace Photo Quality Tips manual `showTips` toggle with `Collapsible` (`CollapsibleTrigger render={<Button ... />}`, `CollapsibleContent`); replace `role="status"` / retake warning boxes with `<Alert>` / `<AlertTitle>` / `<AlertDescription>`; replace prefilled `role="textbox"` read-only divs with `<InputGroup>` + `<InputGroupInput readOnly />` + `<InputGroupAddon align="inline-end"><Badge variant="secondary">Locked</Badge></InputGroupAddon>`; wrap camera `<NativeSelect>` in `<Field>` + `<FieldLabel className="sr-only">`; replace raw footer `border-t` div with `<DialogFooter>`; replace `RotateCwIcon animate-spin` with `<Spinner data-icon="inline-start" />`; replace template-literal ternaries with `cn()` and `space-y-*` with `flex flex-col gap-*`. Keep hidden `<input type="file">` capture inputs raw.
- **Notifications:**
  - `notification-bell.tsx`, `notification-list.tsx`, `notification-row.tsx`: Wrap scrollable notification feed in `<ScrollArea>`, add `<Spinner data-icon="inline-start" />` to pending `"Mark all read"` / `"Load older updates"` buttons, remove redundant `Badge` color overrides, manual icon sizing, and manual `dark:` overrides.

---

### Wave 3 — Dashboard, Roster & Settings (Desktop + Mobile)

**Files (15):** `app/(teacher)/dashboard/page.tsx`, `components/dashboard/*` (4 files), `app/(teacher)/roster/page.tsx`, `components/roster/*` (5 files), `app/(teacher)/settings/page.tsx`, `components/settings/{notification,profile,security}-settings-card.tsx` (3 files).

- **Dashboard:**
  - `dashboard/page.tsx`: Replace `space-y-*` with `flex flex-col gap-*`, add `data-icon="inline-start"` to button icons, replace spinning `RotateCcw` / Retry text swap with `<Spinner data-icon="inline-start" />`, remove manual `size-4` inside `Alert` and `Button` overrides.
  - `summary-cards.tsx`: Add full `CardHeader` / `CardTitle` / `CardAction` / `CardContent` / `CardFooter` anatomy; replace `dark:text-amber-300` / manual `dark:` overrides with semantic tokens; replace `space-y-*` with `flex flex-col gap-*`.
  - `class-table.tsx`:
    - **Mobile (`sm:hidden`):** Wrap sort `<NativeSelect>` + `<FieldLabel>` in `<Field orientation="horizontal">`; replace raw `<button>` student cards with `<ItemGroup>` of `<Item variant="outline" render={<button type="button" onClick={...} />} />` (`min-h-11`).
    - **Desktop:** Replace raw `<button>` student name trigger in `<TableCell>` with `<Button type="button" variant="link" />`; replace `<TooltipTrigger>` raw-styled sort headers with `<TooltipTrigger render={<Button type="button" variant="ghost" size="xs" />} />`; replace `<Link className={buttonVariants(...)}>` with `<Button nativeButton={false} render={<Link href="/roster" />} />`; wrap table & empty states in `Card` / `CardContent` / `CardFooter` + `Separator`; replace `w-2 h-2` with `size-2`, `space-y-*` with `flex flex-col gap-*`, and remove manual `dark:` overrides.
  - `criterion-trend-chart.tsx`: Replace hand-rolled `TrendChartTooltip` with `<ChartTooltipContent />` (removing manual `z-50` and `border-b`); replace 6 looped `<Toggle>` components with `<ToggleGroup multiple>` + `<ToggleGroupItem>`; wrap trajectory summary in `<Card>` + `<Separator />`; add full `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter` (moving mobile scroll hint into `CardFooter`); replace `w-2 h-2`, `space-y-*`, manual icon sizes, and manual `dark:` overrides.
  - `student-drill-down.tsx`: Replace both raw `<button>` submission lists (Overview + History) with `<ItemGroup>` + `<Item variant="outline" render={<button type="button" />} />`; replace Diagnostic Criteria Framework `<ul>` with `<Card>` / `<ItemGroup>`; replace Diagnostic Note box with `<Alert>`; replace raw `<footer>` with `<SheetFooter>` + `<Separator />`; add `CardHeader`/`CardTitle` to Overall Performance & Trends cards; replace spinning `RefreshCw` on retry with `<Spinner data-icon="inline-start" />`; replace all `space-y-*` with `flex flex-col gap-*` and add `data-icon`.
- **Roster:**
  - `roster/page.tsx`:
    - **Mobile (`md:hidden`):** Replace 2 looped sort `Button`s (`Name` / `Section`) with `<ToggleGroup multiple={false}>` + `<ToggleGroupItem>`; replace raw `<div>` student cards + `border-t` footers with `<Card size="sm">` + `<CardHeader>` + `<CardContent>` + `<Separator />` + `<CardFooter>`.
    - **Both:** Wrap `RowActions` `DropdownMenuItem`s in `<DropdownMenuGroup>`; replace raw `emerald-50`/`amber-50` status badge classes with semantic tokens; replace `h-9 w-9` → `size-9`, template-literal ternaries → `cn()`, `space-y-*` → `flex flex-col gap-*`, and add `data-icon` on button icons / `Spinner`.
  - `batch-move-dialog.tsx`, `bulk-student-dialog.tsx`, `student-dialog.tsx`, `manage-sections-dialog.tsx`, `floating-batch-bar.tsx`:
    - Replace all raw `border-t` footers with `<DialogFooter>`; replace raw hint `<p>`s with `<FieldDescription>`; replace amber/destructive callout boxes with `<Alert>` (semantic tokens, no `amber-*`); replace empty state in `manage-sections-dialog.tsx` with `<Empty>`; wrap inline section rename `<Input>` + error in `<Field>` + `<FieldError>` (inside `<FieldGroup>`); replace student chips & count pills with `<Badge>`; replace `h-10 w-10` → `size-10`, `w-* h-*` icons → `data-icon`, remove manual `dark:` / button color overrides, and fix `floating-batch-bar.tsx` conflicting mobile label classes (`sm:hidden hidden min-[360px]:inline` → clean `hidden min-[360px]:inline sm:hidden`).
- **Settings:**
  - `settings/page.tsx`: Replace raw `<div className="border-border border-t" />` with `<Separator />` and `space-y-10` with `flex flex-col gap-10`.
  - `security-settings-card.tsx`: Refactor all 3 password fields onto `<FieldGroup>` + `<Field data-invalid={...}>` + `<FieldLabel>` + `<FieldDescription>` + `<FieldError>`; add `<CardHeader>` / `<CardTitle>` / `<CardDescription>`; sweep `cn()`, `data-icon`, `flex flex-col gap-*`, and manual `dark:` overrides.
  - `profile-settings-card.tsx`: Add `<CardHeader>` / `<CardTitle>` / `<CardDescription>`, propagate `data-disabled={isSaving || undefined}` on `<Field>`, remove manual `size-3` on `<Lock>` inside `<Badge>`.
  - `notification-settings-card.tsx`: Replace `<p role="status">Email settings saved.</p>` with `<Alert role="status">` and drop redundant `Card` ring/border overrides.

---

### Wave 4 — Activities, Submissions, Diagnostic Overlay & Comments (Desktop + Mobile)

**Files (44):** `app/(teacher)/activities/page.tsx`, `app/(teacher)/activities/[id]/page.tsx`, `app/(teacher)/activities/[id]/submissions/[submissionId]/page.tsx`, `components/activities/*` (17 UI files), `components/submissions/*` (8 files), `components/shared/{band-position-bar,criterion-feedback-row,worksheet-image-inspector}.tsx`, `components/shared/diagnostic-overlay/{annotation-tooltip,calm-overlay-toolbar,diagnostic-fallback-banner,diagnostic-overlay,overlay-toolbar}.tsx`, `components/comments/*` (8 non-clean files).

- **Activities Routes & Components:**
  - `activities/page.tsx`: Replace raw `<button>` `"Clear search"` with `<Button variant="link" size="xs">`; replace bare `DropdownMenuTrigger` with `render={<Button variant="outline" size="sm" />}`; replace manual `✓` `DropdownMenuItem`s with `DropdownMenuRadioGroup` + `DropdownMenuRadioItem`; wrap skeleton items in `<Card>` / `<CardContent>`; sweep `space-y-*`, `data-icon`, and manual `dark:` overrides.
  - `activities/[id]/page.tsx`: Replace raw `<button>` `"Clear hidden"` with `<Button variant="link" size="xs">`, amber warning `<div>` with `<Badge>` / `<Alert>` (semantic tokens), `<div role="status">` banner with `<Alert role="status">`, hand-styled back `<Link>`s with `<Button nativeButton={false} variant="ghost" render={<Link href="/activities" />} />`, `border-t` on `Collapsible` with `<Separator />`, add `<Spinner data-icon="inline-start" />` on `isBatchExcusing` `AlertDialogAction`, and sweep `space-y-*` / `data-icon` / `dark:`.
  - `activities/[id]/submissions/[submissionId]/page.tsx`: Replace all 3 hand-rolled fallback states (`Invalid Conversation Link`, `Unable to Load Submission`, `Submission Not Found`) with `<Empty>` / `<Alert variant="destructive">` + `<Button nativeButton={false} render={<Link href={activityHref} />} />`; sweep `space-y-*` and `data-icon`.
  - `components/activities/*`:
    - `delete-activity-dialog.tsx`: Migrate from `Dialog` → `AlertDialog` (`AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`) + `<Alert>` warning callout.
    - `create-activity-dialog.tsx` & `edit-activity-dialog.tsx`: Replace raw `<button>` prompt suggestion chips with `<Button variant="outline" size="xs">`; replace amber warning `<div>`/`<p>` callouts with `<Alert>`; replace raw hint `<p>`s with `<FieldDescription>`; migrate take-home toggle to `<Field orientation="horizontal">` + `<FieldContent>` + `<FieldDescription>`; replace raw footer divs with `<DialogFooter>`.
    - `submission-card.tsx`: Replace all 5 raw `<button>`s with `<Button>` (preserving photo preview and 4:3 dropzone touch targets); replace raw `<label>` with `<Field orientation="horizontal">` + `<FieldLabel>`; replace hand-rolled rejection & newer-attempt boxes with `<Alert>`; replace pulsing `<Clock>` with `<Spinner>`; migrate `<article>` cards to `<Card>` + `<CardFooter>` + `<Separator />`; replace `"Parent upload"` span with `<Badge>`; use `render={<Button />}` on `TooltipTrigger`/`PopoverTrigger`, remove manual `z-50`, and wrap `DropdownMenuItem`s in `<DropdownMenuGroup>`.
    - `activity-card.tsx`, `activity-detail-hero.tsx`, `activity-review-empty-states.tsx`, `activity-review-toolbar.tsx`, `activity-assignment-fields.tsx`, `activity-work-status.tsx`, `attempt-deletion-dialogs.tsx`, `attempt-selection-preview.tsx`, `batch-release-dialog.tsx`, `scoring-guide-popover.tsx`, `student-work-summary.tsx`, `worksheet-history.tsx`, `worksheet-prompt.tsx`:
      - Wrap card surfaces in `<Card>` + `<Separator />` (including mobile stacked dividers in `activity-detail-hero.tsx`); migrate prompt expand toggle in `activity-detail-hero.tsx` to `Collapsible`; wrap `activity-review-toolbar.tsx` horizontal filter strip in `<ScrollArea>` + `<ScrollBar orientation="horizontal" />`, split filter/clear into `<ButtonGroup>`, count span → `<Badge>`, amber hidden-selection banner → `<Alert>`, checkbox row → `<Field orientation="horizontal">`; migrate loading `<p role="status">` states to `<Skeleton>` / `<Spinner>`; migrate `attempt-selection-preview.tsx` / `attempt-deletion-dialogs.tsx` / `batch-release-dialog.tsx` / `worksheet-history.tsx` callouts to `<Alert>` (using `<AlertAction>` where appropriate), band spans to `<Badge>`, scrollable lists to `<ScrollArea>` + `<Separator />`; wrap all `DropdownMenuItem`s in `<DropdownMenuGroup>` and use `render={<Button />}` on triggers without manual `z-50`.
- **Submissions:**
  - `manual-rubric-entry-form.tsx`: Wrap outer panel in `<Card>` + `<Separator />`; migrate Focus vs All(5) and 5-criterion step switcher to `<ToggleGroup>` / `<ToggleGroupItem>`; migrate keyboard help panel to `<Collapsible>`; migrate checkbox `<Label>` to `<Field orientation="horizontal">` + `<FieldLabel>`; wrap `DropdownMenuLabel`/`DropdownMenuItem` in `<DropdownMenuGroup>`; sweep `cn()`, `space-y-*`, `data-icon`.
  - `submission-detail-content.tsx` & `submission-detail-dialog.tsx`:
    - **Mobile (`lg:hidden`):** Rebuild sticky worksheet preview bar with `<Card size="sm">` / `<CardContent>` + `<Button>` + `<Separator />`.
    - **Both:** Migrate student pager to `<ButtonGroup>`; migrate Target Prompt, Capitalization Note, Diagnostic Guide, Need Another Photo, and callout boxes to `<Card>` / `<Alert>`; migrate Analyzing Handwriting pulsing `<Clock>` box to `<Empty>` + `<Spinner>`; complete `CardHeader` / `CardTitle` / `CardContent` anatomy on all inner cards; replace custom metric pill spans with `<Badge>`; wrap `DropdownMenuItem` in `<DropdownMenuGroup>`; sweep `space-y-*`, `data-icon`, and `dark:bg-card` on `DialogContent`.
  - `submission-lifecycle-controls.tsx` & `activity-release-grade-preview.tsx`: Replace all 11 raw `role="alert"` elements and amber/returned/filtered boxes (removing raw `⚠️` emoji in favor of `AlertTriangle`) with `<Alert>` / `<FieldError>`; wrap `SelectItem`s in `<SelectGroup>`; migrate loading `<p role="status">` to `<Skeleton>` / `<Spinner>`; wrap scrollable preview lists in `<ScrollArea>` + `<Separator />`; group quick-extend buttons in `<ButtonGroup>`; add `<Spinner data-icon="inline-start" />` on all pending action buttons.
  - `quality-error-card.tsx`, `raw-measurements-table.tsx`, `submission-rejection-card.tsx`: Replace raw thumbnail `<button>` with `<Button>`, tips expand with `<Collapsible>`, zoom controls with `<ButtonGroup>`, image error fallback with `<Empty>`, floating hint & word-count pills with `<Badge>`, **mobile** (`lg:hidden`) coaching tip in `raw-measurements-table.tsx` with `<Alert>`, metric wrappers with `<Card>` (keeping `role="meter"` bar custom), and refactor `submission-rejection-card.tsx`'s overridden `Alert` into standard `Alert` + `Card` composition.
- **Shared Inspector & Diagnostic Overlay:**
  - `worksheet-image-inspector.tsx`: Migrate collapsible image tools to `<Collapsible>`, active summary pill to `<Badge>`, Ink Contrast & Magnify to `<Toggle>`, zoom cluster to `<ButtonGroup>`, unavailable photo fallback to `<Empty>`, `CollapsibleTrigger` to `render={<Button variant="ghost" />}`, and sweep `space-y-*` / `data-icon`.
  - `diagnostic-overlay/{annotation-tooltip,calm-overlay-toolbar,diagnostic-fallback-banner,diagnostic-overlay,overlay-toolbar}.tsx`: Replace raw close `<button>` in `annotation-tooltip.tsx` with `<Button variant="ghost" size="icon-xs">`, `border-t` with `<Separator />`; replace `animate-pulse` loading placeholder in `diagnostic-overlay.tsx` with `<Skeleton>`; replace focus steppers in both toolbars with `<ButtonGroup>`; replace `Lines` button in `overlay-toolbar.tsx` with `<Toggle>`, legend panel with `<Collapsible>`, **mobile** scroll strip with `<ScrollArea>` + `<ScrollBar orientation="horizontal" />` + `<Separator />`, `Switch`+`Label` rows with `<Field orientation="horizontal">` + `<Switch size="sm" />` (removing `scale-90`/`scale-75`), `DropdownMenuTrigger` with `render={<Button />}` + `DropdownMenuGroup`, `PopoverHeader`/`PopoverTitle` in `calm-overlay-toolbar.tsx`, and proper `<AlertTitle>`/`<AlertDescription>` in `diagnostic-fallback-banner.tsx`.
  - `criterion-feedback-row.tsx` & `band-position-bar.tsx`: `CollapsibleTrigger render={<Button variant="ghost" />}`, `flex flex-col gap-*`, `size-*`, semantic tokens.
- **Comments (`components/comments/*`):**
  - `activity-threads.tsx`: Wrap section in `<Card>` (`CardHeader`, `CardTitle`, `CardContent`), replace `Unread` span with `<Badge variant="secondary">`, remove wrapper `<div role="status">` around `<Alert>`, sweep `space-y-*`.
  - `comment-composer.tsx`: Replace raw `<p role="alert|status">` errors with `<FieldError>`, propagate `data-disabled` on `<Field>`, add `<Spinner data-icon="inline-start" />` on pending Send button.
  - `submission-comment-picker.tsx`: Replace `Unread` span with `<Badge variant="secondary">` and raw `<p role="status">` fallback with `<Empty>`.
  - `submission-comment-thread.tsx`: Wrap Load-older button and `<Empty>` inside `<MessageScrollerContent>` with `<MessageScrollerItem>`, replace read-only footer div with `<Marker>` / `<Alert>`, add `<Spinner data-icon="inline-start" />` to pending Saving / Load-older buttons, clean up icon sizing.
  - `thread-entry.tsx`: Replace inline `<Alert role="group">` delete confirmation with `<AlertDialog>`, add `<Spinner data-icon="inline-start" />` while deleting, replace raw `<span role="alert">` with `<Alert variant="destructive">`.
  - `submission-comment-destination.tsx`, `submission-comment-picker-sheet.tsx`, `submission-comment-tabs.tsx`: Replace `<Link className={buttonVariants(...)}>` with `<Button nativeButton={false} render={<Link />} />`, remove wrapper `<div role="status">` around `<Alert>`, clean up icon sizing, `space-y-*`, and manual `dark:` overrides.

---

### Wave 5 — Gradebook Full Sweep & Dedicated Mobile Card View

**Files (7 — 6 modified + 1 new):**
- Modify: `components/gradebook/teacher-gradebook.tsx`, `components/gradebook/gradebook-cell.tsx`, `components/gradebook/gradebook-bulk-dialog.tsx`, `components/gradebook/points-field.tsx`, `components/gradebook/work-grade-details.tsx`, `components/gradebook/work-grade-sheet.tsx`.
- Create: `components/gradebook/mobile-gradebook-list.tsx`.

#### 5.1 Strict shadcn Sweep of Existing Gradebook Files
- `teacher-gradebook.tsx`:
  - Wrap toolbar and section readiness summary bar in `<Card size="sm">` / `<CardContent>`.
  - Replace `"All current grades released"` raw `<span>` with `<Badge variant="outline">`.
  - Replace `"Sign in again to view grades."` `<p role="status">` with `<Alert role="status">`.
  - Replace search empty state `<div>` with `<Empty>` + `"Clear search"` `<Button>`.
  - Convert activity filter dropdown to `<DropdownMenuTrigger render={<Button variant="outline" size="sm" />} />` + `<DropdownMenuRadioGroup>` + `<DropdownMenuRadioItem>` (removing manual `✓` span).
  - Replace bare `DropdownMenuTrigger`s (activity column actions & batch actions) with `render={<Button />}`; wrap all `DropdownMenuItem`s and `DropdownMenuSub`s in `<DropdownMenuGroup>`.
  - Remove `className="bottom-4 mb-[env(safe-area-inset-bottom,0px)]"` override on `<FloatingActionBar>` (handled natively by Wave 1's `FloatingActionBar`).
  - Sweep `space-y-*`, `data-icon`, manual `dark:` overrides on `ToggleGroupItem`, and `<Button nativeButton={false} render={<Link href="/roster" />} />` in empty states.
- `gradebook-cell.tsx`: Wrap inline edit `<Input>` + validation message in `<Field data-invalid={Boolean(error) || undefined}>` + `<FieldError>`; replace `Unread` spans with `<Badge variant="secondary">`; replace footer `border-t` with `<Separator />`; remove manual icon sizing inside `Button` and `space-y-*`.
- `gradebook-bulk-dialog.tsx`: Replace `Viewing` & `ready to publish` spans with `<Badge>`; replace info/success boxes with `<Alert>`; replace standalone `<FieldError>` with `<Alert variant="destructive">`; remove Radix `data-[state=checked]:` override on Base UI `Checkbox`; sweep `cn()`, `space-y-*`, manual `dark:`.
- `points-field.tsx`: Replace raw `<p role="alert">` with `<FieldError>` + `<FieldDescription>`, add `data-disabled={disabled || undefined}` on `<Field>`, use `cn()`.
- `work-grade-details.tsx`: Replace `border-t` with `<Separator />` and `space-y-3` with `flex flex-col gap-3`.
- `work-grade-sheet.tsx`: Replace custom score & status cards with `<Card>` + `<Separator />`; replace `Teacher rubric` & `Late` spans with `<Badge variant="outline">`; replace styled `<Link>` with `<Button nativeButton={false} variant="outline" size="sm" render={<Link />} />`; replace inline `"Set 0 pts?"` and release confirmation boxes with `<AlertDialog>` (Base UI natively supports nested alert dialogs inside `Sheet`); replace raw `amber-600` warning text with `<Alert>`; add `<Spinner data-icon="inline-start" />` on pending `"Releasing…"` buttons; sweep `space-y-*` and `data-icon`.

#### 5.2 Dedicated Mobile Gradebook Card View (`components/gradebook/mobile-gradebook-list.tsx`)
In `teacher-gradebook.tsx`, `SectionGrid` switches cleanly by responsive visibility while keeping Print mode on the desktop table:
- **Desktop + Print:** `<div className="hidden md:block print:block">` wraps the existing sticky `<Table disableContainer role="grid" ...>` (zero changes to keyboard navigation, sticky headers/columns, or print layout).
- **Mobile (`<768px`):** `<div className="block md:hidden print:hidden">` renders `<MobileGradebookList ... />`.

**`MobileGradebookList` Interface:**
```tsx
export interface MobileGradebookListProps {
  rows: GradebookRow[];
  activities: GradebookActivity[];
  viewMode: "points" | "diagnostic";
  selectedStudentIds: ReadonlySet<string>;
  unreadThreads: UnreadCommentThread[] | undefined;
  search: string;
  isSingleActivityFiltered: boolean;
  onToggleStudent: (studentId: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onOpenCell: (cell: GradebookCell) => void;
  onBeginBulk: (activityId: string, operation: "zero" | "excuse" | "release") => void;
  onViewActivity: (activityId: string) => void;
  onClearSearch: () => void;
}
```

**`MobileGradebookList` Structure & Behavior:**
1. **Empty Search State (`rows.length === 0`):** Renders `<Empty>` with `<EmptyHeader>`, `<EmptyTitle>No students match “{search}”</EmptyTitle>`, and `<EmptyContent><Button variant="outline" size="sm" onClick={onClearSearch}>Clear search</Button></EmptyContent>`.
2. **Mobile Header Bar (above student cards):**
   - Left: `<Field orientation="horizontal">` with `<Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} />` + `<FieldLabel>Select all ({rows.length})</FieldLabel>` (44px tap target).
   - Right: **"Activity actions"** `<DropdownMenu>` (`render={<Button variant="outline" size="sm" className="min-h-11" />}`) using `<DropdownMenuGroup>` + `<DropdownMenuSub>` per visible activity (or direct actions when `activities.length === 1`):
     - `Release grades to parents` → `onBeginBulk(act.id, "release")`
     - `Mark uncollected (0 pts)` (disabled if `act.points_possible === null`) → `onBeginBulk(act.id, "zero")`
     - `Excuse all / selected` → `onBeginBulk(act.id, "excuse")`
     - `View activity details` → `onViewActivity(act.id)`
3. **Student Card Stack (`flex flex-col gap-3`, adds `pb-24` when `selectedStudentIds.size > 0` so `FloatingActionBar` never covers the last card):**
   - Each `row` renders `<Card size="sm">`:
     - **`<CardHeader>`:**
       - Left cluster: `<Checkbox checked={selectedStudentIds.has(row.student_id)} onCheckedChange={...} aria-label={...} />` + `<CardTitle>{row.student_name}</CardTitle>`.
       - `<CardAction>`: Overall earned/possible (`tabular-nums`) + `<Badge variant="secondary">{row.totals.percentage === null ? "No grades" : `${row.totals.percentage}%`}</Badge>`.
     - **`<CardContent>`:**
       - Maps `activities` to activity items (first `3` rendered directly; if `!isSingleActivityFiltered && activities.length > 3`, remaining items live inside `<Collapsible>` with `<CollapsibleTrigger render={<Button type="button" variant="ghost" size="sm" className="w-full min-h-11 justify-between" />} />` labeled `Show ${overflowCount} more activities` / `Show fewer`).
       - Each assigned activity renders inside `<ItemGroup>` as `<Item variant="outline" size="sm" render={<button type="button" onClick={() => onOpenCell(work)} className="min-h-11 w-full text-left" />} />`:
         - `<ItemContent>`: `<ItemTitle>{act.title}</ItemTitle>` + `<ItemDescription>` (points possible or `"Bands only"`, plus `"Archived"` if archived).
         - `<ItemActions>`:
           - Primary readout respecting `viewMode`:
             - `"points"` mode: `final_points !== null ? `${final_points} / ${work.points_possible}` : coursework_status` (`tabular-nums`) plus status `<Badge variant="outline">` (`Draft`, `Late`, `Excused`, `Missing`).
             - `"diagnostic"` mode: `<BandBadge>` when band/score exists, else status `<Badge variant="outline">`.
           - `<Badge variant="secondary">Unread</Badge>` when `hasUnreadWorkComments(...)` is true.
           - `<ChevronRight aria-hidden="true" />` opening `WorkGradeSheet`.
       - Unassigned activities (`!work`) render a non-interactive `<Item variant="muted" size="sm">` showing `"Not assigned"`.

---

## 4. Verification & Acceptance Criteria

Per `AGENTS.md` §5 and `DESIGN.md` (no automated frontend test suite by design), every wave must pass **all four static gates** before committing, and a full desktop + mobile manual QA pass upon completion:

### Automated Static Gates
1. **Lint:** `cd frontend && npx eslint .` → 0 errors, 0 warnings introduced.
2. **Type-check:** `cd frontend && npx tsc --noEmit` → 0 errors (`strict: true`).
3. **Design Detector:** `node .agent/skills/impeccable/scripts/detect.mjs --json <changed-files>` → 0 new regressions.
4. **Strict shadcn Compliance Scan:** Case-sensitive regex audit across `frontend/app/(teacher)` and all Teacher-used `frontend/components/**` confirms:
   - **0** imports of `"sonner"` or `@/components/ui/sonner` anywhere in `frontend/`.
   - **0** raw `<button>`, `<select>`, `<textarea>`, `<label>`, `<fieldset>`, `<legend>`, `<hr>`, `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`, `<details>`, `<summary>`, `<kbd>`, or `Loader2` in Teacher Portal files.
   - **0** raw `<input>` except the 2 explicitly exempt `<input type="file">` capture controls in `quick-upload-dialog.tsx`.
   - **0** hand-rolled `role="radiogroup"`, `role="tablist"`, `role="tab"`, `role="alert"` (outside shadcn `Alert`/`FieldError`), or `animate-pulse` loading placeholders.
   - **0** `space-y-*` / `space-x-*` in Teacher Portal files.

### Manual QA Matrix (Desktop `≥1280px` & Mobile `375px`, Light & Dark Theme)
- **Wave 1 (Toasts & Shared):** Trigger success, error, warning, description (`accept-invite`), and Undo action (`manual-rubric-entry-form`) Base UI toasts; confirm swipe/close dismissal and zero console errors. Verify `FilterPills` horizontal touch scroll, `SearchInput` keyboard clear, and `FloatingActionBar` safe-area mobile docking.
- **Wave 2 (Shell & Modals):** Verify expanded/collapsed sidebar pending badges + user menu; open `CursiveGuideDialog` (`Alt+C`) on mobile (`375px`) to test the filter `Drawer`, stroke canvas case/speed `ToggleGroup`s, and play/replay buttons; open `QuickUploadDialog` (`Ctrl/Cmd+K`) and `RubricReferenceDialog` (`Alt+R`); test `NotificationBell` mobile `Drawer` and desktop `Popover`.
- **Wave 3 (Dashboard, Roster & Settings):** Verify `/dashboard` `SummaryCards`, `ClassTable` mobile `Item` rows + `Field` sort bar, `CriterionTrendChart` `ChartTooltipContent` + `ToggleGroup`, `StudentDrillDownDrawer` `Item` lists + `SheetFooter`; verify `/roster` mobile `Card` list + `ToggleGroup` sort + all 4 roster dialogs; verify `/settings` `SecuritySettingsCard` password validation (`FieldError` / `data-invalid`).
- **Wave 4 (Activities, Submissions, Overlay & Comments):** Verify `/activities` sort radio menu + `Create/Edit/DeleteActivityDialog` (`AlertDialog`); verify `/activities/[id]` review toolbar, `SubmissionCard`, `ActivityDetailHero`, and `/activities/[id]/submissions/[submissionId]` fallback states; verify `SubmissionDetailContent` mobile sticky preview bar, `ManualRubricEntryForm` Focus/All & step `ToggleGroup`s + keyboard shortcuts (`1–4`, `Alt+1–4`, `Ctrl+Enter`), `WorksheetImageInspector` + `OverlayToolbar` mobile scroll strip, and `SubmissionCommentThread` (`MessageScrollerItem` + `AlertDialog` delete).
- **Wave 5 (Gradebook Desktop & Mobile):**
  - Desktop (`≥1280px`): Sticky header + sticky Student column scroll, arrow-key cell navigation, `Enter` inline edit + validation error, `Space` `WorkGradeSheet`, `AlertDialog` confirmations, CSV export, and Print layout (`print:block`).
  - Mobile (`375px`): `MobileGradebookList` renders with zero horizontal page overflow, `Select all` + `FloatingActionBar` batch actions work, `Activity actions` menu triggers Release / 0 pts / Excuse / View details, tapping any activity item opens `WorkGradeSheet`, `Points | Diagnostic` toggle updates card readouts, `>3` activities collapse/expand cleanly, and empty search renders `<Empty>`.
