"use client";

import {
  useState,
  useRef,
  useMemo,
  useEffect,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  Send,
  MoreHorizontal,
  CheckCircle2,
  FileX,
  ExternalLink,
  Users,
  FileText,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  useSectionGradebook,
  useGradebookActions,
  type GradebookCell,
  useActiveGradebookAccount,
} from "@/lib/hooks/use-gradebook";
import { useQuery } from "@tanstack/react-query";
import { useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import { hasUnreadWorkComments } from "@/lib/comments/selection";
import { gradebookRequest, downloadGradebookCsv } from "@/lib/gradebook/transport";
import { GradebookCellButton, TouchDeviceContext, useIsTouchDevice } from "./gradebook-cell";
import { WorkGradeSheet } from "./work-grade-sheet";
import { GradebookBulkDialog } from "./gradebook-bulk-dialog";
import { QueryRecovery } from "@/components/shared/query-recovery";
import { FloatingActionBar } from "@/components/ui/floating-action-bar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SearchInput } from "@/components/ui/search-input";
import { FilterPills, type FilterPillItem } from "@/components/ui/filter-pills";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "@/components/ui/empty";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import type { components } from "@/types/api";
import { cn } from "@/lib/utils";

const ACTIVITY_FILTER_ITEMS = [
  { value: "all", label: "All activities" },
  { value: "active", label: "Current activities" },
  { value: "archived", label: "Archived activities" },
];

export function TeacherGradebook({
  userId,
  initialActivityId,
  initialSectionId,
}: {
  userId: string;
  initialActivityId?: string;
  initialSectionId?: string;
}) {
  const active = useActiveGradebookAccount(userId);
  const sections = useQuery({
    queryKey: ["gradebook", userId, "sections"],
    queryFn: ({ signal }) =>
      gradebookRequest<components["schemas"]["SectionResponse"][]>(userId, "/api/sections", signal),
    staleTime: 30_000,
    enabled: active,
  });
  const [chosenSection, setChosenSection] = useState<string | null>(initialSectionId ?? null);
  const [activityId, setActivityId] = useState(initialActivityId);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const sectionId = sections.data?.some((section) => section.id === chosenSection)
    ? (chosenSection ?? undefined)
    : sections.data?.[0]?.id;

  const sectionItems = useMemo<FilterPillItem[]>(
    () =>
      (sections.data ?? []).map((sec) => ({
        id: sec.id,
        label: sec.name,
      })),
    [sections.data]
  );

  function setSection(id: string) {
    setChosenSection(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("section", id);
      window.history.replaceState(null, "", url.toString());
    }
  }

  function handleClearActivityFilter() {
    setActivityId(undefined);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("activity");
      const cleanPath = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "");
      window.history.replaceState(null, "", cleanPath);
    }
  }

  async function download() {
    if (!sectionId) return;
    setExporting(true);
    setExportError("");
    try {
      await downloadGradebookCsv(userId, sectionId);
      toast.success("Class record CSV downloaded");
    } catch (failure) {
      if (!(failure instanceof Error && failure.name === "AbortError"))
        setExportError("CSV could not be downloaded. Try again.");
    } finally {
      setExporting(false);
    }
  }

  if (!active)
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Sign in again to view grades.
      </p>
    );

  return (
    <div className="w-full min-w-0 space-y-5 sm:space-y-6">
      {/* Page Header — matches Dashboard, Activities, and Roster */}
      <div className="flex items-center justify-between gap-3 sm:gap-4 print:hidden">
        <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-foreground tracking-tight">
          Gradebook
        </h1>
        {sectionId && (
          <Button
            variant="outline"
            onClick={() => void download()}
            disabled={exporting}
            className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] border-border text-foreground hover:bg-muted text-xs sm:text-sm font-medium shadow-xs rounded-lg sm:rounded-xl cursor-pointer shrink-0"
            aria-label={exporting ? "Downloading class record" : "Export class record"}
          >
            <Download className="w-4 h-4 mr-1.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>{exporting ? "Downloading…" : "Export CSV"}</span>
          </Button>
        )}
      </div>

      {exportError && (
        <Alert variant="destructive" className="print:hidden">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Export failed</AlertTitle>
          <AlertDescription className="[&>p]:mb-0">{exportError}</AlertDescription>
        </Alert>
      )}

      {sections.isError ? (
        <QueryRecovery
          title="Sections could not be loaded"
          description="Try again to choose a class."
          onRetry={() => void sections.refetch()}
          isRetrying={sections.isFetching}
        />
      ) : sections.isPending ? (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-10 w-56 rounded-xl" />
            <Skeleton className="h-10 w-40 rounded-xl" />
          </div>
          <div className="rounded-xl sm:rounded-2xl border border-border p-6 space-y-3 shadow-warm">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>
      ) : !sections.data.length ? (
        <Empty className="rounded-xl sm:rounded-2xl border border-border bg-surface dark:bg-card p-8 shadow-warm">
          <EmptyMedia variant="icon">
            <Users className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Choose a class to start</EmptyTitle>
            <EmptyDescription>
              Add a section and its students in your roster to use the class gradebook.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link href="/roster" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open class roster
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          {sectionId && (
            <SectionGrid
              key={`${userId}:${sectionId}`}
              userId={userId}
              sectionId={sectionId}
              activityId={activityId}
              totalSectionsCount={sections.data.length}
              sections={sections.data}
              sectionItems={sectionItems}
              onSelectSection={setSection}
              onClearActivityFilter={handleClearActivityFilter}
            />
          )}
        </>
      )}
    </div>
  );
}

