import type { ActivityWorkState } from "@/lib/hooks/use-activity-work";
import type { Submission } from "@/lib/hooks/use-submissions";
import { resolveSubmissionScore } from "@/lib/utils/submission-status";

export const reviewFilterLabels = {
  all: "All work",
  needs_scoring: "Needs scoring",
  ready: "Ready to release",
  needs_upload: "Needs an upload",
  missing: "Missing",
  returned: "Returned",
  processing: "Processing",
  released: "Released",
  excused: "Excused",
  no_upload: "Never uploaded",
} as const;

export const reviewFilterHelp: Partial<Record<keyof typeof reviewFilterLabels, string>> = {
  needs_upload:
    "Includes students who have never uploaded, need to replace a rejected or returned worksheet, or have missing work.",
  no_upload: "Students with no upload history for this activity, including excused work.",
};

export type ReviewFilter = keyof typeof reviewFilterLabels;

export function matchesReviewFilter(
  submission: Submission | null,
  state: ActivityWorkState | null,
  filter: ReviewFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "no_upload") return !submission;
  if (filter === "processing") return submission?.status === "processing";
  if (filter === "excused") return state?.work_status === "Excused";
  if (state?.excused || state?.work_status === "Excused") return false;
  if (filter === "needs_scoring")
    return (
      submission?.status === "completed" &&
      state?.active_submission_id === submission.id &&
      !resolveSubmissionScore(submission).isScored
    );
  if (filter === "ready")
    return (
      !!submission &&
      state?.active_submission_id === submission.id &&
      state.work_status === "Draft" &&
      resolveSubmissionScore(submission).isScored
    );
  if (filter === "needs_upload")
    return (
      !submission ||
      submission.status === "rejected" ||
      submission.status === "returned" ||
      state?.work_status === "Missing" ||
      state?.work_status === "Returned"
    );
  // Historical attempts must not inherit the current attempt's publication state.
  if (filter === "released")
    return (
      !!submission &&
      state?.active_submission_id === submission.id &&
      state.work_status === "Released"
    );
  return state?.work_status === reviewFilterLabels[filter];
}

export function activityReviewQuery(params: { get: (key: string) => string | null }): string {
  const result = new URLSearchParams();
  for (const key of ["q", "status", "sort", "group", "layout"]) {
    const value = params.get(key);
    if (value) result.set(key, value);
  }
  return result.size ? `?${result}` : "";
}
