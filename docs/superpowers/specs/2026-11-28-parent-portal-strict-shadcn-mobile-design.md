# Parent Portal Strict shadcn/ui & Mobile UX Transition — Design Spec

**Date:** 2026-11-28
**Status:** Draft for User Review
**Related Prior Work:** `d3a79ca` (`refactor(ui): transition remaining teacher and parent portal components to shadcn`), `docs/superpowers/specs/2026-11-28-teacher-portal-strict-shadcn-mobile-design.md`
**Design System References:** `DESIGN.md` (visual tokens, spacing, 4-band developmental palette, shadcn-first policy), `docs/DESIGN.md` (parent portal flows & accessibility targets), `AGENTS.md` §4–§6, `.agents/skills/shadcn/SKILL.md` (`base-luma` / Base UI preset).

---

## 1. Objective & Scope

Bring **100% of Parent Portal pages, subpages, tabs, dialogs, drawers, sheets, skeletons, and parent-reachable shared components** into strict compliance with the installed `base-luma` (`@base-ui/react`) shadcn/ui component system across **both desktop (`≥1024px`) and mobile (`<640px` / `375px`) viewports**.

Specifically, this transition closes four remaining gap categories:
1. **Remaining Raw HTML Controls, Spinners, Avatars & Dividers:** Eliminate raw `<button>` elements, `<Loader2>` spinner usage, bespoke circular initials `<div>`/`<span>` avatars, and raw border/card `<div>` wrappers across parent navigation, progress dashboard cards, upload wizard steps, and skeletons.
2. **Custom Callouts & Tooltip Containers:** Replace custom styled `<div role="status">`, prompt/tip boxes, notification list markup, and the floating `AnnotationTooltip` container with `Alert`, `Card`, `ItemGroup`/`Item`, and `Badge`.
3. **Mobile vs. Desktop Viewport Overlay Parity:** Upgrade the **5 Parent Portal overlays** that currently render desktop `Dialog` on mobile viewports (`ParentUploadDialog` + its Step 3 zoom overlay, `WorksheetViewDialog`, `PendingWorksheetDialog`, `PhotoPreviewDialog` in `TakeHomeActivities`, and `NotificationWorkDestination`) to `ResponsiveRichOverlay` or `ResponsiveModal` matching the Teacher Portal's mobile UX.
4. **Strict Base UI (`base-luma`) Composition & Styling Hygiene:** Fix missing `<SelectGroup>` and Radix-only `placeholder` usage on Base UI `<Select>` / `<SelectValue>`, replace `<Link className={buttonVariants(...)}>` with `<Button nativeButton={false} render={<Link />} />`, replace `space-y-*` with `flex flex-col gap-*`, replace template-literal class ternaries with `cn()`, enforce `data-icon` without manual `size-*` on icons inside `Button`, and swap manual `dark:` scale overrides for semantic tokens.

### In-Scope Files (17 unique files)
- **Parent Routes & Layout (2):**
  - `frontend/app/(parent)/progress/progress-content.tsx`
  - `frontend/app/(parent)/parent-settings/page.tsx`
- **Parent Navigation & Portal Components (10):**
  - `frontend/components/parent-nav.tsx`
  - `frontend/components/parent/parent-portal-skeletons.tsx`
  - `frontend/components/parent/latest-submission-card.tsx`
  - `frontend/components/parent/submission-history-dialog.tsx`
  - `frontend/components/parent/sample-report-preview.tsx`
  - `frontend/components/parent/take-home-activities.tsx`
  - `frontend/components/parent/parent-upload-dialog.tsx`
  - `frontend/components/parent/worksheet-view-dialog.tsx`
  - `frontend/components/parent/pending-worksheet-dialog.tsx`
  - `frontend/components/parent/notification-work-destination.tsx`
- **Shared Components Reachable from Parent Portal (5):**
  - `frontend/components/notifications/notification-list.tsx`
  - `frontend/components/notifications/notification-row.tsx`
  - `frontend/components/comments/submission-comment-picker.tsx`
  - `frontend/components/shared/diagnostic-overlay/annotation-tooltip.tsx`
  - `frontend/components/submissions/quality-error-card.tsx`
  *(Total: 2 route files + 10 parent/nav files + 5 shared files = **17 unique files**.)*