function SectionGrid({
  userId,
  sectionId,
  activityId,
  totalSectionsCount = 1,
  sections,
  sectionItems,
  onSelectSection,
  onClearActivityFilter,
}: {
  userId: string;
  sectionId: string;
  activityId?: string;
  totalSectionsCount?: number;
  sections?: components["schemas"]["SectionResponse"][];
  sectionItems: FilterPillItem[];
  onSelectSection: (id: string) => void;
  onClearActivityFilter?: () => void;
}) {
  const router = useRouter();
  const query = useSectionGradebook(userId, sectionId);
  const unread = useUnreadCommentThreads(userId);
  const actions = useGradebookActions(userId);
  const isTouchDevice = useIsTouchDevice();
  const tableRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cell, setCell] = useState<GradebookCell | null>(null);
  const [bulk, setBulk] = useState<{
    activityId: string;
    operation: "zero" | "excuse" | "release";
    studentIds: string[];
    eligibleCount: number;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"points" | "diagnostic">("points");
  const [activeCell, setActiveCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });

  // "/" focuses search; Escape clears bulk student selection
  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Escape" && selected.size > 0 && !cell && !bulk) {
        setSelected(new Set());
        return;
      }

      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping && !cell && !bulk) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected.size, cell, bulk]);

  if (!query.isAccountActive)
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Sign in again to view grades.
      </p>
    );
  if (query.isError)
    return (
      <QueryRecovery
        title="Gradebook could not be loaded"
        description="Try again to read the latest grades."
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  if (!query.data || query.data.section_id !== sectionId)
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-56 rounded-md" />
          <Skeleton className="h-10 w-40 rounded-md" />
          <Skeleton className="h-10 w-44 rounded-md" />
        </div>
        <div className="rounded-md border p-6 space-y-3">
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </div>
    );

  const book = query.data;
  const rows = book.rows.filter((row) =>
    row.student_name.toLocaleLowerCase().includes(search.toLocaleLowerCase())
  );
  const activities = book.activities.filter(
    (activity) =>
      (!activityId || activity.id === activityId) &&
      (filter === "all" || activity.is_archived === (filter === "archived"))
  );
  const targets = selected.size ? book.rows.filter((row) => selected.has(row.student_id)) : rows;

  let gradedCellsCount = 0;
  let pendingDraftReleaseCount = 0;
  let awaitingScanCount = 0;

  book.rows.forEach((row) => {
    row.cells.forEach((c) => {
      if (!c.applicable) return;
      if (c.coursework_status === "Missing" && c.active_submission_id === null) {
        awaitingScanCount++;
      }
      if (c.final_points !== null) {
        gradedCellsCount++;
        if (c.publication !== "released") {
          pendingDraftReleaseCount++;
        }
      } else if (c.points_possible === null && c.coursework_status === "Draft") {
        pendingDraftReleaseCount++;
      }
    });
  });

  function beginBulk(targetActivityId: string, operation: "zero" | "excuse" | "release") {
    const eligibleCount = (operation === "release" ? book.rows : targets).filter((row) => {
      const work = row.cells.find((entry) => entry.activity_id === targetActivityId);
      if (!work?.applicable || work.coursework_status === "Excused") return false;
      if (operation === "zero")
        return (
          work.coursework_status === "Missing" &&
          work.points_override === null &&
          work.active_submission_id === null
        );
      if (operation === "release")
        return (
          (work.final_points !== null && work.publication !== "released") ||
          (work.points_possible === null && work.coursework_status === "Draft")
        );
      return true;
    }).length;
    setBulk({
      activityId: targetActivityId,
      operation,
      studentIds: targets.map((row) => row.student_id),
      eligibleCount,
    });
  }

  const toggle = (id: string, checked: boolean) =>
    setSelected((old) => {
      const next = new Set(old);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  async function handleSaveScore(actId: string, studId: string, score: string) {
    const points = score === "" ? null : Number(score);
    try {
      await actions.updateWork.mutateAsync({
        activityId: actId,
        studentId: studId,
        body: { points_override: points },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update score");
      throw err;
    }
  }

  function handleNavigateDown(row: number, column: number) {
    if (row >= rows.length - 1) {
      // Reached the end of the roster: do not loop into edit mode!
      return;
    }
    const nextRow = row + 1;
    setActiveCell({ row: nextRow, col: column });
    const nextCell = tableRef.current?.querySelector<HTMLElement>(
      `[data-gradecell][data-row="${nextRow}"][data-column="${column}"]`
    );
    if (nextCell) {
      nextCell.focus();
    }
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!event.key.startsWith("Arrow") && event.key !== "Home" && event.key !== "End") return;
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    const cellEl =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>("[data-gradecell]")
        : null;
    if (!cellEl) return;
    const row = Number(cellEl.dataset.row);
    const column = Number(cellEl.dataset.column);

    let nextRow = row;
    let nextColumn = column;
    const maxColumn = activities.length;

    if (event.key === "ArrowDown") nextRow = Math.min(row + 1, rows.length - 1);
    else if (event.key === "ArrowUp") nextRow = Math.max(row - 1, 0);
    else if (event.key === "ArrowRight") nextColumn = Math.min(column + 1, maxColumn);
    else if (event.key === "ArrowLeft") nextColumn = Math.max(column - 1, 0);
    else if (event.key === "Home") nextColumn = 0;
    else if (event.key === "End") nextColumn = maxColumn;

    if (nextRow !== row || nextColumn !== column) {
      event.preventDefault();
      setActiveCell({ row: nextRow, col: nextColumn });
      const next = event.currentTarget.querySelector<HTMLElement>(
        `[data-gradecell][data-row="${nextRow}"][data-column="${nextColumn}"]`
      );
      if (next) {
        next.focus();
      }
    }
  }

  const currentActivityFilterLabel =
    ACTIVITY_FILTER_ITEMS.find((item) => item.value === filter)?.label ?? "All activities";

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Unified Filter & Search Toolbar — matches Activities and Roster */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 lg:gap-3 bg-surface dark:bg-card p-3 rounded-xl sm:rounded-2xl border border-border shadow-warm print:hidden">
        {/* Row 1 on mobile / Left on desktop: Search + Activity Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <SearchInput
            ref={searchInputRef}
            aria-label="Find student in gradebook"
            placeholder="Find student…"
            containerClassName="flex-1 min-w-0 lg:w-60"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch("")}
          />

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Show activities"
              className="inline-flex items-center justify-between gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-[36px] text-xs font-medium rounded-lg sm:rounded-xl border border-border bg-background text-foreground hover:bg-muted/60 transition-colors cursor-pointer shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{currentActivityFilterLabel}</span>
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {ACTIVITY_FILTER_ITEMS.map((item) => (
                <DropdownMenuItem
                  key={item.value}
                  onClick={() => setFilter(item.value)}
                  className="cursor-pointer text-xs justify-between"
                >
                  <span>{item.label}</span>
                  {filter === item.value && (
                    <span className="text-primary font-bold">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Row 2 on mobile / Right on desktop: Section FilterPills + View Mode Toggle */}
        <div className="flex items-center justify-between lg:justify-end gap-2 min-w-0 flex-1">
          {sectionItems.length > 0 && (
            <FilterPills
              items={sectionItems}
              value={sectionId}
              onChange={onSelectSection}
              label="Section:"
              ariaLabel="Select section"
              containerClassName="min-w-0 flex-1 lg:flex-initial lg:justify-end"
            />
          )}

          <ToggleGroup
            value={[viewMode]}
            multiple={false}
            spacing={0}
            onValueChange={(vals) => {
              if (vals.length > 0) {
                setViewMode(vals[0] as "points" | "diagnostic");
              }
            }}
            aria-label="Gradebook view mode"
            className="inline-flex items-center rounded-lg sm:rounded-xl border border-border bg-background p-0.5 text-xs font-medium shrink-0"
          >
            <ToggleGroupItem
              value="points"
              size="sm"
              className="h-auto px-2.5 py-1.5 rounded-md sm:rounded-lg transition-all cursor-pointer min-h-[34px] sm:min-h-[28px] whitespace-nowrap text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-transparent dark:hover:bg-transparent aria-pressed:bg-brand-700 dark:aria-pressed:bg-primary aria-pressed:text-white dark:aria-pressed:text-primary-foreground aria-pressed:hover:bg-brand-700 dark:aria-pressed:hover:bg-primary aria-pressed:hover:text-white dark:aria-pressed:hover:text-primary-foreground aria-pressed:shadow-warm-sm aria-pressed:font-semibold"
            >
              Points
            </ToggleGroupItem>
            <ToggleGroupItem
              value="diagnostic"
              size="sm"
              className="h-auto px-2.5 py-1.5 rounded-md sm:rounded-lg transition-all cursor-pointer min-h-[34px] sm:min-h-[28px] whitespace-nowrap text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-transparent dark:hover:bg-transparent aria-pressed:bg-brand-700 dark:aria-pressed:bg-primary aria-pressed:text-white dark:aria-pressed:text-primary-foreground aria-pressed:hover:bg-brand-700 dark:aria-pressed:hover:bg-primary aria-pressed:hover:text-white dark:aria-pressed:hover:text-primary-foreground aria-pressed:shadow-warm-sm aria-pressed:font-semibold"
            >
              Diagnostic
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Section Readiness Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 sm:gap-3 rounded-xl border border-border bg-surface/70 dark:bg-card/70 px-3.5 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 sm:gap-x-4">
          <span className="text-foreground font-medium">
            Class: <strong className="font-semibold">{book.section_name}</strong> ({book.rows.length} students)
          </span>
          <span className="text-muted-foreground">
            Graded: <strong className="font-semibold text-foreground tabular-nums">{gradedCellsCount}</strong>
          </span>
          <span className="text-muted-foreground">
            Awaiting scan: <strong className="font-semibold text-foreground tabular-nums">{awaitingScanCount}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {pendingDraftReleaseCount > 0 ? (
            <Badge
              variant="outline"
              className="h-auto gap-1.5 rounded-full bg-band-2/15 border-band-2/30 px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-medium text-band-2-text"
            >
              <span className="size-1.5 rounded-full bg-band-2" aria-hidden="true" />
              <span>{pendingDraftReleaseCount} draft {pendingDraftReleaseCount === 1 ? "grade" : "grades"} pending release</span>
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-band-4/15 border border-band-4/30 px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-medium text-band-4-text">
              <span className="size-1.5 rounded-full bg-band-4" aria-hidden="true" />
              <span>All current grades released</span>
            </span>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <p className="text-muted-foreground text-xs print:hidden">
          {selected.size} {selected.size === 1 ? "student" : "students"} selected.
        </p>
      )}

      {!book.rows.length ? (
        <Empty className="rounded-xl sm:rounded-2xl border border-border bg-surface dark:bg-card p-8 shadow-warm">
          <EmptyMedia variant="icon">
            <Users className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No students in this section</EmptyTitle>
            <EmptyDescription>
              Add students to this section from the class roster to begin tracking cursive handwriting progress.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link href="/roster" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open class roster
            </Link>
          </EmptyContent>
        </Empty>
      ) : !activities.length ? (
        <Empty className="rounded-xl sm:rounded-2xl border border-border bg-surface dark:bg-card p-8 shadow-warm">
          <EmptyMedia variant="icon">
            <FileText className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No coursework matches this filter</EmptyTitle>
            <EmptyDescription>
              {activityId
                ? "The linked activity is not available in this section with the current activity filter."
                : book.activities.length
                  ? "No activities match your current filter. Choose All activities to see the full class record."
                  : "No coursework assigned yet. Assign an activity to this section or its students to begin."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {onClearActivityFilter ? (
              <Button variant="outline" size="sm" onClick={onClearActivityFilter}>
                Show all activities
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                Show all activities
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <TouchDeviceContext.Provider value={isTouchDevice}>
          <div
            ref={tableRef}
            className={cn(
              "bg-surface dark:bg-card max-h-[70svh] overflow-auto rounded-xl sm:rounded-2xl border border-border shadow-warm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:max-h-none print:overflow-visible print:border-none print:shadow-none",
              selected.size > 0 && "pb-24 sm:pb-20"
            )}
            tabIndex={-1}
            aria-label={`${book.section_name} grades, scroll for more activities. Use arrow keys to navigate cells, Enter to edit, Space to inspect.`}
            onKeyDown={moveFocus}
          >
            <Table
              disableContainer
              className="w-full border-collapse text-sm"
              role="grid"
              aria-colcount={activities.length + 2}
              aria-rowcount={rows.length + 1}
            >
              <TableCaption className="sr-only mt-0">
                {book.section_name} coursework. Draft totals include all activities. Use arrow keys
                between grade cells, Enter to edit, Space to inspect.
              </TableCaption>
              <TableHeader className="bg-card sticky top-0 z-20 print:static">
                <TableRow className="border-b hover:bg-transparent" role="row" aria-rowindex={1}>
                  <TableHead
                    scope="col"
                    role="columnheader"
                    aria-colindex={1}
                    className="bg-card sticky left-0 z-30 h-auto min-w-32 max-w-36 sm:min-w-48 border-r p-3 [&:has([role=checkbox])]:pr-3 text-left whitespace-normal print:static"
                  >
                    <Label className="flex items-center gap-2.5 sm:gap-3 font-medium text-foreground cursor-pointer select-none">
                      <Checkbox
                        aria-label="Select shown students"
                        className="print:hidden"
                        checked={rows.length > 0 && rows.every((row) => selected.has(row.student_id))}
                        onCheckedChange={(checked) =>
                          setSelected((old) => {
                            const next = new Set(old);
                            rows.forEach((row) => {
                              if (checked) next.add(row.student_id);
                              else next.delete(row.student_id);
                            });
                            return next;
                          })
                        }
                      />
                      <span>Student</span>
                    </Label>
                  </TableHead>
                  {activities.map((act, actIndex) => (
                    <TableHead
                      key={act.id}
                      scope="col"
                      role="columnheader"
                      aria-colindex={actIndex + 2}
                      className="h-auto max-w-64 min-w-44 sm:min-w-56 border-r p-3 text-left align-top whitespace-normal"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <Link
                            className="font-medium text-foreground hover:underline underline-offset-4 decoration-primary/40 break-words"
                            href={`/activities/${act.id}`}
                          >
                            {act.title}
                          </Link>
                          <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                            {act.points_possible
                              ? `${act.points_possible} points`
                              : "Bands only"}
                            {act.is_archived ? " · Archived" : ""}
                          </p>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={`Actions for ${act.title}`}
                            className="inline-flex min-h-9 min-w-9 size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer print:hidden"
                          >
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuGroup>
                              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                Activity Actions
                              </DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => beginBulk(act.id, "release")} className="cursor-pointer">
                                <Send className="mr-2 size-4 text-primary" />
                                Release grades to parents
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => beginBulk(act.id, "zero")}
                                disabled={act.points_possible === null}
                                className="cursor-pointer"
                              >
                                <FileX className="mr-2 size-4 text-muted-foreground" />
                                {selected.size
                                  ? `Mark uncollected (0) for ${selected.size}`
                                  : "Mark uncollected (0 pts)"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => beginBulk(act.id, "excuse")} className="cursor-pointer">
                                <CheckCircle2 className="mr-2 size-4 text-muted-foreground" />
                                {selected.size
                                  ? `Excuse ${selected.size} selected`
                                  : "Excuse all in section"}
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                router.push(`/activities/${act.id}`);
                              }}
                              className="cursor-pointer"
                            >
                              <ExternalLink className="mr-2 size-4" />
                              View activity details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableHead>
                  ))}
                  <TableHead
                    scope="col"
                    role="columnheader"
                    aria-colindex={activities.length + 2}
                    className="h-auto min-w-32 sm:min-w-40 p-3 text-left font-medium text-foreground whitespace-normal"
                  >
                    Overall
                    <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                      Includes drafts
                    </p>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, rowIndex) => (
                  <TableRow
                    key={row.student_id}
                    role="row"
                    aria-rowindex={rowIndex + 2}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors group/row"
                  >
                    <TableHead
                      scope="row"
                      role="rowheader"
                      aria-colindex={1}
                      className="bg-card sticky left-0 z-10 h-auto border-r p-3 [&:has([role=checkbox])]:pr-3 text-left font-medium whitespace-normal print:static group-hover/row:bg-muted/30 transition-colors"
                    >
                      <Label className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none leading-snug">
                        <Checkbox
                          checked={selected.has(row.student_id)}
                          onCheckedChange={(checked) => toggle(row.student_id, !!checked)}
                          aria-label={`Select ${row.student_name}`}
                          className="print:hidden"
                        />
                        <span className="break-words text-foreground line-clamp-2">{row.student_name}</span>
                      </Label>
                    </TableHead>
                    {activities.map((act, column) => {
                      const work = row.cells.find((entry) => entry.activity_id === act.id);
                      const isCellFocused = activeCell.row === rowIndex && activeCell.col === column;
                      if (!work) {
                        return (
                          <TableCell
                            key={act.id}
                            role="gridcell"
                            aria-colindex={column + 2}
                            className="border-r p-1 align-top text-muted-foreground text-xs whitespace-normal"
                          >
                            Not assigned
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell
                          key={act.id}
                          role="gridcell"
                          aria-colindex={column + 2}
                          aria-selected={isCellFocused}
                          className="border-r p-1 align-top whitespace-normal"
                        >
                          <GradebookCellButton
                            cell={work}
                            viewMode={viewMode}
                            hasUnreadComments={hasUnreadWorkComments(unread.data, {
                              activityId: work.activity_id,
                              studentId: work.student_id,
                            })}
                            label={`${row.student_name}, ${act.title}`}
                            onOpen={() => setCell(work)}
                            row={rowIndex}
                            column={column}
                            isFocused={isCellFocused}
                            onFocusCell={() => setActiveCell({ row: rowIndex, col: column })}
                            onSaveScore={(score) =>
                              handleSaveScore(act.id, row.student_id, score)
                            }
                            onNavigateDown={handleNavigateDown}
                          />
                        </TableCell>
                      );
                    })}
                    <TableCell
                      role="gridcell"
                      aria-colindex={activities.length + 2}
                      aria-selected={activeCell.row === rowIndex && activeCell.col === activities.length}
                      data-gradecell
                      data-row={rowIndex}
                      data-column={activities.length}
                      tabIndex={activeCell.row === rowIndex && activeCell.col === activities.length ? 0 : -1}
                      onFocus={() => setActiveCell({ row: rowIndex, col: activities.length })}
                      aria-label={`${row.student_name} overall grade: ${row.totals.earned} of ${row.totals.possible} points, ${
                        row.totals.percentage === null ? "no included grades" : `${row.totals.percentage}%`
                      }`}
                      className={cn(
                        "p-3 align-top tabular-nums whitespace-normal transition-colors focus-visible:outline-none",
                        activeCell.row === rowIndex && activeCell.col === activities.length
                          ? "border-primary/60 ring-2 ring-primary/40 bg-muted/40"
                          : ""
                      )}
                    >
                      <p className="font-semibold text-foreground">
                        {row.totals.earned} / {row.totals.possible}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {row.totals.percentage === null
                          ? "No included grades"
                          : `${row.totals.percentage}%`}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!rows.length && (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm text-muted-foreground">No students match “{search}”.</p>
                <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="min-h-9">
                  Clear search
                </Button>
              </div>
            )}
          </div>
        </TouchDeviceContext.Provider>
      )}

      {selected.size > 0 && (
        <FloatingActionBar
          selectedCount={selected.size}
          totalCount={rows.length}
          itemLabel="student"
          allSelected={rows.length > 0 && selected.size === rows.length}
          onSelectAll={() => setSelected(new Set(rows.map((r) => r.student_id)))}
          onClearSelection={() => setSelected(new Set())}
          ariaLabel="Gradebook batch student actions"
          className="bottom-4 mb-[env(safe-area-inset-bottom,0px)]"
        >
          {activities.length > 0 && (
            <div className="flex items-center gap-2">
              {activityId ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs bg-background/80 cursor-pointer"
                    disabled={
                      !activities.some(
                        (a) => a.id === activityId && a.points_possible !== null
                      )
                    }
                    onClick={() => beginBulk(activityId, "zero")}
                  >
                    Mark uncollected (0 pts)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs bg-background/80 cursor-pointer"
                    onClick={() => beginBulk(activityId, "excuse")}
                  >
                    Excuse
                  </Button>
                </>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-9 rounded-md border border-input bg-background/80 px-2.5 text-xs font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
                    Batch actions <MoreHorizontal className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Batch Actions ({selected.size} selected)
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-xs cursor-pointer min-h-9">
                        <FileX className="mr-2 size-3.5 text-muted-foreground" />
                        Mark uncollected (0 pts)
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-64 max-h-56 overflow-y-auto">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Choose activity:
                          </DropdownMenuLabel>
                          {activities.filter((a) => a.points_possible !== null).length === 0 ? (
                            <p className="px-3 py-2 text-xs text-muted-foreground italic">No scored activities</p>
                          ) : (
                            activities
                              .filter((a) => a.points_possible !== null)
                              .map((act) => (
                                <DropdownMenuItem
                                  key={act.id}
                                  className="text-xs truncate cursor-pointer min-h-9"
                                  onClick={() => beginBulk(act.id, "zero")}
                                >
                                  <span className="truncate">{act.title}</span>
                                </DropdownMenuItem>
                              ))
                          )}
                        </DropdownMenuGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-xs cursor-pointer min-h-9">
                        <CheckCircle2 className="mr-2 size-3.5 text-muted-foreground" />
                        Excuse students
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-64 max-h-56 overflow-y-auto">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Choose activity:
                          </DropdownMenuLabel>
                          {activities.map((act) => (
                            <DropdownMenuItem
                              key={act.id}
                              className="text-xs truncate cursor-pointer min-h-9"
                              onClick={() => beginBulk(act.id, "excuse")}
                            >
                              <span className="truncate">{act.title}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </FloatingActionBar>
      )}

      {cell && (() => {
        // Navigate through the actively shown/filtered rows
        const studentIndex = rows.findIndex((row) => row.student_id === cell.student_id);
        const activeCell =
          (studentIndex >= 0 &&
            rows[studentIndex]?.cells.find((c) => c.activity_id === cell.activity_id)) ||
          cell;
        const hasPrevStudent = studentIndex > 0;
        const hasNextStudent = studentIndex >= 0 && studentIndex < rows.length - 1;

        return (
          <WorkGradeSheet
            key={`${cell.student_id}:${cell.activity_id}`}
            userId={userId}
            cell={activeCell}
            studentName={studentIndex >= 0 ? rows[studentIndex]?.student_name : undefined}
            activityTitle={
              book.activities.find((activity) => activity.id === cell.activity_id)?.title
            }
            open
            onOpenChange={(open) => {
              if (!open) setCell(null);
            }}
            hasPrevStudent={hasPrevStudent}
            hasNextStudent={hasNextStudent}
            onNavigateStudent={(direction) => {
              const targetIndex = direction === "prev" ? studentIndex - 1 : studentIndex + 1;
              if (targetIndex >= 0 && targetIndex < rows.length) {
                const targetRow = rows[targetIndex];
                const targetCell = targetRow.cells.find((c) => c.activity_id === cell.activity_id);
                if (targetCell) setCell(targetCell);
              }
            }}
          />
        );
      })()}

      {bulk && (
        <GradebookBulkDialog
          key={`${bulk.activityId}:${bulk.operation}`}
          userId={userId}
          activityId={bulk.activityId}
          studentIds={bulk.studentIds}
          eligibleCount={bulk.eligibleCount}
          operation={bulk.operation}
          activityTitle={book.activities.find((activity) => activity.id === bulk.activityId)?.title}
          sectionId={sectionId}
          sectionName={book.section_name}
          totalSectionsCount={totalSectionsCount}
          sections={sections}
          open
          onOpenChange={(open) => {
            if (!open) setBulk(null);
          }}
        />
      )}
    </div>
  );
}
