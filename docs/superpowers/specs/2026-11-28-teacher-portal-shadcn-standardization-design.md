# Teacher Portal shadcn/ui & Responsive Standardization Design

**Date:** 2026-11-28  
**Scope:** Teacher portal (`frontend/app/(teacher)/**`, `frontend/components/**` used by teacher routes)  
**Target Viewports:** Desktop (`md+`, `>= 768px`) and Mobile (`< 768px`, `375px` baseline)  
**UI Base:** `shadcn` `base-luma` (`@base-ui/react`, `lucide-react`, Tailwind v4)

---

## 1. Purpose & Constraints

Ensure every interactive control, surface container, progress indicator, and overlay across all teacher portal pages and subpages uses `shadcn/ui` primitives from `@/components/ui/*`, while giving mobile viewports native bottom-drawer and full-height sheet ergonomics without sacrificing desktop dialog/table efficiency.

### Explicit Exclusions (`AGENTS.md` §4)
- Native `<input type="file">` picker and mobile camera capture inputs in `frontend/components/quick-upload-dialog.tsx`.
- SVG diagnostic overlay layers in `frontend/components/shared/diagnostic-overlay/`.
- Custom `<canvas>` cursive stroke renderer in `frontend/components/cursive-stroke-canvas.tsx`.
- Target-range `<div role="meter">` in `frontend/components/submissions/raw-measurements-table.tsx` (semantically `meter`, not `progressbar`; no dual-bound target-window `Meter` exists in `@shadcn`).

---

## 2. `components/ui/` Boundary & Shared Composite Deduplication

### 2.1 Relocate Non-Registry Composites Out of `components/ui/`
`frontend/components/ui/` is reserved strictly for `@shadcn` registry primitives (matching `npx shadcn@latest info --json`). Move the three custom composite components into `frontend/components/shared/`:
- `frontend/components/ui/search-input.tsx` → `frontend/components/shared/search-input.tsx`
- `frontend/components/ui/filter-pills.tsx` → `frontend/components/shared/filter-pills.tsx`
- `frontend/components/ui/floating-action-bar.tsx` → `frontend/components/shared/floating-action-bar.tsx`

Update all 14 teacher-portal import sites across:
- `frontend/app/(teacher)/activities/page.tsx`
- `frontend/app/(teacher)/activities/[id]/page.tsx`
- `frontend/app/(teacher)/roster/page.tsx`
- `frontend/components/activities/activity-review-toolbar.tsx`
- `frontend/components/dashboard/class-table.tsx`
- `frontend/components/gradebook/teacher-gradebook.tsx`
- `frontend/components/roster/floating-batch-bar.tsx`
- `frontend/components/cursive-guide-dialog.tsx`

### 2.2 Deduplicate `ActivityReviewToolbar` Scroll Strip
`frontend/components/activities/activity-review-toolbar.tsx` currently duplicates `FilterPills`'s `ScrollArea` + `ResizeObserver` + edge-fade mask + `ChevronLeft`/`ChevronRight` scroll buttons in order to append a `"More filters"` `ButtonGroup`/`DropdownMenu` after the `ToggleGroup`.

Extend `FilterPills` (`frontend/components/shared/filter-pills.tsx`) with:
- Optional `trailing?: React.ReactNode` rendered inside the scrollable row right after `ToggleGroup`.
- Optional `className?: string` and `badgeClassName?: string` on `FilterPillItem` so styled accent pills (such as `"Unread Comments"`) remain declarative.

Replace the duplicated scroll container in `ActivityReviewToolbar` with `<FilterPills trailing={...} />`.

---

## 3. Responsive Overlay Primitives & Desktop/Mobile Mapping

### 3.1 Shared Primitives (`frontend/components/shared/`)
Both primitives read `useIsMobile()` (`< 768px` breakpoint in `frontend/hooks/use-mobile.ts`) and expose an identical compound API (`Root`, `Trigger`, `Content`, `Header`, `Title`, `Description`, `Body`, `Footer`, `Close`) via React context so call sites never branch on `Dialog` vs `Drawer` vs `Sheet`.

1. **`ResponsiveModal`** (`frontend/components/shared/responsive-modal.tsx`):
   - **Desktop (`md+`):** Renders shadcn `Dialog` (`DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`).
   - **Mobile (`< 768px`):** Renders shadcn `Drawer` (`swipeDirection="down"`, `showSwipeHandle={true}` by default), `DrawerContent` (`max-h-[90dvh]`), left-aligned `DrawerHeader`, scrollable body slot (`overflow-y-auto overscroll-contain`), and `DrawerFooter` with safe-area bottom padding (`pb-[max(1rem,env(safe-area-inset-bottom))]`).
   - Forwards `finalFocus` cleanly to `DialogContent` / `DrawerContent` for keyboard focus restoration.

2. **`ResponsiveRichOverlay`** (`frontend/components/shared/responsive-rich-overlay.tsx`):
   - **Desktop (`md+`):** Renders wide shadcn `Dialog`.
   - **Mobile (`< 768px`):** Renders shadcn `Sheet` with `side="bottom"` and full/near-full height (`h-dvh max-h-dvh rounded-none` or `h-[96dvh] rounded-t-2xl`), **without** vertical swipe-to-dismiss so touch pan/zoom, stroke canvas drawing, and camera framing gestures never trigger accidental dismissal.

### 3.2 Component Mapping