### Already Compliant / Verified Clean (No Edits Required)
The following parent-reachable files were audited and already satisfy strict `base-luma` shadcn and responsive rules:
- `frontend/components/dashboard/criterion-trend-chart.tsx` (`ChartContainer`, `ChartTooltip`, `ChartLegend`, semantic tokens)
- `frontend/components/settings/parent-profile-settings-card.tsx` (`Card`, `Field`/`FieldGroup`, `InputGroup`, `Button`, `Alert`)
- `frontend/components/settings/notification-settings-card.tsx` (`Card`, `Field`, `Switch`, `Button`)
- `frontend/components/settings/security-settings-card.tsx` (`Card`, `Field`, `Button`, `ResponsiveModal` via `ForgotPasswordDialog`)
- `frontend/components/parent-portal-provider.tsx` (context provider only)

### Explicitly Out-of-Scope / Exempt (Keep Custom per `AGENTS.md` §4)
- Hidden `<input type="file">` native camera and photo library capture controls in `parent-upload-dialog.tsx` (`lines 527–545`).
- SVG diagnostic, guideline, and illustration layers (`guide-line-overlay.tsx`, `diagnostic-overlay/layers/*`, `sample-report-preview.tsx` SVG worksheet illustration, `cursive-stroke-canvas.tsx` SVG penmanship canvas, `rubric-reference-dialog.tsx` SVG diagrams, `criterion-trend-chart.tsx` line-legend SVG swatches).
- Recharts chart plot elements inside `<ChartContainer>` (`criterion-trend-chart.tsx`).
- `BrandLogo` / `BrandIcon` Next.js `<Image>` components (`brand-logo.tsx`) and skip-to-main-content `<a href="#main-content">` link (`parent-portal-provider.tsx`).
- `CommentSheetContent` (`components/comments/comment-sheet-shell.tsx`), which already renders a mobile-friendly full-width `Sheet` (`w-full sm:max-w-lg`) across viewports.
- Teacher-only files not imported by `(parent)`.

---

## 2. Global Constraints & Conventions

Every slice must enforce all of the following rules without exception:

1. **Base UI (`base-luma`) composition:**
   - Use `render={<Element />}` on `@base-ui/react` triggers (`DropdownMenuTrigger`, `DrawerTrigger`, `CollapsibleTrigger`, `Item`, `Button nativeButton={false} render={<Link />}`). Never use Radix `asChild`.
   - Wrap all `SelectItem` elements inside `<SelectGroup>`. On Base UI `<Select>`, pass an `items` array (or explicit `<SelectValue>` fallback render) instead of Radix's `placeholder` prop on `<SelectValue>`.
   - Wrap all `DropdownMenuItem` elements inside `<DropdownMenuGroup>`.
   - Every `Dialog`, `Sheet`, `Drawer`, `AlertDialog`, `ResponsiveModal`, and `ResponsiveRichOverlay` must render its accessible `*Title` and `*Description` (`className="sr-only"` when visually hidden).
2. **Component-first primitives:**
   - Zero raw `<button>` elements inside UI flows; use `<Button>` or `<Item render={<Button ... />} />`.
   - Use `<Avatar>` + `<AvatarFallback>` for user/child initials badges instead of raw circular `<div>`/`<span>` wrappers.
   - Use `<Spinner data-icon="inline-start" />` for pending/loading indicators inside buttons/dialogs; never import `Loader2` for spinning loaders.
   - Use `<Alert>` (`AlertTitle` / `AlertDescription`) for status, warning, error, and teacher-return-note callouts.
   - Use `<Card>` (`CardHeader` / `CardTitle` / `CardContent` / `CardFooter`) for card surfaces and `<Separator />` instead of raw `<div className="h-px ...">` or `border-t` divider boxes.
   - Use `<ItemGroup>` + `<Item>` (`ItemMedia` / `ItemContent` / `ItemTitle` / `ItemActions`) for structured interactive or feed lists.
