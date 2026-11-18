"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { gradebookRequest } from "@/lib/gradebook/transport";
import {
  useActiveGradebookAccount,
  type GradebookCell,
  type SectionGradebook,
} from "@/lib/hooks/use-gradebook";
import type { ActivityWorkState } from "@/lib/hooks/use-activity-work";
import type { Student } from "@/lib/hooks/use-students";

export function useActivityReleaseGrades({
  userId,
  activityId,
  students,
  states,
  enabled,
}: {
  userId: string;
  activityId: string;
  students: Student[];
  states: ActivityWorkState[] | undefined;
  enabled: boolean;
}) {
  const active = useActiveGradebookAccount(userId);
  const assignedIds = new Set(states?.map((state) => state.student_id));
  const assigned = students.filter((student) => assignedIds.has(student.id));
  const sectionIds = [
    ...new Set(assigned.flatMap((student) => (student.section_id ? [student.section_id] : []))),
  ].sort();
  const queries = useQueries({
    queries: sectionIds.map((sectionId) => ({
      queryKey: ["gradebook", userId, "section", sectionId],
      enabled: enabled && active && !!userId,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        gradebookRequest<SectionGradebook>(
          userId,
          `/api/sections/${encodeURIComponent(sectionId)}/gradebook`,
          signal
        ),
      staleTime: 0,
      refetchOnWindowFocus: "always" as const,
      refetchOnMount: "always" as const,
      refetchInterval: enabled ? 15_000 : (false as const),
      refetchIntervalInBackground: false,
      retry: false,
    })),
  });
  const pending = queries.some((query) => query.isPending || query.isFetching);
  const failed = queries.some((query) => query.isError);
  const sections =
    active && enabled ? queries.flatMap((query) => (query.data ? [query.data] : [])) : [];
  const cells = new Map<string, GradebookCell>();
  for (const section of sections) {
    for (const row of section.rows) {
      const cell = row.cells.find((entry) => entry.activity_id === activityId);
      if (cell && cell.applicable && assignedIds.has(row.student_id))
        cells.set(row.student_id, cell);
    }
  }
  const uncovered = assigned.filter((student) => !cells.has(student.id));
  const unknownCount = [...assignedIds].filter(
    (id) => !students.some((student) => student.id === id)
  ).length;
  const entries = assigned.flatMap((student) => {
    const cell = cells.get(student.id);
    return cell &&
      cell.publication === "draft" &&
      cell.final_points !== null &&
      cell.coursework_status !== "Excused"
      ? [{ student, cell }]
      : [];
  });
  const ready = enabled && active && !!userId && !pending && !failed;
  return {
    active,
    pending,
    failed,
    ready,
    sections,
    entries,
    uncovered,
    unknownCount,
    complete: ready && uncovered.length === 0 && unknownCount === 0,
    snapshot: JSON.stringify([...cells.entries()].sort(([a], [b]) => a.localeCompare(b))),
    retry: () => {
      for (const query of queries) void query.refetch();
    },
  };
}

export function ActivityReleaseGradePreview({
  inventory,
  activityId,
}: {
  inventory: ReturnType<typeof useActivityReleaseGrades>;
  activityId: string;
}) {
  if (!inventory.active)
    return <p role="alert">Your account changed. Sign in again before reviewing grades.</p>;
  if (inventory.failed)
    return (
      <div className="flex flex-col gap-2">
        <p role="alert">Could not load all point grades. Retry before continuing.</p>
        <Button variant="outline" onClick={inventory.retry} disabled={inventory.pending}>
          Retry point grades
        </Button>
      </div>
    );
  if (inventory.pending)
    return <p role="status">Checking point grades across assigned sections…</p>;
  return (
    <section aria-label="Point grades ready for release" className="flex flex-col gap-3 text-sm">
      <p>
        <strong>{inventory.entries.length} draft point grades</strong> ready
        {inventory.complete
          ? " across all assigned students."
          : " in the covered sections. This is a partial inventory."}
      </p>
      {inventory.entries.length > 0 && (
        <ul
          className="flex max-h-48 flex-col gap-2 overflow-y-auto"
          tabIndex={0}
          aria-label="Draft point grades"
        >
          {inventory.entries.map(({ student, cell }) => (
            <li key={student.id} className="flex flex-col gap-1 border-b pb-2">
              <strong className="font-medium break-words">{student.full_name}</strong>
              <span>
                {student.section || "No section"} · {cell.final_points} / {cell.points_possible}{" "}
                points
              </span>
              <span className="flex flex-wrap gap-2">
                {cell.points_override !== null && <Badge variant="outline">Override</Badge>}
                {Number(cell.final_points) === 0 && <Badge variant="outline">Zero</Badge>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!inventory.complete && (
        <div className="flex flex-col gap-2">
          <p>
            These students are not covered by the section Gradebook reads. Their eligible grades may
            also be released; review them manually before continuing.
          </p>
          <ul className="list-inside list-disc">
            {inventory.uncovered.map((student) => (
              <li key={student.id}>
                {student.full_name} —{" "}
                {student.section_id ? "Gradebook entry unavailable" : "No section"}
              </li>
            ))}
            {inventory.unknownCount > 0 && (
              <li>
                {inventory.unknownCount} assigned students missing from the loaded roster. Reload
                the roster to identify them.
              </li>
            )}
          </ul>
        </div>
      )}
      {inventory.sections.map((section) => (
        <Link
          key={section.section_id}
          href={`/gradebook?activity=${encodeURIComponent(activityId)}&section=${encodeURIComponent(section.section_id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary inline-flex min-h-10 items-center underline underline-offset-4"
        >
          Review {section.section_name} in Gradebook (new tab)
        </Link>
      ))}
    </section>
  );
}
