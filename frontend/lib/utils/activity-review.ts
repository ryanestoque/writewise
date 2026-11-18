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

export function needsReviewAttention(
  workStatus?: string,
  latestUploadStatus?: string,
  hasNewerCompletedUpload = false
) {
  if (workStatus === "Excused") return false;
  return (
    (latestUploadStatus === "completed" && hasNewerCompletedUpload) ||
    latestUploadStatus === "rejected" ||
    latestUploadStatus === "returned" ||
    (workStatus !== undefined && workStatus !== "Released")
  );
}

export type ReviewFilter =
  "all" | "attention" | "awaiting" | "completed" | "processing" | "rejected" | "returned";
export type ReviewSort =
  "attention" | "newest" | "oldest" | "name_asc" | "name_desc" | "score_desc";
export type ReviewView = "attention" | "awaiting" | "all";
export type UploadFilter = Exclude<ReviewFilter, "attention" | "awaiting">;

export interface ReviewQueueState {
  searchQuery: string;
  statusFilter: ReviewView;
  uploadFilter: UploadFilter;
  sortBy: ReviewSort;
}

const queueKeys = ["q", "workView", "upload", "sort"] as const;

export function readReviewQueue(params: Pick<URLSearchParams, "get">): ReviewQueueState {
  const view = params.get("workView");
  const upload = params.get("upload");
  const sort = params.get("sort");
  const statusFilter = view === "all" || view === "awaiting" ? view : "attention";
  return {
    searchQuery: params.get("q") ?? "",
    statusFilter,
    // Awaiting a first upload and filtering an existing upload are mutually exclusive.
    uploadFilter:
      statusFilter !== "awaiting" &&
      (upload === "completed" ||
        upload === "processing" ||
        upload === "rejected" ||
        upload === "returned")
        ? upload
        : "all",
    sortBy:
      sort === "newest" ||
      sort === "oldest" ||
      sort === "name_asc" ||
      sort === "name_desc" ||
      sort === "score_desc"
        ? sort
        : "attention",
  };
}

/** Preserve unrelated parameters, including conversation links, when controls change. */
export function updateReviewQueue(params: URLSearchParams, patch: Partial<ReviewQueueState>) {
  const state = { ...readReviewQueue(params), ...patch };
  if (patch.statusFilter === "awaiting") state.uploadFilter = "all";
  else if (
    patch.uploadFilter &&
    patch.uploadFilter !== "all" &&
    state.statusFilter === "awaiting"
  ) {
    state.statusFilter = "all";
  }
  const next = new URLSearchParams(params);
  queueKeys.forEach((key) => next.delete(key));
  if (state.searchQuery) next.set("q", state.searchQuery);
  if (state.statusFilter !== "attention") next.set("workView", state.statusFilter);
  if (state.uploadFilter !== "all") next.set("upload", state.uploadFilter);
  if (state.sortBy !== "attention") next.set("sort", state.sortBy);
  return next;
}

/** Carry only queue controls to worksheet routes; never carry a conversation destination. */
export function reviewQueueQuery(params: Pick<URLSearchParams, "get">) {
  const next = updateReviewQueue(new URLSearchParams(), readReviewQueue(params));
  for (const key of ["group", "status", "layout"]) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `?${query}` : "";
}

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
  const stateMap = new Map(states.map((state) => [state.student_id, state]));
  const attemptsMap = new Map<string, Submission[]>();
  for (const submission of submissions) {
    const attempts = attemptsMap.get(submission.student_id) ?? [];
    attempts.push(submission);
    attemptsMap.set(submission.student_id, attempts);
  }
  return students.map((student) => {
    const state = stateMap.get(student.id);
    const attempts = [...(attemptsMap.get(student.id) ?? [])].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
    );
    const latest = attempts[0];
    const counted = attempts.find((attempt) => attempt.id === state?.active_submission_id);
    return {
      student,
      state,
      attempts,
      latest,
      counted,
      selected: state ? selectReviewAttempt(attempts, state.active_submission_id) : undefined,
      attention:
        !state ||
        needsReviewAttention(
          state.work_status,
          latest?.status,
          !!counted &&
            !!latest &&
            latest.id !== counted.id &&
            Date.parse(latest.created_at) > Date.parse(counted.created_at)
        ),
    };
  });
}

