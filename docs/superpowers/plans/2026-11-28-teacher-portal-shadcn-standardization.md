# Teacher Portal shadcn/ui & Responsive Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize every component, surface, progress bar, and overlay across all teacher portal pages and subpages onto `shadcn/ui` (`base-luma`) primitives with native desktop (`Dialog`) and mobile (`Drawer` / full-height `Sheet`) viewport adaptation.

**Architecture:** Reserve `frontend/components/ui/` strictly for `@shadcn` registry primitives by moving custom composites (`SearchInput`, `FilterPills`, `FloatingActionBar`) to `frontend/components/shared/`, add `ResponsiveModal` (`Dialog` ↔ `Drawer`) and `ResponsiveRichOverlay` (`Dialog` ↔ full-height `Sheet`) adapters in `frontend/components/shared/`, and migrate all remaining raw `<button>`, `<div role="progressbar">`, custom `bg-card` wrappers, and desktop-only `Dialog`s across teacher routes.

**Tech Stack:** Next.js 16.2.12 (App Router, React 19.2.4, TypeScript strict), Tailwind CSS v4, `@base-ui/react` (`^1.6.0`), `shadcn` (`base-luma` style), `lucide-react`.

**Spec:** [2026-11-28-teacher-portal-shadcn-standardization-design.md](../../superpowers/specs/2026-11-28-teacher-portal-shadcn-standardization-design.md)

## Global Constraints

- Frontend UI (`AGENTS.md` §4): Always use installed `shadcn/ui` primitives from `@/components/ui/*` (`base-luma` / Base UI) before raw HTML controls (`<button>`, `<input>`, `<label>`, `<fieldset>`, `role="radiogroup"`, `role="progressbar"`, `role="alert"`, `animate-pulse`, `Loader2 animate-spin`) or bespoke styled wrappers.
- Explicit exceptions (`AGENTS.md` §4): Keep native `<input type="file">` capture inputs (`quick-upload-dialog.tsx`), SVG diagnostic overlay layers (`components/shared/diagnostic-overlay/`), custom `<canvas>` (`cursive-stroke-canvas.tsx`), and the dual-bound `<div role="meter">` in `raw-measurements-table.tsx`.
- Base UI rule (`shadcn` skill): Use `render` prop (never `asChild`), no `space-x-*`/`space-y-*` (use `flex gap-*`), `size-*` for equal dimensions, semantic color tokens only, no manual `z-index` on overlays, icons inside `Button` use `data-icon="inline-start"|"inline-end"`.
- Verification (`AGENTS.md` §5): Always run `npx eslint .` and `npx tsc --noEmit` inside `frontend/`, plus `npm run build` and a manual QA pass across desktop (`1280×800`) and mobile (`375×812`) per `docs/DESIGN.md`.

---

### Task 1: Relocate `components/ui/` Custom Composites & Deduplicate `ActivityReviewToolbar`

**Files:**
- Create: `frontend/components/shared/search-input.tsx` (moved from `frontend/components/ui/search-input.tsx`)
- Create: `frontend/components/shared/floating-action-bar.tsx` (moved from `frontend/components/ui/floating-action-bar.tsx`)
- Create: `frontend/components/shared/filter-pills.tsx` (moved & extended from `frontend/components/ui/filter-pills.tsx`)
- Delete: `frontend/components/ui/search-input.tsx`, `frontend/components/ui/filter-pills.tsx`, `frontend/components/ui/floating-action-bar.tsx`
- Modify:
  - `frontend/app/(teacher)/activities/page.tsx:17,21,22`
  - `frontend/app/(teacher)/activities/[id]/page.tsx:61`
  - `frontend/app/(teacher)/roster/page.tsx:11,12`
  - `frontend/components/activities/activity-review-toolbar.tsx:12,269-505`
  - `frontend/components/dashboard/class-table.tsx:34,35`
  - `frontend/components/gradebook/teacher-gradebook.tsx:40,47,48`
  - `frontend/components/roster/floating-batch-bar.tsx:11`
  - `frontend/components/cursive-guide-dialog.tsx:32`

**Interfaces:**
- Produces:
  - `@/components/shared/search-input`: `SearchInput`, `type SearchInputProps`
  - `@/components/shared/floating-action-bar`: `FloatingActionBar`, `type FloatingActionBarProps`
  - `@/components/shared/filter-pills`: `FilterPills`, `type FilterPillsProps`, `type FilterPillItem` (extended with `trailing?: React.ReactNode`, `FilterPillItem.className?: string`, `FilterPillItem.badgeClassName?: string`)

- [ ] **Step 1: Move `search-input.tsx` and `floating-action-bar.tsx` into `frontend/components/shared/`**

```powershell
git mv frontend/components/ui/search-input.tsx frontend/components/shared/search-input.tsx
git mv frontend/components/ui/floating-action-bar.tsx frontend/components/shared/floating-action-bar.tsx
git mv frontend/components/ui/filter-pills.tsx frontend/components/shared/filter-pills.tsx
```

- [ ] **Step 2: Extend `frontend/components/shared/filter-pills.tsx` with `trailing`, `item.className`, and `item.badgeClassName`**

Update `FilterPillItem`, `FilterPillsProps`, and the `ToggleGroup` render block in `frontend/components/shared/filter-pills.tsx`:

```tsx
export interface FilterPillItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  count?: number | string;
  icon?: React.ComponentType<{
    className?: string;
    "aria-hidden"?: React.AriaAttributes["aria-hidden"];
    "data-icon"?: string;
  }>;
  disabled?: boolean;
  className?: string;
  badgeClassName?: string;
}

export interface FilterPillsProps<T extends string = string> {
  items: FilterPillItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  ariaLabel?: string;
  trailing?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  pillClassName?: string;
}
```

Inside `FilterPills` (`frontend/components/shared/filter-pills.tsx`), destructure `trailing`, render `item.className` and `item.badgeClassName`, and place `{trailing}` right after `</ToggleGroup>`:

```tsx
export function FilterPills<T extends string = string>({
  items,
  value,
  onChange,
  label,
  ariaLabel,
  trailing,
  className,
  containerClassName,
  pillClassName,
}: FilterPillsProps<T>) {
  // ... existing scroll/observer hooks unchanged ...
```

