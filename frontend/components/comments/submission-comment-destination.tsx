"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, FileText } from "lucide-react";
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
      <div className="flex flex-col gap-4 p-4" role="status" aria-label="Loading conversation">
        <Skeleton className="h-6 w-32 rounded-md" />
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  if (query.isError || !query.data || query.data.activity_id !== activityId)
    return (
      <div className="flex flex-col gap-3 p-4">
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Conversation unavailable</AlertTitle>
          <AlertDescription>
            This conversation is either no longer available or does not match the current activity.
          </AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" className="min-h-11 sm:min-h-9 w-fit cursor-pointer" onClick={() => void query.retry()}>
          Try again
        </Button>
      </div>
    );
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 p-2 sm:p-4" aria-label="Submission conversation">
      <div>
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          render={<Link href={`/activities/${activityId}`} />}
        >
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          <span>Back to activity</span>
        </Button>
      </div>
      <div className="flex flex-col gap-1">
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
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={<Link href={`/activities/${activityId}/submissions/${submissionId}`} />}
          >
            <FileText data-icon="inline-start" className="text-muted-foreground" aria-hidden="true" />
            <span>Open full worksheet details &amp; scoring</span>
          </Button>
        </div>
      </SubmissionCommentTabs>
    </section>
  );
}
