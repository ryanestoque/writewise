"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommentAccountId, useCommentThread } from "@/lib/hooks/use-comments";
import { SubmissionCommentTabs } from "./submission-comment-tabs";

export function SubmissionCommentDestination({
  activityId,
  submissionId,
  studentName,
}: {
  activityId: string;
  submissionId: string;
  studentName?: string;
}) {
  const userId = useCommentAccountId();
  const query = useCommentThread(userId ?? "", { submissionId }, !!userId);
  if (!userId || query.isPending)
    return (
      <div className="space-y-4 p-4" role="status" aria-label="Loading conversation">
        <Skeleton className="h-6 w-32 rounded-md" />
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  if (query.isError || !query.data || query.data.activity_id !== activityId)
    return (
      <div className="flex flex-col gap-3 p-4" role="status">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Conversation unavailable</AlertTitle>
          <AlertDescription>
            This conversation is either no longer available or does not match the current activity.
          </AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" onClick={() => void query.retry()}>
          Try again
        </Button>
      </div>
    );
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 p-2 sm:p-4" aria-label="Submission conversation">
      <div>
        <Link
          href={`/activities/${activityId}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 text-muted-foreground hover:text-foreground")}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>Back to activity</span>
        </Link>
      </div>
      <div className="space-y-1">
        <h1 className="font-heading text-xl font-semibold text-foreground">
          Private comments{studentName ? ` · ${studentName}` : ""}
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Direct dialogue regarding {studentName ? `${studentName}'s` : "this"} cursive worksheet upload.
        </p>
      </div>
      <SubmissionCommentTabs
        key={`${userId}:${submissionId}`}
        submissionId={submissionId}
        initialView="comments"
        studentName={studentName}
        location={{ submissionId, activityId, studentId: query.data.student_id }}
      >
        <div className="p-4 flex flex-col items-start gap-3">
          <p className="text-muted-foreground text-sm">
            View student cursive stroke diagnostics, quality gate measurements, and rubric ratings.
          </p>
          <Link
            href={`/activities/${activityId}/submissions/${submissionId}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
          >
            <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
            <span>Open full worksheet details &amp; scoring</span>
          </Link>
        </div>
      </SubmissionCommentTabs>
    </section>
  );
}