```tsx
                <ToggleGroupItem
                  key={item.id}
                  value={item.id}
                  variant="outline"
                  size="sm"
                  id={`${groupId}-pill-${item.id}`}
                  disabled={item.disabled}
                  className={cn(
                    "relative h-auto min-h-10 gap-1.5 rounded-lg border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all cursor-pointer touch-manipulation hover:bg-muted/60 hover:text-foreground sm:min-h-8",
                    "data-pressed:border-primary data-pressed:bg-primary data-pressed:font-semibold data-pressed:text-primary-foreground data-pressed:shadow-warm-sm data-pressed:hover:bg-primary data-pressed:hover:text-primary-foreground",
                    "after:absolute after:-inset-x-1 after:inset-y-0 after:content-['']",
                    pillClassName,
                    item.className
                  )}
                >
                  {Icon && <Icon data-icon="inline-start" aria-hidden="true" />}
                  <span>{item.label}</span>
                  {item.count !== undefined && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "h-auto rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums transition-colors",
                        isSelected &&
                          "bg-primary-foreground/20 text-primary-foreground",
                        item.badgeClassName
                      )}
                    >
                      {item.count}
                    </Badge>
                  )}
                </ToggleGroupItem>
```

```tsx
          </ToggleGroup>
          {trailing}
        </div>
      </ScrollArea>
```

- [ ] **Step 3: Update all 14 import paths across the teacher portal**

Replace `@/components/ui/search-input`, `@/components/ui/filter-pills`, and `@/components/ui/floating-action-bar` with `@/components/shared/...` in:
- `frontend/app/(teacher)/activities/page.tsx:17,21-22`
- `frontend/app/(teacher)/activities/[id]/page.tsx:61`
- `frontend/app/(teacher)/roster/page.tsx:11-12`
- `frontend/components/activities/activity-review-toolbar.tsx:12`
- `frontend/components/dashboard/class-table.tsx:34-35`
- `frontend/components/gradebook/teacher-gradebook.tsx:40,47-48`
- `frontend/components/roster/floating-batch-bar.tsx:11`
- `frontend/components/cursive-guide-dialog.tsx:32`

- [ ] **Step 4: Replace duplicated scroll-pill logic in `frontend/components/activities/activity-review-toolbar.tsx` with `FilterPills`**

Remove the local `scrollAreaRef`, `canScrollLeft`, `canScrollRight`, `checkScroll`, `handleScrollLeft`, `handleScrollRight`, `maskStyle`, `PILL_BASE_CLASS`, and unused `ScrollArea` / `ToggleGroup` / `ChevronLeft` / `ChevronRight` imports from `frontend/components/activities/activity-review-toolbar.tsx`. Import `FilterPills, type FilterPillItem` from `@/components/shared/filter-pills` and build `primaryPillItems`:

```tsx
const primaryPillItems = useMemo<FilterPillItem<string>[]>(() => {
  const items: FilterPillItem<string>[] = [
    { id: "all", label: "All Students", count: allWorkFilter?.count },
    {
      id: "needs_scoring",
      label: "To Grade",
      count: needsScoringCount > 0 ? needsScoringCount : undefined,
      badgeClassName:
        statusFilter !== "needs_scoring" ? "bg-primary/10 text-primary font-bold" : undefined,
    },
    {
      id: "missing",
      label: "Missing",
      count: missingCount > 0 ? missingCount : undefined,
    },
    {
      id: "released",
      label: "Done & Released",
      count: releasedCount > 0 ? releasedCount : undefined,
    },
  ];
  if (unreadCommentsCount > 0) {
    items.push({
      id: "unread_comments",
      label: "Unread Comments",
      icon: MessageSquare,
      count: unreadCommentsCount,
      className:
        statusFilter !== "unread_comments"
          ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
          : undefined,
      badgeClassName:
        statusFilter !== "unread_comments" ? "bg-primary/15 text-primary" : undefined,
    });
  }
  return items;
}, [allWorkFilter?.count, needsScoringCount, missingCount, releasedCount, unreadCommentsCount, statusFilter]);
```

Replace the manual scroll wrapper in `ActivityReviewToolbar` (`lines 269-505`) with:

```tsx
<FilterPills
  items={primaryPillItems}
  value={statusFilter}
  onChange={(next) => {
    if (viewMode !== "grouped") onViewModeChange("grouped");
    onStatusFilterChange(next as SubmissionFilter);
  }}
  ariaLabel="Student work inbox filters"
  pillClassName="min-h-11 whitespace-nowrap sm:min-h-8"
  trailing={
    <ButtonGroup className="shrink-0">
      {/* existing More filters DropdownMenu + Clear Button unchanged */}
    </ButtonGroup>
  }
/>
```

- [ ] **Step 5: Verify TypeScript and ESLint**

Run inside `frontend/`:
```powershell
cd frontend; npx tsc --noEmit; npx eslint app/(teacher)/ components/shared/ components/activities/activity-review-toolbar.tsx components/dashboard/class-table.tsx components/gradebook/teacher-gradebook.tsx components/roster/floating-batch-bar.tsx components/cursive-guide-dialog.tsx
```
Expected: Exit code `0`, zero errors.

- [ ] **Step 6: Commit**

```powershell
git add -A frontend/components/shared/ frontend/components/ui/ frontend/app/(teacher)/ frontend/components/activities/activity-review-toolbar.tsx frontend/components/dashboard/class-table.tsx frontend/components/gradebook/teacher-gradebook.tsx frontend/components/roster/floating-batch-bar.tsx frontend/components/cursive-guide-dialog.tsx
git commit -m "refactor(ui): move custom composites to shared and deduplicate review toolbar pills"
```

---

### Task 2: Create `ResponsiveModal` and `ResponsiveRichOverlay` Shared Primitives

**Files:**
- Create: `frontend/components/shared/responsive-modal.tsx`
- Create: `frontend/components/shared/responsive-rich-overlay.tsx`

**Interfaces:**
- Consumes:
  - `@/hooks/use-mobile`: `useIsMobile()` (`< 768px`)
  - `@/components/ui/dialog`: `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose`
  - `@/components/ui/drawer`: `Drawer`, `DrawerTrigger`, `DrawerContent`, `DrawerHeader`, `DrawerFooter`, `DrawerTitle`, `DrawerDescription`, `DrawerClose`
  - `@/components/ui/sheet`: `Sheet`, `SheetTrigger`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`, `SheetClose`
- Produces:
  - `ResponsiveModal`, `ResponsiveModalTrigger`, `ResponsiveModalContent`, `ResponsiveModalHeader`, `ResponsiveModalBody`, `ResponsiveModalTitle`, `ResponsiveModalDescription`, `ResponsiveModalFooter`, `ResponsiveModalClose`
  - `ResponsiveRichOverlay`, `ResponsiveRichOverlayTrigger`, `ResponsiveRichOverlayContent`, `ResponsiveRichOverlayHeader`, `ResponsiveRichOverlayBody`, `ResponsiveRichOverlayTitle`, `ResponsiveRichOverlayDescription`, `ResponsiveRichOverlayFooter`, `ResponsiveRichOverlayClose`

- [ ] **Step 1: Create `frontend/components/shared/responsive-modal.tsx`**

```tsx
"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const ResponsiveModalContext = React.createContext<{ isMobile: boolean }>({
  isMobile: false,
});

