"use client";

import { use, useMemo, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useActivity } from "@/lib/hooks/use-activities";
import { useSubmissions, type Submission } from "@/lib/hooks/use-submissions";
import { SubmissionDetailContent } from "@/components/submissions/submission-detail-content";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { parseTeacherCommentTarget } from "@/lib/comments/targets";
import { SubmissionCommentDestination } from "@/components/comments/submission-comment-destination";
import { buildReviewRows, getReviewQueueRows, getReviewNavigation, readReviewQueue, reviewQueueQuery, getAttemptReviewNavigation } from "@/lib/utils/activity-review";
import { matchesReviewFilter, reviewFilterLabels, type LegacyReviewFilter } from "@/lib/utils/activity-attempt-review";
import { useStudents } from "@/lib/hooks/use-students";
import { useActivityWork } from "@/lib/hooks/use-activity-work";
import { activityAssignedTo } from "@/lib/utils/activity-work";
import { resolveSubmissionScore } from "@/lib/utils/submission-status";
import { useActivityReviewSession } from "@/components/activities/activity-review-session";

export default function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const { id: activityId, submissionId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const commentTarget = parseTeacherCommentTarget(searchParams, activityId, submissionId);
  const queueQuery = reviewQueueQuery(searchParams);
  const activityHref = `/activities/${activityId}${queueQuery}`;

  const {
    data: activity,
    isLoading: activityLoading,
    isError: activityError,
    refetch: refetchActivity,
  } = useActivity(activityId);
  const {
    data: submissions,
    isLoading: submissionsLoading,
    isError: submissionsError,
    refetch: refetchSubmissions,
  } = useSubmissions(activityId);
  const roster = useStudents();
  const work = useActivityWork(activityId);
  const { session: reviewSession, setSession: setReviewSession } = useActivityReviewSession();
  const scope = `${activityId}${queueQuery}`;
  const rows = useMemo(() => buildReviewRows(
    (roster.data ?? []).filter(student => !!activity && activityAssignedTo(activity, student)),
    submissions ?? [], work.data ?? []
  ), [roster.data, activity, submissions, work.data]);
  const queueRows = useMemo(() => getReviewQueueRows(
    rows, readReviewQueue(new URLSearchParams(queueQuery)),
    item => resolveSubmissionScore(item).compositeScore
  ), [rows, queueQuery]);
  const attemptGroup = searchParams.get("group");
  const attemptNavigation = useMemo(() => {
    if (attemptGroup !== "grouped" && attemptGroup !== "all") return null;
    const params = new URLSearchParams(queueQuery);
    const requested = params.get("status") ?? "all";
    const filter = Object.hasOwn(reviewFilterLabels, requested) ? requested as LegacyReviewFilter : "all";
    const state = readReviewQueue(params);
    return getAttemptReviewNavigation(rows, attemptGroup, state.searchQuery, state.sortBy,
      (attempt, row) => matchesReviewFilter(attempt, row.state ?? null, filter),
      attempt => resolveSubmissionScore(attempt).compositeScore);
  }, [rows, queueQuery, attemptGroup]);
  const navigationReady = !!activity && !!submissions && !!roster.data && !!work.data &&
    !roster.isError && !work.isError;
  // Capture the selected review session once. Sharing a result must not remove its
  // current position or reorder the remaining students while the teacher reviews.
  useEffect(() => {
    if (navigationReady && reviewSession?.scope !== scope) {
      setReviewSession({ scope, studentIds: queueRows.filter(row => row.selected).map(row => row.student.id), submissionIds: attemptNavigation?.map(attempt => attempt.id) });
    }
  }, [navigationReady, reviewSession, scope, queueRows, setReviewSession, attemptNavigation]);

  const submission = useMemo(
    () => submissions?.find((s) => s.id === submissionId) ?? null,
    [submissions, submissionId]
  );

  const navigation = useMemo(() => {
    if (!navigationReady || reviewSession?.scope !== scope) return [];
    if (reviewSession.submissionIds) {
      const byId = new Map((submissions ?? []).map(attempt => [attempt.id, attempt]));
      return reviewSession.submissionIds.flatMap(id => {
        const attempt = byId.get(id);
        if (!attempt) return [];
        return [attemptGroup === "grouped" && submission?.student_id === attempt.student_id ? submission : attempt];
      });
    }
    return getReviewNavigation(rows, submission ?? undefined, reviewSession.studentIds);
  }, [navigationReady, reviewSession, scope, rows, submission, submissions, attemptGroup]);
  const currentIndex = navigation.findIndex(item => item.id === submissionId);

  const handleNavigate = useCallback(
    (target: Submission) => {
      router.replace(
        `/activities/${activityId}/submissions/${target.id}${queueQuery}`,
        { scroll: false }
      );
    },
    [router, activityId, queueQuery]
  );

  const handleClose = useCallback(() => {
    router.push(activityHref);
  }, [router, activityHref]);

  // Handle Esc key to return to activity view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (
          e.defaultPrevented ||
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement ||
          document.activeElement?.getAttribute("role") === "combobox" ||
          document.querySelector('[data-rubric-editing="true"]') ||
          document.querySelector('[data-diagnostic-active="true"]') ||
          document.querySelector('[role="tooltip"]') ||
          document.querySelector('#diagnostic-annotation-tooltip')
        ) {
          return;
        }
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  // Synchronize document title for browser tab identification
  useEffect(() => {
    if (submission?.student?.full_name) {
      const targetPrompt = activity?.target_text ? ` — "${activity.target_text}"` : "";
      document.title = `${submission.student.full_name}${targetPrompt} | WriteWise`;
    } else {
      document.title = "Submission Assessment | WriteWise";
    }
  }, [submission?.student?.full_name, activity?.target_text]);

  const isLoading = activityLoading || submissionsLoading;

  if (commentTarget.kind === "invalid") {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-4 bg-surface/50 dark:bg-card/50 rounded-2xl border border-dashed border-border/80" data-page-studio="true">
        <div className="space-y-1.5 max-w-md">
          <h1 className="font-heading text-lg font-semibold text-foreground">
            Invalid Conversation Link
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This conversation link is invalid. Choose a worksheet upload from the activity to view its comments.
          </p>
        </div>
        <Link
          href={activityHref}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors shadow-xs min-h-11 sm:min-h-9"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>Return to Activity</span>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full space-y-4" role="status" aria-label="Loading handwriting submission details" data-page-studio="true">
        {/* Top Back Navigation Trail Skeleton */}
        <div className="py-2 -ml-1 sm:-ml-2">
          <Skeleton className="h-4 w-28 rounded-md" />
        </div>

        {/* Header Skeleton matching rendered responsive layout */}
        <div className="space-y-2 pb-2.5 sm:pb-3 border-b border-border/70">
          {/* Main identity row */}
          <div className="flex items-center justify-between gap-2.5 sm:gap-3">
            <div className="space-y-1.5 min-w-0 flex-1">
              <Skeleton className="h-6 sm:h-7 w-40 sm:w-52 rounded-md" />
              <Skeleton className="h-3.5 w-44 sm:w-56 rounded-md" />
            </div>
            <Skeleton className="h-9 w-32 rounded-lg shrink-0" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:items-start py-2.5 sm:py-3.5">
          <div className="lg:col-span-6 space-y-2.5">
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="aspect-3/4 w-full rounded-2xl min-h-[300px] sm:min-h-[340px] lg:min-h-[460px]" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-6 space-y-3">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const isQueryError = activityError || submissionsError;

  if (isQueryError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4 bg-surface/50 dark:bg-card/50 rounded-2xl border border-destructive/30" data-page-studio="true">
        <div className="space-y-1.5 max-w-md">
          <h1 className="font-heading text-lg font-semibold text-foreground">
            Unable to Load Submission
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            There was a problem loading this handwriting assessment. Please check your connection and try again.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap justify-center">
          <Button
            type="button"
            onClick={() => {
              void refetchActivity();
              void refetchSubmissions();
            }}
            className="min-h-11 sm:min-h-9 px-4 text-xs font-semibold gap-1.5 rounded-lg cursor-pointer"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>Retry</span>
          </Button>
          <Link
            href={activityHref}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-border/80 hover:bg-muted transition-colors min-h-11 sm:min-h-9"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Return to Activity</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!submission) {
    if (commentTarget.kind === "valid") {
      return (
        <div data-page-studio="true">
          <SubmissionCommentDestination
            activityId={commentTarget.target.activityId}
            submissionId={commentTarget.target.submissionId}
          />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-4 bg-surface/50 dark:bg-card/50 rounded-2xl border border-dashed border-border/80" data-page-studio="true">
        <div className="space-y-1.5 max-w-md">
          <h1 className="font-heading text-lg font-semibold text-foreground">
            Submission Not Found
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The handwriting submission you are looking for may have been deleted, or the submission ID is invalid.
          </p>
        </div>
        <Link
          href={activityHref}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors shadow-xs min-h-11 sm:min-h-9"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>Return to Activity</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full" data-page-studio="true">
      <SubmissionDetailContent
        key={`${submission.id}:${commentTarget.kind === "valid" ? "comments" : "details"}`}
        submission={submission}
        submissions={navigation}
        currentIndex={currentIndex >= 0 ? currentIndex : undefined}
        onNavigate={handleNavigate}
        activityTitle={activity?.title}
        activityTargetText={activity?.target_text}
        onClose={handleClose}
        variant="page"
        initialView={commentTarget.kind === "valid" ? "comments" : "details"}
      />
    </div>
  );
}
