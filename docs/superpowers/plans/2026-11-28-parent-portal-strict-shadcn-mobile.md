# Parent Portal Strict shadcn/ui & Mobile UX Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring 100% of Parent Portal pages, subpages, tabs, dialogs, drawers, sheets, skeletons, and parent-reachable shared components into strict `base-luma` (`@base-ui/react`) shadcn/ui compliance across both desktop (`≥1024px`) and mobile (`375px`) viewports.

**Architecture:** Execute the transition across the spec's 4 vertical slices organized into **14 non-overlapping tasks** (13 focused file-scoped implementation tasks covering all 17 unique files + 1 final portal-wide static/manual QA gate). Each implementation task resolves raw HTML controls, missing Base UI wrappers (`SelectGroup`, `items`, `Avatar`, `Spinner`, `Alert`, `Card`, `ItemGroup`/`Item`, `Separator`, `Empty`, `Badge`), styling hygiene (`flex flex-col gap-*`, `cn()`, `data-icon`, semantic tokens), and responsive overlay parity (`ResponsiveRichOverlay` / `ResponsiveModal`) in one clean commit per task.

**Tech Stack:** Next.js 16.2, React 19.2, TypeScript (`strict: true`), Tailwind CSS v4, shadcn/ui (`style: "base-luma"`, `@base-ui/react ^1.6.0`), Lucide icons, ESLint, Impeccable detector.

**Spec:** `docs/superpowers/specs/2026-11-28-parent-portal-strict-shadcn-mobile-design.md`

---

## Global Constraints

- **Base UI (`base-luma`) composition:** Always use `render={<Element />}` on `@base-ui/react` triggers (`DropdownMenuTrigger`, `DrawerTrigger`, `CollapsibleTrigger`, `Item`, `Button nativeButton={false} render={<Link />}`). Never use Radix `asChild`. Never use Radix `data-[state=*]` selectors.
- **Select & DropdownMenu anatomy:** Wrap all `SelectItem` elements inside `<SelectGroup>`. On Base UI `<Select>`, pass an `items` array (`{ value, label }[]`) and render explicit fallback text inside `<SelectValue>` rather than Radix's `placeholder` prop. Wrap all `DropdownMenuItem` elements inside `<DropdownMenuGroup>`.
- **Accessible overlay titles & descriptions:** Every `Dialog`, `Sheet`, `Drawer`, `AlertDialog`, `ResponsiveModal`, and `ResponsiveRichOverlay` must render its `*Title` and `*Description` (`className="sr-only"` when visually hidden).
- **Component-first primitives:**
  - Zero raw `<button>` elements inside UI flows; use `<Button>` or `<Item render={<Button ... />} />`.
  - Use `<Avatar>` + `<AvatarFallback>` for user/child initials badges instead of raw circular `<div>`/`<span>` wrappers.
  - Use `<Spinner data-icon="inline-start" />` inside pending buttons/actions; never import `Loader2` for spinning loaders.
  - Use `<Alert>` (`AlertTitle` / `AlertDescription`) for status, warning, error, and teacher-note callouts.
  - Use `<Card>` (`CardHeader` / `CardTitle` / `CardContent` / `CardFooter`) and `<Separator />` instead of bespoke bordered card `<div>`s and `<div className="h-px ..." />` / `border-t` divider blocks.
  - Use `<ItemGroup>` + `<Item>` (`ItemMedia` / `ItemContent` / `ItemTitle` / `ItemActions`) for structured notification feed lists.
- **Styling, icons & layout (`DESIGN.md` + `shadcn` rules):**
  - Replace `space-y-*` / `space-x-*` with `flex flex-col gap-*` / `flex items-center gap-*` (4px scale; `gap-1.5` only for tight label/metadata proximity).
  - Replace equal `w-N h-N` with `size-N`.
  - Use `cn()` for conditional class names (never template-literal `${...}` ternaries in `className`).
  - Replace manual `dark:` surface/brand overrides (`bg-brand-50/80 dark:bg-brand-950/40`, `bg-surface dark:bg-card`, `text-brand-700 dark:text-brand-300`, `dark:data-[scrolled=true]:*`, `dark:text-warning`, etc.) on non-SVG UI elements with semantic tokens (`bg-secondary`, `text-secondary-foreground`, `bg-primary/5`, `text-primary`, `bg-card`, `text-foreground`, `bg-warning/10`, `text-warning-foreground`, `bg-band-1..4/*`, `text-band-1..4-text`, `shadow-warm`).
  - Omit manual icon sizing classes (`size-3.5`, `size-4`) inside `<Button>`, `<Badge>`, `<Alert>`, and `<DropdownMenuItem>`; use `data-icon="inline-start"` or `data-icon="inline-end"` on `<Button>` icons.
  - Preserve all `DESIGN.md` rules: no `max-w-*` or `container` width caps on portal shells or page roots; keep `min-h-11` (`44px`) touch targets on mobile interactive controls; never use standard red (`#EF4444`) in 4-band developmental indicators; preserve all existing `ApiError.code` branches, focus restoration hooks, upload-in-flight close guards, and keyboard shortcuts.
- **Explicitly Exempt (Keep Custom per `AGENTS.md` §4):**
  - Hidden `<input type="file">` native camera and library capture inputs in `parent-upload-dialog.tsx:527-545`.
  - SVG diagnostic, guideline, and illustration layers (`guide-line-overlay.tsx`, `diagnostic-overlay/layers/*`, `sample-report-preview.tsx` SVG worksheet illustration, `cursive-stroke-canvas.tsx`, `rubric-reference-dialog.tsx`, `criterion-trend-chart.tsx`).
- **Workspace hygiene:** The repository may contain pre-existing uncommitted work outside Parent Portal scope. Never use `git add -A` or `git add .` — stage only each task's explicit file paths.
- **No Automated Frontend Test Suite (`AGENTS.md` §5):** Every task verifies with `npx eslint`, `npx tsc --noEmit`, `detect.mjs --json`, and strict `Select-String` compliance checks. No new packages or CLI component installs are required.

---

## Progress Tracker

| Slice | Task | Surface / Files | Status |
|---|---|---|---|
| **1 — Chrome** | Task 1 | `frontend/components/parent-nav.tsx` | [ ] |
| **1 — Chrome** | Task 2 | `frontend/components/parent/parent-portal-skeletons.tsx`, `frontend/app/(parent)/parent-settings/page.tsx` | [ ] |
| **1 — Chrome** | Task 3 | `frontend/components/notifications/notification-list.tsx`, `frontend/components/notifications/notification-row.tsx` | [ ] |
| **1 — Chrome** | Task 4 | `frontend/components/comments/submission-comment-picker.tsx` | [ ] |
| **2 — Dashboard** | Task 5 | `frontend/app/(parent)/progress/progress-content.tsx` | [ ] |
| **2 — Dashboard** | Task 6 | `frontend/components/parent/latest-submission-card.tsx` | [ ] |
| **2 — Dashboard** | Task 7 | `frontend/components/parent/submission-history-dialog.tsx`, `frontend/components/parent/sample-report-preview.tsx` | [ ] |
| **3 — Rich Overlays** | Task 8 | `frontend/components/parent/parent-upload-dialog.tsx` | [ ] |
| **3 — Rich Overlays** | Task 9 | `frontend/components/parent/worksheet-view-dialog.tsx`, `frontend/components/parent/pending-worksheet-dialog.tsx` | [ ] |
| **3 — Rich Overlays** | Task 10 | `frontend/components/parent/take-home-activities.tsx` | [ ] |
| **3 — Rich Overlays** | Task 11 | `frontend/components/shared/diagnostic-overlay/annotation-tooltip.tsx` | [ ] |
| **3 — Rich Overlays** | Task 12 | `frontend/components/submissions/quality-error-card.tsx` | [ ] |
| **4 — Modal & QA** | Task 13 | `frontend/components/parent/notification-work-destination.tsx` | [ ] |
| **4 — Modal & QA** | Task 14 | Full Parent Portal Static Gates, Compliance Scan & Manual QA Pass | [ ] |

---

## Slice 1 — Navigation, Skeletons & Shared Chrome

### Task 1: Bring `ParentNav` into Strict Base UI `shadcn` Compliance

**Files:**
- Modify: `frontend/components/parent-nav.tsx:1-378`

**Interfaces:**
- Preserves `ParentNav` props (`user`, `linkedChildren`, `selectedChildId`, `onChildChange`, `onOpenRubric`, `onOpenCursiveGuide`), sign-out `AlertDialog`, and mobile child `Drawer`.

- [ ] **Step 1: Update imports in `frontend/components/parent-nav.tsx`**

Replace lines 17–49 to add `SelectGroup`, `Avatar`, `AvatarFallback`, and `Spinner`, and remove `Loader2`:

```tsx
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
```

Update line 36 (`lucide-react` import) to remove `Loader2`:

```tsx
import { LogOut, Settings, Users, BookOpen, PenTool, ChevronDown, Check } from "lucide-react";
```

- [ ] **Step 2: Clean header scrolled border/shadow (`L125`) and desktop `Select` child switcher (`L149-181`)**

Add `childItems` right after `activeChild` (`L114`):

```tsx
  const childItems = linkedChildren.map((child) => ({
    value: child.id,
    label: `${child.fullName} (${child.section})`,
  }));
```

Replace the scrolled header class (`L124-125`):

```tsx
          !hasSubNav &&
            "border-b border-border transition-[border-color,box-shadow] duration-200 ease-out data-[scrolled=true]:border-border data-[scrolled=true]:shadow-warm"
```

Replace the desktop child `Select` block (`L149-181`):

```tsx
                {/* Desktop Switcher: Standard Select Dropdown */}
                <div className="hidden sm:block">
                  <Select
                    items={childItems}
                    value={selectedChildId ?? undefined}
                    onValueChange={(val) => {
                      if (val) onChildChange(val);
                    }}
                  >
                    <SelectTrigger
                      className="w-auto min-w-0 max-w-[340px] h-9 text-xs sm:text-sm font-medium gap-1.5 border-border/70 bg-card hover:bg-muted/40 transition-colors shadow-warm-sm"
                      aria-label="Switch child profile"
                    >
                      <Users className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                      <SelectValue className="min-w-0">
                        {activeChild ? (
                          <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                            <span className="truncate font-semibold text-foreground">{activeChild.fullName}</span>
                            <span className="text-muted-foreground text-xs shrink-0">({activeChild.section})</span>
                          </span>
                        ) : (
                          "Select child"
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="center" className="w-[280px]">
                      <SelectGroup>
                        {linkedChildren.map((child) => (
                          <SelectItem key={child.id} value={child.id} className="cursor-pointer text-sm">
                            <div className="flex flex-col text-left">
                              <span className="font-medium text-foreground">{child.fullName}</span>
                              <span className="text-xs text-muted-foreground">Section {child.section}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
```

- [ ] **Step 3: Replace mobile `Drawer` initials `<span>`s and `dark:` overrides (`L194-263`) with `<Avatar>` + semantic tokens**

Replace lines 194–265 inside the mobile `Drawer`:

```tsx
                          <Avatar size="sm" className="shrink-0">
                            <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold text-xs">
                              {activeChild ? getStudentInitials(activeChild.fullName) : "S"}
                            </AvatarFallback>
                          </Avatar>
```

And replace the child row `Button` classes and leading initials (`L232-258`):

```tsx
                              className={cn(
                                "h-auto w-full flex items-center justify-between p-3 rounded-xl text-left font-normal cursor-pointer min-h-[52px] touch-manipulation",
                                isSelected
                                  ? "bg-primary/5 border-primary/40 hover:bg-primary/10 shadow-warm-sm"
                                  : "bg-card border-border/70 hover:bg-muted/40 active:bg-muted/70"
                              )}
                            >
                              <span className="flex items-center gap-3 min-w-0">
                                <Avatar size="default" className="size-9 shrink-0">
                                  <AvatarFallback
                                    className={cn(
                                      "font-semibold text-xs",
                                      isSelected
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground"
                                    )}
                                  >
                                    {childInitials}
                                  </AvatarFallback>
                                </Avatar>
```

