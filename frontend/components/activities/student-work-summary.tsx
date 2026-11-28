"use client";

import { ActivityWorkStatus } from "@/components/activities/activity-work-status";
import { WorkCommentsButton } from "@/components/comments/submission-comment-picker-sheet";
import { StudentWorkControls } from "@/components/submissions/submission-lifecycle-controls";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityWorkState } from "@/lib/hooks/use-activity-work";
import type { Submission } from "@/lib/hooks/use-submissions";

export function StudentWorkSummary({
  activityId,
  studentId,
  studentName,
  state,
  attempts,
  isLoading,
  compact = false,
  isScored,
  hideDraftPending = false,
}: {
  activityId: string;
  studentId: string;
  studentName: string;
  state: ActivityWorkState | null;
  attempts: Submission[];
  isLoading: boolean;
  compact?: boolean;
  isScored?: boolean;
  hideDraftPending?: boolean;
}) {
  return (
    <div className={compact ? "flex items-center min-w-0" : "flex flex-col gap-3"}>
      {state ? (
        <ActivityWorkStatus state={state} isScored={isScored} hideDraftPending={hideDraftPending} />
      ) : isLoading ? (
        <Skeleton className="h-5 w-24" aria-label="Loading work status" />
      ) : (
        <ActivityWorkStatus state={null} unavailable />
      )}
      {!compact && (
        <div className="flex flex-wrap gap-2">
          {attempts.length > 0 && (
            <WorkCommentsButton
              scope={{ activityId, studentId }}
              activeSubmissionId={state?.active_submission_id ?? null}
              studentName={studentName}
            />
          )}
          <StudentWorkControls
            activityId={activityId}
            studentId={studentId}
            studentName={studentName}
            state={state}
            attempts={attempts}
          />
        </div>
      )}
    </div>
  );
}
