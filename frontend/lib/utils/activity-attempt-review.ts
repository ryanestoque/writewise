import type { Submission } from "../hooks/use-submissions";
import type { ActivityWorkState } from "../hooks/use-activity-work";
import { resolveSubmissionScore } from "./submission-status";

export const reviewFilterLabels = {
  all: "All work",
  needs_action: "Needs action",
  needs_scoring: "Needs scoring",
  ready: "Ready to release",
  needs_upload: "Needs an upload",
  missing: "Missing",
  returned: "Returned",
  processing: "Processing",
  released: "Released",
  excused: "Excused",
  no_upload: "Never uploaded",
  unread_comments: "Unread comments",
} as const;

export const reviewFilterHelp: Partial<Record<keyof typeof reviewFilterLabels, string>> = {
  needs_action:
    "Students with pending uploads, missing work, returned worksheets, or unreviewed submissions.",
  needs_upload:
    "Includes students who have never uploaded, need to replace a rejected or returned worksheet, or have missing work.",
  no_upload: "Students with no upload history for this activity, including excused work.",
  unread_comments: "Students who have unread private comments from parents or teachers.",
};

export type LegacyReviewFilter = keyof typeof reviewFilterLabels;

export function matchesReviewFilter(
  submission: Submission | null,
  state: ActivityWorkState | null,
  filter: LegacyReviewFilter,
  unreadSubmissionIds?: Set<string>
): boolean {
  if (filter === "all") return true;
  if (filter === "unread_comments") {
    return !!submission && !!unreadSubmissionIds?.has(submission.id);
  }
  if (filter === "needs_action") {
    return (
      matchesReviewFilter(submission, state, "needs_scoring", unreadSubmissionIds) ||
      matchesReviewFilter(submission, state, "ready", unreadSubmissionIds) ||
      matchesReviewFilter(submission, state, "needs_upload", unreadSubmissionIds) ||
      matchesReviewFilter(submission, state, "missing", unreadSubmissionIds) ||
      matchesReviewFilter(submission, state, "returned", unreadSubmissionIds)
    );
  }
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
  if (filter === "missing")
    return (
      (!submission ||
        state?.work_status === "Missing" ||
        state?.work_status === "Assigned" ||
        (!state?.active_submission_id && submission?.status === "rejected")) &&
      submission?.status !== "processing" &&
      submission?.status !== "completed"
    );
  return state?.work_status === reviewFilterLabels[filter];
}