export function filterReviewRows(rows: ActivityReviewRow[], filter: ReviewFilter, search = "") {
  const query = search.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    if (query && !row.student.full_name.toLocaleLowerCase().includes(query)) return false;
    if (filter === "all") return true;
    if (filter === "attention") return row.attention;
    if (filter === "awaiting")
      return !!row.state && row.state.work_status !== "Excused" && !row.latest;
    // Upload filters always describe the latest upload, never an older official result.
    return row.latest?.status === filter;
  });
}

export function countReviewRows(rows: ActivityReviewRow[]) {
  const filters: ReviewFilter[] = [
    "all",
    "attention",
    "awaiting",
    "completed",
    "processing",
    "rejected",
    "returned",
  ];
  return Object.fromEntries(
    filters.map((filter) => [filter, filterReviewRows(rows, filter).length])
  ) as Record<ReviewFilter, number>;
}

/** The workspace and worksheet traversal must use identical filters and ordering. */
export function getReviewQueueRows(
  rows: ActivityReviewRow[],
  state: ReviewQueueState,
  scoreFor: (submission: Submission | undefined) => number | null
) {
  return sortReviewRows(
    filterReviewRows(
      filterReviewRows(rows, state.uploadFilter),
      state.statusFilter,
      state.searchQuery
    ),
    state.sortBy,
    scoreFor
  );
}

/** One destination per student, retaining the open attempt within that student's slot. */
export function getReviewNavigation(
  rows: ActivityReviewRow[],
  current: Submission | undefined,
  studentOrder: string[]
): Submission[] {
  if (!current || !studentOrder.includes(current.student_id)) return [];
  const byStudent = new Map(rows.map((row) => [row.student.id, row]));
  return [...new Set(studentOrder)].flatMap((studentId) => {
    const row = byStudent.get(studentId);
    if (!row) return [];
    const attempt = studentId === current.student_id ? current : row.selected;
    return attempt ? [attempt] : [];
  });
}

export function getAttemptReviewNavigation(
  rows: ActivityReviewRow[],
  group: "grouped" | "all",
  search: string,
  sort: ReviewSort,
  matches: (submission: Submission, row: ActivityReviewRow) => boolean,
  scoreFor: (submission: Submission) => number | null
): Submission[] {
  const query = search.trim().toLocaleLowerCase();
  return rows.flatMap(row => {
    if (!row.student.full_name.toLocaleLowerCase().includes(query)) return [];
    const attempts = group === "all" ? row.attempts : row.selected ? [row.selected] : [];
    return attempts.filter(attempt => matches(attempt, row)).map(attempt => ({ attempt, name: row.student.full_name }));
  }).sort((a, b) => {
    if (sort === "name_asc") return a.name.localeCompare(b.name);
    if (sort === "name_desc") return b.name.localeCompare(a.name);
    if (sort === "score_desc") return (scoreFor(b.attempt) ?? -1) - (scoreFor(a.attempt) ?? -1);
    const date = Date.parse(a.attempt.created_at) - Date.parse(b.attempt.created_at);
    return sort === "oldest" ? date : -date;
  }).map(item => item.attempt);
}

export function sortReviewRows(
  rows: ActivityReviewRow[],
  sort: ReviewSort,
  scoreFor: (submission: Submission | undefined) => number | null
) {
  return [...rows].sort((a, b) => {
    const byName = a.student.full_name.localeCompare(b.student.full_name);
    if (sort === "attention") return reviewPriority(a) - reviewPriority(b) || byName;
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

function reviewPriority(row: ActivityReviewRow) {
  if (!row.attention) return 5;
  if (!row.state) return 4;
  if (row.latest?.status === "completed") return 0;
  if (row.latest?.status === "rejected" || row.latest?.status === "returned") return 1;
  if (!row.latest) return 2;
  return 3;
}
