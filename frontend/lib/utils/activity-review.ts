import type { Student } from "../hooks/use-students";
import type { Submission } from "../hooks/use-submissions";
import type { ActivityWorkState } from "../hooks/use-activity-work";

/** Keep the classroom's counted result stable while newer uploads are reviewed. */
export function selectReviewAttempt<T extends { id: string; created_at: string }>(
  attempts: T[],
  countedId: string | null | undefined
): T | undefined {
  return (
    attempts.find((attempt) => attempt.id === countedId) ??
    attempts.reduce<T | undefined>(
      (latest, attempt) =>
        !latest || Date.parse(attempt.created_at) > Date.parse(latest.created_at)
          ? attempt
          : latest,
      undefined
    )
  );
}

export function needsReviewAttention(workStatus?: string, latestUploadStatus?: string, hasNewerCompletedUpload = false) {
  if (workStatus === "Excused") return false;
  return (
    (latestUploadStatus === "completed" && hasNewerCompletedUpload) ||
    latestUploadStatus === "rejected" ||
    latestUploadStatus === "returned" ||
    (workStatus !== undefined && workStatus !== "Released")
  );
}

export type ReviewFilter = "all" | "attention" | "awaiting" | "completed" | "processing" | "rejected" | "returned";
export type ReviewSort = "attention" | "newest" | "oldest" | "name_asc" | "name_desc" | "score_desc";

export interface ActivityReviewRow {
  student: Student;
  state: ActivityWorkState | undefined;
  attempts: Submission[];
  latest: Submission | undefined;
  counted: Submission | undefined;
  selected: Submission | undefined;
  attention: boolean;
}

/** Both layouts use the assigned roster, including students without uploads. */
export function buildReviewRows(
  students: Student[],
  submissions: Submission[],
  states: ActivityWorkState[]
): ActivityReviewRow[] {
  const stateMap = new Map(states.map(state => [state.student_id, state]));
  const attemptsMap = new Map<string, Submission[]>();
  for (const submission of submissions) {
    const attempts = attemptsMap.get(submission.student_id) ?? [];
    attempts.push(submission);
    attemptsMap.set(submission.student_id, attempts);
  }
  return students.map(student => {
    const state = stateMap.get(student.id);
    const attempts = [...(attemptsMap.get(student.id) ?? [])].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
    );
    const latest = attempts[0];
    const counted = attempts.find(attempt => attempt.id === state?.active_submission_id);
    return {
      student, state, attempts, latest, counted,
      selected: state ? selectReviewAttempt(attempts, state.active_submission_id) : undefined,
      attention: !state || needsReviewAttention(
        state.work_status,
        latest?.status,
        !!counted && !!latest && latest.id !== counted.id &&
          Date.parse(latest.created_at) > Date.parse(counted.created_at)
      ),
    };
  });
}

export function filterReviewRows(rows: ActivityReviewRow[], filter: ReviewFilter, search = "") {
  const query = search.trim().toLocaleLowerCase();
  return rows.filter(row => {
    if (query && !row.student.full_name.toLocaleLowerCase().includes(query)) return false;
    if (filter === "all") return true;
    if (filter === "attention") return row.attention;
    if (filter === "awaiting") return !!row.state && row.state.work_status !== "Excused" && !row.latest;
    // Upload filters always describe the latest upload, never an older official result.
    return row.latest?.status === filter;
  });
}

export function countReviewRows(rows: ActivityReviewRow[]) {
  const filters: ReviewFilter[] = ["all", "attention", "awaiting", "completed", "processing", "rejected", "returned"];
  return Object.fromEntries(filters.map(filter => [filter, filterReviewRows(rows, filter).length])) as Record<ReviewFilter, number>;
}

export function sortReviewRows(
  rows: ActivityReviewRow[],
  sort: ReviewSort,
  scoreFor: (submission: Submission | undefined) => number | null
) {
  return [...rows].sort((a, b) => {
    const byName = a.student.full_name.localeCompare(b.student.full_name);
    if (sort === "attention") return Number(b.attention) - Number(a.attention) || byName;
    if (sort === "name_asc") return byName;
    if (sort === "name_desc") return -byName;
    if (sort === "score_desc") {
      return (scoreFor(b.counted) ?? -1) - (scoreFor(a.counted) ?? -1) || byName;
    }
    if (!a.latest || !b.latest) return Number(!!b.latest) - Number(!!a.latest) || byName;
    const byDate = Date.parse(a.latest.created_at) - Date.parse(b.latest.created_at);
    return (sort === "oldest" ? byDate : -byDate) || byName;
  });
}
