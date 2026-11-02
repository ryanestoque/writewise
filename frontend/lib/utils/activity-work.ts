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