3. **Styling & Icons (`shadcn` rules + `DESIGN.md`):**
   - Replace `space-y-*` / `space-x-*` with `flex flex-col gap-*` / `flex items-center gap-*` (staying on the 4px spacing scale; `gap-1.5` only for tight label/metadata proximity).
   - Replace equal `w-N h-N` with `size-N`.
   - Use `cn()` for conditional class names (never template-literal `${...}` ternaries).
   - Replace manual `dark:` brand/surface color overrides (`bg-brand-50/80 dark:bg-brand-950/40`, `bg-surface dark:bg-card`, `text-brand-700 dark:text-brand-300`, etc.) on non-SVG UI elements with semantic tokens (`bg-secondary`, `text-secondary-foreground`, `bg-primary/5`, `text-primary`, `bg-card`, `text-foreground`, `bg-warning/10`, `text-warning-foreground`, `bg-band-1..4/*`, `text-band-1..4-text`) that already switch themes via CSS variables in `globals.css`.
   - Inside `<Button>`, `<Badge>`, `<Alert>`, and `<DropdownMenuItem>`, omit manual icon sizing classes (`size-3.5`, `size-4`) and use `data-icon="inline-start"` or `data-icon="inline-end"` on `<Button>` icons.
   - Preserve all `DESIGN.md` layout rules: never add `max-w-*` or `container` width caps to portal shells or page roots; retain `min-h-11` (`44px`) touch targets on mobile interactive controls; never use standard red (`#EF4444`) in developmental 4-band indicators.
