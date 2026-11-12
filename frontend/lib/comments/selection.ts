import { compareCommentTimestamps } from "./data";
import type { CommentAttempt, CommentLocation, CommentThread, UnreadCommentThreads, WorkCommentScope } from "./types";

export function selectCommentAttempt(
  rows: CommentAttempt[], activeSubmissionId: string | null, explicitSubmissionId?: string
): CommentAttempt | null {
  if (explicitSubmissionId) return rows.find(row => row.submission_id === explicitSubmissionId) ?? null;
  const active = rows.find(row => row.submission_id === activeSubmissionId);
  if (active) return active;
  return [...rows].sort((a, b) => compareCommentTimestamps(b.submitted_at, a.submitted_at) ||
    b.submission_id.localeCompare(a.submission_id))[0] ?? null;
}

export function matchesCommentLocation(thread: CommentThread, location: CommentLocation): boolean {
  return thread.submission_id === location.submissionId && thread.activity_id === location.activityId &&
    thread.student_id === location.studentId;
}

export function hasUnreadWorkComments(notices: UnreadCommentThreads | undefined, scope: WorkCommentScope): boolean {
  return !!notices && [...notices.values()].some(notice =>
    notice.activity_id === scope.activityId && notice.student_id === scope.studentId);
}
