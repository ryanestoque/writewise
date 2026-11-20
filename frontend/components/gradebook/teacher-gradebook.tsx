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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FloatingActionBar } from "@/components/ui/floating-action-bar";
import { QueryRecovery } from "@/components/shared/query-recovery";
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
  if (!active)
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Sign in again to view grades.
      </p>
    );
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold sm:text-3xl">Gradebook</h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          Review coursework points alongside handwriting assessments. Your totals include drafts;
          parents see released grades.
        </p>
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
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <p className="text-muted-foreground">
                Showing the linked activity. Choose a section to review its grades.
              </p>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => setActivityId(undefined)}
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
          <label className="flex flex-wrap items-center gap-3 text-sm font-medium">
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
}: {
  userId: string;
  sectionId: string;
  activityId?: string;
  totalSectionsCount?: number;
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
      toast.success("Draft score saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update score");
      throw err;
    }
  }

  function handleNavigateDown(row: number, column: number) {
    const nextRow = row + 1;
    const nextCell = tableRef.current?.querySelector<HTMLElement>(
      `[data-gradecell][data-row="${nextRow}"][data-column="${column}"]`
    );
    if (nextCell) {
      nextCell.focus();
      nextCell.click();
    }
  }

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!event.key.startsWith("Arrow")) return;
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
    const row = Number(cellEl.dataset.row),
      column = Number(cellEl.dataset.column);
    const nextRow = row + (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0);
    const nextColumn =
      column + (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0);
    const next = event.currentTarget.querySelector<HTMLElement>(
      `[data-gradecell][data-row="${nextRow}"][data-column="${nextColumn}"]`
    );
    if (next) {
      event.preventDefault();
      next.focus();
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
              <span className="size-1.5 rounded-full bg-amber-500" />
              <span>{pendingDraftReleaseCount} draft {pendingDraftReleaseCount === 1 ? "grade" : "grades"} pending release</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="size-3.5" />
              <span>All current grades released</span>
            </span>
          )}
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
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
          className="bg-card max-h-[70vh] overflow-auto rounded-xl border transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
          aria-label={`${book.section_name} grades, scroll for more activities. Use arrow keys to navigate cells, Enter to edit, Space to inspect.`}
          onKeyDown={moveFocus}
        >
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              {book.section_name} coursework. Draft totals include all activities. Use arrow keys
              between grade cells, Enter to edit, Space to inspect.
            </caption>
            <thead className="bg-card sticky top-0 z-20">
              <tr className="border-b">
                <th
                  scope="col"
                  className="bg-card sticky left-0 z-30 min-w-48 border-r p-3 text-left"
                >
                  <label className="flex items-center gap-3 font-medium text-foreground">
                    <Checkbox
                      aria-label="Select shown students"
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
                    Student
                  </label>
                </th>
                {activities.map((act) => (
                  <th
                    key={act.id}
                    scope="col"
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
                          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                            Activity Actions
                          </DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => beginBulk(act.id, "release")}>
                            <Send className="mr-2 size-4 text-primary" />
                            Release grades to parents
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => beginBulk(act.id, "zero")}
                            disabled={act.points_possible === null}
                          >
                            <FileX className="mr-2 size-4 text-muted-foreground" />
                            {selected.size
                              ? `Mark uncollected (0) for ${selected.size}`
                              : "Mark uncollected (0 pts)"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => beginBulk(act.id, "excuse")}>
                            <CheckCircle2 className="mr-2 size-4 text-muted-foreground" />
                            {selected.size
                              ? `Excuse ${selected.size} selected`
                              : "Excuse all in section"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              window.location.href = `/activities/${act.id}`;
                            }}
                          >
                            <ExternalLink className="mr-2 size-4" />
                            View activity details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </th>
                ))}
                <th scope="col" className="min-w-40 p-3 text-left font-medium text-foreground">
                  Overall
                  <p className="text-muted-foreground mt-0.5 text-xs font-normal">Includes drafts</p>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.student_id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <th
                    scope="row"
                    className="bg-card sticky left-0 z-10 border-r p-3 text-left font-medium"
                  >
                    <label className="flex items-center gap-3">
                      <Checkbox
                        checked={selected.has(row.student_id)}
                        onCheckedChange={(checked) => toggle(row.student_id, !!checked)}
                        aria-label={`Select ${row.student_name}`}
                      />
                      <span className="break-words text-foreground">{row.student_name}</span>
                    </label>
                  </th>
                  {activities.map((act, column) => {
                    const work = row.cells.find((entry) => entry.activity_id === act.id)!;
                    return (
                      <td key={act.id} className="border-r p-1 align-top">
                        <GradebookCellButton
                          cell={work}
                          hasUnreadComments={hasUnreadWorkComments(unread.data, {
                            activityId: work.activity_id,
                            studentId: work.student_id,
                          })}
                          label={`${row.student_name}, ${act.title}`}
                          onOpen={() => setCell(work)}
                          row={rowIndex}
                          column={column}
                          onSaveScore={(score) =>
                            handleSaveScore(act.id, row.student_id, score)
                          }
                          onNavigateDown={handleNavigateDown}
                        />
                      </td>
                    );
                  })}
                  <td className="p-3 align-top tabular-nums">
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
        >
          {activities.length > 0 && (
            <div className="flex items-center gap-2">
              {activityId ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs bg-background/80"
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
                    className="h-8 text-xs bg-background/80"
                    onClick={() => beginBulk(activityId, "excuse")}
                  >
                    Excuse
                  </Button>
                </>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 rounded-md border border-input bg-background/80 px-2.5 text-xs font-medium hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Batch actions <MoreHorizontal className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 max-h-60 overflow-y-auto">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Apply to Activity:
                    </DropdownMenuLabel>
                    {activities.map((act) => (
                      <div key={act.id} className="p-1 border-b last:border-0">
                        <p className="px-2 py-1 text-xs font-semibold truncate">{act.title}</p>
                        <div className="flex gap-1 px-1">
                          {act.points_possible !== null && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs flex-1 justify-start"
                              onClick={() => beginBulk(act.id, "zero")}
                            >
                              Mark 0 pts
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs flex-1 justify-start"
                            onClick={() => beginBulk(act.id, "excuse")}
                          >
                            Excuse
                          </Button>
                        </div>
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </FloatingActionBar>
      )}

      {cell && (
        <WorkGradeSheet
          key={`${cell.student_id}:${cell.activity_id}:${cell.grade_revision}`}
          userId={userId}
          cell={cell}
          studentName={book.rows.find((row) => row.student_id === cell.student_id)?.student_name}
          activityTitle={
            book.activities.find((activity) => activity.id === cell.activity_id)?.title
          }
          open
          onOpenChange={(open) => {
            if (!open) setCell(null);
          }}
        />
      )}
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
          open
          onOpenChange={(open) => {
            if (!open) setBulk(null);
          }}
        />
      )}
    </div>
  );
}