4. **No new packages or CLI component installs required:** All needed shadcn primitives (`alert`, `alert-dialog`, `avatar`, `badge`, `button`, `button-group`, `card`, `chart`, `collapsible`, `dialog`, `drawer`, `dropdown-menu`, `empty`, `field`, `input`, `input-group`, `item`, `kbd`, `popover`, `progress`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `spinner`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toggle`, `toggle-group`) are already installed in `frontend/components/ui/`.

---

## 3. Four-Slice Architecture & Detailed Surface Changes

### Slice 1 — Navigation, Skeletons & Shared Chrome

**Files (6):**
- `frontend/components/parent-nav.tsx`
- `frontend/components/parent/parent-portal-skeletons.tsx`
- `frontend/app/(parent)/parent-settings/page.tsx`
- `frontend/components/notifications/notification-list.tsx`
- `frontend/components/notifications/notification-row.tsx`
- `frontend/components/comments/submission-comment-picker.tsx`

**Detailed Changes:**
1. **`parent-nav.tsx`:**
   - **Desktop Child Switcher (`Select`):** Build an `items` array from `linkedChildren` (`{ value: child.id, label: child.fullName }`), pass `items` to `<Select>`, wrap `<SelectItem>`s inside `<SelectGroup>`, and render `<SelectValue>` without Radix-only `placeholder`.
   - **Mobile Child Switcher (`Drawer`):** Replace the raw initials `<span>` inside the trigger `Button` (`line 194`) with `<Avatar size="sm"><AvatarFallback className="bg-secondary text-secondary-foreground font-semibold text-xs">{...}</AvatarFallback></Avatar>`. Replace the raw initials `<span>` inside each drawer row `Button` (`line 240`) with `<Avatar><AvatarFallback ...>{childInitials}</AvatarFallback></Avatar>`.
   - **Account Menu (`DropdownMenu`):** Replace the raw `<DropdownMenuTrigger className="...">` button (`lines 280–285`) with `<DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" className="size-10 sm:size-9 rounded-full" aria-label={...} />}><Avatar className="size-full"><AvatarFallback className="bg-secondary text-secondary-foreground font-semibold text-xs">{initials}</AvatarFallback></Avatar></DropdownMenuTrigger>` (matching `teacher-sidebar.tsx`). Replace the initials `<div>` inside `DropdownMenuLabel` (`line 293`) with `<Avatar className="size-9 rounded-xl"><AvatarFallback className="rounded-xl bg-secondary text-secondary-foreground font-semibold text-xs">{initials}</AvatarFallback></Avatar>`. Remove manual `size-4` on icons inside `DropdownMenuItem` (`lines 310, 319, 327, 337`).
   - **Sign-out `AlertDialogAction`:** Remove `Loader2` from `lucide-react` imports; render `<Spinner data-icon="inline-start" aria-hidden="true" />` when `isSigningOut` is true (`line 366`). Ensure `DropdownMenuItem` actions in the account menu are grouped inside `<DropdownMenuGroup>`.
2. **`parent-portal-skeletons.tsx`:**
   - Replace `ParentSettingsSkeleton`'s bespoke `<div className="rounded-xl border border-border bg-card ...">` wrapper (`lines 566–578`) with `<Card className="gap-0 pb-0 overflow-hidden"><CardContent className="flex flex-col gap-5 p-6">...</CardContent><CardFooter className="justify-end border-t border-border bg-muted/20 px-6 py-3.5">...</CardFooter></Card>`, and replace `<div className="h-px w-full bg-border" />` (`line 581`) with `<Separator />`.
   - Convert all `space-y-*` / `sm:space-y-2` wrappers (`lines 222, 227, 235, 275, 289, 306, 364, 481, 484, 513, 542, 552, 559, 561, 567, 569`) to `flex flex-col gap-*` (`sm:gap-2` on desktop for trend summary rows). Replace `bg-surface dark:bg-card` (`line 167`) with `bg-card`.
3. **`parent-settings/page.tsx`:**
   - Replace `<Link href="/progress" className={cn(buttonVariants(...))}>` (`lines 41–50`) with `<Button nativeButton={false} variant="ghost" size="sm" className="-ml-2 h-10 min-h-10 text-muted-foreground hover:text-foreground sm:h-9 sm:min-h-9" render={<Link href="/progress" />}><ArrowLeft data-icon="inline-start" aria-hidden="true" /><span>Back to progress</span></Button>`.
   - Convert `space-y-8` (`line 38`) and `space-y-1` (`line 54`) to `flex flex-col gap-8` and `flex flex-col gap-1`.
4. **`notification-list.tsx` & `notification-row.tsx`:**
   - Replace `<ul className="flex flex-col gap-1">` (`notification-list.tsx:318`) with `<ItemGroup aria-label={`${group.label} notifications`} className="gap-1">`.
   - Refactor `NotificationRowItem` (`notification-row.tsx:97–181`) onto `<Item render={<li data-notification-id={row.id} />} size="xs" variant={unread ? "muted" : "default"} className={cn("group relative flex-nowrap items-start rounded-lg border transition-colors", unread ? "border-primary/15 bg-primary/5 hover:bg-primary/10" : "border-transparent hover:bg-muted/50")}>`, wrapping the leading icon + unread dot in `<ItemMedia className="relative mt-0.5 shrink-0">`, the `<Link>` text stack in `<ItemContent className="min-w-0 flex-1 gap-0">`, and the mark-as-read `<Button>` in `<ItemActions className="shrink-0">`. Preserve `[data-notification-id="${completedId}"] a` focus restoration in `NotificationList`.
5. **`submission-comment-picker.tsx`:**
   - Pass `items` built from `rows` (`rows.map((row, index) => ({ value: row.submission_id, label: ... }))` using `UPLOAD_TIME_FORMAT`) to `<Select>`, and render explicit fallback text (`"Choose an upload"`) inside `<SelectValue>` instead of Radix-only `placeholder="Choose an upload"` (`line 210`), keeping `<SelectGroup>` inside `<SelectContent>`.

---

### Slice 2 — Progress Dashboard & Archive

**Files (4):**
- `frontend/app/(parent)/progress/progress-content.tsx`
- `frontend/components/parent/latest-submission-card.tsx`
- `frontend/components/parent/submission-history-dialog.tsx`
- `frontend/components/parent/sample-report-preview.tsx`

**Detailed Changes:**
1. **`progress-content.tsx`:**
   - Replace the raw `border-t border-border/70 pt-4` divider inside the 1-worksheet baseline `CardContent` (`line 755`) with `<Separator />` (`<CardContent className="flex flex-col gap-4 p-5 sm:p-6">`).
   - Place `<Clock aria-hidden="true" />` directly inside `<Alert>` (without manual `size-4` or wrapper `div`) alongside `<AlertTitle>` (`lines 618–640`).
   - Convert all `space-y-*` classes (`lines 562, 565, 704, 708, 734, 736, 818`) to `flex flex-col gap-*`, and replace `data-[scrolled=true]:border-brand-200 dark:data-[scrolled=true]:border-border` (`line 518`) with `data-[scrolled=true]:border-border`.
2. **`latest-submission-card.tsx`:**
   - Replace the raw `<button type="button" onClick={() => openWorksheetForCriterion()} ...>` around the worksheet photo (`lines 238–253`) with `<Button type="button" variant="ghost" onClick={() => openWorksheetForCriterion()} aria-haspopup="dialog" aria-label={...} className="group relative size-full overflow-hidden rounded-lg border border-border/70 bg-background p-0 shadow-warm-sm transition-shadow hover:bg-background hover:shadow-warm">` (keeping zero color/hover wash over the worksheet photo).
   - Replace `<Item render={<button type="button" ... />} />` on the 5 Skill Breakdown rows (`lines 378–414`) with `<Item render={<Button type="button" variant="ghost" ... />} className="group h-auto flex-nowrap rounded-none border-0 px-4 sm:px-6 py-3.5 min-h-12 w-full justify-between text-left font-normal whitespace-normal cursor-pointer transition-colors hover:bg-muted/40 last:rounded-b-xl" />`.
3. **`submission-history-dialog.tsx` (`PastWorksheetsSection`):**
   - Replace `space-y-3` (`line 262`) with `flex flex-col gap-3`.
   - Remove manual `size-3.5` / `size-4` on `<ArrowUpDown>`, `<ChevronUp>`, and `<ChevronDown>` inside `<Button>` (`lines 284, 314, 319`), and add `data-icon="inline-start"` to `<ChevronUp>` and `<ChevronDown>`.
   - Replace manual `dark:` overrides (`lines 122, 124, 284`) with semantic tokens (`text-band-4-text bg-band-4/15 border-band-4/30`, `text-band-2-text bg-band-2/15 border-band-2/30`, `text-primary`).
4. **`sample-report-preview.tsx`:**
   - Remove redundant `dark:data-active:bg-primary dark:data-active:text-primary-foreground` on `<TabsTrigger>` (`line 168`) since `bg-primary` and `text-primary-foreground` already resolve per theme via CSS variables.

---

### Slice 3 — Rich Overlays & Upload Flow (`ResponsiveRichOverlay`)

**Files (6):**
- `frontend/components/parent/parent-upload-dialog.tsx`
- `frontend/components/parent/worksheet-view-dialog.tsx`
- `frontend/components/parent/pending-worksheet-dialog.tsx`
- `frontend/components/parent/take-home-activities.tsx` (`PhotoPreviewDialog` + card/alert token hygiene)
- `frontend/components/shared/diagnostic-overlay/annotation-tooltip.tsx`
- `frontend/components/submissions/quality-error-card.tsx`

**Detailed Changes:**
1. **`parent-upload-dialog.tsx`:**
   - **Responsive Overlay:** Migrate both outer `ParentUploadDialog` (`lines 144–164`) and nested Step 3 `zoomOpen` modal (`lines 1219–1239`) from `<Dialog>` to `<ResponsiveRichOverlay>` (`ResponsiveRichOverlayContent`, `ResponsiveRichOverlayHeader`, `ResponsiveRichOverlayBody`, `ResponsiveRichOverlayFooter`, `ResponsiveRichOverlayTitle`, `ResponsiveRichOverlayDescription`), matching `QuickUploadDialog`. Keep `if (!nextOpen && isUploading) return;` intact on `onOpenChange`.
   - **Raw `<button>` Replacements:**
     - Stepper steps (`lines 582–603`): Replace raw `<button>` with `<Button type="button" variant="ghost" size="sm" ...>` using `cn(...)` instead of template-literal ternaries (`lines 577, 589, 607, 621, 635`).
     - Step 1 worksheet cards (`lines 776–821`): Replace raw `<button>` cards with `<Button type="button" variant="outline" ... className={cn("h-auto w-full flex-col items-stretch text-left whitespace-normal p-3.5 rounded-xl ...", isSelected && "border-primary bg-primary/5 ring-1 ring-primary")}>`.
     - Step 3 tap-to-zoom preview (`lines 1187–1213`): Replace raw `<button>` with `<Button type="button" variant="ghost" ...>` (`p-0` layout classes) and replace the floating `<span>Tap to zoom</span>` pill with `<Badge variant="secondary" className="absolute bottom-2.5 right-2.5 h-auto px-2.5 py-1 shadow-warm-sm"><ZoomInIcon data-icon="inline-start" aria-hidden="true" /><span>Tap to zoom</span></Badge>`.
   - **Custom Containers, Alerts & Step 5:**
     - Step 2 & Step 3 context header (`lines 833–862, 1086–1115`) and Step 2 `Photo quality tips` 2×2 grid tiles (`lines 1045–1076`): Replace custom styled `<div>`s with `<Card size="sm" className="py-0 shadow-none bg-muted/40">` / `<Card size="sm" className="py-0 shadow-none bg-card">` + `<CardContent ...>`.
     - Step 2 & Step 3 re-attempt `<Alert>` (`lines 866, 1119`): Replace `bg-brand-50/80 dark:bg-brand-950/40 ...` and manual `text-brand-600 dark:text-brand-400` with semantic `bg-secondary/60 border-primary/20 text-foreground`.
     - Step 5 success state (`lines 1256–1285`): Compose with `<Empty className="border-0 p-6 gap-4">` (`EmptyMedia variant="icon"`, `EmptyHeader`, `EmptyTitle`, `EmptyDescription`, `EmptyContent` wrapping `Done` `<Button>`), removing `space-y-4` / `space-y-1.5`.
   - Keep hidden `<input type="file">` camera/library inputs (`lines 527–545`) untouched.
2. **`worksheet-view-dialog.tsx`:**
   - Migrate `<Dialog>` to `<ResponsiveRichOverlay>` (`ResponsiveRichOverlayContent` with `className="w-[calc(100%-1.5rem)] sm:w-[95vw] sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl max-h-[min(94dvh,calc(100dvh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm"`, `ResponsiveRichOverlayHeader`, `ResponsiveRichOverlayBody`, `ResponsiveRichOverlayFooter`, `ResponsiveRichOverlayTitle`, `ResponsiveRichOverlayDescription`).
   - Replace the raw `<div role="status">` Teacher note banner (`lines 375–387`) with `<Alert role="status" className="border-band-2/40 bg-band-2/15"><AlertTitle className="text-xs font-semibold text-band-2-text">Teacher note</AlertTitle><AlertDescription className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{returnNote}</AlertDescription></Alert>`.
   - Remove manual `size-3.5` / `size-4` and add `data-icon="inline-start"` on `<PenLine>` (`line 490`); remove `size-4` on `<MoreHorizontal>` inside `size="icon-sm"` `<Button>` (`line 270`); replace `space-y-*` (`lines 238, 374, 378, 391, 425`) with `flex flex-col gap-*`; replace manual `dark:` overrides on the `Paper lines` `<Toggle>` (`line 224`) with semantic `aria-pressed:bg-secondary aria-pressed:text-secondary-foreground`.
3. **`pending-worksheet-dialog.tsx`:**
   - Migrate `<Dialog>` to `<ResponsiveRichOverlay>` (`ResponsiveRichOverlayContent`, `ResponsiveRichOverlayHeader`, `ResponsiveRichOverlayBody`, `ResponsiveRichOverlayTitle`, `ResponsiveRichOverlayDescription`), matching `WorksheetViewDialog`.
   - Replace the raw `<div role="status">` Teacher note banner (`lines 151–163`) with `<Alert role="status" className="border-band-2/40 bg-band-2/15"><AlertTitle ...>Teacher note</AlertTitle><AlertDescription ...>{item.returnNote}</AlertDescription></Alert>`.
   - Remove manual `size-3.5` / `size-4` and add `data-icon="inline-start"` on `<ArrowLeft>` (`line 71`) and `<Camera>` (`line 176`) inside `<Button>`; replace `space-y-*` (`lines 63, 128, 130, 132, 154`) and manual `dark:` classes (`line 69`) with `flex flex-col gap-*` and semantic `text-primary`.
4. **`PhotoPreviewDialog` & Token Hygiene in `take-home-activities.tsx`:**
   - Migrate `PhotoPreviewDialog` (`lines 1101–1183`) from `<Dialog>` to `<ResponsiveRichOverlay>` (`ResponsiveRichOverlayContent`, `ResponsiveRichOverlayHeader`, `ResponsiveRichOverlayBody`, `ResponsiveRichOverlayFooter`, `ResponsiveRichOverlayTitle`, `ResponsiveRichOverlayDescription`).
   - Convert `space-y-1` (`line 1103`) to `flex flex-col gap-1`.
   - Remove manual `dark:` color/border overrides: replace `bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300` (`line 251`, `EmptyMedia` / icon well) with semantic `bg-secondary text-secondary-foreground`; replace `bg-primary/5 dark:bg-primary/10` (`line 281`, `Alert`) with semantic `bg-primary/5`; and replace manual `dark:` border/bg overrides on `ActivityCard` (`lines 848–852`) with semantic `bg-primary/5`, `bg-warning/5`, and `hover:border-primary/40`.
5. **`annotation-tooltip.tsx` & `quality-error-card.tsx`:**
   - In `annotation-tooltip.tsx` (`lines 338–426`), replace the custom floating tooltip `<div ref={cardRef} className="p-2 sm:p-3 rounded-xl ...">` with `<Card ref={cardRef} size="sm" ...><CardContent className="p-2 sm:p-3">` while preserving the directional SVG caret stem, `cardWidth` inline sizing, and viewport-clamped `transform`.
   - In `quality-error-card.tsx`, remove manual `size-4` on `<ImageOff>` (`line 791`) inside the thumbnail `<Button>` and clean up remaining `size-*` / semantic token usage (`dark:text-warning` at `line 976` → `text-warning-foreground`).

---

### Slice 4 — Compact Detail Modal (`ResponsiveModal`)

**File (1):**
- `frontend/components/parent/notification-work-destination.tsx`

**Detailed Changes:**
1. Migrate `<Dialog>` (`lines 94–189`) to `<ResponsiveModal>` (`Drawer` on mobile, `Dialog` on desktop — matching `ForgotPasswordDialog`):
   - `ResponsiveModal`, `ResponsiveModalContent`, `ResponsiveModalHeader`, `ResponsiveModalBody`, `ResponsiveModalFooter`, `ResponsiveModalTitle`, `ResponsiveModalDescription`.
2. Replace the raw `<div role="alert">` error block (`lines 114–125`) with `<Alert variant="destructive">` (`AlertTitle` + `AlertDescription` + `Try again` `<Button>`).
3. Replace the raw prompt `<div className="rounded-lg border ... space-y-1">` (`lines 132–135`) with `<Card size="sm" className="bg-muted/30 py-0 shadow-none"><CardContent className="flex flex-col gap-1 p-3">...</CardContent></Card>`.
4. Replace the raw return note `<p className="rounded-lg border ...">` (`lines 153–157`) with `<Alert role="status" className="border-band-2/40 bg-band-2/15"><AlertTitle className="text-xs font-semibold text-band-2-text">Teacher note</AlertTitle><AlertDescription className="text-sm whitespace-pre-wrap">{work.work.return_note}</AlertDescription></Alert>`.
5. Replace the raw footer `<div>` (`lines 165–188`) with `<ResponsiveModalFooter showCloseButton={false} className="sm:justify-between">`, and replace `<Camera className="size-4" />` inside `<Button>` with `<Camera data-icon="inline-start" aria-hidden="true" />`.

---

## 4. Error Handling, Accessibility & Mobile Ergonomics

1. **Error-code & close-guard continuity:** All existing `ApiError.code` branches (`ACTIVITY_NOT_ASSIGNED`, `SUBMISSIONS_CLOSED`, `UNAUTHORIZED`, `NOT_FOUND`, `COMMENT_READ_CONFLICT`, quality-gate codes) remain unchanged per `AGENTS.md` §6 rule 2. `ParentUploadDialog` preserves upload-in-flight close blocking (`if (!nextOpen && isUploading) return`) across both desktop `Dialog` and mobile `Sheet`.
2. **Focus restoration & screen-reader announcements:**
   - `NotificationRowItem` preserves `data-notification-id={row.id}` and `<Link>` structure inside `<Item render={<li />} />` so `NotificationList` restores focus cleanly when a notification moves from unread to read.
   - `ParentUploadDialog` preserves `choosePhotoButtonRef`, `submitButtonRef`, `retryButtonRef`, `doneButtonRef`, `unavailableActionRef`, and `aria-live="polite"` step announcements inside `ResponsiveRichOverlay`.
3. **Keyboard shortcuts inside mobile `Sheet`:** Because `ui/sheet.tsx` uses `@base-ui/react/dialog` (`SheetPrimitive.Popup`), it renders `role="dialog"` on mobile just like desktop `Dialog`, preserving `WorksheetImageInspector`'s `container.closest("[role='dialog']")` shortcut scoping and `Escape` handling.
4. **Touch targets & safe areas:** All mobile interactive triggers retain `min-h-11` (`44px`) targets; `ResponsiveModalFooter` and `ResponsiveRichOverlayFooter` automatically apply `pb-[max(1rem,env(safe-area-inset-bottom))]` on mobile viewports, with zero horizontal page overflow at `375px`.

---

## 5. Verification & Acceptance Criteria

Per `AGENTS.md` §5 and `docs/TESTING.md` §7 (no automated frontend test suite by design), every slice and the completed transition must pass all static gates plus a full desktop and mobile manual QA pass.

### Automated Static Gates (run in `frontend/` unless noted)
1. **Lint:** `npx eslint .` → 0 errors, 0 new warnings.
2. **Type-check:** `npx tsc --noEmit` → 0 TypeScript errors (`strict: true`).
3. **Design Detector (from repo root):** `node .agent/skills/impeccable/scripts/detect.mjs --json <changed-files>` → 0 new regressions.
4. **Strict shadcn Compliance Scan:** Regex audit across `frontend/app/(parent)/**`, `frontend/components/parent/**`, `frontend/components/parent-nav.tsx`, `frontend/components/parent-portal-provider.tsx`, and the 5 modified shared files confirming:
   - **0** raw `<button>`, `<select>`, `<textarea>`, `<label>`, `<fieldset>`, `<legend>`, `<hr>`, or `Loader2` imports.
   - **0** raw `<input>` elements except the 2 explicitly exempt `<input type="file">` capture controls in `parent-upload-dialog.tsx`.
   - **0** `space-y-*` / `space-x-*`, template-literal ternaries in `className`, or `data-[state=*]` / `asChild` Radix remnants.
   - **0** `SelectContent` blocks missing `<SelectGroup>`.
   - **0** desktop-only `<Dialog>` usages left in `parent-upload-dialog.tsx`, `worksheet-view-dialog.tsx`, `pending-worksheet-dialog.tsx`, `take-home-activities.tsx`, or `notification-work-destination.tsx`.

### Manual QA Matrix (Desktop `≥1280px` & Mobile `375px`, Light & Dark Theme)
- **Navigation & Shell (`ParentNav`, `NotificationBell`):**
  - Desktop: Multi-child `<Select>` switcher opens/selects via keyboard and pointer; account `<DropdownMenu>` displays `<Avatar>` in trigger and header; sign-out shows `<Spinner>` inside `AlertDialogAction`; `NotificationBell` opens `Popover` with `Item` rows and restores focus on mark-read.
  - Mobile (`375px`): Child switcher opens bottom `Drawer` with `Avatar` rows; `NotificationBell` opens bottom `Drawer` with swipe handle and zero horizontal overflow.
- **Progress Page (`/progress` — all 4 tabs):**
  - `Recent`: `LatestSubmissionCard` photo preview `<Button>` and 5 Skill Breakdown `<Item render={<Button />} />` rows open `WorksheetViewDialog` to the matching criterion; `SampleReportPreview` toggles and switches skill tabs cleanly.
  - `Practice`: `TakeHomeActivities` cards open `ParentUploadDialog` and `PhotoPreviewDialog` (`ResponsiveRichOverlay`).
  - `Progress`: 1-worksheet baseline `<Separator />` summary and multi-worksheet `CriterionTrendChart` (`Chart` + `Table` tabs) and `PastWorksheetsSection` sort/expand controls render cleanly at `375px` and desktop.
  - `Grades`: `ParentGrades` rows, points, comments button, and deep-link highlight scroll work across viewports.
- **Overlays & Upload Flow (Desktop `Dialog` + Mobile full-height `Sheet` / `Drawer`):**
  - `ParentUploadDialog`: Steps 1–5 + Step 3 zoom overlay + `QualityErrorCard` error & inspection modal work on both desktop and mobile (`375px` camera/library inputs, focus transitions, upload-in-flight close guard).
  - `WorksheetViewDialog` & `PendingWorksheetDialog`: Split photo inspector (`AnnotationTooltip` `<Card>`, `WorksheetImageInspector` zoom/contrast/loupe, `SubmissionCommentTabs`) + `<Alert>` Teacher note work cleanly in mobile `Sheet` and desktop `Dialog`.
  - `PhotoPreviewDialog` & `NotificationWorkDestination`: Mobile `Sheet`/`Drawer` and desktop `Dialog` open, display `<Card>`/`<Alert>`, delete/replace/upload actions fire properly, and safe-area footers remain visible.
- **Settings (`/parent-settings`) & Teacher Spot-Check:**
  - `/parent-settings`: `<Button nativeButton={false} render={<Link />} />` back link, `ParentSettingsSkeleton` `<Card>` + `<Separator />`, all 3 settings cards, and `ForgotPasswordDialog` (`ResponsiveModal`) work across viewports.
  - Teacher spot-check: Verify `NotificationList`/`NotificationRowItem`, `AnnotationTooltip`, `SubmissionCommentPicker`, `QualityErrorCard`, and `CriterionTrendChart` remain intact inside `(teacher)` routes (`/dashboard`, `/activities/[id]`, `/gradebook`).