function useResponsiveModal() {
  return React.useContext(ResponsiveModalContext);
}

type ResponsiveModalProps = React.ComponentProps<typeof Dialog> & {
  showSwipeHandle?: boolean;
};

function ResponsiveModal({
  showSwipeHandle = true,
  ...props
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  return (
    <ResponsiveModalContext.Provider value={{ isMobile }}>
      {isMobile ? (
        <Drawer swipeDirection="down" showSwipeHandle={showSwipeHandle} {...props} />
      ) : (
        <Dialog {...props} />
      )}
    </ResponsiveModalContext.Provider>
  );
}

function ResponsiveModalTrigger({
  ...props
}: React.ComponentProps<typeof DialogTrigger>) {
  const { isMobile } = useResponsiveModal();
  return isMobile ? <DrawerTrigger {...props} /> : <DialogTrigger {...props} />;
}

function ResponsiveModalClose({
  ...props
}: React.ComponentProps<typeof DialogClose>) {
  const { isMobile } = useResponsiveModal();
  return isMobile ? <DrawerClose {...props} /> : <DialogClose {...props} />;
}

type ResponsiveModalContentProps = React.ComponentProps<typeof DialogContent> & {
  drawerClassName?: string;
};

function ResponsiveModalContent({
  className,
  drawerClassName,
  showCloseButton = true,
  overlayClassName,
  children,
  ...props
}: ResponsiveModalContentProps) {
  const { isMobile } = useResponsiveModal();

  if (isMobile) {
    return (
      <DrawerContent
        className={cn(
          "max-h-[90dvh] rounded-t-3xl rounded-b-none border-x-0 border-b-0 bg-card text-card-foreground",
          drawerClassName
        )}
        {...props}
      >
        {children}
      </DrawerContent>
    );
  }

  return (
    <DialogContent
      showCloseButton={showCloseButton}
      overlayClassName={overlayClassName}
      className={className}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

function ResponsiveModalHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { isMobile } = useResponsiveModal();
  if (isMobile) {
    return (
      <DrawerHeader
        className={cn("shrink-0 px-5 pt-3 pb-3 text-left group-data-[swipe-axis=y]/drawer-popup:text-left", className)}
        {...props}
      />
    );
  }
  return <DialogHeader className={className} {...props} />;
}

function ResponsiveModalBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex-1 min-h-0 overflow-y-auto overscroll-contain", className)}
      {...props}
    />
  );
}

function ResponsiveModalFooter({
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  const { isMobile } = useResponsiveModal();
  if (isMobile) {
    return (
      <DrawerFooter
        className={cn(
          "shrink-0 flex-col-reverse gap-2 border-t border-border/60 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]",
          className
        )}
        {...props}
      />
    );
  }
  return <DialogFooter showCloseButton={showCloseButton} className={className} {...props} />;
}

function ResponsiveModalTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const { isMobile } = useResponsiveModal();
  return isMobile ? (
    <DrawerTitle className={className} {...props} />
  ) : (
    <DialogTitle className={className} {...props} />
  );
}

function ResponsiveModalDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const { isMobile } = useResponsiveModal();
  return isMobile ? (
    <DrawerDescription className={className} {...props} />
  ) : (
    <DialogDescription className={className} {...props} />
  );
}

export {
  ResponsiveModal,
  ResponsiveModalTrigger,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalBody,
  ResponsiveModalFooter,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
};
```

- [ ] **Step 2: Create `frontend/components/shared/responsive-rich-overlay.tsx`**

```tsx
"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const ResponsiveRichOverlayContext = React.createContext<{ isMobile: boolean }>({
  isMobile: false,
});

function useResponsiveRichOverlay() {
  return React.useContext(ResponsiveRichOverlayContext);
}

function ResponsiveRichOverlay({
  ...props
}: React.ComponentProps<typeof Dialog>) {
  const isMobile = useIsMobile();

  return (
    <ResponsiveRichOverlayContext.Provider value={{ isMobile }}>
      {isMobile ? <Sheet {...props} /> : <Dialog {...props} />}
    </ResponsiveRichOverlayContext.Provider>
  );
}

function ResponsiveRichOverlayTrigger({
  ...props
}: React.ComponentProps<typeof DialogTrigger>) {
  const { isMobile } = useResponsiveRichOverlay();
  return isMobile ? <SheetTrigger {...props} /> : <DialogTrigger {...props} />;
}

function ResponsiveRichOverlayClose({
  ...props
}: React.ComponentProps<typeof DialogClose>) {
  const { isMobile } = useResponsiveRichOverlay();
  return isMobile ? <SheetClose {...props} /> : <DialogClose {...props} />;
}

type ResponsiveRichOverlayContentProps = React.ComponentProps<typeof DialogContent> & {
  sheetClassName?: string;
  mobileFullHeight?: boolean;
};

function ResponsiveRichOverlayContent({
  className,
  sheetClassName,
  mobileFullHeight = true,
  showCloseButton = true,
  overlayClassName,
  children,
  ...props
}: ResponsiveRichOverlayContentProps) {
  const { isMobile } = useResponsiveRichOverlay();

  if (isMobile) {
    return (
      <SheetContent
        side="bottom"
        showCloseButton={showCloseButton}
        className={cn(
          "flex flex-col gap-0 overflow-hidden bg-card text-card-foreground p-0",
          mobileFullHeight
            ? "h-dvh max-h-dvh rounded-none border-t-0"
            : "h-[96dvh] max-h-[96dvh] rounded-t-2xl",
          sheetClassName
        )}
        {...props}
      >
        {children}
      </SheetContent>
    );
  }

  return (
    <DialogContent
      showCloseButton={showCloseButton}
      overlayClassName={overlayClassName}
      className={className}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

function ResponsiveRichOverlayHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { isMobile } = useResponsiveRichOverlay();
  if (isMobile) {
    return (
      <SheetHeader
        className={cn("shrink-0 p-4 pb-3 text-left", className)}
        {...props}
      />
    );
  }
  return <DialogHeader className={className} {...props} />;
}

function ResponsiveRichOverlayBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex-1 min-h-0 overflow-y-auto overscroll-contain", className)}
      {...props}
    />
  );
}

function ResponsiveRichOverlayFooter({
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  const { isMobile } = useResponsiveRichOverlay();
  if (isMobile) {
    return (
      <SheetFooter
        className={cn(
          "shrink-0 flex-row items-center justify-between gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
          className
        )}
        {...props}
      />
    );
  }
  return <DialogFooter showCloseButton={showCloseButton} className={className} {...props} />;
}

function ResponsiveRichOverlayTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const { isMobile } = useResponsiveRichOverlay();
  return isMobile ? (
    <SheetTitle className={className} {...props} />
  ) : (
    <DialogTitle className={className} {...props} />
  );
}

function ResponsiveRichOverlayDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const { isMobile } = useResponsiveRichOverlay();
  return isMobile ? (
    <SheetDescription className={className} {...props} />
  ) : (
    <DialogDescription className={className} {...props} />
  );
}

export {
  ResponsiveRichOverlay,
  ResponsiveRichOverlayTrigger,
  ResponsiveRichOverlayClose,
  ResponsiveRichOverlayContent,
  ResponsiveRichOverlayHeader,
  ResponsiveRichOverlayBody,
  ResponsiveRichOverlayFooter,
  ResponsiveRichOverlayTitle,
  ResponsiveRichOverlayDescription,
};
```

- [ ] **Step 3: Type-check and lint the new primitives**

Run inside `frontend/`:
```powershell
cd frontend; npx tsc --noEmit; npx eslint components/shared/responsive-modal.tsx components/shared/responsive-rich-overlay.tsx
```
Expected: Exit code `0`, zero errors.

- [ ] **Step 4: Commit**

```powershell
git add frontend/components/shared/responsive-modal.tsx frontend/components/shared/responsive-rich-overlay.tsx
git commit -m "feat(ui): add ResponsiveModal and ResponsiveRichOverlay shared primitives"
```

---

### Task 3: Migrate `BandPositionBar` (`Progress`), `GradebookCell` (`Button`), and Interactive `Item` Rows

**Files:**
- Modify: `frontend/components/ui/progress.tsx:7-44`
- Modify: `frontend/components/shared/band-position-bar.tsx:1-75`
- Modify: `frontend/components/gradebook/gradebook-cell.tsx:1-35,328-359`
- Modify: `frontend/components/dashboard/class-table.tsx:473-484`
- Modify: `frontend/components/dashboard/student-drill-down.tsx:828-839`
- Modify: `frontend/components/gradebook/mobile-gradebook-list.tsx:116-126`

**Interfaces:**
- Produces:
  - `Progress` & `ProgressTrack` in `@/components/ui/progress` accept optional `trackChildren?: React.ReactNode` (defaults to `<ProgressIndicator className={indicatorClassName} />`).
  - `BandPositionBar` renders `@/components/ui/progress` (`role="progressbar"` owned by `@base-ui/react/progress`).
  - `GradebookCell` and `Item` interactive triggers use shadcn `Button`.

- [ ] **Step 1: Add optional `trackChildren` support to `frontend/components/ui/progress.tsx`**

```tsx
function Progress({
  className,
  trackClassName,
  indicatorClassName,
  trackChildren,
  children,
  value,
  ...props
}: ProgressPrimitive.Root.Props & {
  trackClassName?: string;
  indicatorClassName?: string;
  trackChildren?: React.ReactNode;
}) {
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot="progress"
      className={cn("flex flex-wrap gap-3", className)}
      {...props}
    >
      {children}
      <ProgressTrack className={trackClassName}>
        {trackChildren ?? <ProgressIndicator className={indicatorClassName} />}
      </ProgressTrack>
    </ProgressPrimitive.Root>
  );
}

function ProgressTrack({ className, children, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      className={cn(
        "bg-muted relative flex h-3 w-full items-center overflow-x-hidden rounded-full",
        className
      )}
      data-slot="progress-track"
      {...props}
    >
      {children}
    </ProgressPrimitive.Track>
  );
}
```

- [ ] **Step 2: Refactor `frontend/components/shared/band-position-bar.tsx` to use `<Progress>`**

Import `Progress` from `@/components/ui/progress` and replace lines 35–80 in `frontend/components/shared/band-position-bar.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { getBandFromScore, type ScoreBand } from "@/lib/utils/scoring";
```

```tsx
      <div className="w-full flex items-center gap-2.5">
        <Progress
          value={numericScore !== null ? Math.round(numericScore) : null}
          min={0}
          max={100}
          aria-valuetext={ariaValueText}
          aria-label={
            ariaLabel ??
            (numericScore !== null
              ? `Diagnostic score position: ${Math.round(numericScore)}%`
              : "Diagnostic score not yet available")
          }
          className="flex-1 gap-0"
          trackClassName={cn(
            "relative flex-1 rounded-full overflow-hidden bg-muted/40 border border-border/50 grid grid-cols-4 items-stretch p-0.5",
            height === "sm" ? "h-2.5" : "h-3.5"
          )}
          trackChildren={
            <>
              {/* 4 Colored Band Zones: Clay, Gold, Sage, Forest */}
              <div className="bg-band-1/45 rounded-l-full border-r border-background/80" />
              <div className="bg-band-2/45 border-r border-background/80" />
              <div className="bg-band-3/45 border-r border-background/80" />
              <div className="bg-band-4/45 rounded-r-full" />

              {/* Marker indicator for current score */}
              {numericScore !== null && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-300 ease-out z-10 motion-reduce:transition-none"
                  style={{ left: `${numericScore}%` }}
                >
                  <div
                    className={cn(
                      "rounded-full bg-foreground shadow-xs border-2 border-background ring-1 ring-border/60",
                      height === "sm" ? "size-2.5" : "size-3.5"
                    )}
                  />
                </div>
              )}
            </>
          }
        />

        {showLabel && (
          <span className="font-sans text-xs font-semibold tabular-nums text-foreground min-w-[2.5rem] text-right shrink-0">
            {numericScore !== null ? `${numericScore.toFixed(1)}%` : "—"}
          </span>
        )}
      </div>
```

- [ ] **Step 3: Replace raw `<button>` in `frontend/components/gradebook/gradebook-cell.tsx` with shadcn `Button`**

Ensure `Button` is imported from `@/components/ui/button` in `frontend/components/gradebook/gradebook-cell.tsx`, and replace `<button ...>` (`lines 328-359`) with:

```tsx
      <Button
        type="button"
        variant="ghost"
        ref={cellRef}
        tabIndex={isFocused ? 0 : -1}
        data-gradecell
        data-row={row}
        data-column={column}
        aria-label={`${label ?? "Work grade"}: ${statusLabel}, ${
          cell.final_points === null
            ? "no point grade"
            : `${cell.final_points} of ${cell.points_possible} points`
        }, ${
          cell.assessment_composite !== null
            ? `composite score ${Math.round(Number(cell.assessment_composite))}%`
            : "no assessment"
        }, ${
          cell.points_possible === null
            ? "bands only"
            : cell.publication === "released"
              ? "released to parents"
              : "draft"
        }${hasUnreadComments ? ", unread comments" : ""}. Click or Space to inspect, Enter to edit score.`}
        onClick={() => {
          onFocusCell?.();
          onOpen();
        }}
        onFocus={() => {
          onFocusCell?.();
        }}
        onKeyDown={handleCellKeyDown}
        className="flex h-auto min-h-[5rem] w-full flex-col items-stretch justify-between rounded-sm p-2 text-left font-normal hover:bg-transparent cursor-pointer focus-visible:outline-none"
      >
        {/* existing cell content */}
      </Button>
