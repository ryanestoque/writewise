"use client";

import { use, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useActivity } from "@/lib/hooks/use-activities";
import { useSubmissions, type Submission } from "@/lib/hooks/use-submissions";
import { SubmissionDetailContent } from "@/components/submissions/submission-detail-content";
import { ChevronRight, ArrowLeft } from "lucide-react";
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

  const isLoading = activityLoading || submissionsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0" aria-hidden="true" />
          <Skeleton className="h-4 w-36" />
          <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0" aria-hidden="true" />
          <Skeleton className="h-4 w-28" />
        </div>

        <div className="flex items-center justify-between pb-4 border-b border-border/70">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="aspect-4/3 sm:aspect-3/2 lg:aspect-4/3 w-full rounded-2xl" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-6 space-y-4">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
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
    <div className="space-y-4">
      {/* Breadcrumb Bar */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
        <Link
          href="/activities"
          className="hover:text-foreground transition-colors font-medium"
        >
          Activities
        </Link>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        <Link
          href={`/activities/${activityId}`}
          className="hover:text-foreground transition-colors font-medium truncate max-w-[140px] sm:max-w-[240px]"
          title={activity?.target_text || "Activity"}
        >
          {activity?.target_text
            ? activity.target_text.length > 25
              ? activity.target_text.slice(0, 25) + "…"
              : activity.target_text
            : "Activity"}
        </Link>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        <span className="text-foreground font-semibold truncate max-w-[140px] sm:max-w-[200px]">
          {submission.student?.full_name ?? "Student"}
        </span>
      </nav>

      {/* Back link */}
      <div>
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
        >
          <ArrowLeft className="size-3.5 sm:size-4 group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" />
          <span>Back to activity</span>
        </button>
      </div>

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
