"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useChildGradebook } from "@/lib/hooks/use-gradebook";
import { useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import { hasUnreadWorkComments } from "@/lib/comments/selection";
import { BandBadge } from "@/components/shared/band-badge";
import { QueryRecovery } from "@/components/shared/query-recovery";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkCommentsButton } from "@/components/comments/submission-comment-picker-sheet";
import type { GradebookCell } from "@/lib/hooks/use-gradebook";

function formatPointsValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(num);
}

function formatCourseworkStatus(status: GradebookCell["coursework_status"]): string {
  switch (status) {
    case "Draft":
      return "Turned in";
    case "Returned":
      return "New photo requested";
    case "Missing":
      return "Awaiting photo";
    default:
      return status;
  }
}

function formatCellPoints(cell: GradebookCell): string {
  if (cell.coursework_status === "Excused") return "Excused";
  if (cell.points_possible === null) return "Not a graded activity";
  const possible = formatPointsValue(cell.points_possible);
  if (cell.final_points !== null) {
    return `${formatPointsValue(cell.final_points)} / ${possible} pts`;
  }
  if (
    cell.coursework_status === "Assigned" ||
    cell.coursework_status === "Missing" ||
    cell.coursework_status === "Returned"
  ) {
    return `${possible} pts possible`;
  }
  return `Not yet released · ${possible} pts`;
}

