"use client";

import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useChildGradebook } from "@/lib/hooks/use-gradebook";
import { BandBadge } from "@/components/shared/band-badge";
import { QueryRecovery } from "@/components/shared/query-recovery";
import { Button } from "@/components/ui/button";
import { WorkCommentsButton } from "@/components/comments/submission-comment-picker-sheet";

export function ParentGrades({
  userId,
  childId,
  showScoreDetails = false,
  highlightActivityId,
  onDismissTarget,
}: {
  userId: string;
  childId: string;
  showScoreDetails?: boolean;
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
        <Loader2 className="size-4 animate-spin" aria-hidden /> Loading
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
        <Button
          variant="outline"
          onClick={onDismissTarget}
          className="h-10 min-h-10 sm:h-9 sm:min-h-9 cursor-pointer touch-manipulation"
        >
          Back to grades
        </Button>
      </div>
    );
  if (query.data.groups.length === 0)
    return (
      <section
        id="coursework-section"
        aria-labelledby="coursework-heading"
        className="space-y-3"
      >
        <h2
          id="coursework-heading"
          className="font-heading text-base sm:text-lg font-semibold text-foreground"
        >
          Coursework
        </h2>
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8 text-center space-y-2">
          <h3 className="font-heading text-base font-semibold text-foreground">
            No coursework grades yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Released points and coursework updates from your child&apos;s teacher will appear here.
          </p>
        </div>
      </section>
    );
  return (
    <section
      id="coursework-section"
      aria-labelledby="coursework-heading"
      className="space-y-3"
    >
      <h2
        id="coursework-heading"
        className="font-heading text-base sm:text-lg font-semibold text-foreground"
      >
        Coursework
      </h2>
      <div className="space-y-4">
      {query.data.groups.map((group) => {
        const totals = group.row.totals;
        return (
          <section
            key={group.teacher_id}
            className="bg-card overflow-hidden rounded-xl border border-border"
            aria-labelledby={`grades-teacher-${group.teacher_id}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 px-4 py-4 sm:px-5">
              <h3
                id={`grades-teacher-${group.teacher_id}`}
                className="font-heading text-sm sm:text-base font-semibold text-foreground"
              >
                {group.teacher_name}
              </h3>
              <div className="text-right tabular-nums">
                <p className="text-sm font-semibold text-foreground">
                  {totals.earned} / {totals.possible}{" "}
                  <span className="text-muted-foreground text-xs font-normal">pts</span>
                </p>
                {(totals.percentage === null || showScoreDetails) && (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {totals.percentage === null
                      ? "No points yet"
                      : `${totals.percentage}%`}
                  </p>
                )}
              </div>
            </div>
            <ul className="divide-y divide-border/70">
              {group.activities.map((activity) => {
                const cell = group.row.cells.find((item) => item.activity_id === activity.id);
                if (!cell?.applicable) return null;
                return (
                  <li
                    key={activity.id}
                    id={`parent-grade-${activity.id}`}
                    className={`flex scroll-mt-24 flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5 ${highlightActivityId === activity.id ? "bg-primary/5 ring-primary ring-2 ring-inset" : ""}`}
                  >
                    <div className="min-w-0 flex-1 basis-40 space-y-0.5">
                      <h4 className="font-sans text-sm font-medium text-foreground break-words">
                        {activity.title}
                      </h4>
                      <p className="text-muted-foreground text-xs">
                        {cell.coursework_status === "Draft" ? "Turned in" : cell.coursework_status}
                        {cell.late ? " · Late" : ""}
                        {activity.is_archived ? " · Archived" : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {cell.assessment_composite !== null && (
                          <BandBadge
                            score={Number(cell.assessment_composite)}
                            size="sm"
                            showDot
                          />
                        )}
                        <WorkCommentsButton
                          scope={{ activityId: activity.id, studentId: childId }}
                          activeSubmissionId={cell.active_submission_id}
                        />
                      </div>
                      <p className="text-xs sm:text-sm font-medium tabular-nums text-foreground">
                        {cell.coursework_status === "Excused"
                          ? "Excused"
                          : cell.points_possible === null
                            ? "Feedback only"
                            : cell.final_points === null
                              ? `Pending · ${cell.points_possible} pts`
                              : `${cell.final_points} / ${cell.points_possible} pts`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      </div>
    </section>
  );
}