```

- [ ] **Step 4: Standardize `Item` `render` button triggers to `<Button variant="ghost" ... />`**

Update the three `Item` lists so no raw `<button>` tags appear:
1. `frontend/components/dashboard/class-table.tsx:473-484`:
```tsx
                <Item
                  key={student.studentId}
                  variant="outline"
                  size="sm"
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onSelectStudent(student)}
                      className="h-auto min-h-11 w-full justify-between bg-card text-left font-normal hover:bg-muted/50 cursor-pointer"
                    />
                  }
                >
```
2. `frontend/components/dashboard/student-drill-down.tsx:828-839`:
```tsx
    <Item
      variant="outline"
      size="sm"
      render={
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenSubmission(item.submissionId, item.activityId)}
          aria-label={`View worksheet submission for "${item.targetText}", scored ${item.compositeScore != null ? `${item.compositeScore.toFixed(1)}%` : "—"}`}
          className="group h-auto min-h-11 w-full justify-between bg-card text-left font-normal hover:bg-muted/50 cursor-pointer"
        />
      }
    >
```
3. `frontend/components/gradebook/mobile-gradebook-list.tsx:116-126`:
```tsx
    <Item
      variant="outline"
      size="sm"
      render={
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenCell(work)}
          className="h-auto min-h-11 w-full justify-between bg-card text-left font-normal hover:bg-muted/50 cursor-pointer"
        />
      }
    >
```

- [ ] **Step 5: Verify TypeScript and ESLint**

Run inside `frontend/`:
```powershell
cd frontend; npx tsc --noEmit; npx eslint components/ui/progress.tsx components/shared/band-position-bar.tsx components/gradebook/gradebook-cell.tsx components/dashboard/class-table.tsx components/dashboard/student-drill-down.tsx components/gradebook/mobile-gradebook-list.tsx
```
Expected: Exit code `0`, zero errors.

- [ ] **Step 6: Commit**

```powershell
git add frontend/components/ui/progress.tsx frontend/components/shared/band-position-bar.tsx frontend/components/gradebook/gradebook-cell.tsx frontend/components/dashboard/class-table.tsx frontend/components/dashboard/student-drill-down.tsx frontend/components/gradebook/mobile-gradebook-list.tsx
git commit -m "refactor(ui): migrate BandPositionBar to Progress and raw buttons to shadcn Button"
```

---

### Task 4: Replace Custom `bg-card` `<div>` Surfaces with shadcn `Card`

**Files:**
- Modify: `frontend/app/(teacher)/roster/page.tsx:414-525,713-770`
- Modify: `frontend/components/quick-upload-dialog.tsx:1464-1515`
- Modify: `frontend/components/gradebook/gradebook-bulk-dialog.tsx:245-275`
- Modify: `frontend/components/submissions/submission-detail-content.tsx:1330-1356`

**Interfaces:**
- Consumes: `Card`, `CardContent`, `CardHeader` from `@/components/ui/card`

- [ ] **Step 1: Convert custom `bg-card border` boxes in `frontend/app/(teacher)/roster/page.tsx` to `Card`**

(`Card`, `CardAction`, `CardContent`, `CardFooter`, `CardHeader`, `CardTitle` are already imported on line 9 of `roster/page.tsx`.)

1. Search & filter toolbar (`lines 414-436`):
```tsx
          <Card size="sm" className="py-3 shadow-warm">
            <CardContent className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-3">
              {/* Search Input & FilterPills unchanged */}
            </CardContent>
          </Card>
```
2. Loading box (`lines 461-464`):
```tsx
          <Card className="py-0">
            <CardContent className="p-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Spinner className="size-6 text-primary" />
              <span className="text-sm font-medium">Loading class roster...</span>
            </CardContent>
          </Card>
```
3. Empty roster wrapper (`lines 467-496`) and empty filter wrapper (`lines 499-517`):
```tsx
          <Card className="py-0 overflow-hidden">
            <CardContent className="px-0">
              <Empty className="py-14 border-0">
                {/* existing Empty children */}
              </Empty>
            </CardContent>
          </Card>
```
```tsx
          <Card className="py-0 overflow-hidden">
            <CardContent className="px-0">
              <Empty className="py-12 border-0">
                {/* existing Empty children */}
              </Empty>
            </CardContent>
          </Card>
```
4. Desktop table container (`lines 521-708`):
```tsx
            <Card className="hidden md:block py-0 overflow-hidden">
              <CardContent className="p-0">
                <div role="region" aria-label="Class roster table" className="overflow-x-auto">
                  <Table>{/* existing table */}</Table>
                </div>
              </CardContent>
            </Card>
```
5. Mobile select-all & sort bar (`lines 713-769`):
```tsx
              <Card size="sm" className="py-2 rounded-xl">
                <CardContent className="flex items-center justify-between gap-2 px-3 text-xs">
                  {/* existing Checkbox & ToggleGroup sort controls */}
                </CardContent>
              </Card>
```

- [ ] **Step 2: Convert remaining custom `bg-card` surfaces in `quick-upload-dialog.tsx`, `gradebook-bulk-dialog.tsx`, and `submission-detail-content.tsx`**

1. In `frontend/components/quick-upload-dialog.tsx` (import `Card, CardContent` from `@/components/ui/card` and update line `1464`):
```tsx
                <Card size="sm" className="rounded-2xl py-4">
                  <CardContent className="px-4 flex flex-col gap-3">
                    {/* existing selected file preview content */}
                  </CardContent>
                </Card>
```
2. In `frontend/components/gradebook/gradebook-bulk-dialog.tsx` (import `Card, CardContent, CardHeader` from `@/components/ui/card` and update lines `245-275`):
```tsx
            <Card size="sm" className="rounded-lg border-border/80 py-0 overflow-hidden text-xs">
              <CardHeader className="bg-muted/40 px-3.5 py-2.5 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
                <span className="font-medium text-foreground">Assigned Sections</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {totalReadyAcrossSections}{" "}
                  {totalReadyAcrossSections === 1 ? "grade ready" : "grades ready"}
                </span>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/40">
                {/* existing assignedSections map */}
              </CardContent>
            </Card>
```
3. In `frontend/components/submissions/submission-detail-content.tsx` (line `1330-1355`):
```tsx
                    <TabsContent value="comments" id="submission-tabpanel-comments">
                      <Card className="py-0 overflow-hidden flex flex-col min-h-80 shadow-xs">
                        <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                          {/* existing SubmissionCommentThread / Skeleton */}
                        </CardContent>
                      </Card>
                    </TabsContent>
