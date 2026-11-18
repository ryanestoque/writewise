"use client";

import { ActivityWorkStatus } from "@/components/activities/activity-work-status";
import { WorkCommentsButton } from "@/components/comments/submission-comment-picker-sheet";
import { StudentWorkControls } from "@/components/submissions/submission-lifecycle-controls";
import type { ActivityWorkState } from "@/lib/hooks/use-activity-work";
import type { Submission } from "@/lib/hooks/use-submissions";

export function StudentWorkSummary({
  activityId,
  studentId,
  studentName,
  state,
  attempts,
  isLoading,
}: {
  activityId: string;
  studentId: string;
  studentName: string;
  state: ActivityWorkState | null;
  attempts: Submission[];
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {state ? (
        <ActivityWorkStatus state={state} />
      ) : (
        <p className="text-muted-foreground text-xs" role="status">
          {isLoading ? "Loading work status…" : "Work status unavailable"}
        </p>
      )}
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
    </div>
  );
}
