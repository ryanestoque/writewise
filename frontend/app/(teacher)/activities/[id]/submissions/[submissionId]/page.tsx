"use client";

import { use, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useActivity } from "@/lib/hooks/use-activities";
import { useSubmissions, type Submission } from "@/lib/hooks/use-submissions";
import { SubmissionDetailContent } from "@/components/submissions/submission-detail-content";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const { id: activityId, submissionId } = use(params);
  const router = useRouter();

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
      router.replace(
        `/activities/${activityId}/submissions/${target.id}`,
        { scroll: false }
      );
    },
    [router, activityId]
  );

  const handleClose = useCallback(() => {
    router.push(`/activities/${activityId}`);
  }, [router, activityId]);

  // Handle Esc key to return to activity view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (
          e.defaultPrevented ||
          document.activeElement instanceof HTMLInputElement ||
          document.activeElement instanceof HTMLTextAreaElement ||
          document.activeElement?.getAttribute("role") === "combobox" ||
          document.querySelector('[data-rubric-editing="true"]')
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

  if (isLoading) {
    return (
      <div className="w-full space-y-4 animate-pulse" role="status" aria-label="Loading handwriting submission details">
        {/* Header Skeleton matching rendered layout */}
        <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-border/70">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Skeleton className="h-9 w-28 sm:w-36 rounded-xl shrink-0" />
            <Skeleton className="size-9 sm:size-10 rounded-xl shrink-0" />
            <div className="space-y-1.5 min-w-0">
              <Skeleton className="h-5 sm:h-6 w-36 sm:w-48 rounded-md" />
              <Skeleton className="h-3 w-40 sm:w-52 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-9 w-24 sm:w-28 rounded-xl shrink-0" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:items-start py-2.5 sm:py-3.5">
          <div className="lg:col-span-6 space-y-2.5">
            <Skeleton className="h-9 w-full rounded-xl" />
            <Skeleton className="aspect-4/3 sm:aspect-3/2 lg:aspect-4/3 w-full rounded-2xl min-h-[320px]" />
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

  if (!submission) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-4 bg-surface/50 dark:bg-card/50 rounded-2xl border border-dashed border-border/80">
        <div className="space-y-1.5 max-w-md">
          <h3 className="font-heading text-lg font-semibold text-foreground">
            Submission Not Found
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The handwriting submission you are looking for may have been deleted, or the submission ID is invalid.
          </p>
        </div>
        <Link
          href={`/activities/${activityId}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>Return to Activity</span>
        </Link>
      </div>
    );
  }


  return (
    <div className="w-full">
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