- [ ] **Step 4: Replace account menu trigger, label avatar, icon sizing, and sign-out `<Spinner>` (`L279-372`)**

Replace lines 279–372:

```tsx
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 sm:size-9 rounded-full cursor-pointer touch-manipulation"
                    aria-label={`Account menu for ${user.fullName}`}
                  />
                }
              >
                <Avatar className="size-full">
                  <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 rounded-2xl p-1.5 shadow-warm border border-border/80 bg-popover"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal p-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="size-9 rounded-xl after:rounded-xl shrink-0">
                        <AvatarFallback className="rounded-xl bg-secondary text-secondary-foreground font-semibold text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{user.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate" title={user.email}>{user.email}</p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {onOpenRubric && (
                    <DropdownMenuItem
                      onClick={() => onOpenRubric()}
                      className="cursor-pointer gap-2 py-2 min-h-10 sm:min-h-9 text-sm"
                    >
                      <BookOpen aria-hidden="true" />
                      <span>Score Guide</span>
                    </DropdownMenuItem>
                  )}
                  {onOpenCursiveGuide && (
                    <DropdownMenuItem
                      onClick={() => onOpenCursiveGuide()}
                      className="cursor-pointer gap-2 py-2 min-h-10 sm:min-h-9 text-sm"
                    >
                      <PenTool aria-hidden="true" />
                      <span>Cursive Guide</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    render={<Link href="/parent-settings" />}
                    className="cursor-pointer gap-2 py-2 min-h-10 sm:min-h-9 text-sm"
                  >
                    <Settings aria-hidden="true" />
                    <span>Account Settings</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => setShowSignOutDialog(true)}
                    className="cursor-pointer gap-2 py-2 min-h-10 sm:min-h-9 text-sm text-destructive focus:text-destructive"
                  >
                    <LogOut aria-hidden="true" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </header>

      {/* Sign-out confirmation dialog */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of WriteWise?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to view your child&apos;s handwriting progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              id="confirm-parent-sign-out"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? (
                <>
                  <Spinner data-icon="inline-start" aria-hidden="true" />
                  <span>Signing out...</span>
                </>
              ) : (
                "Sign out"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

- [ ] **Step 5: Verify `parent-nav.tsx` static checks**

```powershell
Select-String -Path frontend/components/parent-nav.tsx -Pattern 'Loader2|dark:|SelectValue placeholder|asChild'
```
Expected: zero output.

```powershell
Set-Location frontend; npx eslint "components/parent-nav.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/parent-nav.tsx"
```
Expected: 0 ESLint errors, 0 TypeScript errors, 0 detector regressions.

- [ ] **Step 6: Commit**

```powershell
git add frontend/components/parent-nav.tsx; if ($?) { git commit -m "refactor(ui): migrate parent nav avatars, select group, and spinner to strict shadcn" }
```

---

### Task 2: Standardize `ParentPortalSkeletons` and `/parent-settings` Route Header

**Files:**
- Modify: `frontend/components/parent/parent-portal-skeletons.tsx:1-586`
- Modify: `frontend/app/(parent)/parent-settings/page.tsx:1-83`

**Interfaces:**
- Preserves all exported skeleton names (`LatestSubmissionSkeleton`, `TakeHomeActivitiesSkeleton`, `ProgressTrendSkeleton`, `PastWorksheetsSkeleton`, `ParentGradesSkeleton`, `ParentPortalPageSkeleton`, `NotificationWorkLoadingSkeleton`, `ParentSettingsSkeleton`) and `/parent-settings` RSC props/output.

- [ ] **Step 1: Add `Separator` and convert all `space-y-*` / raw card wrappers / `dark:` surface override in `frontend/components/parent/parent-portal-skeletons.tsx`**

Import `Separator` at line 5:

```tsx
import { Separator } from "@/components/ui/separator";
```

Apply these exact class/JSX updates in `parent-portal-skeletons.tsx`:

1. `L167` (`TakeHomeActivitiesSkeleton` specimen surface): replace `bg-surface dark:bg-card` with `bg-card`:
```tsx
<div className="relative overflow-hidden rounded-xl border border-border/70 bg-card">
```

2. `L222, L227, L235` (`ProgressTrendSkeleton` trajectory items): replace `sm:space-y-2` with `sm:gap-2`:
```tsx
<div className="order-first sm:order-none flex items-center justify-between sm:flex-col sm:items-start sm:gap-2 pb-2 sm:pb-0 border-b sm:border-b-0 border-border/50">
```
```tsx
<div className="flex items-center justify-between sm:flex-col sm:items-start sm:gap-2">
```

3. `L275, L289, L306, L364, L481, L484, L513`: replace every `space-y-*` with `flex flex-col gap-*`:
- `L275`: `className="flex flex-col gap-4 min-w-0"`
- `L289`: `<CardContent className="p-4 sm:p-6 flex flex-col gap-4 min-w-0">`
- `L306`: `className="flex flex-col gap-3"`
- `L364`: `className="flex flex-col gap-3"`
- `L481`: `className="w-full px-4 sm:px-6 py-6 flex flex-col gap-6 pb-16"`
- `L484`: `<div className="flex flex-col gap-1.5 min-w-0">`
- `L513`: `className="rounded-lg border border-border/80 bg-muted/30 p-3 flex flex-col gap-2"`

4. Replace `ParentSettingsSkeleton` (`L536-586`) to compose `<Card>`, `<CardContent>`, `<CardFooter>`, `<Separator />`, and `flex flex-col gap-*`:

```tsx
export function ParentSettingsSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading account settings"
      className="w-full min-w-0 px-4 py-6 sm:px-6 flex flex-col gap-8 pb-20 sm:pb-16"
    >
      <span className="sr-only">Loading account settings</span>

      {/* Back link */}
      <div aria-hidden="true">
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      {/* Page Header */}
      <div aria-hidden="true" className="border-border flex flex-col gap-2 border-b pb-6">
        <Skeleton className="h-8 sm:h-9 w-52 rounded-md" />
        <Skeleton className="h-4 w-72 max-w-full rounded-md" />
      </div>

      {/* 3 Settings Sections */}
      {[2, 2, 1].map((fieldCount, sectionIdx) => (
        <div key={sectionIdx} aria-hidden="true" className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-6 w-44 rounded-md" />
              <Skeleton className="h-4 w-56 rounded-md opacity-70" />
            </div>

            <Card className="gap-0 py-0">
              <CardContent className="p-6 flex flex-col gap-5">
                {Array.from({ length: fieldCount }).map((_, fieldIdx) => (
                  <div key={fieldIdx} className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-28 rounded-md" />
                    <Skeleton className="h-10 sm:h-9 w-full rounded-lg" />
                  </div>
                ))}
              </CardContent>
              <CardFooter className="justify-end border-t border-border bg-muted/20 px-6 py-3.5">
                <Skeleton className="h-11 sm:h-9 w-32 rounded-lg" />
              </CardFooter>
            </Card>
          </div>

          {sectionIdx < 2 && <Separator />}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Replace `buttonVariants` and `space-y-*` in `frontend/app/(parent)/parent-settings/page.tsx`**

Update imports (`L9-10`) to replace `buttonVariants` and remove unused `cn`:

```tsx
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
```

Replace lines 38–61:

```tsx
    <div className="w-full min-w-0 px-4 py-6 sm:px-6 flex flex-col gap-8 pb-20 sm:pb-16">
      {/* Return to Progress Navigation */}
      <div>
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2 h-10 min-h-10 text-muted-foreground hover:text-foreground sm:h-9 sm:min-h-9"
          render={<Link href="/progress" />}
        >
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          <span>Back to progress</span>
        </Button>
      </div>

      {/* Page Header */}
      <div className="border-border flex flex-col gap-1 border-b pb-6">
        <h1 className="font-heading text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
          Account Settings
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage your profile, password, and email notifications.
        </p>
      </div>
```

- [ ] **Step 3: Verify skeletons and `/parent-settings` page**

```powershell
Select-String -Path frontend/components/parent/parent-portal-skeletons.tsx, frontend/app/\(parent\)/parent-settings/page.tsx -Pattern 'space-y-|dark:|buttonVariants|h-px w-full bg-border'
```
Expected: zero output.

```powershell
Set-Location frontend; npx eslint "components/parent/parent-portal-skeletons.tsx" "app/(parent)/parent-settings/page.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/parent/parent-portal-skeletons.tsx" "frontend/app/(parent)/parent-settings/page.tsx"
```
Expected: 0 ESLint errors, 0 TypeScript errors, 0 detector regressions.

- [ ] **Step 4: Commit**

```powershell
git add frontend/components/parent/parent-portal-skeletons.tsx frontend/app/\(parent\)/parent-settings/page.tsx; if ($?) { git commit -m "refactor(ui): standardize parent skeletons and settings back link onto Card, Separator, and Button render" }
```

---

### Task 3: Migrate Shared `NotificationList` & `NotificationRowItem` onto `ItemGroup` + `Item`

**Files:**
- Modify: `frontend/components/notifications/notification-list.tsx:1-24,313-332`
- Modify: `frontend/components/notifications/notification-row.tsx:1-183`

**Interfaces:**
- Preserves all props on `NotificationList` and `NotificationRowItem`, and preserves `[data-notification-id="${completedId}"] a` focus restoration in `NotificationList:96-98`.

- [ ] **Step 1: Update `frontend/components/notifications/notification-list.tsx` to wrap rows in `<ItemGroup>`**

Import `{ ItemGroup } from "@/components/ui/item";` near line 13, then replace `<ul aria-label={...}>` at line 318–330 with `<ItemGroup>`:

```tsx
                <ItemGroup aria-label={`${group.label} notifications`} className="gap-1">
                  {group.items.map((row) => (
                    <NotificationRowItem
                      key={row.id}
                      row={row}
                      labels={labels}
                      role={role}
                      pending={row.id === pendingId}
                      onRead={onRead}
                      onActivate={onActivate}
                    />
                  ))}
                </ItemGroup>
```

- [ ] **Step 2: Refactor `frontend/components/notifications/notification-row.tsx` onto `<Item>`, `<ItemMedia>`, `<ItemContent>`, `<ItemActions>`**

Import `{ Item, ItemActions, ItemContent, ItemMedia } from "@/components/ui/item";` at line 17, then replace lines 96–182:

```tsx
  return (
    <Item
      role="listitem"
      data-notification-id={row.id}
      size="xs"
      variant={unread ? "muted" : "default"}
      className={cn(
        "group relative flex-nowrap items-start gap-3 rounded-lg p-2.5 transition-colors border",
        unread
          ? "bg-primary/5 hover:bg-primary/10 border-primary/15"
          : "border-transparent hover:bg-muted/50"
      )}
    >
      {/* Primary card link covering icon + text */}
      <Link
        href={notificationHref(row, role)}
        onClick={() => onActivate(row)}
        onAuxClick={(event) => {
          if (event.button === 1) onActivate(row);
        }}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Domain-grounded pedagogical icon with semantic urgency & unread indicator dot */}
        <ItemMedia className="relative mt-0.5 shrink-0">
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-lg transition-colors",
              unread
                ? visual.badgeStyle
                : "bg-muted text-muted-foreground"
            )}
            aria-hidden="true"
          >
            <IconComponent className="size-4" />
          </div>
          {unread && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-popover",
                visual.dotStyle
              )}
              aria-hidden="true"
            />
          )}
        </ItemMedia>

        <ItemContent className="min-w-0 flex-1 gap-1 group-data-[size=xs]/item:gap-1">
          <span className="sr-only">
            {unread ? "Unread notification: " : "Read notification: "}
          </span>
          <span
            className={cn(
              "text-sm leading-snug",
              unread ? "font-semibold text-foreground" : "font-normal text-muted-foreground"
            )}
          >
            {notificationCopy(row.type)}
          </span>
          <span className="text-muted-foreground line-clamp-1 text-xs">
            {labels.students[row.student_id] ?? "Student"} ·{" "}
            {labels.activities[row.activity_id] ?? "Handwriting activity"}
          </span>
          <time
            dateTime={row.created_at}
            title={formattedTitle}
            className="text-muted-foreground text-xs font-sans tabular-nums"
          >
            {formattedDistance}
          </time>
        </ItemContent>
      </Link>

      {/* Quick mark-as-read action ONLY when unread with 44px tap target expansion that doesn't bleed into title link */}
      {unread && !(row.type === "comment_posted" && !row.comment_version) && (
        <ItemActions className="shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="relative size-8 md:size-7 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted rounded-md touch-manipulation cursor-pointer after:absolute after:-inset-y-2 after:-end-3 after:start-0 focus-visible:ring-2 focus-visible:ring-ring"
            disabled={pending}
            aria-label={`Mark as read: ${notificationCopy(row.type)} for ${labels.students[row.student_id] ?? "Student"}`}
            onClick={(e) => {
              e.stopPropagation();
              onRead(row.id);
            }}
          >
            <Check aria-hidden="true" />
          </Button>
        </ItemActions>
      )}
    </Item>
  );
```

- [ ] **Step 3: Verify `NotificationList` & `NotificationRowItem` across both Parent and Teacher callers**

```powershell
Set-Location frontend; npx eslint "components/notifications/notification-list.tsx" "components/notifications/notification-row.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/notifications/notification-list.tsx" "frontend/components/notifications/notification-row.tsx"
```
Expected: 0 ESLint errors, 0 TypeScript errors, 0 detector regressions.

- [ ] **Step 4: Commit**

```powershell
git add frontend/components/notifications/notification-list.tsx frontend/components/notifications/notification-row.tsx; if ($?) { git commit -m "refactor(ui): migrate notification list and rows onto shadcn ItemGroup and Item" }
```

---

### Task 4: Fix Base UI `<Select>` `items` and `<SelectValue>` in Shared `SubmissionCommentPicker`

**Files:**
- Modify: `frontend/components/comments/submission-comment-picker.tsx:194-228`

**Interfaces:**
- Preserves all props of `SubmissionCommentPicker` and unsaved-comment confirmation alert flow.

- [ ] **Step 1: Pass `items` to `<Select>` and replace Radix `placeholder` prop on `<SelectValue>` (`L199-214`)**

Compute `uploadSelectItems` right before `return` (around line 193) and update `<Select>` / `<SelectValue>`:

```tsx
  const uploadSelectItems = rows.map((row, index) => ({
    value: row.submission_id,
    label: `Upload ${rows.length - index} · ${UPLOAD_TIME_FORMAT.format(new Date(row.submitted_at))}`,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {rows.length > 1 && (
        <Field className="shrink-0 gap-1.5 px-4 pt-0.5 pb-2 sm:gap-2 sm:pt-1 sm:pb-3">
          <FieldLabel htmlFor={id}>Worksheet upload</FieldLabel>
          <Select
            items={uploadSelectItems}
            value={selected?.submission_id ?? ""}
            onValueChange={(value) => {
              if (value) handleUploadChange(value);
            }}
          >
            <SelectTrigger
              ref={selectTriggerRef}
              id={id}
              className="h-11 md:h-9 min-h-11 md:min-h-9 w-full bg-card border-border font-sans tabular-nums cursor-pointer touch-manipulation"
            >
              <SelectValue>
                {selected ? renderUploadSummary(selected, selectedIndex) : "Choose an upload"}
              </SelectValue>
            </SelectTrigger>
```

- [ ] **Step 2: Verify `submission-comment-picker.tsx`**

```powershell
Select-String -Path frontend/components/comments/submission-comment-picker.tsx -Pattern 'SelectValue placeholder'
```
Expected: zero output.

```powershell
Set-Location frontend; npx eslint "components/comments/submission-comment-picker.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/comments/submission-comment-picker.tsx"
```
Expected: 0 ESLint errors, 0 TypeScript errors, 0 detector regressions.

- [ ] **Step 3: Commit**

```powershell
git add frontend/components/comments/submission-comment-picker.tsx; if ($?) { git commit -m "refactor(ui): pass Base UI items array and explicit fallback to submission comment Select" }
```

---

## Slice 2 — Progress Dashboard & Archive

### Task 5: Clean Up `ProgressContent` Layout Spacing, `<Alert>`, and `<Separator>`

**Files:**
- Modify: `frontend/app/(parent)/progress/progress-content.tsx:1-50,516-838`

**Interfaces:**
- Preserves all 4 tab keys (`overview`, `to-write`, `progress`, `grades`), URL tab query syncing, notification deep-link modals, and `CriterionTrendChart` / `ParentGrades` integration.

- [ ] **Step 1: Add `Separator` import (`L10`)**

Import `{ Separator } from "@/components/ui/separator";` and ensure `AlertTitle`, `AlertDescription` are imported from `@/components/ui/alert` (`AlertDescription` alongside `Alert, AlertTitle`!).

- [ ] **Step 2: Replace manual scrolled dark overrides (`L518`), `space-y-*` classes (`L562, 565, 704, 708, 734, 736, 818`), pending `<Alert>` layout (`L618-640`), and baseline `border-t` divider (`L755`)**

Apply these exact replacements in `frontend/app/(parent)/progress/progress-content.tsx`:

1. Sticky sub-navbar scrolled border/shadow (`L518`):
```tsx
          className="fixed top-[calc(3.5rem-1px)] left-0 right-0 z-30 h-[calc(2.75rem+1px)] pt-px w-full border-b border-border/80 bg-background transition-[border-color,box-shadow] duration-200 ease-out data-[scrolled=true]:border-border data-[scrolled=true]:shadow-warm print:hidden"
```

2. `L562` & `L565` page container & header spacing:
```tsx
        <div className="w-full px-4 sm:px-6 py-6 flex flex-col gap-6 pb-16">
          {/* Page Header Bar (Matches Teacher Portal Dashboard Header) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
```

3. `L618-640` pending submission `<Alert>` (placing `<Clock aria-hidden="true" />` directly inside `<Alert>` without manual `size-4` or wrapper `div`):
```tsx
              {hasPendingSubmission && latestScores && (
                <Alert
                  role="status"
                  className="border-primary/25 bg-secondary/50 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-y-0"
                >
                  <Clock className="text-primary" aria-hidden="true" />
                  <AlertTitle className="text-sm font-medium text-foreground min-w-0">
                    New worksheet received · waiting for teacher review
                  </AlertTitle>
                  <AlertDescription className="col-start-2 pt-2 sm:col-start-3 sm:row-span-2 sm:self-center sm:justify-self-end sm:pt-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTab("progress");
                      }}
                      className="h-11 sm:h-9 text-xs font-medium shrink-0 cursor-pointer bg-card"
                    >
                      View history
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
```

4. `L704, L708, L734, L736, L754-755` (`progress` tab `space-y-*` + `<Separator />`):
```tsx
        {/* Tab 3: Progress (Trend Chart & Past Worksheets Archive) */}
        <TabsContent value="progress" className="flex flex-col gap-6">
          <section
            id="progress-trends-section"
            aria-labelledby="progress-trends-heading"
            className="flex flex-col gap-3 scroll-mt-28"
          >
```
And inside the 1-worksheet baseline card (`L733-755`):
```tsx
              <Card className="p-0 gap-0 shadow-none">
                <CardContent className="p-5 sm:p-6 flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <h3 className="font-heading text-base font-semibold text-foreground">
                        1 of 2 worksheets checked
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed font-sans tabular-nums">
                        &ldquo;{history[0].targetText}&rdquo; ({new Date(history[0].submissionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}) · Trend chart unlocks after the next worksheet.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-start">
                      <BandBadge score={history[0].compositeScore} band={history[0].compositeBand} size="sm" showDot />
                      {history[0].compositeScore != null && (
                        <span className="font-sans text-sm font-semibold tabular-nums text-foreground">
                          {Math.round(history[0].compositeScore)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Flat 5-Criteria Baseline Summary (no nested cards) */}
                  <Separator className="bg-border/70" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-3">
```

5. `L818` (`grades` tab):
```tsx
        <TabsContent value="grades" className="flex flex-col gap-6">
```

- [ ] **Step 3: Verify `progress-content.tsx`**

```powershell
Select-String -Path frontend/app/\(parent\)/progress/progress-content.tsx -Pattern 'space-y-|dark:'
```
Expected: zero output.

```powershell
Set-Location frontend; npx eslint "app/(parent)/progress/progress-content.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/app/(parent)/progress/progress-content.tsx"
```
Expected: 0 ESLint errors, 0 TypeScript errors, 0 detector regressions.

- [ ] **Step 4: Commit**

```powershell
git add frontend/app/\(parent\)/progress/progress-content.tsx; if ($?) { git commit -m "refactor(ui): migrate parent progress page dividers, alert, and spacing to strict shadcn" }
```

---

### Task 6: Replace Raw `<button>` Triggers in `LatestSubmissionCard` with `<Button>`

**Files:**
- Modify: `frontend/components/parent/latest-submission-card.tsx:14-38,236-255,378-415`

**Interfaces:**
- Preserves click/keyboard inspection modal opening (`openWorksheetForCriterion`) across both worksheet photo preview and the 5 Skill Breakdown rows.

- [ ] **Step 1: Ensure `Button` is imported in `frontend/components/parent/latest-submission-card.tsx`**

Verify `import { Button } from "@/components/ui/button";` is present near line 15 (alongside `Badge`, `Card`, `Item`).

- [ ] **Step 2: Replace the photo preview raw `<button>` (`L238-253`) and Skill Breakdown `<Item render={<button ... />} />` (`L378-414`)**

Replace lines 238–253 (photo button):

```tsx
              <Button
                type="button"
                variant="outline"
                onClick={() => openWorksheetForCriterion()}
                aria-haspopup="dialog"
                aria-label={`Inspect worksheet photo for ${displayActivityText}`}
                className="group relative size-full cursor-pointer overflow-hidden rounded-lg border-border/70 bg-background p-0 shadow-warm-sm transition-shadow hover:border-primary/40 hover:bg-background hover:shadow-warm focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Image
                  src={imageUrl}
                  alt={`Handwriting for ${displayActivityText}`}
                  fill
                  sizes="(min-width: 768px) 42vw, 100vw"
                  className="object-contain p-1.5 transition-transform duration-200 ease-out group-hover:scale-[1.015] motion-reduce:transition-none"
                  onError={() => setFailedImageUrl(imageUrl)}
                />
              </Button>
```

Replace lines 378–389 (Skill Breakdown `<Item>` render prop):

```tsx
              <Item
                key={key}
                size="sm"
                className="group h-auto flex-nowrap rounded-none border-0 px-4 sm:px-6 py-3.5 min-h-12 w-full justify-between text-left font-normal whitespace-normal cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring last:rounded-b-xl"
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => openWorksheetForCriterion(key, "details")}
                    aria-haspopup="dialog"
                  />
                }
              >
```

- [ ] **Step 3: Verify `latest-submission-card.tsx`**

```powershell
Select-String -Path frontend/components/parent/latest-submission-card.tsx -Pattern '<button'
```
Expected: zero output.

```powershell
Set-Location frontend; npx eslint "components/parent/latest-submission-card.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/parent/latest-submission-card.tsx"
```
Expected: 0 ESLint errors, 0 TypeScript errors, 0 detector regressions.

- [ ] **Step 4: Commit**

```powershell
git add frontend/components/parent/latest-submission-card.tsx; if ($?) { git commit -m "refactor(ui): replace raw button triggers in LatestSubmissionCard with shadcn Button" }
```

---

### Task 7: Clean Up `PastWorksheetsSection` (`submission-history-dialog.tsx`) and `SampleReportPreview`

**Files:**
- Modify: `frontend/components/parent/submission-history-dialog.tsx:116-130,261-325`
- Modify: `frontend/components/parent/sample-report-preview.tsx:165-175`

**Interfaces:**
- Preserves sort order toggle (`Newest first` / `Oldest first`), inline expand/collapse (`See all` / `Show fewer`), and sample skill tab switching.

- [ ] **Step 1: Remove manual `dark:` overrides, `space-y-3`, and manual icon `size-*` in `frontend/components/parent/submission-history-dialog.tsx`**

Replace lines 120–126 (delta badge styles):

```tsx
                "h-auto max-w-full px-2 py-0.5 rounded-md tabular-nums text-xs font-medium",
                getScoreProgressDirection(item.delta) === "improving"
                  ? "text-band-4-text bg-band-4/15 border-band-4/30"
                  : getScoreProgressDirection(item.delta) === "lower"
                    ? "text-band-2-text bg-band-2/15 border-band-2/30"
                    : "text-muted-foreground bg-muted/40 border-border/60"
```

Replace line 262 (`section` spacing) and lines 284, 314, 319 (`Button` icons):

```tsx
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
```

```tsx
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))}
            className="h-11 sm:h-9 rounded-lg bg-card border-border/80 hover:bg-muted/50 text-xs font-medium text-foreground cursor-pointer touch-manipulation"
          >
            <ArrowUpDown data-icon="inline-start" className="text-primary" aria-hidden="true" />
            <span>{sortOrder === "newest" ? "Newest first" : "Oldest first"}</span>
          </Button>
```

```tsx
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToggleExpand}
            className="h-11 sm:h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer"
          >
            {showAllInline ? (
              <>
                <ChevronUp data-icon="inline-start" aria-hidden="true" />
                <span>Show fewer</span>
              </>
            ) : (
              <>
                <ChevronDown data-icon="inline-start" aria-hidden="true" />
                <span>See all ({processedHistory.length})</span>
              </>
            )}
          </Button>
```

- [ ] **Step 2: Remove redundant `dark:data-active:*` overrides in `frontend/components/parent/sample-report-preview.tsx:168`**

Replace line 168:

```tsx
                      className="flex-none h-auto rounded-lg px-3 py-2 text-xs sm:text-sm font-medium cursor-pointer select-none min-h-11 sm:min-h-9 bg-card text-muted-foreground ring-1 ring-border/80 hover:text-foreground hover:bg-muted/60 data-active:bg-primary data-active:text-primary-foreground data-active:ring-primary data-active:font-semibold"
```

- [ ] **Step 3: Verify `submission-history-dialog.tsx` and `sample-report-preview.tsx`**

```powershell
Select-String -Path frontend/components/parent/submission-history-dialog.tsx, frontend/components/parent/sample-report-preview.tsx -Pattern 'space-y-|dark:'
```
Expected: zero output.

```powershell
Set-Location frontend; npx eslint "components/parent/submission-history-dialog.tsx" "components/parent/sample-report-preview.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/parent/submission-history-dialog.tsx" "frontend/components/parent/sample-report-preview.tsx"
```
Expected: 0 ESLint errors, 0 TypeScript errors, 0 detector regressions.

- [ ] **Step 4: Commit**

```powershell
git add frontend/components/parent/submission-history-dialog.tsx frontend/components/parent/sample-report-preview.tsx; if ($?) { git commit -m "refactor(ui): remove manual dark overrides and fix Button icons in archive and sample preview" }
```

---

## Slice 3 — Rich Overlays & Upload Flow (`ResponsiveRichOverlay`)

### Task 8: Migrate `ParentUploadDialog` & Nested Step 3 Zoom Modal onto `ResponsiveRichOverlay` and Strict `shadcn` Primitives

**Files:**
- Modify: `frontend/components/parent/parent-upload-dialog.tsx:10-40,143-165,547-647,769-878,1044-1132,1185-1314`

**Interfaces:**
- Preserves `ParentUploadDialogProps`, upload-in-flight close guard (`if (!nextOpen && isUploading) return;`), `choosePhotoButtonRef`, `submitButtonRef`, `retryButtonRef`, `doneButtonRef`, `unavailableActionRef`, `aria-live="polite"` step announcement, and hidden `<input type="file">` capture inputs (`L527-545`).

- [ ] **Step 1: Replace `Dialog` imports (`L10-17`) and add `EmptyContent` (`L34-39`)**

Replace lines 10–17 and add `EmptyContent`:

```tsx
import {
  ResponsiveRichOverlay,
  ResponsiveRichOverlayBody,
  ResponsiveRichOverlayContent,
  ResponsiveRichOverlayDescription,
  ResponsiveRichOverlayFooter,
  ResponsiveRichOverlayHeader,
  ResponsiveRichOverlayTitle,
} from "@/components/shared/responsive-rich-overlay";
```

Update `@/components/ui/empty` (`L34-39`) to include `EmptyContent`:

```tsx
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
```

- [ ] **Step 2: Swap outer `Dialog` (`L143-165`), Flow Header (`L547-556`), Body (`L649` & `L1288`), and Stepper (`L574-640`)**

Replace the outer overlay (`L144-164`):

```tsx
    <ResponsiveRichOverlay
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isUploading) return;
        onOpenChange(nextOpen);
      }}
    >
      <ResponsiveRichOverlayContent
        showCloseButton={!isUploading}
        className="w-[calc(100%-1.5rem)] max-w-xl max-h-[min(92dvh,calc(100dvh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm"
      >
        <ParentUploadFlow
          key={open ? "open" : "closed"}
          onClose={() => onOpenChange(false)}
          childId={childId}
          childName={childName}
          prefilledActivityId={prefilledActivityId}
          onUploadingChange={setIsUploading}
        />
      </ResponsiveRichOverlayContent>
    </ResponsiveRichOverlay>
```

Replace the flow header (`L547-555`) and stepper (`L574-641`):

```tsx
      <ResponsiveRichOverlayHeader className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-border/80">
        <div className="min-w-0 pr-10 sm:pr-8">
          <ResponsiveRichOverlayTitle className="text-base sm:text-lg font-semibold text-foreground truncate">
            Send worksheet photo
          </ResponsiveRichOverlayTitle>
          <ResponsiveRichOverlayDescription className="sr-only">
            Submitting for {childName}
          </ResponsiveRichOverlayDescription>
        </div>

        {/* 3-Step Interactive Progress Stepper */}
        <nav aria-label="Upload progress" className="mt-3 sm:mt-3.5 w-full">
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {stepAnnouncement}
          </p>
          {(() => {
            const activeSteps = !allowActivitySwitch
              ? STEPS.filter((s) => s.step !== 1)
              : STEPS;
            return (
              <ol className="flex items-center justify-between gap-1.5 sm:gap-2 w-full">
                {activeSteps.map((s, idx) => {
                  const isCurrent = step === s.step;
                  const isCompleted = step > s.step || step === 5;
                  const canJump = isStepNavigable(s.step as Step) && !isUploading && step !== 5;
                  const stepNumber = !allowActivitySwitch ? idx + 1 : s.step;

                  return (
                    <li
                      key={s.step}
                      className={cn(
                        "flex items-center gap-1.5 sm:gap-2 min-w-0",
                        idx < activeSteps.length - 1 && "flex-1"
                      )}
                      aria-current={isCurrent ? "step" : undefined}
                    >
                      {canJump && !isCurrent ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setStep(s.step as Step)}
                          aria-label={`${s.label} — Step ${stepNumber}${isCompleted ? ", completed" : ""}`}
                          className="group h-auto min-w-0 min-h-11 sm:min-h-9 p-1 -m-1 rounded-lg justify-start text-left cursor-pointer touch-manipulation hover:bg-muted/80"
                        >
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-transform",
                              isCompleted
                                ? "bg-primary text-primary-foreground group-hover:bg-primary/90 group-hover:scale-105"
                                : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                            )}
                          >
                            {isCompleted ? (
                              <CheckIcon aria-hidden="true" />
                            ) : (
                              stepNumber
                            )}
                          </span>
                          <span className="text-xs sm:text-sm truncate font-medium text-foreground group-hover:text-primary transition-colors">
                            {s.label}
                          </span>
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <div
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                              isCompleted
                                ? "bg-primary text-primary-foreground"
                                : isCurrent
                                  ? "bg-primary/15 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                                  : "bg-muted text-muted-foreground"
                            )}
                          >
                            {isCompleted ? (
                              <CheckIcon className="size-3.5" aria-hidden="true" />
                            ) : (
                              stepNumber
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-xs sm:text-sm truncate font-medium",
                              isCurrent
                                ? "text-foreground font-semibold"
                                : isCompleted
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                            )}
                          >
                            {s.label}
                          </span>
                        </div>
                      )}

                      {idx < activeSteps.length - 1 && (
                        <div
                          className={cn(
                            "h-0.5 flex-1 rounded-full transition-colors",
                            step > s.step || step === 5 ? "bg-primary" : "bg-muted"
                          )}
                          aria-hidden="true"
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            );
          })()}
        </nav>
      </ResponsiveRichOverlayHeader>
```

Change the scroll body wrapper (`L649` open tag & matching close `L1288`):

```tsx
      <ResponsiveRichOverlayBody className="px-4 sm:px-6 py-4">
```
*(Remember to close with `</ResponsiveRichOverlayBody>` instead of `</div>` at `L1288`.)*

- [ ] **Step 3: Convert Step 1 cards (`L769-823`), Step 2/3 context Cards & `<Alert>`s (`L833-878, 1086-1131`), and Step 2 Photo Tips grid (`L1044-1078`)**

1. `L770` Step 1 status label: replace `text-brand-700 dark:text-brand-300 font-medium` with `text-primary font-medium`.

2. `L776-821` Step 1 worksheet selector button: replace `<button>` with `<Button>`:

```tsx
                      return (
                        <Button
                          key={act.id}
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setSelectedActivityId(act.id);
                            setStep(2);
                          }}
                          className={cn(
                            "h-auto w-full flex-col items-stretch justify-start text-left whitespace-normal font-normal p-3.5 rounded-xl border transition-colors text-xs sm:text-sm cursor-pointer shadow-xs focus-visible:ring-primary",
                            isSelected
                              ? "border-primary bg-primary/5 hover:bg-primary/5 ring-1 ring-primary"
                              : "border-border/80 bg-card hover:border-primary/60 hover:bg-muted/30"
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground line-clamp-2">
                              {act.title}
                            </span>
                            {isSelected && (
                              <CheckCircle2Icon
                                className="text-primary shrink-0"
                                aria-hidden="true"
                              />
                            )}
                          </span>
                          {act.targetText && (
                            <span className="mt-0.5 text-xs text-muted-foreground italic line-clamp-1">
                              &ldquo;{act.targetText}&rdquo;
                            </span>
                          )}
                          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground font-sans tabular-nums">
                            {statusBadge && (
                              <>
                                <span className={statusBadge.className}>
                                  {statusBadge.label}
                                </span>
                                <span aria-hidden="true" className="text-muted-foreground/40">·</span>
                              </>
                            )}
                            <span>
                              {act.dueAt
                                ? `Due ${formatActivityDueAt(act.dueAt)}`
                                : `Assigned ${formatActivityDate(act.createdAt)}`}
                            </span>
                          </span>
                        </Button>
                      );
```

3. Step 2 & Step 3 Context Header & Reassurance Banner (`L833-878` and `L1086-1131`): replace both identical blocks with `<Card size="sm">` and semantic `<Alert>`:

```tsx
                {/* Context Header: Active Child & Worksheet */}
                <Card size="sm" className="py-0 shadow-none bg-muted/40 border-border/80 text-xs">
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex flex-col gap-0.5">
                      <div className="font-semibold text-foreground break-words">
                        <span>{childName}</span>
                        <span className="text-muted-foreground font-normal"> · </span>
                        <span>{selectedActivity?.title ?? "Practice worksheet"}</span>
                      </div>
                      {selectedActivity?.targetText && (
                        <p className="text-muted-foreground italic font-sans break-words leading-relaxed">
                          &ldquo;{selectedActivity.targetText}&rdquo;
                        </p>
                      )}
                    </div>
                    {activities && activities.length > 1 && (
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        onClick={() => {
                          setAllowActivitySwitch(true);
                          setStep(1);
                        }}
                        className="min-h-10 sm:min-h-9 h-auto px-2 -my-1 text-xs font-medium shrink-0 cursor-pointer"
                      >
                        Change worksheet
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Reassurance banner for re-attempts */}
                {priorSubmission?.status === "completed" && (
                  <Alert
                    role="status"
                    className="py-2.5 px-3 bg-secondary/60 border-primary/20 text-xs text-foreground"
                  >
                    <CheckCircle2Icon className="text-primary" aria-hidden="true" />
                    <AlertDescription className="text-xs text-foreground/90">
                      <strong>New attempt</strong> — earlier photos stay saved in history.
                    </AlertDescription>
                  </Alert>
                )}
```

4. Step 2 Photo quality tips 2×2 tiles (`L1044-1077`): replace the four `<div className="p-2.5 rounded-lg bg-background/60 dark:bg-muted/30 flex flex-col gap-0.5">` wrappers with `<Card size="sm" className="rounded-lg bg-card py-0 shadow-none"><CardContent className="p-2.5 flex flex-col gap-0.5">`:

```tsx
                  <CollapsibleContent className="px-3.5 pb-3.5 pt-1.5 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs animate-in fade-in-50 duration-150 motion-reduce:animate-none">
                    <Card size="sm" className="rounded-lg bg-card py-0 shadow-none">
                      <CardContent className="p-2.5 flex flex-col gap-0.5">
                        <p className="font-semibold text-foreground text-xs sm:text-sm">
                          1. 3-line penmanship paper
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Use standard 3-line paper with top line, midline, and baseline clearly visible.
                        </p>
                      </CardContent>
                    </Card>
                    <Card size="sm" className="rounded-lg bg-card py-0 shadow-none">
                      <CardContent className="p-2.5 flex flex-col gap-0.5">
                        <p className="font-semibold text-foreground text-xs sm:text-sm">
                          2. Connected cursive
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Words must be written in connected cursive strokes, not separated print letters.
                        </p>
                      </CardContent>
                    </Card>
                    <Card size="sm" className="rounded-lg bg-card py-0 shadow-none">
                      <CardContent className="p-2.5 flex flex-col gap-0.5">
                        <p className="font-semibold text-foreground text-xs sm:text-sm">
                          3. Flat paper &amp; even light
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Hold your phone straight above the page. Avoid strong glare, shadows, or camera angles.
                        </p>
                      </CardContent>
                    </Card>
                    <Card size="sm" className="rounded-lg bg-card py-0 shadow-none">
                      <CardContent className="p-2.5 flex flex-col gap-0.5">
                        <p className="font-semibold text-foreground text-xs sm:text-sm">
                          4. Sharp focus
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Tap your phone screen on the ink before snapping so writing lines stay crisp.
                        </p>
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
```

- [ ] **Step 4: Replace Step 3 zoom `<button>`, `<Badge>`, nested zoom `<ResponsiveRichOverlay>`, Step 5 `<Empty>`, and Footer (`L1185-1314`)**

Replace lines 1185–1241 (zoom trigger button + nested zoom modal):

```tsx
                  {previewUrl && (
                    <CardContent>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setZoomOpen(true)}
                        aria-label="Inspect worksheet photo full size before sending"
                        className={cn(
                          "group relative h-auto w-full rounded-xl overflow-hidden bg-muted/40 border border-border p-0 flex items-center justify-center touch-pan-y cursor-zoom-in hover:bg-muted/40 focus-visible:ring-primary",
                          isPortrait
                            ? "aspect-3/4 max-h-[240px] sm:max-h-[400px]"
                            : "aspect-4/3 max-h-[220px] sm:max-h-[340px]"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt={`Handwriting worksheet preview for ${childName}`}
                          draggable={false}
                          onLoad={(e) => {
                            const img = e.currentTarget;
                            setIsPortrait(img.naturalHeight >= img.naturalWidth);
                          }}
                          className="size-full object-contain pointer-events-none select-none"
                        />
                        <Badge
                          variant="secondary"
                          className="absolute bottom-2.5 right-2.5 h-auto rounded-full bg-background/90 backdrop-blur-xs border-border/80 px-2.5 py-1 text-xs font-medium text-foreground shadow-warm-sm"
                        >
                          <ZoomInIcon data-icon="inline-start" className="text-primary" aria-hidden="true" />
                          <span>Tap to zoom</span>
                        </Badge>
                      </Button>
                    </CardContent>
                  )}
                </Card>

                {previewUrl && (
                  <ResponsiveRichOverlay open={zoomOpen} onOpenChange={setZoomOpen}>
                    <ResponsiveRichOverlayContent className="max-w-3xl max-h-[92dvh] p-0 gap-0 overflow-hidden flex flex-col">
                      <ResponsiveRichOverlayHeader className="p-4 border-b border-border/70 pr-12">
                        <ResponsiveRichOverlayTitle className="text-base font-semibold text-foreground">
                          Check photo sharpness
                        </ResponsiveRichOverlayTitle>
                        <ResponsiveRichOverlayDescription className="text-xs text-muted-foreground">
                          Make sure 3-line rulings, cursive strokes, and all 4 corners are crisp before sending.
                        </ResponsiveRichOverlayDescription>
                      </ResponsiveRichOverlayHeader>
                      <ResponsiveRichOverlayBody className="p-4 bg-muted/20 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt={`Full-size handwriting preview for ${childName}`}
                          className="w-full h-auto max-h-[72dvh] object-contain rounded-lg border border-border"
                        />
                      </ResponsiveRichOverlayBody>
                    </ResponsiveRichOverlayContent>
                  </ResponsiveRichOverlay>
                )}
```

Replace Step 5 success state & footer (`L1256-1312`):

```tsx
            {/* Step 5 — Success State */}
            {step === 5 && (
              <Empty className="border-0 p-6 gap-4 animate-in fade-in-50 zoom-in-95 duration-200 motion-reduce:animate-none">
                <EmptyMedia
                  variant="icon"
                  className="size-14 sm:size-16 rounded-2xl bg-success/10 text-success border border-success/20 shadow-warm"
                >
                  <CheckCircle2Icon className="size-8 sm:size-9" aria-hidden="true" />
                </EmptyMedia>

                <EmptyHeader className="max-w-sm gap-1.5">
                  <EmptyTitle className="text-base sm:text-lg font-semibold text-foreground tracking-tight font-heading">
                    Photo received—waiting for teacher review
                  </EmptyTitle>
                  <EmptyDescription className="text-sm text-muted-foreground leading-relaxed">
                    The cursive sample for{" "}
                    <strong className="text-foreground font-medium">{childName}</strong>{" "}
                    has been received. Your teacher reviews every result before you see it, so feedback appears here once it&apos;s released.
                  </EmptyDescription>
                </EmptyHeader>

                <EmptyContent className="pt-2 w-full max-w-xs">
                  <Button
                    ref={doneButtonRef}
                    type="button"
                    variant="default"
                    onClick={onClose}
                    className="h-11 sm:h-9 text-xs sm:text-sm font-medium w-full shadow-warm-sm cursor-pointer touch-manipulation"
                  >
                    Done
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </div>
        )}
      </ResponsiveRichOverlayBody>

      {/* Step 3 (Review & Confirm) Action Footer */}
      {!isUploading && step === 3 && (
        <ResponsiveRichOverlayFooter className="shrink-0 flex-row items-center justify-between sm:justify-between border-t border-border bg-background sm:p-3.5 sm:px-6">
          <Button
            variant="outline"
            onClick={() => setStep(2)}
            className="h-10 sm:h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer"
          >
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Back
          </Button>

          <Button
            ref={submitButtonRef}
            disabled={uploadMutation.isPending || !selectedActivity}
            onClick={handleRetryUpload}
            className="h-10 sm:h-9 px-5 text-xs sm:text-sm font-semibold shadow-warm-sm cursor-pointer"
          >
            <CheckCircle2Icon data-icon="inline-start" aria-hidden="true" />
            Send worksheet photo
          </Button>
        </ResponsiveRichOverlayFooter>
      )}
```

- [ ] **Step 5: Verify `parent-upload-dialog.tsx` static rules (allowing only the 2 exempt `<input type="file">`)**

```powershell
Select-String -Path frontend/components/parent/parent-upload-dialog.tsx -Pattern '<Dialog|</Dialog>|<button|space-y-|dark:|className=\{`'
```
Expected: zero output.

```powershell
Set-Location frontend; npx eslint "components/parent/parent-upload-dialog.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/parent/parent-upload-dialog.tsx"
```
Expected: 0 ESLint errors, 0 TypeScript errors, 0 detector regressions.

- [ ] **Step 6: Commit**

```powershell
git add frontend/components/parent/parent-upload-dialog.tsx; if ($?) { git commit -m "refactor(ui): migrate ParentUploadDialog and zoom preview onto ResponsiveRichOverlay and shadcn" }
```

---

### Task 9: Migrate `WorksheetViewDialog` & `PendingWorksheetDialog` onto `ResponsiveRichOverlay` and `<Alert>`

**Files:**
- Modify: `frontend/components/parent/worksheet-view-dialog.tsx:5-16,219-292,374-496`
- Modify: `frontend/components/parent/pending-worksheet-dialog.tsx:5-189`

**Interfaces:**
- Preserves split image-inspector layout, diagnostic annotations, comment tab deep linking (`initialView`), delete `AlertDialog`, and mobile `Sheet` (`role="dialog"` for keyboard shortcut scoping).

- [ ] **Step 1: Update `frontend/components/parent/worksheet-view-dialog.tsx`**

Replace `Dialog` imports (`L5-12`) with `ResponsiveRichOverlay*` + `Alert` imports:

```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ResponsiveRichOverlay,
  ResponsiveRichOverlayBody,
  ResponsiveRichOverlayContent,
  ResponsiveRichOverlayDescription,
  ResponsiveRichOverlayFooter,
  ResponsiveRichOverlayHeader,
  ResponsiveRichOverlayTitle,
} from "@/components/shared/responsive-rich-overlay";
```

Update `paperLinesToggle` (`L224`), overlay container (`L233-291`), right column `Alert` & spacing (`L374-428`), and footer (`L479-495`):

```tsx
  const paperLinesToggle = Boolean(resolvedGuideLines) && (
    <Toggle
      size="sm"
      pressed={showGuideLines}
      onPressedChange={setShowGuideLines}
      className="h-auto min-h-10 sm:min-h-8 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 aria-pressed:bg-secondary aria-pressed:text-secondary-foreground cursor-pointer touch-manipulation shrink-0 focus-visible:ring-2 focus-visible:ring-primary"
      title="Toggle 3-line penmanship paper guides"
    >
      <span className="hidden sm:inline">Paper lines</span>
      <span className="sm:hidden">Lines</span>
    </Toggle>
  );

  return (
    <ResponsiveRichOverlay open={open} onOpenChange={handleOpenChange}>
      <ResponsiveRichOverlayContent className="w-[calc(100%-1.5rem)] sm:w-[95vw] sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl max-h-[min(94dvh,calc(100dvh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
        {/* Header */}
        <ResponsiveRichOverlayHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-card/80">
          <div className="flex items-start justify-between gap-2 pr-11 sm:pr-10">
            <div className="min-w-0 flex flex-col gap-1">
              <ResponsiveRichOverlayTitle className="font-heading text-base sm:text-lg font-semibold text-foreground truncate">
                {childName ? `${childName}'s Worksheet` : "Worksheet Feedback"}
              </ResponsiveRichOverlayTitle>
              <ResponsiveRichOverlayDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                <time dateTime={submissionDate} className="font-sans tabular-nums">
                  {formattedDate}
                </time>
                {displayTargetText && (
                  <>
                    <span>&middot;</span>
                    <span className="truncate max-w-xs sm:max-w-md" title={displayTargetText}>
                      Prompt: &ldquo;{displayTargetText}&rdquo;
                    </span>
                  </>
                )}
              </ResponsiveRichOverlayDescription>
            </div>

            {showHeaderMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="size-10 sm:size-8 rounded-lg border-border/70 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer touch-manipulation"
                      aria-label="Worksheet options"
                    />
                  }
                >
                  <MoreHorizontal aria-hidden="true" />
                </DropdownMenuTrigger>
```

Change body wrapper (`L291` & close at `L475`) and right-column blocks (`L374-428`):

```tsx
        {/* Content Body: Split view (Worksheet pinned left, Feedback & Notes tabbed right) */}
        <ResponsiveRichOverlayBody className="p-4 sm:p-6">
          {/* ... */}
        </ResponsiveRichOverlayBody>
```

Inside `SubmissionCommentTabs` (`L374-428`):

```tsx
                  <div className="flex flex-col gap-4 w-full">
                    {returnNote && (
                      <Alert role="status" className="border-band-2/40 bg-band-2/15 p-3">
                        <AlertTitle className="text-xs font-semibold text-band-2-text">
                          Teacher note
                        </AlertTitle>
                        <AlertDescription className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {returnNote}
                        </AlertDescription>
                      </Alert>
                    )}

                    {compositeScore != null && (
                      <Card size="sm" className="border-border/80 shadow-none gap-2.5">
                        <CardContent className="flex flex-col gap-2.5">
```
And at line 425 (`Skill breakdown` section wrapper):

```tsx
                    {scores && bands && (
                      <div className="flex flex-col gap-2">
```

Replace footer & close tag (`L478-496`):

```tsx
        {/* Footer — single calm primary CTA when practice is available */}
        {onPracticeNow && activeView !== "comments" && (
          <ResponsiveRichOverlayFooter className="border-t border-border bg-card/80 sm:px-5 sm:py-3">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onPracticeNow();
              }}
              className="h-11 sm:h-9 px-4 text-xs sm:text-sm font-semibold cursor-pointer touch-manipulation shadow-warm-sm"
            >
              <PenLine data-icon="inline-start" aria-hidden="true" />
              <span>Practice together</span>
            </Button>
          </ResponsiveRichOverlayFooter>
        )}
      </ResponsiveRichOverlayContent>
```
*(And close `</ResponsiveRichOverlay>` after `AlertDialog`, replacing `</Dialog>` at `L534`.)*

- [ ] **Step 2: Update `frontend/components/parent/pending-worksheet-dialog.tsx`**

Replace `Dialog` imports (`L5-13`) with `Alert` + `ResponsiveRichOverlay*`:

```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ResponsiveRichOverlay,
  ResponsiveRichOverlayBody,
  ResponsiveRichOverlayContent,
  ResponsiveRichOverlayDescription,
  ResponsiveRichOverlayHeader,
  ResponsiveRichOverlayTitle,
} from "@/components/shared/responsive-rich-overlay";
```

Replace lines 52–190:

```tsx
  return (
    <ResponsiveRichOverlay
      open
      onOpenChange={(open) => {
        if (!open) onBack();
      }}
    >
      <ResponsiveRichOverlayContent className="w-[calc(100%-1.5rem)] sm:w-[95vw] sm:max-w-5xl lg:max-w-6xl xl:max-w-7xl max-h-[min(94dvh,calc(100dvh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
        {/* Header matching WorksheetViewDialog */}
        <ResponsiveRichOverlayHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-card/80">
          <div className="flex items-center justify-between gap-3 pr-10">
            <div className="min-w-0 flex flex-col gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="h-auto min-h-10 sm:min-h-9 w-fit px-2 py-1 mb-0.5 text-xs font-medium text-primary hover:text-primary/80 cursor-pointer group touch-manipulation"
              >
                <ArrowLeft data-icon="inline-start" className="transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
                <span>{backLabel}</span>
              </Button>
              <ResponsiveRichOverlayTitle className="font-heading text-base sm:text-lg font-semibold text-foreground truncate">
                Worksheet &amp; Review Status
              </ResponsiveRichOverlayTitle>
              <ResponsiveRichOverlayDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">{childName}</span>
                <span>&middot;</span>
                <time dateTime={item.submissionDate} className="font-sans tabular-nums">
                  {formattedDate}
                </time>
                {item.targetText && (
                  <>
                    <span>&middot;</span>
                    <span className="italic truncate max-w-xs sm:max-w-md" title={item.targetText}>
                      &ldquo;{item.targetText}&rdquo;
                    </span>
                  </>
                )}
              </ResponsiveRichOverlayDescription>
            </div>
          </div>
        </ResponsiveRichOverlayHeader>

        {/* Content Body: Split view (Worksheet pinned left, Status & Notes tabbed right) */}
        <ResponsiveRichOverlayBody className="p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
            {/* Left Column: Photo Inspector */}
            <div className="lg:col-span-6 lg:sticky lg:top-0 flex flex-col w-full gap-3">
              <WorksheetImageInspector
                imageUrl={image.data}
                altText={`Handwriting worksheet submitted for ${childName}`}
                isLoading={image.isLoading}
                isError={image.isError}
                onRetry={() => image.refetch()}
                headerLabel="Handwritten Worksheet"
                showShortcutsLegend={false}
                collapsibleImageTools={true}
                flatFrame={true}
                keyboardScope="focused"
                aspectRatioClass="max-h-[min(640px,calc(100dvh-14rem))] min-h-[220px]"
              />
            </div>

            {/* Right Column: Tabbed Status & Notes */}
            <div className="lg:col-span-6 flex flex-col w-full min-w-0">
              <SubmissionCommentTabs
                key={item.submissionId}
                submissionId={item.submissionId}
                studentName={childName}
                initialView={initialView}
                detailsLabel="Status"
                commentsLabel="Comments"
                variant="default"
                open
              >
                <div className="flex flex-col gap-4 w-full">
                  <Card className="p-0 gap-0 border-border/80 shadow-none">
                    <CardContent className="p-4 sm:p-5 flex flex-col gap-4">
                      {/* Status Headline & Explanation */}
                      <div className="flex flex-col gap-1.5">
                        <h3 className="font-heading text-base font-semibold text-foreground">
                          {item.status === "returned"
                            ? "New photo requested"
                            : item.status === "rejected"
                              ? "Clearer photo needed"
                              : "Waiting for teacher review"}
                        </h3>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {item.status === "returned"
                            ? "Your teacher asked for another photo. Earlier uploads stay saved in history."
                            : item.status === "rejected"
                              ? "This photo couldn't be read clearly. Retake it flat in even light."
                              : "Worksheet received. Feedback will appear here once your teacher shares it."}
                        </p>
                      </div>

                      {/* Teacher Return Note if present */}
                      {item.returnNote && (
                        <Alert role="status" className="border-band-2/40 bg-band-2/15 p-3">
                          <AlertTitle className="text-xs font-semibold text-band-2-text">
                            Teacher note
                          </AlertTitle>
                          <AlertDescription className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                            {item.returnNote}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Primary Action */}
                      {canSendNewPhoto && (
                        <div className="pt-2 border-t border-border/60">
                          <Button
                            type="button"
                            onClick={() => {
                              onBack();
                              onUploadActivity?.(item.activityId);
                            }}
                            className="w-full h-11 sm:h-9 font-semibold cursor-pointer touch-manipulation"
                          >
                            <Camera data-icon="inline-start" aria-hidden="true" />
                            <span>Send new photo</span>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </SubmissionCommentTabs>
            </div>
          </div>
        </ResponsiveRichOverlayBody>
      </ResponsiveRichOverlayContent>
    </ResponsiveRichOverlay>
  );
```

- [ ] **Step 3: Verify `worksheet-view-dialog.tsx` and `pending-worksheet-dialog.tsx`**

```powershell
Select-String -Path frontend/components/parent/worksheet-view-dialog.tsx, frontend/components/parent/pending-worksheet-dialog.tsx -Pattern '<Dialog|space-y-|dark:'
```
Expected: zero output.

```powershell
Set-Location frontend; npx eslint "components/parent/worksheet-view-dialog.tsx" "components/parent/pending-worksheet-dialog.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/parent/worksheet-view-dialog.tsx" "frontend/components/parent/pending-worksheet-dialog.tsx"
```
Expected: 0 ESLint errors, 0 TypeScript errors, 0 detector regressions.

- [ ] **Step 4: Commit**

```powershell
git add frontend/components/parent/worksheet-view-dialog.tsx frontend/components/parent/pending-worksheet-dialog.tsx; if ($?) { git commit -m "refactor(ui): migrate WorksheetViewDialog and PendingWorksheetDialog onto ResponsiveRichOverlay and Alert" }
```

---

### Task 10: Migrate `PhotoPreviewDialog` & Clean Semantic Tokens in `TakeHomeActivities`

**Files:**
- Modify: `frontend/components/parent/take-home-activities.tsx:54-62,250-285,843-855,1100-1185`

**Interfaces:**
- Preserves `TakeHomeActivities` props, `ActivityCard` upload/comment triggers, and `PhotoPreviewDialog` delete `AlertDialog`.

- [ ] **Step 1: Replace `Dialog` imports with `ResponsiveRichOverlay*` (`L54-62`)**

```tsx
import {
  ResponsiveRichOverlay,
  ResponsiveRichOverlayBody,
  ResponsiveRichOverlayContent,
  ResponsiveRichOverlayDescription,
  ResponsiveRichOverlayFooter,
  ResponsiveRichOverlayHeader,
  ResponsiveRichOverlayTitle,
} from "@/components/shared/responsive-rich-overlay";
```

- [ ] **Step 2: Clean `dark:` color/border overrides in `EmptyMedia` (`L251`), Focus `Alert` (`L281`), and `ActivityCard` (`L848-852`)**

Apply these three semantic replacements:

1. `L251`:
```tsx
          <EmptyMedia variant="icon" className="bg-secondary text-secondary-foreground">
```

2. `L281`:
```tsx
        <Alert
          role="note"
          className="border-primary/20 bg-primary/5 px-4 py-3 text-xs sm:text-sm"
        >
```

3. `L846-853`:
```tsx
      className={cn(
        "group relative justify-between rounded-xl sm:rounded-2xl sm:[--card-spacing:--spacing(5)] hover:shadow-md transition-[border-color,box-shadow] duration-200",
        isRejected || latestRejected
          ? "border-warning/50 bg-warning/5 hover:border-warning/80"
          : isReturned
            ? "border-primary/40 bg-primary/5 hover:border-primary/60"
            : "hover:border-primary/40"
      )}
```

- [ ] **Step 3: Migrate `PhotoPreviewDialog` (`L1101-1183`) onto `ResponsiveRichOverlay`**

```tsx
      <ResponsiveRichOverlay open={open} onOpenChange={onOpenChange}>
        <ResponsiveRichOverlayContent className="w-[calc(100%-1.5rem)] sm:max-w-3xl max-h-[90dvh] p-0 gap-0 overflow-hidden flex flex-col shadow-warm">
          <ResponsiveRichOverlayHeader className="p-4 sm:p-5 border-b border-border/70 pr-12 flex flex-col gap-1">
            <ResponsiveRichOverlayTitle className="font-heading text-base sm:text-lg font-semibold text-foreground break-words">
              {title}
            </ResponsiveRichOverlayTitle>
            {(childName || statusLabel) && (
              <p className="text-xs font-medium text-muted-foreground">
                {[childName, statusLabel].filter(Boolean).join(" · ")}
              </p>
            )}
            <ResponsiveRichOverlayDescription className="text-xs text-muted-foreground italic break-words line-clamp-2">
              &ldquo;{normalizeActivityPrompt(targetText)}&rdquo;
            </ResponsiveRichOverlayDescription>
          </ResponsiveRichOverlayHeader>

          <ResponsiveRichOverlayBody className="p-4 sm:p-5">
            <WorksheetImageInspector
              imageUrl={imageUrl}
              altText={`Uploaded handwriting worksheet for ${title}`}
              isLoading={isLoading}
              isError={isError}
              onRetry={() => {
                void refetch();
              }}
              headerLabel="Uploaded Worksheet Photo"
              imageToolsDisclosure={true}
              flatFrame={true}
              aspectRatioClass="h-[260px] sm:h-[360px] lg:min-h-[420px] lg:max-h-[min(600px,calc(100dvh-18rem))]"
            />
          </ResponsiveRichOverlayBody>

          <ResponsiveRichOverlayFooter
            showCloseButton={false}
            className="flex-wrap border-t border-border sm:p-4 sm:items-center sm:justify-between bg-background"
          >
            <div className="flex items-center gap-2 flex-wrap">
              {activityId && childId && submissionId && (
                <WorkCommentsButton
                  scope={{ activityId, studentId: childId }}
                  activeSubmissionId={submissionId}
                  activityTitle={title}
                  teacherName={teacherName}
                  audience="parent"
                  hasUnread={hasUnreadComments}
                  className="h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium gap-1.5 px-3"
                />
              )}
              {canDelete && submissionId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={deleteMutation.isPending}
                  className="h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive px-3 cursor-pointer"
                >
                  <Trash2 data-icon="inline-start" aria-hidden="true" />
                  <span>Delete upload</span>
                </Button>
              )}
              {canSendNewPhoto && onSendNewPhoto && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onSendNewPhoto}
                  className="h-11 sm:h-9 min-h-11 sm:min-h-9 text-xs sm:text-sm font-medium px-3 cursor-pointer"
                >
                  <Camera data-icon="inline-start" aria-hidden="true" />
                  <span>Send new photo</span>
                </Button>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-11 sm:h-9 min-h-11 sm:min-h-9 px-4 text-xs sm:text-sm font-medium cursor-pointer ml-auto"
            >
              Close
            </Button>
          </ResponsiveRichOverlayFooter>
        </ResponsiveRichOverlayContent>
      </ResponsiveRichOverlay>
```

- [ ] **Step 4: Verify `take-home-activities.tsx`**

```powershell
Select-String -Path frontend/components/parent/take-home-activities.tsx -Pattern '<Dialog|space-y-|dark:'
```
Expected: zero output.

```powershell
Set-Location frontend; npx eslint "components/parent/take-home-activities.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/parent/take-home-activities.tsx"
```
Expected: 0 ESLint errors, 0 TypeScript errors, 0 detector regressions.

- [ ] **Step 5: Commit**

```powershell
git add frontend/components/parent/take-home-activities.tsx; if ($?) { git commit -m "refactor(ui): migrate PhotoPreviewDialog onto ResponsiveRichOverlay and semantic tokens" }
```

---

### Task 11: Refactor Shared `AnnotationTooltip` Floating Card onto `Card`

**Files:**
- Modify: `frontend/components/shared/diagnostic-overlay/annotation-tooltip.tsx:5-10,338-427`

**Interfaces:**
- Preserves `AnnotationTooltipProps`, directional SVG caret stem, `cardWidth` inline sizing, viewport clamping via `cardRef`, and `pointer-events` / `select-*` pin behavior across both Parent and Teacher views.

- [ ] **Step 1: Import `Card` and `CardContent` in `frontend/components/shared/diagnostic-overlay/annotation-tooltip.tsx`**

```tsx
import { Card, CardContent } from "@/components/ui/card";
```

- [ ] **Step 2: Replace the custom floating tooltip `<div>` (`L338-426`) with `<Card>` + `<CardContent>`**

```tsx
      <Card
        ref={cardRef}
        size="sm"
        style={{ maxWidth: `${cardWidth}px`, width: `${cardWidth}px` }}
        className={cn(
          "gap-0 py-0 rounded-xl shadow-warm backdrop-blur-md transition-colors relative bg-popover/95 text-popover-foreground",
          isPinned ? "pointer-events-auto select-text" : "pointer-events-none select-none",
          isAttention
            ? "border-band-1/45 ring-2 ring-band-1/10"
            : "border-primary/45 ring-2 ring-primary/10"
        )}
      >
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-1.5 min-w-0">
            {isAttention ? (
              <AlertCircle
                className="size-3.5 sm:size-4 shrink-0 text-band-1"
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2
                className="size-3.5 sm:size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
            )}
            <span
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-0 truncate"
              title={CRITERION_FULL_LABELS[criterion] ?? criterion}
            >
              {CRITERION_LABELS[criterion] ?? criterion}
            </span>
            <Badge
              variant={isAttention ? "outline" : "secondary"}
              className={cn(
                "ml-auto text-xs px-1.5 py-0 sm:py-0.5 h-auto font-medium border shrink-0 whitespace-nowrap",
                isAttention
                  ? "border-band-1/30 text-band-1-text bg-band-1/15"
                  : "border-primary/25 text-secondary-foreground bg-secondary"
              )}
            >
              {isAttention ? "Needs Attention" : "Consistent"}
            </Badge>
            {isPinned && onDismiss && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                className="relative ml-0.5 shrink-0 pointer-events-auto text-muted-foreground hover:text-foreground after:absolute after:-inset-2.5 md:after:hidden"
                aria-label="Close annotation"
                title="Close annotation details"
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </div>

          <p className="text-xs sm:text-[13px] font-semibold leading-tight sm:leading-snug break-words line-clamp-1 sm:line-clamp-2">
            {title}
          </p>
          <p className="text-xs text-muted-foreground leading-snug sm:leading-relaxed mt-0.5 sm:mt-1 break-words line-clamp-2 sm:line-clamp-none">
            {note}
          </p>

          {criterion === "letter_formation" && isAttention && showMeasurementDetails && (
            <p className="text-xs font-medium text-band-1-text mt-1 sm:mt-1.5 hidden sm:flex items-center gap-1.5">
              <span className="inline-block size-1.5 rounded-full bg-band-1 shrink-0" aria-hidden="true" />
              <span>Highlighted zones show stroke irregularities flagged by the CNN.</span>
            </p>
          )}

          {criterion === "spacing" && showMeasurementDetails && (
            <p className="text-xs font-medium text-muted-foreground mt-1 sm:mt-1.5 hidden sm:flex items-center gap-1.5">
              <span className="inline-block size-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
              <span>Measured relative to midline ruling (x-height). Target range: 1.5× – 2.5× guideline for words, 0.3× – 0.5× for letters.</span>
            </p>
          )}

          {!isPinned && (
            <>
              <Separator className="mt-1 sm:mt-1.5 hidden sm:block" />
              <div className="pt-0.5 sm:pt-1 text-xs text-muted-foreground hidden sm:flex items-center justify-between">
                <span>Click to pin details</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
```

- [ ] **Step 3: Verify `annotation-tooltip.tsx`**

```powershell
Set-Location frontend; npx eslint "components/shared/diagnostic-overlay/annotation-tooltip.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/shared/diagnostic-overlay/annotation-tooltip.tsx"
```
Expected: 0 ESLint errors, 0 TypeScript errors, 0 detector regressions.

- [ ] **Step 4: Commit**

```powershell
git add frontend/components/shared/diagnostic-overlay/annotation-tooltip.tsx; if ($?) { git commit -m "refactor(ui): migrate floating AnnotationTooltip container to shadcn Card" }
```

---

### Task 12: Clean Up `ImageOff` Sizing & Semantic Warning Token in Shared `QualityErrorCard`

**Files:**
- Modify: `frontend/components/submissions/quality-error-card.tsx:789-793,975-977`

**Interfaces:**
- Preserves all `QualityErrorCard` props, `variant="parent" | "teacher"`, inspection `ResponsiveRichOverlay`, and remediation actions across both portals.

- [ ] **Step 1: Remove manual `size-4` on `<ImageOff>` (`L791`) and manual `dark:text-warning` override (`L976`)**

Replace lines 790–793:

```tsx
                {imageError ? (
                  <div className="size-full flex flex-col items-center justify-center bg-muted text-muted-foreground p-1 text-center gap-0.5">
                    <ImageOff aria-hidden="true" />
                    <span className="text-xs leading-tight font-medium">No preview</span>
                  </div>
                ) : (
```

Replace line 976 (`similarity >= 0.4` badge styling):

```tsx
                          : error.details.similarity >= 0.4
                          ? "bg-warning/10 text-warning-foreground border-warning/30"
```

- [ ] **Step 2: Verify `quality-error-card.tsx`**

```powershell
Select-String -Path frontend/components/submissions/quality-error-card.tsx -Pattern 'dark:'
```
Expected: zero output.

```powershell
Set-Location frontend; npx eslint "components/submissions/quality-error-card.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/submissions/quality-error-card.tsx"
```
Expected: 0 ESLint errors, 0 TypeScript errors, 0 detector regressions.

- [ ] **Step 3: Commit**

```powershell
git add frontend/components/submissions/quality-error-card.tsx; if ($?) { git commit -m "refactor(ui): remove manual icon sizing and dark warning override in QualityErrorCard" }
```

---

## Slice 4 — Compact Detail Modal (`ResponsiveModal`) & Final Portal Gate

### Task 13: Migrate `NotificationWorkDestination` onto `ResponsiveModal`, `Alert`, and `Card`

**Files:**
- Modify: `frontend/components/parent/notification-work-destination.tsx:1-192`

**Interfaces:**
- Preserves `NotificationWorkDestination` props, `WorksheetViewDialog` / `PendingWorksheetDialog` delegating branches, `work.retry`, and upload action button.

- [ ] **Step 1: Replace `Dialog` imports with `ResponsiveModal*`, `Alert*`, and `Card*` (`L5-14`)**

```tsx
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NotificationWorkLoadingSkeleton } from "@/components/parent/parent-portal-skeletons";
import {
  ResponsiveModal,
  ResponsiveModalBody,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/shared/responsive-modal";
```

- [ ] **Step 2: Replace `<Dialog>` (`L94-190`), raw error block (`L114-125`), prompt `<div>` (`L132-135`), return note `<p>` (`L153-157`), and raw footer `<div>` (`L165-188`)**

```tsx
  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ResponsiveModalContent className="sm:max-w-lg">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>
            {work.status === "ready" ? work.activity.title : "Activity update"}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            {work.status === "ready"
              ? `Review activity instructions, due date, and submission status for ${childName}.`
              : "View your activity update."}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <ResponsiveModalBody className="flex flex-col gap-3 px-5 py-2 md:p-0">
          {work.status === "loading" ? (
            <NotificationWorkLoadingSkeleton />
          ) : work.status === "error" ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load this work</AlertTitle>
              <AlertDescription>Please try again.</AlertDescription>
              <AlertAction>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={work.retry}
                  className="h-10 sm:h-8 touch-manipulation cursor-pointer"
                >
                  Try again
                </Button>
              </AlertAction>
            </Alert>
          ) : work.status === "unavailable" ? (
            <p className="text-sm text-muted-foreground py-2">
              This work is no longer available.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <Card size="sm" className="bg-muted/30 border-border/80 py-0 shadow-none">
                <CardContent className="flex flex-col gap-1 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Worksheet prompt</p>
                  <p className="text-sm font-medium text-foreground">{work.activity.target_text}</p>
                </CardContent>
              </Card>
              {work.activity.instructions && (
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {work.activity.instructions}
                </p>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium text-foreground">
                  {work.work.work_status === "Draft" ? "Turned in" : work.work.work_status}
                </dd>
                <dt className="text-muted-foreground">Due</dt>
                <dd className="font-sans tabular-nums text-foreground">
                  {work.work.effective_due_at
                    ? formatActivityDueAt(work.work.effective_due_at)
                    : "No deadline"}
                </dd>
              </dl>
              {work.work.return_note && (
                <Alert role="status" className="border-band-2/40 bg-band-2/15 p-3">
                  <AlertTitle className="text-xs font-semibold text-band-2-text">
                    Teacher note
                  </AlertTitle>
                  <AlertDescription className="text-sm text-foreground/90 whitespace-pre-wrap">
                    {work.work.return_note}
                  </AlertDescription>
                </Alert>
              )}
              {!work.assigned && (
                <p className="text-muted-foreground text-xs">
                  This activity is kept in your child&apos;s history.
                </p>
              )}
            </div>
          )}
        </ResponsiveModalBody>

        <ResponsiveModalFooter showCloseButton={false} className="pt-3.5 sm:pt-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-11 md:h-9 min-h-[44px] md:min-h-0 touch-manipulation cursor-pointer"
          >
            Back to progress
          </Button>
          {canUpload && work.status === "ready" && (
            <Button
              type="button"
              onClick={() => {
                onClose();
                onUploadActivity?.(work.activity.id);
              }}
              className="h-11 md:h-9 min-h-[44px] md:min-h-0 font-semibold touch-manipulation cursor-pointer"
            >
              <Camera data-icon="inline-start" aria-hidden="true" />
              <span>
                {work.work.work_status === "Returned" ? "Send new photo" : "Send photo"}
              </span>
            </Button>
          )}
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
```

- [ ] **Step 3: Verify `notification-work-destination.tsx`**

```powershell
Select-String -Path frontend/components/parent/notification-work-destination.tsx -Pattern '<Dialog|space-y-|dark:'
```
Expected: zero output.

```powershell
Set-Location frontend; npx eslint "components/parent/notification-work-destination.tsx"; npx tsc --noEmit
```
```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/components/parent/notification-work-destination.tsx"
```
Expected: 0 ESLint errors, 0 TypeScript errors, 0 detector regressions.

- [ ] **Step 4: Commit**

```powershell
git add frontend/components/parent/notification-work-destination.tsx; if ($?) { git commit -m "refactor(ui): migrate NotificationWorkDestination to ResponsiveModal, Alert, and Card" }
```

---

### Task 14: Full Parent Portal Verification, Compliance Scan & Manual QA Gate

**Files:**
- Verify (read-only audit): All 17 modified files + `frontend/app/(parent)/**`, `frontend/components/parent/**`, `frontend/components/parent-nav.tsx`, `frontend/components/parent-portal-provider.tsx`

- [ ] **Step 1: Run repo-wide frontend lint & strict TypeScript type-check**

```powershell
Set-Location frontend; npx eslint .; npx tsc --noEmit
```
Expected: 0 ESLint errors, 0 TypeScript errors.

- [ ] **Step 2: Run Impeccable Design Detector across all 17 modified files**

```powershell
node .agent/skills/impeccable/scripts/detect.mjs --json `
  "frontend/components/parent-nav.tsx" `
  "frontend/components/parent/parent-portal-skeletons.tsx" `
  "frontend/app/(parent)/parent-settings/page.tsx" `
  "frontend/components/notifications/notification-list.tsx" `
  "frontend/components/notifications/notification-row.tsx" `
  "frontend/components/comments/submission-comment-picker.tsx" `
  "frontend/app/(parent)/progress/progress-content.tsx" `
  "frontend/components/parent/latest-submission-card.tsx" `
  "frontend/components/parent/submission-history-dialog.tsx" `
  "frontend/components/parent/sample-report-preview.tsx" `
  "frontend/components/parent/parent-upload-dialog.tsx" `
  "frontend/components/parent/worksheet-view-dialog.tsx" `
  "frontend/components/parent/pending-worksheet-dialog.tsx" `
  "frontend/components/parent/take-home-activities.tsx" `
  "frontend/components/shared/diagnostic-overlay/annotation-tooltip.tsx" `
  "frontend/components/submissions/quality-error-card.tsx" `
  "frontend/components/parent/notification-work-destination.tsx"
```
Expected: 0 new regressions across all 17 files.

- [ ] **Step 3: Run strict Base UI `shadcn` regex compliance scan across the Parent Portal + 5 modified shared files**

```powershell
$parentFiles = Get-ChildItem -Path "frontend/app/(parent)", "frontend/components/parent" -Recurse -File -Include *.ts,*.tsx | ForEach-Object { $_.FullName }
$allTargets = $parentFiles + @(
  (Resolve-Path "frontend/components/parent-nav.tsx").Path,
  (Resolve-Path "frontend/components/parent-portal-provider.tsx").Path,
  (Resolve-Path "frontend/components/notifications/notification-list.tsx").Path,
  (Resolve-Path "frontend/components/notifications/notification-row.tsx").Path,
  (Resolve-Path "frontend/components/comments/submission-comment-picker.tsx").Path,
  (Resolve-Path "frontend/components/shared/diagnostic-overlay/annotation-tooltip.tsx").Path,
  (Resolve-Path "frontend/components/submissions/quality-error-card.tsx").Path
)

Select-String -Path $allTargets -Pattern '<button|<select|<textarea|<label|<fieldset|<legend|<hr\b|Loader2|space-y-|space-x-|data-\[state=|asChild|\bbuttonVariants\b|SelectValue placeholder|className=\{`'
```
Expected: **zero matches**.

Confirm zero remaining manual `dark:` overrides across the 17 modified files and confirm every `<SelectContent>` wraps `<SelectGroup>`:

```powershell
Select-String -Path $allTargets -Pattern 'dark:'
Select-String -Path $allTargets -Pattern '<SelectContent' -Context 0,3
```
Expected: zero `dark:` matches; every `<SelectContent>` is immediately followed by `<SelectGroup>`.

Confirm `<input` matches ONLY the 2 exempt `<input type="file">` capture inputs:

```powershell
Select-String -Path $allTargets -Pattern '<input\b'
```
Expected: ONLY `frontend/components/parent/parent-upload-dialog.tsx:527` and `:537`.

Confirm zero remaining desktop-only `<Dialog` overlays in Parent Portal dialogs:

```powershell
Select-String -Path `
  "frontend/components/parent/parent-upload-dialog.tsx", `
  "frontend/components/parent/worksheet-view-dialog.tsx", `
  "frontend/components/parent/pending-worksheet-dialog.tsx", `
  "frontend/components/parent/take-home-activities.tsx", `
  "frontend/components/parent/notification-work-destination.tsx" `
  -Pattern '<Dialog\b|</Dialog>'
```
Expected: zero output.

- [ ] **Step 4: Execute Desktop (`≥1280px`) & Mobile (`375px`) Light/Dark Manual QA Matrix (Spec §5)**

Start local Next.js dev server (`cd frontend && npm run dev`) and verify against `DESIGN.md` & Spec §5 in both light and dark modes:
- **Navigation & Shell (`ParentNav`, `NotificationBell`):**
  - [ ] Desktop: Multi-child `<Select>` opens/selects via keyboard and pointer; account `<DropdownMenu>` displays `<Avatar>` in trigger and header; sign-out `<AlertDialogAction>` renders `<Spinner>` while signing out; `NotificationBell` opens `Popover` with `Item` rows and restores focus on mark-read.
  - [ ] Mobile (`375px`): Child switcher opens bottom `Drawer` with `Avatar` rows; `NotificationBell` opens bottom `Drawer` with swipe handle and zero horizontal overflow.
- **Progress Page (`/progress` — 4 tabs):**
  - [ ] `Recent`: `LatestSubmissionCard` photo preview `<Button>` and 5 Skill Breakdown `<Item render={<Button />} />` rows open `WorksheetViewDialog` (`ResponsiveRichOverlay`) to matching criterion; `SampleReportPreview` toggles and switches skill tabs cleanly.
  - [ ] `Practice`: `TakeHomeActivities` cards open `ParentUploadDialog` and `PhotoPreviewDialog` (`ResponsiveRichOverlay`).
  - [ ] `Progress`: 1-worksheet baseline `<Separator />` summary, `CriterionTrendChart`, and `PastWorksheetsSection` sort/expand controls render cleanly without horizontal overflow.
  - [ ] `Grades`: `ParentGrades` rows, points, comments trigger, and deep-link highlight scroll work cleanly across viewports.
- **Overlays & Upload Flow (Desktop `Dialog` & Mobile `Sheet` / `Drawer`):**
  - [ ] `ParentUploadDialog`: Steps 1–5, Step 3 zoom overlay, and `QualityErrorCard` inspection modal work across desktop and mobile (`375px` camera/library inputs, focus transitions, upload-in-flight close guard).
  - [ ] `WorksheetViewDialog` & `PendingWorksheetDialog`: Split photo inspector (`AnnotationTooltip` `<Card>`, `WorksheetImageInspector` zoom/contrast/loupe, `SubmissionCommentTabs`) + `<Alert>` Teacher note work cleanly in mobile full-height `Sheet` and desktop `Dialog` (keyboard shortcuts preserved).
  - [ ] `PhotoPreviewDialog` & `NotificationWorkDestination`: Mobile `Sheet`/`Drawer` and desktop `Dialog` open, display `<Card>`/`<Alert>`, delete/replace/upload actions work, and safe-area footers remain visible.
- **Settings (`/parent-settings`) & Teacher Spot-Check:**
  - [ ] `/parent-settings`: `<Button nativeButton={false} render={<Link />} />` back link, `ParentSettingsSkeleton` `<Card>` + `<Separator />`, settings cards, and `ForgotPasswordDialog` (`ResponsiveModal`) work across viewports.
  - [ ] Teacher spot-check: Verify `NotificationList`/`NotificationRowItem`, `AnnotationTooltip`, `SubmissionCommentPicker`, and `QualityErrorCard` remain intact inside `(teacher)` routes (`/dashboard`, `/activities/[id]`, `/gradebook`).

---

## Self-Review Coverage Summary

- **Spec §1 & §3 In-Scope Coverage (17/17 files):**
  - Slice 1: `parent-nav.tsx` (Task 1), `parent-portal-skeletons.tsx` + `parent-settings/page.tsx` (Task 2), `notification-list.tsx` + `notification-row.tsx` (Task 3), `submission-comment-picker.tsx` (Task 4) — 6 files.
  - Slice 2: `progress-content.tsx` (Task 5), `latest-submission-card.tsx` (Task 6), `submission-history-dialog.tsx` + `sample-report-preview.tsx` (Task 7) — 4 files.
  - Slice 3: `parent-upload-dialog.tsx` (Task 8), `worksheet-view-dialog.tsx` + `pending-worksheet-dialog.tsx` (Task 9), `take-home-activities.tsx` (Task 10), `annotation-tooltip.tsx` (Task 11), `quality-error-card.tsx` (Task 12) — 6 files.
  - Slice 4: `notification-work-destination.tsx` (Task 13) — 1 file.
  - Total = `6 + 4 + 6 + 1 = 17` unique files, plus Task 14 end-to-end static + manual QA gate.
- **Zero placeholders, zero unverified imports, all Base UI `base-luma` rules enforced.**
