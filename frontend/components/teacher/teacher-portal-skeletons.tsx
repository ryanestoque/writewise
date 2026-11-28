import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Card, CardAction, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemGroup } from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const ACTIVITY_TITLE_WIDTHS = ["w-3/4", "w-2/3", "w-4/5", "w-1/2", "w-3/4", "w-2/3"] as const;
const STUDENT_NAME_WIDTHS = [
  "w-32 sm:w-40",
  "w-28 sm:w-36",
  "w-36 sm:w-44",
  "w-24 sm:w-32",
  "w-32 sm:w-40",
  "w-28 sm:w-36",
] as const;
const CRITERION_ROW_WIDTHS = ["w-28", "w-32", "w-16", "w-14", "w-32"] as const;

/**
 * Mirrors SummaryCards (Dashboard):
 * Lead Class Average card (4 cols) + 5 Penmanship Criteria cards (8 cols).
 */
export function SummaryCardsSkeleton({
  className,
  decorative = false,
}: {
  className?: string;
  decorative?: boolean;
}) {
  return (
    <div
      role={decorative ? undefined : "status"}
      aria-live={decorative ? undefined : "polite"}
      aria-label={decorative ? undefined : "Loading class averages"}
      aria-hidden={decorative ? true : undefined}
      className={cn("grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4", className)}
    >
      {!decorative && <span className="sr-only">Loading class averages</span>}

      <Card
        aria-hidden="true"
        size="sm"
        className="xl:col-span-4 border-primary/25 bg-linear-to-b from-secondary/35 via-card to-card shadow-warm ring-1 ring-primary/15 justify-between gap-3"
      >
        <CardHeader>
          <Skeleton className="h-4 w-24 rounded-md" />
          <CardAction>
            <Skeleton className="h-5 w-20 rounded-full" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 sm:h-9 w-24 rounded-md" />
        </CardContent>
        <CardFooter className="border-t border-border/60">
          <Skeleton className="h-4 w-48 max-w-full rounded-md" />
        </CardFooter>
      </Card>

      <div
        aria-hidden="true"
        className="xl:col-span-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} size="sm" className="bg-card shadow-warm justify-between gap-2">
            <CardHeader className="gap-1">
              <Skeleton className="h-4 w-20 rounded-md" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 sm:h-8 w-16 rounded-md" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-5 w-24 rounded-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Mirrors ClassTable (Dashboard):
 * Mobile (< sm) ItemGroup list + Desktop (sm+) 9-column Table with CardFooter legend.
 */
export function ClassTableSkeleton({
  rows = 5,
  className,
  decorative = false,
}: {
  rows?: number;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <div
      role={decorative ? undefined : "status"}
      aria-live={decorative ? undefined : "polite"}
      aria-label={decorative ? undefined : "Loading student scores"}
      aria-hidden={decorative ? true : undefined}
      className={cn("flex flex-col gap-3.5", className)}
    >
      {!decorative && <span className="sr-only">Loading student scores</span>}

      {/* Mobile Student Cards (< sm) */}
      <ItemGroup aria-hidden="true" className="gap-2.5 sm:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
          <Item key={i} variant="outline" size="sm" className="bg-card justify-between">
            <ItemContent className="min-w-0 gap-1.5">
              <div className="flex items-center gap-2">
                <Skeleton
                  className={cn(
                    "h-4 rounded-md",
                    STUDENT_NAME_WIDTHS[i % STUDENT_NAME_WIDTHS.length]
                  )}
                />
                <Skeleton className="h-3.5 w-14 rounded-md" />
              </div>
              <Skeleton className="h-3.5 w-36 rounded-md" />
            </ItemContent>
            <ItemActions className="shrink-0 gap-2">
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-4 w-12 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="size-4 rounded-sm opacity-60" />
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>

      {/* Desktop Table (sm+) */}
      <Card aria-hidden="true" className="hidden sm:block p-0 gap-0 shadow-none">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent border-b border-border/80">
                <TableHead className="py-3 px-4">
                  <Skeleton className="h-3.5 w-24 rounded-md" />
                </TableHead>
                <TableHead className="py-3 px-4">
                  <Skeleton className="h-3.5 w-14 rounded-md" />
                </TableHead>
                {Array.from({ length: 6 }).map((_, colIdx) => (
                  <TableHead key={colIdx} className="py-3 px-4 text-right">
                    <Skeleton className="ml-auto h-3.5 w-14 rounded-md" />
                  </TableHead>
                ))}
                <TableHead className="w-10 py-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rows }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/50 hover:bg-transparent">
                  <TableCell className="py-3.5 px-4">
                    <Skeleton
                      className={cn(
                        "h-4 rounded-md",
                        STUDENT_NAME_WIDTHS[i % STUDENT_NAME_WIDTHS.length]
                      )}
                    />
                  </TableCell>
                  <TableCell className="py-3.5 px-4">
                    <Skeleton className="h-4 w-16 rounded-md" />
                  </TableCell>
                  {Array.from({ length: 6 }).map((_, colIdx) => (
                    <TableCell key={colIdx} className="py-3.5 px-4 text-right">
                      <Skeleton className="ml-auto h-4 w-12 rounded-md" />
                    </TableCell>
                  ))}
                  <TableCell className="py-3.5 pr-4 pl-0 text-right">
                    <Skeleton className="ml-auto size-4 rounded-sm opacity-60" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <Separator />
        <CardFooter className="px-4 py-2.5 bg-muted/20 flex-wrap justify-between gap-x-4 gap-y-2">
          <Skeleton className="h-3.5 w-36 rounded-md" />
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-3.5 w-24 rounded-md" />
            <Skeleton className="h-3.5 w-20 rounded-md" />
            <Skeleton className="h-3.5 w-24 rounded-md" />
            <Skeleton className="h-3.5 w-20 rounded-md" />
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * Full-page Dashboard shell skeleton for app/(teacher)/dashboard/loading.tsx.
 */
export function DashboardPageSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading teacher dashboard"
      className="flex flex-col gap-6 sm:gap-8 w-full min-w-0 pb-20 sm:pb-16"
    >
      <span className="sr-only">Loading teacher dashboard</span>

      {/* Page Header */}
      <div
        aria-hidden="true"
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <Skeleton className="h-8 sm:h-9 w-36 rounded-md" />
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          <Skeleton className="sm:hidden h-11 w-full rounded-lg" />
          <Skeleton className="h-11 sm:h-9 flex-1 sm:flex-none sm:w-28 rounded-lg" />
          <Skeleton className="h-11 sm:h-9 flex-1 sm:flex-none sm:w-24 rounded-lg" />
        </div>
      </div>

      {/* Section 1: Class Averages */}
      <section aria-hidden="true" className="flex flex-col gap-3">
        <Skeleton className="h-4 w-28 rounded-md" />
        <SummaryCardsSkeleton decorative />
      </section>

      {/* Section 2: Students */}
      <section aria-hidden="true" className="flex flex-col gap-3 pt-2">
        <Skeleton className="h-4 w-20 rounded-md" />
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Skeleton className="h-10 sm:h-9 w-full sm:w-72 rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-hidden">
            <Skeleton className="h-8 w-20 rounded-full shrink-0" />
            <Skeleton className="h-8 w-32 rounded-full shrink-0" />
            <Skeleton className="h-8 w-24 rounded-full shrink-0" />
            <Skeleton className="h-8 w-24 rounded-full shrink-0" />
          </div>
        </div>
        <ClassTableSkeleton decorative />
      </section>
    </div>
  );
}

/**
 * Mirrors StudentDrillDownDrawer Overview tab (Dashboard):
 * Overall Performance hero card (with Top Strength & Priority Focus) + 5-row Diagnostic Breakdown.
 */
export function StudentDrillDownSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading student diagnostic profile"
      className="flex flex-col gap-6"
    >
      <span className="sr-only">Loading student diagnostic profile</span>

      {/* Overall Performance Hero Card */}
      <Card aria-hidden="true" size="sm" className="shadow-warm-sm">
        <CardHeader>
          <Skeleton className="h-4 w-32 rounded-md" />
          <CardAction>
            <Skeleton className="h-6 w-24 rounded-full" />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-8 sm:h-9 w-24 rounded-md" />
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[0, 1].map((idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-muted/20 border border-border/60 flex flex-col gap-2"
              >
                <Skeleton className="h-3.5 w-24 rounded-md" />
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-4 w-12 rounded-md" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 5-Criteria Diagnostic Breakdown */}
      <section aria-hidden="true" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-36 rounded-md" />
          <Skeleton className="h-3.5 w-32 rounded-md" />
        </div>

        <Card className="p-0 gap-0 shadow-warm-sm">
          <CardContent className="p-0 divide-y divide-border">
            {CRITERION_ROW_WIDTHS.map((labelWidth, index) => (
              <Item
                key={index}
                size="sm"
                className="flex-nowrap rounded-none border-0 px-3.5 sm:px-4 py-3 justify-between"
              >
                <ItemContent className="min-w-0">
                  <Skeleton className={cn("h-4 rounded-md", labelWidth)} />
                </ItemContent>
                <ItemActions className="shrink-0 gap-2">
                  <Skeleton className="h-4 w-10 rounded-md" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="size-4 rounded-sm opacity-60" />
                </ItemActions>
              </Item>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

/**
 * Mirrors ActivityCard grid (/activities):
 * Card header (checkbox + mode/words + menu), cursive guideline prompt preview, separator,
 * progress gauge, status line, and 2-button action row.
 */
export function ActivityCardsGridSkeleton({
  count = 6,
  decorative = false,
}: {
  count?: number;
  decorative?: boolean;
}) {
  return (
    <div
      role={decorative ? undefined : "status"}
      aria-live={decorative ? undefined : "polite"}
      aria-label={decorative ? undefined : "Loading activities"}
      aria-hidden={decorative ? true : undefined}
      className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4"
    >
      {!decorative && <span className="sr-only">Loading activities</span>}

      {Array.from({ length: count }).map((_, index) => (
        <Card
          key={index}
          aria-hidden="true"
          className="justify-between gap-3 p-4 sm:p-5 sm:rounded-2xl"
        >
          <CardHeader className="p-0 flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-[4px]" />
              <Skeleton className="h-3.5 w-28 rounded-md" />
            </div>
            <Skeleton className="size-8 rounded-lg" />
          </CardHeader>

          <CardContent className="p-0 flex-1 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Skeleton
                className={cn(
                  "h-5 rounded-md",
                  ACTIVITY_TITLE_WIDTHS[index % ACTIVITY_TITLE_WIDTHS.length]
                )}
              />
              <Skeleton className="h-3.5 w-28 rounded-md" />
            </div>

            {/* WorksheetPrompt cursive guidelines preview */}
            <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card p-3.5 sm:p-4">
              <div
                className="cursive-guidelines pointer-events-none absolute inset-0 z-0 opacity-45"
                aria-hidden="true"
              />
              <div className="relative z-10 flex flex-col gap-4 py-1.5">
                <Skeleton className="h-5 w-4/5 rounded-md opacity-80" />
                <Skeleton className="h-5 w-3/5 rounded-md opacity-70" />
              </div>
            </div>
          </CardContent>

          <Separator />

          <CardFooter className="p-0 flex-col items-stretch gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <Skeleton className="h-3.5 w-12 rounded-md" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex items-center gap-1.5 pt-0.5">
              <Skeleton className="size-1.5 rounded-full" />
              <Skeleton className="h-3.5 w-36 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Skeleton className="h-10 sm:h-9 w-full rounded-lg" />
              <Skeleton className="h-10 sm:h-9 w-full rounded-lg" />
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

/**
 * Full-page Activities shell skeleton for app/(teacher)/activities/loading.tsx.
 */
export function ActivitiesPageSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading activities"
      className="flex w-full min-w-0 flex-col gap-5 sm:gap-6 pb-28 sm:pb-24"
    >
      <span className="sr-only">Loading activities</span>

      {/* Header */}
      <div
        aria-hidden="true"
        className="flex flex-col sm:flex-row justify-between sm:items-center gap-4"
      >
        <Skeleton className="h-8 sm:h-9 w-36 rounded-md" />
        <Skeleton className="h-11 sm:h-9 w-full sm:w-40 rounded-lg sm:rounded-xl" />
      </div>

      {/* Search & Filter Toolbar */}
      <Card aria-hidden="true" size="sm" className="py-3">
        <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-3">
          <Skeleton className="h-10 sm:h-9 w-full md:w-56 lg:w-64 rounded-lg" />
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <Skeleton className="h-8 w-16 rounded-full shrink-0" />
              <Skeleton className="h-8 w-20 rounded-full shrink-0" />
              <Skeleton className="h-8 w-24 rounded-full shrink-0" />
              <Skeleton className="h-8 w-20 rounded-full shrink-0" />
            </div>
            <Skeleton className="h-11 sm:h-8 w-full sm:w-32 rounded-lg shrink-0" />
          </div>
        </CardContent>
      </Card>

      <ActivityCardsGridSkeleton decorative />
    </div>
  );
}

/**
 * Mirrors SubmissionCard & UnsubmittedCard inside ActivityDetailPage (/activities/[id]):
 * Supports both default compact list rows and photo grid cards (?layout=photos).
 */
export function ActivitySubmissionsSkeleton({
  compact = true,
  count = 6,
  decorative = false,
}: {
  compact?: boolean;
  count?: number;
  decorative?: boolean;
}) {
  if (!compact) {
    return (
      <div
        role={decorative ? undefined : "status"}
        aria-live={decorative ? undefined : "polite"}
        aria-label={decorative ? undefined : "Loading student submissions"}
        aria-hidden={decorative ? true : undefined}
        className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4"
      >
        {!decorative && <span className="sr-only">Loading student submissions</span>}

        {Array.from({ length: count }).map((_, i) => (
          <Card
            key={i}
            aria-hidden="true"
            size="sm"
            className="flex h-full min-w-0 flex-col gap-0 py-0 overflow-hidden"
          >
            <AspectRatio ratio={4 / 3} className="w-full border-b border-border/60 bg-muted/30">
              <Skeleton className="size-full rounded-none" />
            </AspectRatio>
            <CardHeader className="px-4 pt-4 pb-0 gap-1.5">
              <Skeleton
                className={cn(
                  "h-5 rounded-md",
                  STUDENT_NAME_WIDTHS[i % STUDENT_NAME_WIDTHS.length]
                )}
              />
              <Skeleton className="h-3.5 w-28 rounded-md" />
            </CardHeader>
            <CardContent className="flex-1 px-4 pt-2.5 pb-4 flex items-center gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-4 w-10 rounded-md" />
            </CardContent>
            <Separator />
            <CardFooter className="justify-between gap-2 px-4 py-3">
              <Skeleton className="size-10 md:size-8 rounded-lg" />
              <Skeleton className="h-10 md:h-9 w-28 rounded-lg" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div
      role={decorative ? undefined : "status"}
      aria-live={decorative ? undefined : "polite"}
      aria-label={decorative ? undefined : "Loading student submissions"}
      aria-hidden={decorative ? true : undefined}
      className="grid gap-3"
    >
      {!decorative && <span className="sr-only">Loading student submissions</span>}

      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} aria-hidden="true" size="sm" className="p-3.5 sm:p-4">
          <CardContent className="p-0 flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_auto] lg:items-center lg:gap-6">
            <div className="flex items-start justify-between gap-2 lg:block">
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <Skeleton
                    className={cn(
                      "h-5 rounded-md",
                      STUDENT_NAME_WIDTHS[i % STUDENT_NAME_WIDTHS.length]
                    )}
                  />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-28 rounded-md" />
              </div>
              <div className="flex items-center gap-1 shrink-0 lg:hidden">
                <Skeleton className="h-10 w-24 rounded-lg" />
                <Skeleton className="size-10 rounded-lg" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-4 w-12 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>

            <div className="hidden lg:flex items-center justify-end gap-2">
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Full-page Activity Detail skeleton (/activities/[id]):
 * Back link + ActivityDetailHero card + Student work toolbar & submissions list.
 */
export function ActivityDetailPageSkeleton({ compact = true }: { compact?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading activity details"
      className="flex w-full min-w-0 flex-col gap-3 pb-28 sm:gap-5 sm:pb-24"
    >
      <span className="sr-only">Loading activity details</span>

      {/* Back Navigation Trail */}
      <div aria-hidden="true" className="py-1">
        <Skeleton className="h-5 w-36 rounded-md" />
      </div>

      {/* Hero Card matching ActivityDetailHero */}
      <Card aria-hidden="true" className="gap-0 px-4 py-3 sm:p-5">
        <CardHeader className="p-0 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3 sm:block">
              <Skeleton className="h-6 sm:h-7 w-52 sm:w-72 rounded-md" />
              <div className="flex items-center gap-1.5 sm:hidden">
                <Skeleton className="h-10 w-20 rounded-lg" />
                <Skeleton className="size-10 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-3.5 w-48 sm:w-64 rounded-md" />
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <Skeleton className="h-9 w-40 rounded-lg" />
            <Skeleton className="size-9 rounded-lg" />
          </div>
        </CardHeader>

        <CardContent className="p-0 mt-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-3/5 rounded-md" />
            <Skeleton className="h-7 w-24 rounded-md shrink-0" />
          </div>
          <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card p-3.5 sm:p-4">
            <div
              className="cursive-guidelines pointer-events-none absolute inset-0 z-0 opacity-45"
              aria-hidden="true"
            />
            <div className="relative z-10 flex flex-col gap-4 py-1.5">
              <Skeleton className="h-6 w-2/3 rounded-md opacity-80" />
              <Skeleton className="h-6 w-1/2 rounded-md opacity-70" />
            </div>
          </div>
        </CardContent>

        <Separator className="my-3.5" />

        <CardFooter className="p-0 flex-col items-stretch gap-3.5 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="h-4 w-8 rounded-md" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <Separator className="sm:hidden" />
          <div className="flex-1 flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-24 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </CardFooter>
      </Card>

      {/* Student work section */}
      <section aria-hidden="true" className="flex flex-col gap-3 sm:gap-4 pt-4 sm:pt-6">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-6 sm:h-7 w-32 rounded-md" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-11 md:h-9 w-44 rounded-lg" />
          </div>
        </div>

        {/* Review Toolbar Card */}
        <Card size="sm" className="py-3">
          <CardContent className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-3">
            <Skeleton className="h-10 sm:h-9 w-full lg:w-64 rounded-lg" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-lg" />
            </div>
          </CardContent>
        </Card>

        <ActivitySubmissionsSkeleton compact={compact} decorative />
      </section>
    </div>
  );
}

/**
 * Mirrors SubmissionDetailPage & SubmissionDetailContent (/activities/[id]/submissions/[submissionId]):
 * Back link, identity header + separator, 12-col split with 3:4 worksheet studio left & tabbed assessment right.
 */
export function SubmissionDetailPageSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading handwriting submission details"
      data-page-studio="true"
      className="flex w-full flex-col gap-4"
    >
      <span className="sr-only">Loading handwriting submission details</span>

      {/* Top Back Navigation Trail */}
      <div aria-hidden="true" className="py-2 -ml-1 sm:-ml-2">
        <Skeleton className="h-4 w-32 rounded-md" />
      </div>

      {/* Header */}
      <div aria-hidden="true" className="flex flex-col gap-2 pb-2.5 sm:pb-3">
        <div className="flex items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-6 sm:h-7 w-40 sm:w-52 rounded-md" />
            <Skeleton className="h-3.5 w-44 sm:w-60 rounded-md" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-9 w-24 rounded-lg hidden sm:block" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
        <Separator className="mt-1" />
      </div>

      {/* 12-column Studio Split */}
      <div
        aria-hidden="true"
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:items-start py-2.5 sm:py-3.5"
      >
        {/* Left: Worksheet Inspector */}
        <div className="lg:col-span-6 flex flex-col gap-2.5">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="aspect-3/4 w-full rounded-2xl min-h-[300px] sm:min-h-[340px] lg:min-h-[460px]" />
          <Card size="sm" className="py-2 shadow-2xs">
            <CardContent className="px-3 flex items-center gap-2">
              <Skeleton className="h-4 w-24 rounded-md shrink-0" />
              <Skeleton className="h-4 w-56 rounded-md" />
            </CardContent>
          </Card>
        </div>

        {/* Right: Tabs + Score Summary + 5-Criterion Breakdown */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-xl bg-muted/60 border border-border/80">
            <Skeleton className="h-9 w-full rounded-lg bg-card" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>

          <Card size="sm" className="border-border/80 shadow-none gap-2.5">
            <CardHeader className="flex flex-row items-center justify-between">
              <Skeleton className="h-5 w-36 rounded-md" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-2 w-full rounded-full" />
            </CardContent>
          </Card>

          <Card className="p-0 gap-0 shadow-none">
            <CardHeader className="px-4 py-3.5 border-b border-border/80 flex flex-row items-center justify-between">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/70">
              {CRITERION_ROW_WIDTHS.map((width, idx) => (
                <Item
                  key={idx}
                  size="sm"
                  className="rounded-none border-0 px-4 py-3 justify-between"
                >
                  <ItemContent>
                    <Skeleton className={cn("h-4 rounded-md", width)} />
                  </ItemContent>
                  <ItemActions className="gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-10 rounded-md" />
                  </ItemActions>
                </Item>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Mirrors RosterPage list & table (/roster):
 * Filter bar + Desktop 5-column Table (md+) and Mobile Select/Sort bar + Student cards (< md).
 */
export function RosterListSkeleton({
  rows = 6,
  decorative = false,
}: {
  rows?: number;
  decorative?: boolean;
}) {
  return (
    <div
      role={decorative ? undefined : "status"}
      aria-live={decorative ? undefined : "polite"}
      aria-label={decorative ? undefined : "Loading class roster"}
      aria-hidden={decorative ? true : undefined}
      className="flex flex-col gap-4"
    >
      {!decorative && <span className="sr-only">Loading class roster</span>}

      {/* Search & Section Filters Bar */}
      <Card aria-hidden="true" size="sm" className="py-3 shadow-warm">
        <CardContent className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-3">
          <Skeleton className="h-10 sm:h-9 w-full lg:w-72 rounded-lg shrink-0" />
          <div className="flex items-center gap-2 overflow-hidden lg:justify-end">
            <Skeleton className="h-8 w-16 rounded-full shrink-0" />
            <Skeleton className="h-8 w-24 rounded-full shrink-0" />
            <Skeleton className="h-8 w-24 rounded-full shrink-0" />
          </div>
        </CardContent>
      </Card>

      {/* Desktop Table View (md and up) */}
      <Card aria-hidden="true" className="hidden md:block py-0 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="w-10 px-3">
                  <Skeleton className="size-4 rounded-[4px]" />
                </TableHead>
                <TableHead className="px-3">
                  <Skeleton className="h-3.5 w-28 rounded-md" />
                </TableHead>
                <TableHead className="px-3">
                  <Skeleton className="h-3.5 w-24 rounded-md" />
                </TableHead>
                <TableHead className="px-3">
                  <Skeleton className="h-3.5 w-24 rounded-md" />
                </TableHead>
                <TableHead className="text-right px-3">
                  <Skeleton className="ml-auto h-3.5 w-14 rounded-md" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rows }).map((_, i) => (
                <TableRow key={i} className="border-b border-border/60 hover:bg-transparent">
                  <TableCell className="w-10 px-3 py-3">
                    <Skeleton className="size-4 rounded-[4px]" />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex flex-col gap-1.5">
                      <Skeleton
                        className={cn(
                          "h-4 rounded-md",
                          STUDENT_NAME_WIDTHS[i % STUDENT_NAME_WIDTHS.length]
                        )}
                      />
                      <div className="flex items-center gap-1.5">
                        <Skeleton className="h-3.5 w-40 rounded-md" />
                        <Skeleton className="h-4 w-14 rounded-full" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="py-3">
                    <Skeleton className="h-4 w-24 rounded-md" />
                  </TableCell>
                  <TableCell className="text-right py-3">
                    <Skeleton className="ml-auto size-8 rounded-lg" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile Card List View (< md) */}
      <div aria-hidden="true" className="flex flex-col gap-2.5 md:hidden">
        <Card size="sm" className="py-2 rounded-xl">
          <CardContent className="flex items-center justify-between gap-2 px-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-[4px]" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-11 w-32 rounded-lg" />
              <Skeleton className="size-11 rounded-lg" />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
            <Card key={i} size="sm" className="gap-2 py-3">
              <CardHeader className="items-center flex flex-row justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Skeleton className="size-4 rounded-[4px]" />
                  <Skeleton
                    className={cn(
                      "h-4 rounded-md",
                      STUDENT_NAME_WIDTHS[i % STUDENT_NAME_WIDTHS.length]
                    )}
                  />
                </div>
                <Skeleton className="size-8 rounded-lg" />
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-44 rounded-md" />
              </CardContent>
              <CardFooter className="mt-1 justify-between border-t border-border/60 pt-3">
                <Skeleton className="h-3 w-12 rounded-md" />
                <Skeleton className="h-3 w-20 rounded-md" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Full-page Class Roster skeleton for app/(teacher)/roster/loading.tsx.
 */
export function RosterPageSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading class roster"
      className="w-full min-w-0 flex flex-col gap-5 sm:gap-6 pb-20 sm:pb-16"
    >
      <span className="sr-only">Loading class roster</span>

      {/* Header */}
      <div
        aria-hidden="true"
        className="flex flex-col sm:flex-row justify-between sm:items-center gap-4"
      >
        <Skeleton className="h-8 sm:h-9 w-40 rounded-md" />
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          <Skeleton className="h-11 sm:h-9 flex-1 sm:flex-none sm:w-28 rounded-lg sm:rounded-xl" />
          <Skeleton className="h-11 sm:h-9 flex-1 sm:flex-none sm:w-36 rounded-lg sm:rounded-xl" />
          <Skeleton className="h-11 sm:h-9 flex-1 sm:flex-none sm:w-28 rounded-lg sm:rounded-xl" />
          <Skeleton className="h-11 sm:h-9 w-full sm:w-32 rounded-lg sm:rounded-xl" />
        </div>
      </div>

      <RosterListSkeleton decorative />
    </div>
  );
}

/**
 * Mirrors ManageSectionsDialog section list rows (/roster).
 */
export function SectionsListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading sections"
      className="divide-y divide-border/50 border border-border/60 rounded-lg overflow-hidden"
    >
      <span className="sr-only">Loading sections</span>
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          aria-hidden="true"
          className="flex items-center justify-between px-3 py-2.5 bg-card min-h-[44px]"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Mirrors TeacherGradebook workspace (/gradebook):
 * Toolbar card + Section readiness summary card + Mobile gradebook cards (< md) + Desktop matrix table (md+).
 */
export function GradebookWorkspaceSkeleton({
  rows = 5,
  decorative = false,
}: {
  rows?: number;
  decorative?: boolean;
}) {
  return (
    <div
      role={decorative ? undefined : "status"}
      aria-live={decorative ? undefined : "polite"}
      aria-label={decorative ? undefined : "Loading class gradebook"}
      aria-hidden={decorative ? true : undefined}
      className="flex w-full min-w-0 flex-col gap-4"
    >
      {!decorative && <span className="sr-only">Loading class gradebook</span>}

      {/* Filter & Search Toolbar */}
      <Card aria-hidden="true" size="sm">
        <CardContent className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 lg:gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-10 sm:h-9 flex-1 lg:w-60 rounded-lg" />
            <Skeleton className="h-11 sm:h-9 w-32 rounded-lg shrink-0" />
          </div>
          <div className="flex items-center justify-between lg:justify-end gap-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <Skeleton className="h-8 w-20 rounded-full shrink-0" />
              <Skeleton className="h-8 w-20 rounded-full shrink-0" />
            </div>
            <Skeleton className="h-11 sm:h-8 w-36 rounded-lg shrink-0" />
          </div>
        </CardContent>
      </Card>

      {/* Section Readiness Summary Bar */}
      <Card aria-hidden="true" size="sm" className="bg-card/70">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
          </div>
          <Skeleton className="h-6 w-40 rounded-full" />
        </CardContent>
      </Card>

      {/* Mobile Gradebook Cards (< md) */}
      <div aria-hidden="true" className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 3 }).map((_, idx) => (
          <Card key={idx} size="sm" className="gap-2.5 py-3">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-4 rounded-[4px]" />
                <Skeleton
                  className={cn(
                    "h-4 rounded-md",
                    STUDENT_NAME_WIDTHS[idx % STUDENT_NAME_WIDTHS.length]
                  )}
                />
              </div>
              <Skeleton className="h-4 w-16 rounded-md" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {[0, 1].map((itemIdx) => (
                <Item key={itemIdx} variant="outline" size="sm" className="justify-between">
                  <ItemContent className="gap-1">
                    <Skeleton className="h-4 w-36 rounded-md" />
                    <Skeleton className="h-3 w-20 rounded-md" />
                  </ItemContent>
                  <ItemActions>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </ItemActions>
                </Item>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop Matrix Table (md+) */}
      <div
        aria-hidden="true"
        className="hidden md:block bg-card overflow-hidden rounded-xl sm:rounded-2xl border border-border"
      >
        <Table>
          <TableHeader className="bg-card">
            <TableRow className="border-b hover:bg-transparent">
              <TableHead className="min-w-48 border-r p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-4 rounded-[4px]" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
              </TableHead>
              {Array.from({ length: 3 }).map((_, colIdx) => (
                <TableHead key={colIdx} className="min-w-44 sm:min-w-52 border-r p-3 align-top">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-3 w-20 rounded-md" />
                  </div>
                </TableHead>
              ))}
              <TableHead className="min-w-28 p-3 text-right">
                <Skeleton className="ml-auto h-4 w-16 rounded-md" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, rIdx) => (
              <TableRow key={rIdx} className="border-b border-border/60 hover:bg-transparent">
                <TableCell className="border-r p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-4 rounded-[4px]" />
                    <Skeleton
                      className={cn(
                        "h-4 rounded-md",
                        STUDENT_NAME_WIDTHS[rIdx % STUDENT_NAME_WIDTHS.length]
                      )}
                    />
                  </div>
                </TableCell>
                {Array.from({ length: 3 }).map((_, cIdx) => (
                  <TableCell key={cIdx} className="border-r p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-5 w-16 rounded-md" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                  </TableCell>
                ))}
                <TableCell className="p-3 text-right">
                  <Skeleton className="ml-auto h-4 w-14 rounded-md" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * Full-page Gradebook skeleton for app/(teacher)/gradebook/loading.tsx.
 */
export function GradebookPageSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading gradebook"
      className="flex w-full min-w-0 flex-col gap-5 sm:gap-6"
    >
      <span className="sr-only">Loading gradebook</span>

      <div aria-hidden="true" className="flex items-center justify-between gap-3 sm:gap-4">
        <Skeleton className="h-8 sm:h-9 w-36 rounded-md" />
        <Skeleton className="h-11 sm:h-9 w-28 rounded-lg sm:rounded-xl shrink-0" />
      </div>

      <GradebookWorkspaceSkeleton decorative />
    </div>
  );
}

/**
 * Full-page Teacher Account Settings skeleton for app/(teacher)/settings/loading.tsx.
 * Mirrors ProfileSettingsCard, SecuritySettingsCard, and NotificationSettingsCard.
 */
export function TeacherSettingsSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading account settings"
      className="w-full min-w-0 flex flex-col gap-10 pb-20 sm:pb-16"
    >
      <span className="sr-only">Loading account settings</span>

      {/* Page Header */}
      <div aria-hidden="true" className="border-border border-b pb-6">
        <Skeleton className="h-8 sm:h-9 w-52 rounded-md" />
      </div>

      {/* 3 Two-Column Settings Sections */}
      {[3, 2, 1].map((fieldCount, sectionIdx) => (
        <div key={sectionIdx} aria-hidden="true" className="flex flex-col gap-10">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-6 w-44 rounded-md" />
              <Skeleton className="h-4 w-56 max-w-full rounded-md opacity-70" />
            </div>

            <Card className="gap-0 pb-0">
              <CardContent className="p-6 flex flex-col gap-5">
                {sectionIdx === 2 ? (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <Skeleton className="h-4 w-24 rounded-md" />
                      <Skeleton className="h-3.5 w-64 max-w-full rounded-md" />
                    </div>
                    <Skeleton className="h-5 w-9 rounded-full shrink-0" />
                  </div>
                ) : (
                  Array.from({ length: fieldCount }).map((_, fieldIdx) => (
                    <div key={fieldIdx} className="flex flex-col gap-1.5">
                      <Skeleton className="h-4 w-28 rounded-md" />
                      <Skeleton className="h-10 sm:h-9 w-full rounded-lg" />
                    </div>
                  ))
                )}
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

/**
 * Mirrors ActivityThreads row list (/activities/[id] Conversation history collapsible).
 */
export function ActivityThreadsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading conversations"
      className="divide-y"
    >
      <span className="sr-only">Loading conversations</span>
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          aria-hidden="true"
          className="flex flex-wrap items-center justify-between gap-3 py-3"
        >
          <div className="flex flex-col gap-1.5">
            <Skeleton
              className={cn(
                "h-4 rounded-md",
                STUDENT_NAME_WIDTHS[idx % STUDENT_NAME_WIDTHS.length]
              )}
            />
            <Skeleton className="h-3.5 w-48 rounded-md" />
          </div>
          <Skeleton className="h-11 sm:h-9 w-28 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
