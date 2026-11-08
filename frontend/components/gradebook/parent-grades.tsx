"use client";

import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useChildGradebook } from "@/lib/hooks/use-gradebook";
import { BandBadge } from "@/components/shared/band-badge";
import { QueryRecovery } from "@/components/shared/query-recovery";
import { Button } from "@/components/ui/button";

export function ParentGrades({
  userId,
  childId,
  highlightActivityId,
  onDismissTarget,
}: {
  userId: string;
  childId: string;
  highlightActivityId?: string;
  onDismissTarget?: () => void;
}) {
  const query = useChildGradebook(userId, childId, true);
  useEffect(() => {
    if (highlightActivityId && query.data && !query.isError) {
      document
        .getElementById(`parent-grade-${highlightActivityId}`)
        ?.scrollIntoView({ block: "center" });
    }
  }, [highlightActivityId, query.data, query.isError]);
  if (!query.isAccountActive)
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Sign in again to view grades.
      </p>
    );
  if (query.isError)
    return (
      <QueryRecovery
        title="Grades could not be loaded"
        description="Try again to see the latest released grades."
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  if (!query.data || query.data.student_id !== childId)
    return (
      <p role="status" className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> Loading
        grades…
      </p>
    );
  if (
    highlightActivityId &&
    !query.data.groups.some((group) =>
      group.row.cells.some((cell) => cell.activity_id === highlightActivityId && cell.applicable)
    )
  )
    return (
      <div className="bg-card space-y-3 rounded-xl border p-6">
        <h2 className="font-heading font-semibold">This grade is no longer available</h2>
        <p className="text-muted-foreground text-sm">
          The activity may have been removed or access may have changed.
        </p>
        <Button variant="outline" onClick={onDismissTarget}>
          Back to grades
        </Button>
      </div>
    );
  if (query.data.groups.length === 0)
    return (
      <div className="bg-card space-y-2 rounded-xl border p-6">
        <h2 className="font-heading font-semibold">Grades will appear here</h2>
        <p className="text-muted-foreground text-sm">
          Your child’s assigned worksheets and released grades will appear once their teacher adds
          coursework.
        </p>
      </div>
    );
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Totals include released point grades. Excused work is excluded. Handwriting feedback uses
        the same assessment bands as Latest Feedback.
      </p>
      {query.data.groups.map((group) => {
        const totals = group.row.totals;
        return (
          <section
            key={group.teacher_id}
            className="bg-card overflow-hidden rounded-xl border"
            aria-labelledby={`grades-teacher-${group.teacher_id}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b px-4 py-4 sm:px-5">
              <div>
                <h2
                  id={`grades-teacher-${group.teacher_id}`}
                  className="font-heading font-semibold"
                >
                  {group.teacher_name}
                </h2>
                <p className="text-muted-foreground mt-1 text-xs">Released coursework</p>
              </div>
              <div className="text-right tabular-nums">
                <p className="font-semibold">
                  {totals.earned} / {totals.possible}{" "}
                  <span className="text-muted-foreground text-xs font-normal">points</span>
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {totals.percentage === null
                    ? "No released point grades"
                    : `${totals.percentage}% overall`}
                </p>
              </div>
            </div>
            <ul className="divide-y">
              {group.activities.map((activity) => {
                const cell = group.row.cells.find((item) => item.activity_id === activity.id);
                if (!cell?.applicable) return null;
                return (
                  <li
                    key={activity.id}
                    id={`parent-grade-${activity.id}`}
                    className={`flex scroll-mt-24 flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5 ${highlightActivityId === activity.id ? "bg-primary/5 ring-primary ring-2 ring-inset" : ""}`}
                  >
                    <div className="min-w-0 flex-1 basis-40 space-y-1">
                      <h3 className="text-sm font-medium break-words">{activity.title}</h3>
                      <p className="text-muted-foreground text-xs">
                        {cell.coursework_status}
                        {cell.late ? " · Late" : ""}
                        {activity.is_archived ? " · Archived" : ""}
                      </p>
                    </div>
                    <div className="space-y-1.5 text-right">
                      <p className="text-sm font-medium tabular-nums">
                        {cell.coursework_status === "Excused"
                          ? "Excused"
                          : cell.points_possible === null
                            ? "Assessment only"
                            : cell.final_points === null
                              ? "Not yet released"
                              : `${cell.final_points} / ${cell.points_possible} points`}
                      </p>
                      {cell.final_points === null &&
                        cell.points_possible !== null &&
                        cell.coursework_status !== "Excused" && (
                          <p className="text-muted-foreground text-xs tabular-nums">
                            {cell.points_possible} points possible
                          </p>
                        )}
                      {cell.assessment_composite !== null && (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-muted-foreground text-xs">Assessment</span>
                          <BandBadge score={Number(cell.assessment_composite)} size="sm" />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
