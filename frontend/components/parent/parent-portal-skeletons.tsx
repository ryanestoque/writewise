import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Item, ItemActions, ItemContent } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SKILL_LABEL_WIDTHS = ["w-32", "w-36", "w-20", "w-16", "w-36"] as const;
const PRACTICE_TITLE_WIDTHS = ["w-2/3", "w-3/4", "w-1/2"] as const;
const HISTORY_PROMPT_WIDTHS = [
  "w-48 sm:w-72",
  "w-40 sm:w-64",
  "w-52 sm:w-80",
] as const;
const GRADE_TITLE_WIDTHS = [
  "w-44 sm:w-64",
  "w-36 sm:w-52",
  "w-48 sm:w-72",
] as const;

/**
 * Mirrors LatestSubmissionCard (Recent tab):
 * 1. 12-column hero card with 4:3 worksheet photo frame + overall band summary + actions
 * 2. 5-row Handwriting skills card with matching row rhythm
 */
export function LatestSubmissionSkeleton({
  childFirstName,
  decorative = false,
}: {
  childFirstName?: string;
  decorative?: boolean;
}) {
  const statusLabel = childFirstName
    ? `Loading ${childFirstName}'s latest worksheet feedback`
    : "Loading latest worksheet feedback";

  return (
    <div
      role={decorative ? undefined : "status"}
      aria-live={decorative ? undefined : "polite"}
      aria-label={decorative ? undefined : statusLabel}
      aria-hidden={decorative ? true : undefined}
      className="flex flex-col gap-6"
    >
      {!decorative && <span className="sr-only">{statusLabel}</span>}

      {/* Hero Latest Worksheet Card */}
      <Card
        aria-hidden="true"
        className="p-0 gap-0 md:grid md:grid-cols-12"
      >
        {/* Left: Worksheet photo pane */}
        <div className="md:col-span-5 flex items-center justify-center bg-secondary/45 p-4 sm:p-6">
          <AspectRatio
            ratio={4 / 3}
            className="w-full max-w-md overflow-hidden rounded-lg border border-border/70 bg-background p-3 shadow-warm-sm flex flex-col justify-center gap-3"
          >
            <Skeleton className="h-3.5 w-2/3 rounded-md" />
            <Skeleton className="h-3.5 w-5/6 rounded-md" />
            <Skeleton className="h-3.5 w-3/4 rounded-md" />
            <Skeleton className="h-3.5 w-1/2 rounded-md" />
          </AspectRatio>
        </div>

        {/* Right: Title, score summary, bar, and actions */}
        <CardContent className="md:col-span-7 flex min-w-0 flex-col justify-center gap-4 p-5 sm:p-6">
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 flex flex-col gap-2">
                <Skeleton className="h-6 sm:h-7 w-3/4 max-w-sm rounded-md" />
                <Skeleton className="h-4 w-44 sm:w-56 rounded-md" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-5 w-10 rounded-md" />
              </div>
            </div>

            {/* BandPositionBar placeholder */}
            <Skeleton className="h-2 w-full rounded-full" />
          </div>

          {/* Primary + secondary actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
            <Skeleton className="h-11 sm:h-9 w-full sm:w-44 rounded-lg" />
            <Skeleton className="h-11 sm:h-9 w-full sm:w-40 rounded-lg" />
          </div>
        </CardContent>
      </Card>

      {/* Skill breakdown 5-criterion card */}
      <Card
        aria-hidden="true"
        className="p-0 gap-0"
      >
        <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 sm:px-6 py-4">
          <Skeleton className="h-6 w-40 rounded-md" />
          <Skeleton className="h-4 w-28 rounded-md" />
        </CardHeader>

        <CardContent className="p-0 border-t border-border divide-y divide-border">
          {SKILL_LABEL_WIDTHS.map((labelWidth, index) => (
            <Item
              key={index}
              size="sm"
              className="flex-nowrap rounded-none border-0 px-4 sm:px-6 py-3.5 min-h-12 justify-between last:rounded-b-xl"
            >
              <ItemContent className="flex-row items-center gap-2.5 min-w-0">
                <Skeleton className={cn("h-4 rounded-md", labelWidth)} />
                {index === 0 && (
                  <Skeleton className="hidden sm:block h-3.5 w-20 rounded-md" />
                )}
              </ItemContent>
              <ItemActions className="gap-2.5 shrink-0">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-9 rounded-md" />
                <Skeleton className="size-4 rounded-sm opacity-60" />
              </ItemActions>
            </Item>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Mirrors TakeHomeActivities (Practice tab):
 * Auto-fill grid of practice worksheet cards featuring the subtle 3-line cursive guidelines desk
 * and full-width photo action footer.
 */
export function TakeHomeActivitiesSkeleton({
  gridClassName = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4",
  count = 3,
}: {
  gridClassName?: string;
  count?: number;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading practice worksheets"
      className="flex flex-col gap-4"
    >
      <span className="sr-only">Loading practice worksheets</span>

      <div aria-hidden="true" className={gridClassName}>
        {Array.from({ length: count }).map((_, index) => (
          <Card
            key={index}
            size="sm"
            className="justify-between rounded-xl sm:rounded-2xl sm:[--card-spacing:--spacing(5)]"
          >
            <CardHeader className="gap-1.5">
              {/* Title + due/word-count metadata */}
              <Skeleton
                className={cn(
                  "h-5 rounded-md",
                  PRACTICE_TITLE_WIDTHS[index % PRACTICE_TITLE_WIDTHS.length]
                )}
              />
              <Skeleton className="h-3.5 w-36 rounded-md" />
            </CardHeader>

            <CardContent className="flex-1">
              {/* Cursive Guidelines Specimen Desk placeholder */}
              <div className="relative overflow-hidden rounded-xl border border-border/70 bg-surface dark:bg-card">
                <div className="relative p-3.5 pb-5 sm:p-4 sm:pb-6">
                  <div
                    className="cursive-guidelines pointer-events-none absolute inset-0 z-0 opacity-45"
                    aria-hidden="true"
                  />
                  <div className="relative z-10 flex flex-col gap-5 py-2">
                    <Skeleton className="h-5 w-4/5 rounded-md opacity-80" />
                    <Skeleton className="h-5 w-3/5 rounded-md opacity-70" />
                  </div>
                </div>
                <div className="border-t border-border/50 bg-muted/30 px-3 py-2">
                  <Skeleton className="h-3.5 w-3/4 rounded-md" />
                </div>
              </div>
            </CardContent>

            {/* Action footer */}
            <CardFooter className="border-t border-border/60 pt-3">
              <Skeleton className="h-11 sm:h-9 w-full rounded-lg" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Mirrors CriterionTrendChart (variant="parent") inside Progress tab:
 * Controls bar + 3-column trajectory summary strip + hairline plot grid.
 */
export function ProgressTrendSkeleton({ bare = false }: { bare?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading progress chart"
      className={cn(
        "space-y-4 min-w-0",
        !bare && "rounded-xl border border-border bg-card p-4 sm:p-6"
      )}
    >
      <span className="sr-only">Loading progress chart</span>

      {/* Controls Bar */}
      <div
        aria-hidden="true"
        className="flex items-center justify-between gap-3 border-b border-border/50 pb-3"
      >
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>
        <Skeleton className="h-9 sm:h-8 w-36 rounded-lg" />
      </div>

      {/* Trajectory Summary Strip */}
      <div
        aria-hidden="true"
        className="flex flex-col sm:grid sm:grid-cols-3 gap-2 sm:gap-2.5 p-3 rounded-xl bg-muted/20 border border-border/60"
      >
        {/* Trend summary item (order-first on mobile) */}
        <div className="order-first sm:order-none flex items-center justify-between sm:flex-col sm:items-start sm:space-y-2 pb-2 sm:pb-0 border-b sm:border-b-0 border-border/50">
          <Skeleton className="h-3.5 w-24 sm:w-28 rounded-md" />
          <Skeleton className="h-5 sm:h-6 w-32 sm:w-36 rounded-full" />
        </div>
        {/* First item */}
        <div className="flex items-center justify-between sm:flex-col sm:items-start sm:space-y-2">
          <Skeleton className="h-3.5 w-20 rounded-md" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-5 w-10 sm:w-12 rounded-md" />
            <Skeleton className="h-5 w-16 sm:w-20 rounded-full" />
          </div>
        </div>
        {/* Latest item */}
        <div className="flex items-center justify-between sm:flex-col sm:items-start sm:space-y-2">
          <Skeleton className="h-3.5 w-20 sm:w-24 rounded-md" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-5 w-10 sm:w-12 rounded-md" />
            <Skeleton className="h-5 w-16 sm:w-20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Chart Plot Scaffolding (hairline grid + axis ticks) */}
      <div
        aria-hidden="true"
        className="h-64 sm:h-72 w-full min-h-[256px] flex flex-col justify-between pt-2"
      >
        <div className="flex-1 flex flex-col justify-between pb-3">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton className="h-3 w-8 sm:w-10 rounded-sm shrink-0 opacity-75" />
              <div className="h-px flex-1 border-t border-dashed border-border/70" />
            </div>
          ))}
        </div>

        {/* X-axis tick row */}
        <div className="flex items-center justify-between pl-11 sm:pl-13 pr-2">
          <Skeleton className="h-3 w-12 rounded-sm opacity-75" />
          <Skeleton className="h-3 w-12 rounded-sm opacity-75" />
          <Skeleton className="h-3 w-12 rounded-sm opacity-75" />
          <Skeleton className="hidden sm:block h-3 w-12 rounded-sm opacity-75" />
        </div>
      </div>
    </div>
  );
}

/**
 * Mirrors PastWorksheetsSection (Progress tab archive list):
 * Header with count + sort control, flat divided card with prompt/date + score/view rows.
 */
export function PastWorksheetsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Loading past worksheets"
      className="space-y-3"
    >
      <span className="sr-only">Loading past worksheets</span>

      <div aria-hidden="true" className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-36 rounded-md" />
          <Skeleton className="h-4 w-7 rounded-md" />
        </div>
        <Skeleton className="h-11 sm:h-9 w-28 rounded-lg" />
      </div>

      <div
        aria-hidden="true"
        className="rounded-xl border border-border bg-card divide-y divide-border/70 overflow-hidden"
      >
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="px-4 py-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton
                  className={cn(
                    "h-4 sm:h-5 rounded-md",
                    HISTORY_PROMPT_WIDTHS[index % HISTORY_PROMPT_WIDTHS.length]
                  )}
                />
                {index === 0 && (
                  <Skeleton className="h-5 w-24 rounded-md" />
                )}
              </div>
              <Skeleton className="h-3.5 w-28 rounded-md" />
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-9 rounded-md" />
              </div>
              <Skeleton className="h-11 sm:h-9 w-16 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Mirrors ParentGrades (Grades tab):
 * Coursework heading + flat bordered teacher card with header totals + coursework rows.
 */
export function ParentGradesSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section
      id="coursework-section"
      aria-labelledby="coursework-heading-loading"
      className="space-y-3"
    >
      <h2
        id="coursework-heading-loading"
        className="font-heading text-base sm:text-lg font-semibold text-foreground"
      >
        Coursework
      </h2>
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading grades"
        className="bg-card overflow-hidden rounded-xl border border-border"
      >
        <span className="sr-only">Loading grades</span>

        {/* Teacher header + overall points */}
        <div
          aria-hidden="true"
          className="flex items-center justify-between gap-4 border-b border-border/80 px-4 py-4 sm:px-5"
        >
          <Skeleton className="h-5 w-36 rounded-md" />
          <div className="flex flex-col items-end gap-1.5">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-3 w-12 rounded-md" />
          </div>
        </div>

        {/* Coursework activity rows */}
        <div aria-hidden="true" className="divide-y divide-border/70">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3.5 sm:px-5"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton
                  className={cn(
                    "h-4 rounded-md",
                    GRADE_TITLE_WIDTHS[index % GRADE_TITLE_WIDTHS.length]
                  )}
                />
                <Skeleton className="h-3.5 w-32 rounded-md" />
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2.5 sm:pt-0 border-t border-border/40 sm:border-0">
                <div className="flex flex-col sm:items-end gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="h-4 w-8 rounded-md" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="hidden sm:block h-4 w-24 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Full-page Parent Portal Progress shell skeleton:
 * Sticky 4-tab bar + full-width header + Recent section skeleton.
 * Used for childrenLoading, /progress route loading, and layout Suspense fallback.
 */
export function ParentPortalPageSkeleton({
  includeTopNavPlaceholder = false,
}: {
  includeTopNavPlaceholder?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading parent portal"
      className={cn(
        "w-full min-w-0 flex flex-col",
        includeTopNavPlaceholder && "pt-14 print:pt-0"
      )}
    >
      <span className="sr-only">Loading parent portal</span>

      {/* Optional top navbar skeleton when rendered outside ParentPortalProvider (e.g. layout Suspense) */}
      {includeTopNavPlaceholder && (
        <div
          aria-hidden="true"
          className="fixed top-0 left-0 right-0 z-40 h-14 w-full bg-background flex items-center justify-between px-4 sm:px-6 print:hidden"
        >
          <Skeleton className="h-8 w-8 sm:w-32 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
          </div>
        </div>
      )}

      {/* Fixed Sub-Navbar matching ProgressPageContent TabsList */}
      <div
        aria-hidden="true"
        className="fixed top-[calc(3.5rem-1px)] left-0 right-0 z-30 h-[calc(2.75rem+1px)] pt-px w-full border-b border-border/80 bg-background print:hidden"
      >
        <div className="h-full w-full px-4 sm:px-6 flex items-center">
          <div className="w-full grid grid-cols-4 sm:w-fit sm:flex gap-2">
            {["w-14", "w-16", "w-16", "w-14"].map((width, idx) => (
              <div key={idx} className="flex items-center justify-center sm:px-3 py-1">
                <Skeleton className={cn("h-4 rounded-md", width)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Layout spacer matching fixed sub-navbar height */}
      <div aria-hidden="true" className="h-11 shrink-0 print:hidden" />

      {/* Main Content Canvas (full width, matching DESIGN.md Full-Width Canvas Rule) */}
      <div aria-hidden="true" className="w-full px-4 sm:px-6 py-6 space-y-6 pb-16">
        {/* Page Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <Skeleton className="h-8 sm:h-9 w-56 sm:w-72 rounded-md" />
            <Skeleton className="h-4 w-28 rounded-md" />
          </div>
          <Skeleton className="h-11 sm:h-9 w-28 rounded-lg shrink-0" />
        </div>

        {/* Default Overview / Recent Section */}
        <LatestSubmissionSkeleton decorative />
      </div>
    </div>
  );
}

/**
 * Mirrors NotificationWorkDestination dialog body while loading a deep-linked activity.
 */
export function NotificationWorkLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading activity details"
      className="flex flex-col gap-3 py-1"
    >
      <span className="sr-only">Loading activity details</span>

      <div
        aria-hidden="true"
        className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2"
      >
        <Skeleton className="h-3.5 w-28 rounded-md" />
        <Skeleton className="h-4 w-5/6 rounded-md" />
      </div>

      <div
        aria-hidden="true"
        className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 pt-1"
      >
        <Skeleton className="h-4 w-12 rounded-md" />
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-4 w-10 rounded-md" />
        <Skeleton className="h-4 w-36 rounded-md" />
      </div>
    </div>
  );
}

/**
 * Mirrors ParentSettingsPage (/parent-settings):
 * Back link + page header + 3 two-column settings sections.
 */
export function ParentSettingsSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading account settings"
      className="w-full min-w-0 px-4 py-6 sm:px-6 space-y-8 pb-20 sm:pb-16"
    >
      <span className="sr-only">Loading account settings</span>

      {/* Back link */}
      <div aria-hidden="true">
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      {/* Page Header */}
      <div aria-hidden="true" className="border-border space-y-2 border-b pb-6">
        <Skeleton className="h-8 sm:h-9 w-52 rounded-md" />
        <Skeleton className="h-4 w-72 max-w-full rounded-md" />
      </div>

      {/* 3 Settings Sections */}
      {[2, 2, 1].map((fieldCount, sectionIdx) => (
        <div key={sectionIdx} aria-hidden="true" className="space-y-8">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-44 rounded-md" />
              <Skeleton className="h-4 w-56 rounded-md opacity-70" />
            </div>

            <div className="rounded-xl border border-border bg-card shadow-warm overflow-hidden">
              <div className="p-6 space-y-5">
                {Array.from({ length: fieldCount }).map((_, fieldIdx) => (
                  <div key={fieldIdx} className="space-y-1.5">
                    <Skeleton className="h-4 w-28 rounded-md" />
                    <Skeleton className="h-10 sm:h-9 w-full rounded-lg" />
                  </div>
                ))}
              </div>
              <div className="flex justify-end border-t border-border bg-muted/20 px-6 py-3.5">
                <Skeleton className="h-11 sm:h-9 w-32 rounded-lg" />
              </div>
            </div>
          </div>

          {sectionIdx < 2 && <div className="h-px w-full bg-border" />}
        </div>
      ))}
    </div>
  );
}
