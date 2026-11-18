import type { ActivityWorkState } from "../hooks/use-activity-work";

const teacherWorkStatusLabels: Record<ActivityWorkState["work_status"], string> = {
  Assigned: "Assigned",
  Returned: "Returned",
  Missing: "Missing",
  Draft: "Needs review",
  Released: "Shared with parents",
  "Turned in": "Turned in",
  Excused: "Excused",
};

export function teacherWorkStatusLabel(status: ActivityWorkState["work_status"]): string {
  return teacherWorkStatusLabels[status];
}

export interface WorkAttempt {
  id: string;
  status: string;
  created_at: string;
}

export function activityAssignedTo(
  activity: { assignments: { section_id?: string | null; student_id?: string | null }[] },
  student: { id: string; section_id?: string | null }
): boolean {
  return activity.assignments.some(
    (target) =>
      target.student_id === student.id ||
      (!!student.section_id && target.section_id === student.section_id)
  );
}