```

- [ ] **Step 3: Verify TypeScript and ESLint**

Run inside `frontend/`:
```powershell
cd frontend; npx tsc --noEmit; npx eslint app/(teacher)/roster/page.tsx components/quick-upload-dialog.tsx components/gradebook/gradebook-bulk-dialog.tsx components/submissions/submission-detail-content.tsx
```
Expected: Exit code `0`, zero errors.

- [ ] **Step 4: Commit**

```powershell
git add frontend/app/(teacher)/roster/page.tsx frontend/components/quick-upload-dialog.tsx frontend/components/gradebook/gradebook-bulk-dialog.tsx frontend/components/submissions/submission-detail-content.tsx
git commit -m "refactor(ui): replace custom bg-card div wrappers with shadcn Card"
```

---

### Task 5: Migrate the 4 Roster Overlays to `ResponsiveModal`

**Files:**
- Modify: `frontend/components/roster/student-dialog.tsx`
- Modify: `frontend/components/roster/bulk-student-dialog.tsx`
- Modify: `frontend/components/roster/batch-move-dialog.tsx`
- Modify: `frontend/components/roster/manage-sections-dialog.tsx`

**Interfaces:**
- Consumes: `ResponsiveModal`, `ResponsiveModalContent`, `ResponsiveModalHeader`, `ResponsiveModalBody`, `ResponsiveModalFooter`, `ResponsiveModalTitle`, `ResponsiveModalDescription` from `@/components/shared/responsive-modal`

- [ ] **Step 1: Migrate `frontend/components/roster/student-dialog.tsx` to `ResponsiveModal`**

Replace `@/components/ui/dialog` imports with `@/components/shared/responsive-modal` (keeping `AlertDialog*` untouched for duplicate-name confirmation):
- `<Dialog open={open} onOpenChange={handleDialogOpenChange}>` → `<ResponsiveModal open={open} onOpenChange={handleDialogOpenChange}>`
- `<DialogContent className="w-[calc(100%-1.5rem)] max-w-lg sm:max-w-[460px] max-h-[min(92dvh,calc(100dvh-2rem))] flex flex-col p-5 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-warm border border-border/80 bg-card">` → `<ResponsiveModalContent ... drawerClassName="max-h-[92dvh]">`
- `<DialogHeader ...>` / `<DialogTitle ...>` / `<DialogDescription ...>` / `<DialogFooter ...>` → `<ResponsiveModalHeader ...>` / `<ResponsiveModalTitle ...>` / `<ResponsiveModalDescription ...>` / `<ResponsiveModalFooter ...>`
- Ensure the scrollable form container uses `ResponsiveModalBody` (`px-5 pb-2 md:px-1 md:py-1`) so mobile drawer body scrolls cleanly beneath the fixed header/footer.

- [ ] **Step 2: Migrate `frontend/components/roster/bulk-student-dialog.tsx` to `ResponsiveModal`**

Replace `@/components/ui/dialog` imports with `@/components/shared/responsive-modal` and swap `<Dialog>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>`, `<DialogDescription>`, `<DialogFooter>` to `<ResponsiveModal*>`, wrapping the scrollable bulk-entry area in `<ResponsiveModalBody className="px-5 py-2 md:px-1 md:py-1">`.

- [ ] **Step 3: Migrate `frontend/components/roster/batch-move-dialog.tsx` to `ResponsiveModal`**

Replace lines 3–9 (`@/components/ui/dialog`) with `@/components/shared/responsive-modal` and update lines 126–268:

```tsx
  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent
        className="w-[calc(100%-1.5rem)] max-w-lg sm:max-w-[460px] max-h-[min(92dvh,calc(100dvh-2rem))] flex flex-col p-5 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-warm border border-border/80 bg-card"
      >
        <ResponsiveModalHeader className="pb-3 sm:pb-4 shrink-0 text-left">
          <ResponsiveModalTitle className="font-heading text-lg sm:text-xl font-semibold tracking-tight text-foreground">
            Move to Section
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            Change the class section for {selectedStudents.length}{" "}
            {selectedStudents.length === 1 ? "student" : "selected students"}.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden pt-1">
          <ResponsiveModalBody className="flex flex-col gap-3 overflow-x-hidden px-5 py-1 md:px-1">
            {/* Target Section FieldGroup, Selected Students summary, and Progress Indicator */}
          </ResponsiveModalBody>

          <ResponsiveModalFooter className="pt-3.5 sm:pt-4 mt-2 border-t border-border sm:justify-between shrink-0">
            {/* Cancel & Confirm Move buttons */}
          </ResponsiveModalFooter>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
```

- [ ] **Step 4: Migrate `frontend/components/roster/manage-sections-dialog.tsx` to `ResponsiveModal`**

Replace `@/components/ui/dialog` imports (`lines 5-10`) with `@/components/shared/responsive-modal` (keeping `AlertDialog*` for delete-section confirmation), swap `<Dialog*>` (`lines 168-179+`) to `<ResponsiveModal*>`, and wrap the section list in `<ResponsiveModalBody className="px-5 pb-4 md:px-0 md:pb-0">`.

- [ ] **Step 5: Verify TypeScript and ESLint**

Run inside `frontend/`:
```powershell
cd frontend; npx tsc --noEmit; npx eslint components/roster/
```
Expected: Exit code `0`, zero errors.

- [ ] **Step 6: Commit**

```powershell
git add frontend/components/roster/
git commit -m "feat(roster): migrate roster dialogs to ResponsiveModal for desktop and mobile"
```

---

### Task 6: Migrate Remaining 6 Compact Overlays to `ResponsiveModal`

**Files:**
- Modify: `frontend/components/activities/create-activity-dialog.tsx`
- Modify: `frontend/components/activities/edit-activity-dialog.tsx`
- Modify: `frontend/components/gradebook/gradebook-bulk-dialog.tsx`
- Modify: `frontend/components/shortcuts-dialog.tsx`
- Modify: `frontend/components/settings/security-settings-card.tsx:105-205`
- Modify: `frontend/components/submissions/submission-lifecycle-controls.tsx:511-528,636-653,1064-1075,1206-1360`

**Interfaces:**
- Consumes: `ResponsiveModal*` from `@/components/shared/responsive-modal`

- [ ] **Step 1: Migrate `frontend/components/activities/create-activity-dialog.tsx` and `edit-activity-dialog.tsx`**

In both files, replace `@/components/ui/dialog` with `@/components/shared/responsive-modal` (keeping `AlertDialog*` in `edit-activity-dialog.tsx` for removing points), swap `<Dialog>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>`, `<DialogDescription>`, `<DialogFooter>` to `<ResponsiveModal*>`, and wrap the form body in `<ResponsiveModalBody className="px-5 py-2 md:px-1 md:py-1">`.

- [ ] **Step 2: Migrate `frontend/components/gradebook/gradebook-bulk-dialog.tsx`**

Replace `@/components/ui/dialog` with `@/components/shared/responsive-modal` and swap `<Dialog*>` (`lines 208-424`) to `<ResponsiveModal*>`, wrapping the section preview & fields in `<ResponsiveModalBody className="px-5 py-2 md:p-0">`.

- [ ] **Step 3: Migrate `frontend/components/shortcuts-dialog.tsx`**

Replace lines 4–10 (`@/components/ui/dialog`) with `@/components/shared/responsive-modal` and update lines 120–166:

```tsx
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="w-[calc(100%-1.5rem)] max-w-md max-h-[min(90dvh,calc(100dvh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
        <ResponsiveModalHeader className="p-6 pb-4 border-b shrink-0">
          <ResponsiveModalTitle className="text-base font-semibold">
            Keyboard Shortcuts
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            Accelerators for fast teacher navigation in WriteWise.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <ResponsiveModalBody className="p-5 sm:p-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-5">
          {/* existing categories map */}
        </ResponsiveModalBody>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
