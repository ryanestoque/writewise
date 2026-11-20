"use client";

import { hasUnreadWorkComments } from "@/lib/comments/selection";
import { useState, useRef, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Loader2,
  MoreHorizontal,
  Send,
  FileX,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { gradebookRequest, downloadGradebookCsv } from "@/lib/gradebook/transport";
import {
  useSectionGradebook,
  useActiveGradebookAccount,
  useGradebookActions,
  type GradebookCell,
} from "@/lib/hooks/use-gradebook";
import type { components } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { FloatingActionBar } from "@/components/ui/floating-action-bar";
import { QueryRecovery } from "@/components/shared/query-recovery";
import { cn } from "@/lib/utils";
import { GradebookCellButton } from "./gradebook-cell";
import { WorkGradeSheet } from "./work-grade-sheet";
import { GradebookBulkDialog } from "./gradebook-bulk-dialog";
import { useUnreadCommentThreads } from "@/lib/hooks/use-comments";

const selectClass =
  "min-h-10 rounded-lg border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer transition-colors hover:bg-muted/30";

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
  const [chosenSection, setSection] = useState<string | null>(initialSectionId ?? null);
  const [activityId, setActivityId] = useState(initialActivityId);
  const sectionId = sections.data?.some((section) => section.id === chosenSection)
    ? chosenSection
    : sections.data?.[0]?.id;

  function handleClearActivityFilter() {
    setActivityId(undefined);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("activity");
      const cleanPath = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "");
      window.history.replaceState(null, "", cleanPath);
    }
  }

  if (!active)
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Sign in again to view grades.
      </p>
    );
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <h1 className="font-heading text-2xl font-semibold sm:text-3xl">Gradebook</h1>
      </div>

      {sections.isError ? (
        <QueryRecovery
          title="Sections could not be loaded"
          description="Try again to choose a class."
          onRetry={() => void sections.refetch()}
          isRetrying={sections.isFetching}
        />
      ) : sections.isPending ? (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> Loading
          sections…
        </p>
      ) : !sections.data.length ? (
        <div className="bg-card space-y-2 rounded-xl border p-6">
          <h2 className="font-heading font-semibold">Choose a class to start</h2>
          <p className="text-muted-foreground text-sm">
            Add a section and its students in your roster to use the class gradebook.
          </p>
          <Link href="/roster" className="inline-flex min-h-10 items-center text-sm underline">
            Open class roster
          </Link>
        </div>
      ) : (
        <>
          {activityId && (
            <div className="flex flex-wrap items-center gap-3 text-sm print:hidden">
              <p className="text-muted-foreground">
                Showing the linked activity. Choose a section to review its grades.
              </p>
              <Button
                variant="outline"
                className="min-h-11 cursor-pointer"
                onClick={handleClearActivityFilter}
              >
                Show all activities
              </Button>
              <Link
                href={`/activities/${encodeURIComponent(activityId)}`}
                className="focus-visible:ring-ring inline-flex min-h-11 items-center rounded underline underline-offset-4 focus-visible:ring-2"
              >
                Back to activity
              </Link>
            </div>
          )}
          <label className="flex flex-wrap items-center gap-3 text-sm font-medium print:hidden">
            Section
            <select
              className={selectClass}
              value={sectionId ?? ""}
              onChange={(event) => setSection(event.target.value)}
            >
              {sections.data.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </label>
          {sectionId && (
            <SectionGrid
              key={`${userId}:${sectionId}`}
              userId={userId}
              sectionId={sectionId}
              activityId={activityId}
              totalSectionsCount={sections.data.length}
              sections={sections.data}
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
}: {
  userId: string;
  sectionId: string;
  activityId?: string;
  totalSectionsCount?: number;
  sections?: components["schemas"]["SectionResponse"][];
}) {
  const query = useSectionGradebook(userId, sectionId);
  const unread = useUnreadCommentThreads(userId);
  const actions = useGradebookActions(userId);
  const tableRef = useRef<HTMLDivElement>(null);
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
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [viewMode, setViewMode] = useState<"points" | "diagnostic">("points");
  const [activeCell, setActiveCell] = useState<{ row: number; col: number }>({ row: 0, col: 0 });

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
      <p role="status" className="flex items-center gap-2 py-8 text-sm">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> Loading
        gradebook…
      </p>
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

  async function download() {
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
    const nextRow = Math.min(row + 1, rows.length - 1);
    setActiveCell({ row: nextRow, col: column });
    const nextCell = tableRef.current?.querySelector<HTMLElement>(
      `[data-gradecell][data-row="${nextRow}"][data-column="${column}"]`
    );
    if (nextCell) {
      nextCell.focus();
      nextCell.click();
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

    if (event.key === "ArrowDown") nextRow = Math.min(row + 1, rows.length - 1);
    else if (event.key === "ArrowUp") nextRow = Math.max(row - 1, 0);
    else if (event.key === "ArrowRight") nextColumn = Math.min(column + 1, activities.length - 1);
    else if (event.key === "ArrowLeft") nextColumn = Math.max(column - 1, 0);
    else if (event.key === "Home") nextColumn = 0;
    else if (event.key === "End") nextColumn = activities.length - 1;

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

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            aria-label="Find student in gradebook"
            placeholder="Find student…"
            className="w-full sm:w-56"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            aria-label="Show activities"
            className={selectClass}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All activities</option>
            <option value="current">Current activities</option>
            <option value="archived">Archived activities</option>
          </select>

          <div
            role="radiogroup"
            aria-label="Gradebook view mode"
            className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs font-medium"
          >
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === "points"}
              onClick={() => setViewMode("points")}
              className={cn(
                "px-2.5 py-1.5 rounded-md transition-colors cursor-pointer",
                viewMode === "points"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Points View
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={viewMode === "diagnostic"}
              onClick={() => setViewMode("diagnostic")}
              className={cn(
                "px-2.5 py-1.5 rounded-md transition-colors cursor-pointer",
                viewMode === "diagnostic"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Diagnostic View
            </button>
          </div>
        </div>
        <Button variant="outline" disabled={exporting} onClick={() => void download()}>
          <Download aria-hidden className="mr-1.5 size-4" />{" "}
          {exporting ? "Downloading…" : "Export class record"}
        </Button>
      </div>

      {/* Section Readiness Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-band-2/15 border border-band-2/30 px-2.5 py-1 text-xs font-medium text-band-2-text dark:text-amber-300">
              <span className="size-1.5 rounded-full bg-band-2" />
              <span>{pendingDraftReleaseCount} draft {pendingDraftReleaseCount === 1 ? "grade" : "grades"} pending release</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-band-4/15 border border-band-4/30 px-2.5 py-1 text-xs font-medium text-band-4-text dark:text-emerald-300">
              <CheckCircle2 className="size-3.5 text-band-4-text dark:text-emerald-300" />
              <span>All current grades released</span>
            </span>
          )}
        </div>
      </div>

      <p className="text-muted-foreground text-xs print:hidden">
        {selected.size ? `${selected.size} students selected` : `${rows.length} students shown`}.
        Filters change the display; totals and CSV include all activities, including archived work.
        Students without a section appear in the roster.
      </p>

      {exportError && (
        <p role="alert" className="text-destructive text-sm">
          {exportError}
        </p>
      )}

      {!book.rows.length ? (
        <p className="bg-card rounded-xl border p-6 text-sm">
          This section has no students. Add students from the class roster.
        </p>
      ) : !activities.length ? (
        <p className="bg-card rounded-xl border p-6 text-sm">
          {activityId
            ? "The linked activity is not available in this section with the current activity filter. Choose another section or show all activities."
            : book.activities.length
              ? "No activities match this filter. Choose All activities to see the class record."
              : "No coursework yet. Assign an activity to this section or its students to begin."}
        </p>
      ) : (
        <div
          ref={tableRef}
          className={cn(
            "bg-card max-h-[70vh] overflow-auto rounded-xl border transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:max-h-none print:overflow-visible print:border-none",
            selected.size > 0 && "pb-24 sm:pb-20"
          )}
          tabIndex={-1}
          aria-label={`${book.section_name} grades, scroll for more activities. Use arrow keys to navigate cells, Enter to edit, Space to inspect.`}
          onKeyDown={moveFocus}
        >
          <table
            className="w-full border-collapse text-sm"
            role="grid"
            aria-colcount={activities.length + 2}
            aria-rowcount={rows.length + 1}
          >
            <caption className="sr-only">
              {book.section_name} coursework. Draft totals include all activities. Use arrow keys
              between grade cells, Enter to edit, Space to inspect.
            </caption>
            <thead className="bg-card sticky top-0 z-20 print:static">
              <tr className="border-b" role="row" aria-rowindex={1}>
                <th
                  scope="col"
                  role="columnheader"
                  aria-colindex={1}
                  className="bg-card sticky left-0 z-30 min-w-44 sm:min-w-48 border-r p-3 text-left print:static"
                >
                  <label className="flex items-center gap-2.5 sm:gap-3 font-medium text-foreground cursor-pointer select-none">
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
                  </label>
                </th>
                {activities.map((act, actIndex) => (
                  <th
                    key={act.id}
                    scope="col"
                    role="columnheader"
                    aria-colindex={actIndex + 2}
                    className="max-w-64 min-w-56 border-r p-3 text-left align-top"
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
                            : "Assessment only"}
                          {act.is_archived ? " · Archived" : ""}
                        </p>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`Actions for ${act.title}`}
                          className="inline-flex min-h-11 min-w-11 size-11 sm:min-h-9 sm:min-w-9 sm:size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer print:hidden"
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
                              window.location.href = `/activities/${act.id}`;
                            }}
                            className="cursor-pointer"
                          >
                            <ExternalLink className="mr-2 size-4" />
                            View activity details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </th>
                ))}
                <th
                  scope="col"
                  role="columnheader"
                  aria-colindex={activities.length + 2}
                  className="min-w-40 p-3 text-left font-medium text-foreground"
                >
                  Overall
                  <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                    {viewMode === "diagnostic" ? "Includes drafts & bands" : "Includes drafts"}
                  </p>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  key={row.student_id}
                  role="row"
                  aria-rowindex={rowIndex + 2}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <th
                    scope="row"
                    role="rowheader"
                    aria-colindex={1}
                    className="bg-card sticky left-0 z-10 border-r p-3 text-left font-medium print:static"
                  >
                    <label className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none">
                      <Checkbox
                        checked={selected.has(row.student_id)}
                        onCheckedChange={(checked) => toggle(row.student_id, !!checked)}
                        aria-label={`Select ${row.student_name}`}
                        className="print:hidden"
                      />
                      <span className="break-words text-foreground">{row.student_name}</span>
                    </label>
                  </th>
                  {activities.map((act, column) => {
                    const work = row.cells.find((entry) => entry.activity_id === act.id)!;
                    return (
                      <td
                        key={act.id}
                        role="gridcell"
                        aria-colindex={column + 2}
                        className="border-r p-1 align-top"
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
                          isFocused={activeCell.row === rowIndex && activeCell.col === column}
                          onFocusCell={() => setActiveCell({ row: rowIndex, col: column })}
                          onSaveScore={(score) =>
                            handleSaveScore(act.id, row.student_id, score)
                          }
                          onNavigateDown={handleNavigateDown}
                        />
                      </td>
                    );
                  })}
                  <td
                    role="gridcell"
                    aria-colindex={activities.length + 2}
                    className="p-3 align-top tabular-nums"
                  >
                    <p className="font-semibold text-foreground">
                      {row.totals.earned} / {row.totals.possible}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {row.totals.percentage === null
                        ? "No included grades"
                        : `${row.totals.percentage}%`}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="p-6 text-sm">No students match this search.</p>}
        </div>
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
                    className="h-8 text-xs bg-background/80 cursor-pointer"
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
                    className="h-8 text-xs bg-background/80 cursor-pointer"
                    onClick={() => beginBulk(activityId, "excuse")}
                  >
                    Excuse
                  </Button>
                </>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 rounded-md border border-input bg-background/80 px-2.5 text-xs font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
                    Batch actions <MoreHorizontal className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Batch Actions ({selected.size} selected)
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-xs cursor-pointer">
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
                                  className="text-xs truncate cursor-pointer"
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
                      <DropdownMenuSubTrigger className="text-xs cursor-pointer">
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
                              className="text-xs truncate cursor-pointer"
                              onClick={() => beginBulk(act.id, "excuse")}
                            >
                              <span className="truncate">{act.title}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-xs cursor-pointer">
                        <Send className="mr-2 size-3.5 text-primary" />
                        Release grades to parents
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-64 max-h-56 overflow-y-auto">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Choose activity:
                          </DropdownMenuLabel>
                          {activities.map((act) => (
                            <DropdownMenuItem
                              key={act.id}
                              className="text-xs truncate cursor-pointer"
                              onClick={() => beginBulk(act.id, "release")}
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
        const studentIndex = book.rows.findIndex((row) => row.student_id === cell.student_id);
        const activeCell =
          (studentIndex >= 0 &&
            book.rows[studentIndex]?.cells.find((c) => c.activity_id === cell.activity_id)) ||
          cell;
        const hasPrevStudent = studentIndex > 0;
        const hasNextStudent = studentIndex >= 0 && studentIndex < book.rows.length - 1;

        return (
          <WorkGradeSheet
            key={`${cell.student_id}:${cell.activity_id}`}
            userId={userId}
            cell={activeCell}
            studentName={studentIndex >= 0 ? book.rows[studentIndex]?.student_name : undefined}
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
              if (targetIndex >= 0 && targetIndex < book.rows.length) {
                const targetRow = book.rows[targetIndex];
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