**Use `ResponsiveModal` (10 compact form / action overlays):**
- Roster: `frontend/components/roster/student-dialog.tsx`, `frontend/components/roster/bulk-student-dialog.tsx`, `frontend/components/roster/batch-move-dialog.tsx`, `frontend/components/roster/manage-sections-dialog.tsx`
- Activities & Gradebook: `frontend/components/activities/create-activity-dialog.tsx`, `frontend/components/activities/edit-activity-dialog.tsx`, `frontend/components/gradebook/gradebook-bulk-dialog.tsx`
- Settings, Shortcuts & Lifecycle: `frontend/components/settings/security-settings-card.tsx` (modal dialog), `frontend/components/shortcuts-dialog.tsx`, and the small action/detail dialogs in `frontend/components/submissions/submission-lifecycle-controls.tsx`

**Use `ResponsiveRichOverlay` (5 rich / multi-step / interactive overlays):**
- `frontend/components/quick-upload-dialog.tsx`
- `frontend/components/submissions/submission-detail-dialog.tsx` and `variant="modal"` header/title/description/footer in `frontend/components/submissions/submission-detail-content.tsx`
- `frontend/components/cursive-guide-dialog.tsx` (preserves its mobile `"grid" | "detail"` flow and nested filter `Drawer`)
- `frontend/components/rubric-reference-dialog.tsx`
- Fullscreen photo preview dialog in `frontend/components/submissions/quality-error-card.tsx`

**Unchanged overlays (already responsive or destructive):**
- `frontend/components/notifications/notification-bell.tsx` (`Popover` ↔ `Drawer`)
- Side `Sheet`s (`StudentDrillDownDrawer`, `WorkGradeSheet`, `WorksheetHistory`, `CommentSheetContent` — already `w-full` on mobile)
- `AlertDialog` destructive confirmations (`DeleteActivityDialog`, `AttemptDeletionDialogs`, `BatchReleaseDialog`, discard guards)

---

## 4. Raw HTML Controls, `Progress`, and Custom `Card` Surfaces

### 4.1 `BandPositionBar` → shadcn `Progress`
- Update `frontend/components/ui/progress.tsx` so `Progress` / `ProgressTrack` accept an optional `trackChildren?: React.ReactNode` prop (defaulting to `<ProgressIndicator />` when omitted, keeping existing callers unchanged).
- Refactor `frontend/components/shared/band-position-bar.tsx` to render `<Progress>` with the 4 band color zones and score marker dot passed via `trackChildren`, replacing the raw `<div role="progressbar">` while preserving the dual-signal UI shared with the parent portal.

### 4.2 Raw `<button>` Controls → shadcn `Button`
- Replace the raw `<button type="button">` in `frontend/components/gradebook/gradebook-cell.tsx` with `<Button variant="ghost" ...>` while preserving roving `tabIndex`, `data-gradecell` / `data-row` / `data-column` attributes, and `min-h-20` layout.
- Standardize interactive `Item` rows in `frontend/components/dashboard/class-table.tsx`, `frontend/components/dashboard/student-drill-down.tsx`, and `frontend/components/gradebook/mobile-gradebook-list.tsx` to pass `<Button variant="ghost" ... />` via `Item`'s `render` prop so zero raw `<button>` tags remain in teacher portal components.

### 4.3 Custom `bg-card border` `<div>` Wrappers → shadcn `Card`
- `frontend/app/(teacher)/roster/page.tsx`: Convert the search/filter bar, loading container, empty-state containers, desktop table wrapper, and mobile select-all/sort bar from raw `bg-card border` `<div>`s to `Card` / `CardContent`.
- Convert remaining modal/panel surface `<div>` wrappers in `frontend/components/quick-upload-dialog.tsx` (selected file card), `frontend/components/gradebook/gradebook-bulk-dialog.tsx` (assigned sections summary box), and `frontend/components/submissions/submission-detail-content.tsx` (comments panel container) to `Card` / `CardHeader` / `CardContent`.

---

## 5. Edge Cases, Accessibility & Verification

### 5.1 Edge Cases & Safeguards
- **Hydration safety:** `useIsMobile()` defaults to `false` during SSR and resolves in `useEffect`. Because overlays only mount portal DOM when `open === true` (and `TeacherModalsProvider` lazy-mounts modals on open), mobile viewports mount directly into `Drawer`/`Sheet` without flashing a `Dialog`.
- **Nested portals:** `AlertDialog` guards inside `ResponsiveModal` / `ResponsiveRichOverlay` and `CursiveGuideDialog`'s mobile filter `Drawer` rely on Base UI's native portal stack with zero manual `z-index` overrides.
- **Touch & keyboard ergonomics:** Interactive targets maintain `min-h-11` (`44px`) on `< md`; scrollable body regions inside `Drawer`/`Sheet` prevent soft keyboards from hiding submit actions on `375px` screens.

### 5.2 Verification Plan (`AGENTS.md` §5)
- **Static checks (in `frontend/`):** `npx eslint .`, `npx tsc --noEmit`, `npm run build`.
- **Regression scan:** Case-sensitive search across `frontend/app/(teacher)/` and teacher component directories confirming zero remaining raw `<button>` elements, custom `role="progressbar"` elements, or `@/components/ui/(search-input|filter-pills|floating-action-bar)` imports.
- **Manual QA (Desktop `1280×800` & Mobile `375×812`):**
  - Check `/dashboard`, `/activities`, `/activities/[id]`, `/activities/[id]/submissions/[submissionId]`, `/roster`, `/gradebook`, `/settings`.
  - Verify `ResponsiveModal` swipe-to-dismiss, form submit, `finalFocus` restoration, and nested `AlertDialog` confirmations.
  - Verify `ResponsiveRichOverlay` touch pan/zoom (`SubmissionDetailDialog`), camera/crop (`QuickUploadDialog`), and stroke canvas (`CursiveGuideDialog`) without gesture conflicts.
  - Verify `FilterPills` scroll + `"More filters"`, `BandPositionBar` ARIA progressbar attributes, `GradebookCell` arrow-key grid navigation, and `roster/page.tsx` `Card` layout.
