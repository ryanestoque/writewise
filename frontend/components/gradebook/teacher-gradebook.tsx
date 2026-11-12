"use client";

import { useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { gradebookRequest, downloadGradebookCsv } from "@/lib/gradebook/transport";
import {
  useSectionGradebook,
  useActiveGradebookAccount,
  type GradebookCell,
} from "@/lib/hooks/use-gradebook";
import type { components } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { QueryRecovery } from "@/components/shared/query-recovery";
import { GradebookCellButton } from "./gradebook-cell";
import { WorkGradeSheet } from "./work-grade-sheet";
import { GradebookBulkDialog } from "./gradebook-bulk-dialog";

const selectClass =
  "min-h-10 rounded-lg border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TeacherGradebook({ userId }: { userId: string }) {
  const active = useActiveGradebookAccount(userId);
  const sections = useQuery({
    queryKey: ["gradebook", userId, "sections"],
    queryFn: ({ signal }) =>
      gradebookRequest<components["schemas"]["SectionResponse"][]>(userId, "/api/sections", signal),
    staleTime: 30_000,
    enabled: active,
  });
  const [chosenSection, setSection] = useState<string | null>(null);
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
            <SectionGrid key={`${userId}:${sectionId}`} userId={userId} sectionId={sectionId} />
          )}
        </>
      )}
    </div>
  );
}

function SectionGrid({ userId, sectionId }: { userId: string; sectionId: string }) {
  const query = useSectionGradebook(userId, sectionId);
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
    (activity) => filter === "all" || activity.is_archived === (filter === "archived")
  );
  const targets = selected.size ? book.rows.filter((row) => selected.has(row.student_id)) : rows;
  function beginBulk(activityId: string, operation: "zero" | "excuse" | "release") {
    const eligibleCount = (operation === "release" ? book.rows : targets).filter((row) => {
      const work = row.cells.find((entry) => entry.activity_id === activityId);
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
      activityId,
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
  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!event.key.startsWith("Arrow")) return;
    const button =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLButtonElement>("button[data-gradecell]")
        : null;
    if (!button) return;
    const row = Number(button.dataset.row),
      column = Number(button.dataset.column);
    const nextRow = row + (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0);
    const nextColumn =
      column + (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0);
    const next = event.currentTarget.querySelector<HTMLButtonElement>(
      `button[data-row="${nextRow}"][data-column="${nextColumn}"]`
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
          <Download aria-hidden /> {exporting ? "Downloading…" : "Export class record"}
        </Button>
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
      ) : !book.activities.length ? (
        <p className="bg-card rounded-xl border p-6 text-sm">
          No coursework yet. Assign an activity to this section or its students to begin.
        </p>
      ) : (
        <div
          className="bg-card max-h-[70vh] overflow-auto rounded-xl border"
          tabIndex={0}
          aria-label={`${book.section_name} grades, scroll for more activities`}
          onKeyDown={moveFocus}
        >
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              {book.section_name} coursework. Draft totals include all activities. Use arrow keys
              between grade cells.
            </caption>
            <thead className="bg-card sticky top-0 z-20">
              <tr className="border-b">
                <th
                  scope="col"
                  className="bg-card sticky left-0 z-30 min-w-48 border-r p-3 text-left"
                >
                  <label className="flex items-center gap-3">
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
                {activities.map((activity) => (
                  <th
                    key={activity.id}
                    scope="col"
                    className="max-w-64 min-w-52 border-r p-3 text-left align-top"
                  >
                    <Link
                      className="decoration-border break-words underline underline-offset-4"
                      href={`/activities/${activity.id}`}
                    >
                      {activity.title}
                    </Link>
                    <p className="text-muted-foreground mt-1 text-xs font-normal">
                      {activity.points_possible
                        ? `${activity.points_possible} points`
                        : "Assessment only"}
                      {activity.is_archived ? " · Archived" : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(["zero", "excuse", "release"] as const).map((operation) => (
                        <Button
                          key={operation}
                          variant="outline"
                          size="sm"
                          className="min-h-8 text-xs"
                          disabled={
                            !targets.length ||
                            (operation === "zero" && activity.points_possible === null)
                          }
                          aria-label={`${operation === "zero" ? "Assign draft zeros" : operation === "excuse" ? "Excuse selected work" : "Release all activity grades"}: ${activity.title}`}
                          onClick={() => beginBulk(activity.id, operation)}
                        >
                          {operation === "zero"
                            ? "Assign 0"
                            : operation === "excuse"
                              ? "Excuse"
                              : "Release"}
                        </Button>
                      ))}
                    </div>
                  </th>
                ))}
                <th scope="col" className="min-w-40 p-3 text-left">
                  Overall
                  <p className="text-muted-foreground mt-1 text-xs font-normal">Includes drafts</p>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.student_id} className="border-b last:border-0">
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
                      <span className="break-words">{row.student_name}</span>
                    </label>
                  </th>
                  {activities.map((activity, column) => {
                    const work = row.cells.find((entry) => entry.activity_id === activity.id)!;
                    return (
                      <td key={activity.id} className="border-r p-1 align-top">
                        <div data-row={rowIndex} data-column={column}>
                          <GradebookCellButton
                            cell={work}
                            label={`${row.student_name}, ${activity.title}`}
                            onOpen={() => setCell(work)}
                            row={rowIndex}
                            column={column}
                          />
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-3 align-top tabular-nums">
                    <p className="font-semibold">
                      {row.totals.earned} / {row.totals.possible}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
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
          open
          onOpenChange={(open) => {
            if (!open) setBulk(null);
          }}
        />
      )}
    </div>
  );
}
