"use client";

import { use, useMemo, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useActivity } from "@/lib/hooks/use-activities";
import { useSubmissions, type Submission } from "@/lib/hooks/use-submissions";
import { SubmissionDetailContent } from "@/components/submissions/submission-detail-content";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { parseTeacherCommentTarget } from "@/lib/comments/targets";
import { SubmissionCommentDestination } from "@/components/comments/submission-comment-destination";
import { activityReviewQuery } from "@/lib/utils/activity-review";

export default function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const { id: activityId, submissionId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const commentTarget = parseTeacherCommentTarget(searchParams, activityId, submissionId);
  const reviewQuery = activityReviewQuery(searchParams);
  const activityHref = `/activities/${activityId}${reviewQuery}`;

  const { data: activity, isLoading: activityLoading } = useActivity(activityId);
  const { data: submissions, isLoading: submissionsLoading } = useSubmissions(activityId);

  const submission = useMemo(
    () => submissions?.find((s) => s.id === submissionId) ?? null,
    [submissions, submissionId]
  );

  const currentIndex = useMemo(() => {
    if (!submissions || !submission) return -1;
    return submissions.findIndex((s) => s.id === submission.id);
  }, [submissions, submission]);

  const handleNavigate = useCallback(
    (target: Submission) => {
      router.replace(`/activities/${activityId}/submissions/${target.id}${reviewQuery}`, {
        scroll: false,
      });
    },
    [router, activityId, reviewQuery]
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
          document.querySelector("#diagnostic-annotation-tooltip")
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

  if (commentTarget.kind === "valid")
    return (
      <SubmissionCommentDestination
        activityId={commentTarget.target.activityId}
        submissionId={commentTarget.target.submissionId}
      />
    );
  if (commentTarget.kind === "invalid")
    return (
      <p role="status" className="p-4">
        This conversation link is invalid. Choose a worksheet upload to view its comments.
      </p>
    );

  if (isLoading) {
    return (
      <div
        className="w-full animate-pulse space-y-4"
        role="status"
        aria-label="Loading handwriting submission details"
      >
        {/* Top Back Navigation Trail Skeleton */}
        <div className="-ml-1 py-2 sm:-ml-2">
          <Skeleton className="h-4 w-28 rounded-md" />
        </div>

        {/* Header Skeleton matching rendered responsive layout */}
        <div className="border-border/70 space-y-2 border-b pb-2.5 sm:pb-3">
          {/* Main identity row */}
          <div className="flex items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
              <Skeleton className="size-9 shrink-0 rounded-xl sm:size-10" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-5 w-36 rounded-md sm:h-6 sm:w-48" />
                <Skeleton className="h-3 w-40 rounded-md sm:w-52" />
              </div>
            </div>
            <Skeleton className="h-9 w-32 shrink-0 rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 py-2.5 sm:gap-6 sm:py-3.5 lg:grid-cols-12 lg:items-start">
          <div className="space-y-2.5 lg:col-span-6">
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="aspect-4/3 min-h-[320px] w-full rounded-2xl sm:aspect-3/2 lg:aspect-4/3" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
          <div className="space-y-3 lg:col-span-6">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="bg-surface/50 dark:bg-card/50 border-border/80 flex flex-col items-center justify-center space-y-4 rounded-2xl border border-dashed px-4 py-20 text-center">
        <div className="max-w-md space-y-1.5">
          <h3 className="font-heading text-foreground text-lg font-semibold">
            Submission Not Found
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The handwriting submission you are looking for may have been deleted, or the submission
            ID is invalid.
          </p>
        </div>
        <Link
          href={activityHref}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium shadow-xs transition-colors"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>Return to Activity</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 sm:space-y-4">
      {/* Top Back Navigation Trail */}
      <nav aria-label="Breadcrumb navigation" className="print:hidden">
        <Link
          href={activityHref}
          className="text-muted-foreground hover:text-foreground group focus-visible:ring-ring hover:bg-muted/50 -ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden sm:-ml-2 sm:min-h-[36px]"
        >
          <ArrowLeft
            className="size-3.5 transition-transform group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
          <span>Back to Activity</span>
        </Link>
      </nav>

      {/* Main Content */}
      <SubmissionDetailContent
        key={submission.id}
        submission={submission}
        submissions={submissions}
        currentIndex={currentIndex >= 0 ? currentIndex : undefined}
        onNavigate={handleNavigate}
        activityTargetText={activity?.target_text}
        onClose={handleClose}
        variant="page"
      />
    </div>
  );
}
