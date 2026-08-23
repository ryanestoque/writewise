"use client";

import { use } from "react";
import Link from "next/link";
import { useActivity } from "@/lib/hooks/use-activities";
import {
  type Submission,
  useSubmissionImageUrl,
  useSubmissions,
} from "@/lib/hooks/use-submissions";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ArrowLeft,
  ClipboardList,
  Home,
  CalendarDays,
  FileText,
  Upload,
  Inbox,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

function getWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return "Just now";
}

function SubmissionCard({ submission }: { submission: Submission }) {
  const { data: imageUrl } = useSubmissionImageUrl(submission.image_path);

  const statusConfig = {
    processing: {
      label: "Processing",
      className:
        "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900",
    },
    completed: {
      label: "Completed",
      className:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
    },
    rejected: {
      label: "Rejected",
      className:
        "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive border-destructive/20 dark:border-destructive/30",
    },
  } as const;

  const config = statusConfig[submission.status];

  return (
    <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-warm overflow-hidden">
      {/* Photo Thumbnail */}
      <div className="aspect-4/3 bg-muted relative overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`Handwriting by ${submission.student?.full_name ?? "student"}`}
            className="size-full object-cover"
          />
        ) : (
          <div className="size-full flex items-center justify-center text-muted-foreground">
            <FileText className="size-8" />
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-medium text-foreground truncate">
          {submission.student?.full_name ?? "Unknown Student"}
        </p>
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold px-2 py-0.5 ${config.className}`}
          >
            {config.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {getRelativeTime(submission.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: activity, isLoading, error, refetch } = useActivity(id);
  const {
    data: submissions,
    isLoading: submissionsLoading,
    error: submissionsError,
    refetch: refetchSubmissions,
  } = useSubmissions(id);
  const { openUpload } = useTeacherModals();

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/activities"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Activities
          </Link>
        </div>
        <div
          role="alert"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">
              {error.message.includes("not found") || error.message.includes("No rows")
                ? "Activity not found. It may have been removed."
                : `Failed to load activity: ${error.message}`}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-destructive/30 hover:bg-destructive/10 text-destructive"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-4 w-32" />
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-6 space-y-4 shadow-warm">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-6 space-y-4 shadow-warm">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/activities"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Activities
          </Link>
        </div>
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-warm overflow-hidden">
          <Empty className="py-14 border-0">
            <EmptyMedia
              variant="icon"
              className="bg-muted text-muted-foreground"
            >
              <ClipboardList className="w-6 h-6" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>Activity not found</EmptyTitle>
              <EmptyDescription>
                This activity may have been removed or you don&apos;t have
                access.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link
                href="/activities"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "rounded-lg sm:rounded-xl"
                )}
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Activities
              </Link>
            </EmptyContent>
          </Empty>
        </div>
      </div>
    );
  }

  const wordCount = getWordCount(activity.target_text);

  return (
    <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6 pb-20 sm:pb-16 px-1 sm:px-0">
      {/* Back Link */}
      <Link
        href="/activities"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Activities
      </Link>

      {/* Activity Info Card */}
      <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-warm">
        <div className="flex items-start gap-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            {/* Target Text */}
            <div>
              <h1 className="text-lg sm:text-xl font-heading font-semibold text-foreground tracking-tight mb-1">
                Activity Details
              </h1>
              <p className="text-sm sm:text-base text-foreground leading-relaxed">
                &ldquo;{activity.target_text}&rdquo;
              </p>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <Badge
                variant="outline"
                className="text-xs font-semibold px-2.5 py-0.5 bg-muted/50 text-muted-foreground border-border"
              >
                {wordCount} {wordCount === 1 ? "word" : "words"}
              </Badge>

              {activity.is_take_home && (
                <Badge
                  variant="outline"
                  className="text-xs font-semibold px-2.5 py-0.5 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border-brand-200/80 dark:border-brand-900"
                >
                  <Home className="w-3 h-3 mr-1" />
                  Take-home
                </Badge>
              )}

              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                {formatDate(activity.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Submissions Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-heading font-semibold text-foreground tracking-tight">
              Submissions
            </h2>
            {submissions && submissions.length > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] font-semibold px-2 py-0.5 bg-muted/50 text-muted-foreground border-border"
              >
                {submissions.length}
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl gap-1.5"
            onClick={() => openUpload({ activityId: id })}
          >
            <Upload className="w-4 h-4" />
            Upload Submission
          </Button>
        </div>

        {submissionsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-warm overflow-hidden"
              >
                <Skeleton className="aspect-4/3 w-full rounded-none" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : submissionsError ? (
          <div
            role="alert"
            className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">
                Failed to load submissions: {submissionsError.message}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchSubmissions()}
              className="border-destructive/30 hover:bg-destructive/10 text-destructive"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Retry
            </Button>
          </div>
        ) : submissions && submissions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {submissions.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
          </div>
        ) : (
          <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-warm overflow-hidden">
            <Empty className="py-12 border-0">
              <EmptyMedia
                variant="icon"
                className="bg-muted text-muted-foreground"
              >
                <Inbox className="w-6 h-6" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle className="text-lg sm:text-xl">
                  No submissions yet
                </EmptyTitle>
                <EmptyDescription className="text-xs sm:text-sm max-w-sm mx-auto">
                  Upload a student&apos;s handwriting for this activity to
                  begin assessment.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex items-center justify-center w-full sm:w-auto px-4 sm:px-0">
                <Button
                  className="h-10 sm:h-9 min-h-[44px] sm:min-h-[36px] w-full sm:w-auto font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl"
                  onClick={() => openUpload({ activityId: id })}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Submission
                </Button>
              </EmptyContent>
            </Empty>
          </div>
        )}
      </div>
    </div>
  );
}