import type { NotificationRow } from "./data";
import { commentThreadHref } from "@/lib/comments/targets";

const COPY: Record<NotificationRow["type"], string> = {
  activity_assigned: "New handwriting activity assigned",
  due_soon: "Handwriting activity due soon",
  submission_returned: "Teacher requested another practice attempt",
  submission_rejected: "Worksheet photo unclear: Tap for retake tips",
  score_released: "Handwriting assessment ready",
  activity_missing: "Pending worksheet: Ready for submission",
  resubmitted_after_return: "New cursive worksheet submitted",
  comment_posted: "New private comment",
};

export function notificationCopy(type: NotificationRow["type"]): string {
  return COPY[type];
}

export function notificationHref(row: NotificationRow, role: "teacher" | "parent"): string {
  if (row.type === "comment_posted") {
    if (!row.submission_id) return role === "teacher" ? `/activities/${row.activity_id}` : "/progress";
    return commentThreadHref({ activityId: row.activity_id, studentId: row.student_id, submissionId: row.submission_id }, role);
  }
  if (role === "teacher")
    return row.submission_id
      ? `/activities/${row.activity_id}/submissions/${row.submission_id}`
      : `/activities/${row.activity_id}`;
  const params = new URLSearchParams({ child: row.student_id, activity: row.activity_id });
  if (row.submission_id) params.set("submission", row.submission_id);
  if (row.type === "score_released" && !row.submission_id) params.set("tab", "grades");
  return `/progress?${params}`;
}
