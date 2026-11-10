import type { NotificationRow } from "./data";
import { commentThreadHref } from "@/lib/comments/targets";

const COPY: Record<NotificationRow["type"], string> = {
  activity_assigned: "New activity assigned",
  due_soon: "Activity due soon",
  submission_returned: "Another attempt requested",
  submission_rejected: "Photo needs another upload",
  score_released: "Result shared",
  activity_missing: "Activity is missing",
  resubmitted_after_return: "New attempt after Return",
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
