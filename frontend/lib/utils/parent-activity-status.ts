import type { TakeHomeActivity } from "@/lib/hooks/use-parent-data";
import { activitySubmissionsClosed } from "./activity-deadlines";

const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

/** Keep the task count, priority prompt, and activity cards on the same state. */
export function getParentActivityStatus(work: TakeHomeActivity, now: number) {
  const submission = work.submission ?? work.latestSubmission;
  const excused = work.workState?.work_status === "Excused";
  const closed = activitySubmissionsClosed(
    { due_at: work.dueAt, close_after_due: work.closeAfterDue },
    now
  );
  const processing =
    submission?.status === "processing" || work.latestSubmission?.status === "processing";
  const returned =
    submission?.status === "returned" ||
    Boolean(work.workState?.returned_at && !work.workState.active_submission_id);
  const rejected = submission?.status === "rejected";
  const needsPhoto = !processing && (!submission || returned || rejected);
  const canSend = needsPhoto && !closed;
  const dueTime = work.dueAt ? Date.parse(work.dueAt) : Number.POSITIVE_INFINITY;
  const urgency = !canSend || excused
    ? null
    : returned || rejected
      ? "new_photo"
      : dueTime < now
        ? "overdue"
        : dueTime <= now + TWO_DAYS_MS
          ? "due_soon"
          : null;

  return {
    closed,
    processing,
    returned,
    rejected,
    excused,
    canSend,
    // A completed counted attempt remains submitted even after its deadline.
    category: excused ? "submitted" : processing ? "processing" : needsPhoto ? (closed ? "closed" : "todo") : "submitted",
    urgency,
    dueTime,
  } as const;
}

export function compareParentActivityUrgency(
  a: TakeHomeActivity,
  b: TakeHomeActivity,
  now: number
) {
  const first = getParentActivityStatus(a, now);
  const second = getParentActivityStatus(b, now);
  const rank = { new_photo: 0, overdue: 1, due_soon: 2 };
  const difference = (first.urgency ? rank[first.urgency] : 3) -
    (second.urgency ? rank[second.urgency] : 3);
  if (difference !== 0) return difference;
  if (first.urgency && second.urgency && first.dueTime !== second.dueTime) {
    return first.dueTime - second.dueTime;
  }
  return 0;
}
