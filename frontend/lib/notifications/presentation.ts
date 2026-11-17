import type { NotificationRow } from "./data";
import { commentThreadHref } from "@/lib/comments/targets";

export type NotificationVisualMeta = {
  label: string;
  copy: string;
  description: string;
  containerClass: string;
  dotClass: string;
  iconName:
    | "camera-off"
    | "rotate-ccw"
    | "award"
    | "file-check"
    | "message-square"
    | "book-open"
    | "clock"
    | "alert-circle";
};

export const NOTIFICATION_VISUAL_MAP: Record<NotificationRow["type"], NotificationVisualMeta> = {
  submission_rejected: {
    label: "Photo Needs Retake",
    copy: "Worksheet photo needs a retake",
    description: "Lighting or blur prevented computer vision scanning",
    containerClass: "bg-band-1/10 text-band-1-text border-band-1/30 dark:text-band-1",
    dotClass: "bg-band-1",
    iconName: "camera-off",
  },
  submission_returned: {
    label: "Practice Requested",
    copy: "Another practice attempt requested",
    description: "Teacher shared revision notes on cursive technique",
    containerClass: "bg-band-2/10 text-band-2-text border-band-2/30 dark:text-band-2",
    dotClass: "bg-band-2",
    iconName: "rotate-ccw",
  },
  score_released: {
    label: "Feedback Published",
    copy: "Diagnostic feedback published",
    description: "Handwriting scores and criteria review ready",
    containerClass: "bg-band-4/10 text-band-4-text border-band-4/30 dark:text-band-4",
    dotClass: "bg-band-4",
    iconName: "award",
  },
  resubmitted_after_return: {
    label: "Attempt Submitted",
    copy: "New practice attempt submitted",
    description: "Student submitted revised handwriting practice",
    containerClass: "bg-primary/10 text-primary border-primary/20",
    dotClass: "bg-primary",
    iconName: "file-check",
  },
  comment_posted: {
    label: "Note Shared",
    copy: "New note on worksheet",
    description: "Teacher or parent shared a comment",
    containerClass: "bg-primary/10 text-primary border-primary/20",
    dotClass: "bg-primary",
    iconName: "message-square",
  },
  activity_assigned: {
    label: "Activity Assigned",
    copy: "New cursive activity assigned",
    description: "New worksheet ready for student practice",
    containerClass: "bg-secondary text-secondary-foreground border-border",
    dotClass: "bg-primary",
    iconName: "book-open",
  },
  due_soon: {
    label: "Due Soon",
    copy: "Activity due soon",
    description: "Worksheet deadline is approaching",
    containerClass: "bg-band-2/10 text-band-2-text border-band-2/30 dark:text-band-2",
    dotClass: "bg-band-2",
    iconName: "clock",
  },
  activity_missing: {
    label: "Submission Overdue",
    copy: "Worksheet submission overdue",
    description: "Activity is past the scheduled due date",
    containerClass: "bg-band-1/10 text-band-1-text border-band-1/30 dark:text-band-1",
    dotClass: "bg-band-1",
    iconName: "alert-circle",
  },
};

export function notificationCopy(type: NotificationRow["type"]): string {
  return NOTIFICATION_VISUAL_MAP[type]?.copy ?? "Activity update";
}

export function notificationMeta(type: NotificationRow["type"]): NotificationVisualMeta {
  return (
    NOTIFICATION_VISUAL_MAP[type] ?? {
      label: "Activity Update",
      copy: "Activity update",
      description: "Classroom handwriting activity notification",
      containerClass: "bg-secondary text-secondary-foreground border-border",
      dotClass: "bg-primary",
      iconName: "book-open",
    }
  );
}

export function notificationHref(row: NotificationRow, role: "teacher" | "parent"): string {
  if (row.type === "comment_posted") {
    if (!row.submission_id) return role === "teacher" ? `/activities/${row.activity_id}` : "/progress";
    return commentThreadHref(
      { activityId: row.activity_id, studentId: row.student_id, submissionId: row.submission_id },
      role
    );
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