export function ParentGrades({
  userId,
  childId,
  childName,
  showScoreDetails = true,
  highlightActivityId,
  onDismissTarget,
  onInspectActivity,
}: {
  userId: string;
  childId: string;
  childName?: string;
  showScoreDetails?: boolean;
  highlightActivityId?: string;
  onDismissTarget?: () => void;
  onInspectActivity?: (target: { activityId: string; submissionId: string | null }) => void;
}) {
  const query = useChildGradebook(userId, childId, true);
  const unread = useUnreadCommentThreads(userId);
  const highlightedRowRef = useRef<HTMLLIElement | null>(null);

  const applicableGroups = useMemo(() => {
    if (!query.data || query.data.student_id !== childId) return [];
    return query.data.groups.filter((group) =>
      group.row.cells.some((cell) => cell.applicable)
    );
  }, [query.data, childId]);

  const hasHighlightMatch = useMemo(
    () =>
      Boolean(
        highlightActivityId &&
          applicableGroups.some((group) =>
            group.row.cells.some(
              (cell) => cell.activity_id === highlightActivityId && cell.applicable
            )
          )
      ),
    [highlightActivityId, applicableGroups]
  );

  useEffect(() => {
    if (hasHighlightMatch && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ block: "center" });
      highlightedRowRef.current.focus({ preventScroll: true });
    }
  }, [hasHighlightMatch, highlightActivityId]);

  if (!query.isAccountActive) {
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
        <div className="rounded-xl border border-border bg-card p-6">
          <p role="status" className="text-muted-foreground text-sm">
            Sign in again to view grades.
          </p>
        </div>
      </section>
    );
  }

  if (query.isError) {
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
        <QueryRecovery
          title="Grades could not be loaded"
          description="Try again to see the latest released grades."
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      </section>
    );
  }

  if (!query.data || query.data.student_id !== childId) {
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
        <div
          role="status"
          aria-label="Loading grades"
          className="bg-card overflow-hidden rounded-xl border border-border"
        >
          <div className="flex items-center justify-between gap-4 border-b border-border/80 px-4 py-4 sm:px-5">
            <Skeleton className="h-5 w-36 rounded-md" />
            <Skeleton className="h-5 w-24 rounded-md" />
          </div>
          <div className="divide-y divide-border/70 px-4 sm:px-5">
            <div className="py-4">
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
            <div className="py-4">
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
            <div className="py-4">
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  const missingHighlightBanner =
    highlightActivityId && !hasHighlightMatch ? (
      <Alert className="bg-card border-border">
        <AlertTitle>This grade is no longer available</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>The activity may have been removed or access may have changed.</span>
          {onDismissTarget && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDismissTarget}
              className="h-10 min-h-10 sm:h-9 sm:min-h-9 cursor-pointer touch-manipulation"
            >
              Dismiss
            </Button>
          )}
        </AlertDescription>
      </Alert>
    ) : null;

  if (applicableGroups.length === 0) {
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
        {missingHighlightBanner}
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
  }

  return (
    <section
      id="coursework-section"
      aria-labelledby="coursework-heading"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="coursework-heading"
          className="font-heading text-base sm:text-lg font-semibold text-foreground"
        >
          Coursework
        </h2>
        {hasHighlightMatch && onDismissTarget && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDismissTarget}
            className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Clear highlight
          </Button>
        )}
      </div>
      {missingHighlightBanner}
      <div className="space-y-4">
        {applicableGroups.map((group) => {
          const totals = group.row.totals;
          const hasPointTotals = totals.percentage !== null;
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
                  {hasPointTotals ? (
                    <>
                      <p className="text-sm font-semibold text-foreground">
                        {formatPointsValue(totals.earned)} / {formatPointsValue(totals.possible)}{" "}
                        <span className="text-muted-foreground text-xs font-normal">pts</span>
                      </p>
                      {showScoreDetails && (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {formatPointsValue(totals.percentage)}%
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-xs font-medium">
                      No points released yet
                    </p>
                  )}
                </div>
              </div>
              <ul className="divide-y divide-border/70">
                {group.activities.map((activity) => {
                  const cell = group.row.cells.find((item) => item.activity_id === activity.id);
                  if (!cell?.applicable) return null;
                  const isHighlighted = highlightActivityId === activity.id;
                  const hasUnread = hasUnreadWorkComments(unread.data, {
                    activityId: activity.id,
                    studentId: childId,
                  });
                  const canShowComments = cell.active_submission_id !== null || hasUnread;
                  const statusText = `${formatCourseworkStatus(cell.coursework_status)}${cell.late ? " · Late" : ""}${activity.is_archived ? " · Archived" : ""}`;

                  return (
                    <li
                      key={activity.id}
                      id={`parent-grade-${activity.id}`}
                      ref={isHighlighted ? highlightedRowRef : undefined}
                      tabIndex={isHighlighted ? -1 : undefined}
                      className={`flex scroll-mt-24 flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5 focus:outline-none ${isHighlighted ? "bg-primary/5 ring-primary ring-2 ring-inset" : ""}`}
                    >
                      {onInspectActivity ? (
                        <button
                          type="button"
                          onClick={() =>
                            onInspectActivity({
                              activityId: activity.id,
                              submissionId: cell.active_submission_id,
                            })
                          }
                          className="group min-w-0 flex-1 basis-40 text-left space-y-0.5 rounded-md py-0.5 -mx-1.5 px-1.5 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer touch-manipulation transition-colors"
                          aria-label={`View worksheet details for ${activity.title}`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h4 className="font-sans text-sm font-medium text-foreground break-words group-hover:text-primary transition-colors">
                              {activity.title}
                            </h4>
                            <ChevronRight
                              className="size-3.5 shrink-0 text-muted-foreground/70 group-hover:text-primary group-hover:translate-x-0.5 transition-all"
                              aria-hidden="true"
                            />
                          </div>
                          <p className="text-muted-foreground text-xs">{statusText}</p>
                        </button>
                      ) : (
                        <div className="min-w-0 flex-1 basis-40 space-y-0.5">
                          <h4 className="font-sans text-sm font-medium text-foreground break-words">
                            {activity.title}
                          </h4>
                          <p className="text-muted-foreground text-xs">{statusText}</p>
                        </div>
                      )}

                      <div className="flex flex-col items-end gap-1.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {cell.assessment_composite !== null && (
                            <div className="flex items-center gap-1.5">
                              {showScoreDetails && (
                                <span className="font-sans text-xs font-semibold tabular-nums text-foreground">
                                  {Math.round(Number(cell.assessment_composite))}%
                                </span>
                              )}
                              <BandBadge
                                score={Number(cell.assessment_composite)}
                                size="sm"
                                showDot
                              />
                            </div>
                          )}
                          {canShowComments && (
                            <WorkCommentsButton
                              scope={{ activityId: activity.id, studentId: childId }}
                              activeSubmissionId={cell.active_submission_id}
                              studentName={childName}
                              activityTitle={activity.title}
                              hasUnread={hasUnread}
                            />
                          )}
                        </div>
                        <p className="text-xs sm:text-sm font-medium tabular-nums text-foreground">
                          {formatCellPoints(cell)}
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
