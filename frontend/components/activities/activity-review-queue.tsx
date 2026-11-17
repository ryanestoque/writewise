"use client";

import Link from "next/link";
import type { Submission } from "@/lib/hooks/use-submissions";
import type { ActivityReviewRow } from "@/lib/utils/activity-review";
import { ActivityWorkStatus } from "./activity-work-status";
import { WorksheetHistory } from "./worksheet-history";
import {
  StudentWorkControls,
} from "@/components/submissions/submission-lifecycle-controls";
import { WorkCommentsButton } from "@/components/comments/submission-comment-picker-sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getRejectionSummary, resolveSubmissionScore } from "@/lib/utils/submission-status";
import { formatActivityDueAt } from "@/lib/utils/activity-deadlines";

const attemptDate = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function AttemptIdentity({ label, submission }: { label: string; submission: Submission }) {
  return (
    <p className="text-muted-foreground text-xs">
      {label} ·{" "}
      <time dateTime={submission.created_at}>
        {attemptDate.format(new Date(submission.created_at))}
      </time>
    </p>
  );
}

function AttemptScore({ label, submission }: { label: string; submission: Submission }) {
  const { compositeScore, scoreBand } = resolveSubmissionScore(submission);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {compositeScore != null ? (
        <Badge variant="outline" className={scoreBand.className}>
          <span className="tabular-nums">{Math.round(compositeScore)}%</span>
          <span aria-hidden="true">·</span>
          {scoreBand.band}
        </Badge>
      ) : (
        <span className="text-muted-foreground">Not scored yet</span>
      )}
    </div>
  );
}

