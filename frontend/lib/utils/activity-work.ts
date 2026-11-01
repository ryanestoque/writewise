export interface WorkAttempt {
  id: string;
  status: string;
  created_at: string;
}

export function deriveActivityWorkStatus(
  dueAt: string | null,
  now: number,
  attempts: WorkAttempt[]
) {
  const completed = attempts
    .filter((s) => s.status === "completed")
    .sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id)
    )[0];
  return {
    status: completed ? "Turned in" : dueAt && now > Date.parse(dueAt) ? "Missing" : "Assigned",
    late: !!completed && !!dueAt && Date.parse(completed.created_at) > Date.parse(dueAt),
  };
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