```

- [ ] **Step 4: Migrate the reset-password modal in `frontend/components/settings/security-settings-card.tsx` (`lines 106-205`)**

Replace `@/components/ui/dialog` imports with `@/components/shared/responsive-modal` (`ResponsiveModal`, `ResponsiveModalTrigger`, `ResponsiveModalContent`, `ResponsiveModalHeader`, `ResponsiveModalTitle`, `ResponsiveModalDescription`, `ResponsiveModalFooter`, `ResponsiveModalClose`) and wrap the body content inside `<ResponsiveModalBody className="px-5 py-2 md:p-0">` so mobile `Drawer` keeps clean horizontal padding and safe-area footer spacing.

- [ ] **Step 5: Migrate the 4 small dialogs in `frontend/components/submissions/submission-lifecycle-controls.tsx`**

Replace `@/components/ui/dialog` imports with `@/components/shared/responsive-modal` (keeping `AlertDialog*` for `releaseConfirmDialog`). Swap all 4 `<Dialog>` instances (`lines 511-528`, `636-653`, `1064-1075`, `1206-1360`) to `<ResponsiveModal>` while preserving `finalFocus={focusTarget}` / `finalFocus={trigger}` on `<ResponsiveModalContent>` and adding `<ResponsiveModalBody className="px-5 py-2 md:p-0">` around the form/inventory contents.

- [ ] **Step 6: Verify TypeScript and ESLint**

Run inside `frontend/`:
```powershell
cd frontend; npx tsc --noEmit; npx eslint components/activities/create-activity-dialog.tsx components/activities/edit-activity-dialog.tsx components/gradebook/gradebook-bulk-dialog.tsx components/shortcuts-dialog.tsx components/settings/security-settings-card.tsx components/submissions/submission-lifecycle-controls.tsx
```
Expected: Exit code `0`, zero errors.

- [ ] **Step 7: Commit**

```powershell
git add frontend/components/activities/create-activity-dialog.tsx frontend/components/activities/edit-activity-dialog.tsx frontend/components/gradebook/gradebook-bulk-dialog.tsx frontend/components/shortcuts-dialog.tsx frontend/components/settings/security-settings-card.tsx frontend/components/submissions/submission-lifecycle-controls.tsx
git commit -m "feat(ui): migrate activity, gradebook, settings, and lifecycle dialogs to ResponsiveModal"
```

---

### Task 7: Migrate the 5 Rich / Interactive Overlays to `ResponsiveRichOverlay`

**Files:**
- Modify: `frontend/components/quick-upload-dialog.tsx`
- Modify: `frontend/components/submissions/submission-detail-dialog.tsx`
- Modify: `frontend/components/submissions/submission-detail-content.tsx:935-1058,1754-1774`
- Modify: `frontend/components/cursive-guide-dialog.tsx:7-14,418-487,850-887`
- Modify: `frontend/components/rubric-reference-dialog.tsx:390-415`
- Modify: `frontend/components/submissions/quality-error-card.tsx:1148-1330`

**Interfaces:**
- Consumes: `ResponsiveRichOverlay*` from `@/components/shared/responsive-rich-overlay`

- [ ] **Step 1: Migrate `frontend/components/submissions/submission-detail-dialog.tsx` & `submission-detail-content.tsx`**

In `frontend/components/submissions/submission-detail-dialog.tsx`:
```tsx
import {
  ResponsiveRichOverlay,
  ResponsiveRichOverlayContent,
} from "@/components/shared/responsive-rich-overlay";
```
```tsx
  return (
    <ResponsiveRichOverlay open={open} onOpenChange={onOpenChange}>
      <ResponsiveRichOverlayContent
        showCloseButton={false}
        className="w-[calc(100%-1.5rem)] sm:w-[95vw] sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl max-h-[min(94dvh,calc(100dvh-2rem))] flex flex-col p-4 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-warm border border-border/80 bg-surface"
        sheetClassName="bg-surface p-4"
      >
        <SubmissionDetailContent
          key={submission.id}
          submission={submission}
          submissions={submissions}
          currentIndex={currentIndex}
          onNavigate={onNavigate}
          activityTargetText={activityTargetText}
          onClose={() => onOpenChange(false)}
          variant="modal"
          open={open}
        />
      </ResponsiveRichOverlayContent>
    </ResponsiveRichOverlay>
  );