export function ActivityReviewQueue({
  activityId,
  queueQuery = "",
  rows,
  assignedStudentCount,
  rosterLoading,
  rosterError,
  workError,
  workLoading,
  uploadsLoading,
  uploadsError,
  searchQuery,
  emptyMessage,
  onClearUploadFilter,
  onClearFilters,
  onRetryRoster,
  onRetryWork,
  onRetryUploads,
  onUpload,
  onEdit,
}: {
  activityId: string;
  queueQuery?: string;
  rows: ActivityReviewRow[];
  assignedStudentCount: number;
  rosterLoading: boolean;
  rosterError: boolean;
  workError: boolean;
  workLoading: boolean;
  uploadsLoading: boolean;
  uploadsError: boolean;
  searchQuery: string;
  emptyMessage?: string;
  onClearUploadFilter?: () => void;
  onClearFilters: () => void;
  onRetryRoster: () => void;
  onRetryWork: () => void;
  onRetryUploads: () => void;
  onUpload: (studentId: string) => void;
  onEdit: () => void;
}) {
  return (
    <div aria-labelledby="submissions-heading" className="flex flex-col gap-4">
      {rosterError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          Could not refresh assigned students. Completion counts are unavailable.
          <Button className="min-h-11 sm:min-h-9" variant="outline" onClick={onRetryRoster}>
            Retry students
          </Button>
        </div>
      ) : rosterLoading ? (
        <p role="status" className="text-sm text-muted-foreground">Loading assigned students…</p>
      ) : !assignedStudentCount ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground text-sm">
            No students are assigned to this activity.
          </p>
          <Button className="min-h-11 sm:min-h-9" variant="outline" onClick={onEdit}>
            Choose students or sections
          </Button>
        </div>
      ) : null}

      {workError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          Could not refresh work status.
          <Button className="min-h-11 sm:min-h-9" variant="outline" onClick={onRetryWork}>
            Retry work status
          </Button>
        </div>
      )}

      {uploadsError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          Could not refresh worksheets.
          <Button className="min-h-11 sm:min-h-9" variant="outline" onClick={onRetryUploads}>
            Retry worksheets
          </Button>
        </div>
      )}

      {!rosterLoading && !rosterError && !workLoading && !workError && !uploadsLoading && !uploadsError && assignedStudentCount > 0 && rows.length === 0 && (
        <div className="flex flex-col items-start gap-3 py-6">
          <p className="text-muted-foreground text-sm">
            {emptyMessage ?? (searchQuery.trim() ? "No students match your search and filter." : "No student work matches the current filter.")}
          </p>
          {onClearUploadFilter && (
            <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={onClearUploadFilter}>
              Clear latest-upload filter
            </Button>
          )}
          <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={onClearFilters}>
            Show all students
          </Button>
        </div>
      )}

      <ul className="divide-border divide-y">
        {rows.map(({ student, state, attempts, latest, counted, selected }) => {
          const needsReplacement =
            !!state && !!latest && (latest.status === "rejected" || latest.status === "returned");
          const hasSeparateLatest = !!selected && !!latest && latest.id !== selected.id;
          const reviewNewer = hasSeparateLatest && latest.status === "completed";
          const selectedScore = resolveSubmissionScore(selected);
          return (
            <li
              key={student.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="text-sm font-semibold break-words">{student.full_name}</h3>
                  <ActivityWorkStatus
                    state={state}
                    unavailable={workError || (!state && !workLoading)}
                  />
                </div>
                {state?.effective_due_at && (state.work_status === "Missing" || (state.late && state.work_status !== "Excused")) && (
                  <p className="text-muted-foreground text-xs">
                    {state.due_at_override ? "Individual deadline" : "Due"}{" "}
                    <time dateTime={state.effective_due_at}>{formatActivityDueAt(state.effective_due_at)}</time>
                    {" · Manila time"}
                  </p>
                )}
                {counted && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <AttemptScore label="Official assessment" submission={counted} />
                    <AttemptIdentity label="Uploaded" submission={counted} />
                  </div>
                )}
                {latest && latest.id !== counted?.id && (
                  <div className="flex flex-col gap-1">
                    {state && latest.status === "completed" && (
                      <AttemptScore label={counted ? "New upload · not official" : "Awaiting review"} submission={latest} />
                    )}
                    <AttemptIdentity label={latest.status === "completed" ? "Uploaded" : "Latest upload"} submission={latest} />
                    {state && latest.status === "processing" && (
                      <p className="text-muted-foreground text-sm">Analysis is processing.</p>
                    )}
                  </div>
                )}
                {!state && !workLoading && (
                  <div className="flex flex-col items-start gap-2">
                    <p className="text-muted-foreground text-sm">
                      Reload work status to review worksheets or upload a replacement.
                    </p>
                    <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={onRetryWork}>
                      Retry work status
                    </Button>
                  </div>
                )}
                {latest?.status === "rejected" && (
                  <p className="text-muted-foreground text-sm">
                    Upload rejected · {getRejectionSummary(latest.rejection_code).label}:{" "}
                    {getRejectionSummary(latest.rejection_code).detail}.
                  </p>
                )}
                {latest?.status === "returned" && (
                  <p className="text-muted-foreground text-sm break-words whitespace-pre-wrap">
                    Returned for revision · {" "}
                    {(
                      {
                        wrong_worksheet: "Wrong worksheet",
                        blurry_or_cropped: "Blurry or cropped photo",
                        wrong_target_text: "Wrong target text",
                        incomplete: "Incomplete work",
                        other: "Other",
                      } as Record<string, string>
                    )[latest.return_reason ?? ""] ?? "Another attempt requested"}
                    .{latest.return_note && ` ${latest.return_note}`}
                  </p>
                )}
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:max-w-[55%] sm:justify-end">
                <div className="flex flex-wrap items-center gap-2">
                  {needsReplacement && (
                    <Button onClick={() => onUpload(student.id)} className="min-h-11 sm:min-h-9">
                      Upload replacement
                      <span className="sr-only"> for {student.full_name}</span>
                    </Button>
                  )}
                  {reviewNewer && (
                    <Link
                      className={buttonVariants({ className: "min-h-11 sm:min-h-9" })}
                      href={`/activities/${activityId}/submissions/${latest.id}${queueQuery}`}
                      aria-label={`Review newer upload for ${student.full_name}`}
                    >
                      Review new attempt
                    </Link>
                  )}
                  {selected ? (
                    <Link
                      className={buttonVariants({
                        variant: needsReplacement || reviewNewer ? "outline" : "default",
                        className: "min-h-11 sm:min-h-9",
                      })}
                      href={`/activities/${activityId}/submissions/${selected.id}${queueQuery}`}
                    >
                      {selected.status === "processing"
                        ? "View processing upload"
                        : selected.status === "returned"
                          ? "View returned worksheet"
                          : selected.status === "rejected"
                            ? "View rejected upload"
                            : selectedScore.isScored
                              ? counted
                                ? selected.released_at ? "Review official result" : "Review and share result"
                                : "Review latest result"
                              : "Score worksheet"}
                      <span className="sr-only"> for {student.full_name}</span>
                    </Link>
                  ) : (
                    !uploadsLoading &&
                    !uploadsError &&
                    !!state && (
                      <Button onClick={() => onUpload(student.id)} className="min-h-11 sm:min-h-9">
                        Upload worksheet
                        <span className="sr-only"> for {student.full_name}</span>
                      </Button>
                    )
                  )}
                </div>
                <details className="max-w-full">
                  <summary className="text-muted-foreground focus-visible:outline-ring min-h-11 cursor-pointer rounded-md px-2 py-3 text-sm focus-visible:outline-2 sm:min-h-9 sm:py-2">
                    More options<span className="sr-only"> for {student.full_name}</span>
                  </summary>
                  <div className="flex flex-wrap gap-2 py-2">
                    {attempts.length > 0 && (
                      <WorksheetHistory activityId={activityId} studentName={student.full_name}
                        attempts={attempts} officialId={state?.active_submission_id ?? null} queueQuery={queueQuery} />
                    )}
                    {!!state && !!selected && !needsReplacement && !uploadsLoading && !uploadsError && (
                      <Button variant="outline" className="min-h-11 sm:min-h-9" onClick={() => onUpload(student.id)}>
                        Upload another worksheet
                        <span className="sr-only"> for {student.full_name}</span>
                      </Button>
                    )}
                    {hasSeparateLatest && !reviewNewer && (
                      <Link
                        className={buttonVariants({
                          variant: "outline",
                          className: "min-h-11 sm:min-h-9",
                        })}
                        href={`/activities/${activityId}/submissions/${latest.id}${queueQuery}`}
                      >
                        View latest attempt<span className="sr-only"> for {student.full_name}</span>
                      </Link>
                    )}
                    {attempts.length > 0 && (
                      <WorkCommentsButton
                        scope={{ activityId, studentId: student.id }}
                        activeSubmissionId={state?.active_submission_id ?? null}
                      />
                    )}
                    <StudentWorkControls
                      activityId={activityId}
                      studentId={student.id}
                      studentName={student.full_name}
                      state={state ?? null}
                      attempts={attempts}
                    />
                  </div>
                </details>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