```

In `frontend/components/submissions/submission-detail-content.tsx`, replace `@/components/ui/dialog` imports (`DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`) with `ResponsiveRichOverlayHeader`, `ResponsiveRichOverlayTitle`, `ResponsiveRichOverlayDescription`, `ResponsiveRichOverlayFooter` from `@/components/shared/responsive-rich-overlay` across lines `942-970`, `1038-1046`, and `1755-1773`.

- [ ] **Step 2: Migrate `frontend/components/quick-upload-dialog.tsx` to `ResponsiveRichOverlay`**

Replace `@/components/ui/dialog` imports with `@/components/shared/responsive-rich-overlay` (`ResponsiveRichOverlay`, `ResponsiveRichOverlayContent`, `ResponsiveRichOverlayHeader`, `ResponsiveRichOverlayTitle`, `ResponsiveRichOverlayDescription`, `ResponsiveRichOverlayFooter`):
- Outer root (`lines 150-173`): `<ResponsiveRichOverlay>` + `<ResponsiveRichOverlayContent sheetClassName="p-0 flex flex-col gap-0">`.
- `UploadFlow` header (`lines 704-712`): `<ResponsiveRichOverlayHeader>`, `<ResponsiveRichOverlayTitle>`, `<ResponsiveRichOverlayDescription>`.
- `UploadFlow` footer (`lines 1621-1673`): `<ResponsiveRichOverlayFooter className="border-t border-border bg-muted/20 px-4 py-3 sm:px-6 sm:justify-between">`.

- [ ] **Step 3: Migrate `frontend/components/cursive-guide-dialog.tsx` to `ResponsiveRichOverlay`**

Replace `@/components/ui/dialog` imports (`lines 7-13`) with `@/components/shared/responsive-rich-overlay` (keeping `Drawer*` for the mobile filter drawer on line `536`), and update lines `418-487` and closing tags to `<ResponsiveRichOverlay>`, `<ResponsiveRichOverlayContent>`, `<ResponsiveRichOverlayHeader>`, `<ResponsiveRichOverlayTitle>`, `<ResponsiveRichOverlayDescription>`.

- [ ] **Step 4: Migrate `frontend/components/rubric-reference-dialog.tsx` to `ResponsiveRichOverlay`**

Replace `@/components/ui/dialog` imports with `@/components/shared/responsive-rich-overlay` and update lines `391-408` (and closing tags) to `<ResponsiveRichOverlay*>` while preserving `id="rubric-reference-dialog"`, `overlayClassName`, and the scrollable accordion body.

- [ ] **Step 5: Migrate photo inspection modal in `frontend/components/submissions/quality-error-card.tsx` (`lines 1150-1330`)**

Replace `@/components/ui/dialog` imports with `@/components/shared/responsive-rich-overlay` and update lines `1150-1330` to `<ResponsiveRichOverlay>`, `<ResponsiveRichOverlayContent>`, `<ResponsiveRichOverlayHeader>`, `<ResponsiveRichOverlayTitle>`, `<ResponsiveRichOverlayDescription>`, `<ResponsiveRichOverlayFooter>` so pinch-zoom/pan gestures on mobile never clash with swipe-to-dismiss.

- [ ] **Step 6: Verify TypeScript and ESLint**

Run inside `frontend/`:
```powershell
cd frontend; npx tsc --noEmit; npx eslint components/quick-upload-dialog.tsx components/submissions/submission-detail-dialog.tsx components/submissions/submission-detail-content.tsx components/cursive-guide-dialog.tsx components/rubric-reference-dialog.tsx components/submissions/quality-error-card.tsx
```
Expected: Exit code `0`, zero errors.

- [ ] **Step 7: Commit**

```powershell
git add frontend/components/quick-upload-dialog.tsx frontend/components/submissions/submission-detail-dialog.tsx frontend/components/submissions/submission-detail-content.tsx frontend/components/cursive-guide-dialog.tsx frontend/components/rubric-reference-dialog.tsx frontend/components/submissions/quality-error-card.tsx
git commit -m "feat(ui): migrate rich interactive overlays to ResponsiveRichOverlay"
```

---

### Task 8: Final Verification, Regression Scan & Desktop/Mobile QA Pass

**Files:**
- Read/verify only (no code edits unless a check surfaces a bug)

- [ ] **Step 1: Run full frontend lint, type-check, and production build**

```powershell
cd frontend; npx eslint .; if ($LASTEXITCODE -eq 0) { npx tsc --noEmit }; if ($LASTEXITCODE -eq 0) { npm run build }
```
Expected: Exit code `0` for `eslint`, `tsc --noEmit`, and `npm run build`.

- [ ] **Step 2: Run regression scan confirming zero non-shadcn violations in teacher portal**

```powershell
$dirs = @(
  "frontend\app\(teacher)",
  "frontend\components\activities",
  "frontend\components\comments",
  "frontend\components\dashboard",
  "frontend\components\gradebook",
  "frontend\components\notifications",
  "frontend\components\roster",
  "frontend\components\settings",
  "frontend\components\shared",
  "frontend\components\submissions"
)
$extra = @(
  "frontend\components\quick-upload-dialog.tsx",
  "frontend\components\rubric-reference-dialog.tsx",
  "frontend\components\shortcuts-dialog.tsx",
  "frontend\components\cursive-guide-dialog.tsx",
  "frontend\components\teacher-header.tsx",
  "frontend\components\teacher-sidebar.tsx",
  "frontend\components\teacher-modals-provider.tsx"
)
$files = ($dirs | ForEach-Object { Get-ChildItem -Recurse -File $_ -Include *.tsx,*.ts }) + ($extra | ForEach-Object { Get-Item $_ }) | Where-Object { $_.Name -notmatch 'parent' }
$files | Select-String -CaseSensitive -Pattern '<(button|select|textarea|label|fieldset|legend|table|thead|tbody|tr|th|td|hr|progress)\b|role="progressbar"|@/components/ui/(search-input|filter-pills|floating-action-bar)'
```
Expected: Zero matches (only documented `<input type="file">` in `quick-upload-dialog.tsx` and `<div role="meter">` in `raw-measurements-table.tsx` are excluded by design).

- [ ] **Step 3: Perform manual QA pass against `docs/DESIGN.md` at Desktop (`1280×800`) and Mobile (`375×812`)**

Start `npm run dev` in `frontend/` and verify every teacher route and overlay:
- `/dashboard`: Summary cards, `ClassTable` desktop table & mobile `Item` list, `StudentDrillDownDrawer`, `BandPositionBar` ARIA `progressbar`, `SubmissionDetailDialog` (`ResponsiveRichOverlay`).
- `/activities`: `SearchInput`, `FilterPills`, `CreateActivityDialog` / `EditActivityDialog` (`ResponsiveModal`), `FloatingActionBar`.
- `/activities/[id]`: `ActivityReviewToolbar` (`FilterPills` with `"More filters"` trailing group), `ReleaseActivityButton` & `Deadline` (`ResponsiveModal`).
- `/activities/[id]/submissions/[submissionId]`: `SubmissionDetailContent` comments `Card`, `SubmissionLifecycleControls` (`ResponsiveModal`), `QualityErrorCard` fullscreen preview (`ResponsiveRichOverlay`).
- `/roster`: `Card` containers for toolbar, loading, empty states, desktop table, and mobile bar; `StudentDialog`, `BulkStudentDialog`, `BatchMoveDialog`, `ManageSectionsDialog` (`ResponsiveModal` bottom `Drawer` on `375px` with swipe handle & soft-keyboard scroll).
- `/gradebook`: `GradebookCell` (`Button`) arrow-key navigation on desktop, `MobileGradebookList` `Item` rows & `Drawer` on mobile, `GradebookBulkDialog` (`ResponsiveModal`).
- `/settings`: `SecuritySettingsCard` password reset `ResponsiveModal`.
- Global modals (`TeacherModalsProvider`): `QuickUploadDialog`, `CursiveGuideDialog`, `RubricReferenceDialog` (`ResponsiveRichOverlay`), `ShortcutsDialog` (`ResponsiveModal`).
