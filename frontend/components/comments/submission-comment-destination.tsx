"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCommentAccountId, useCommentThread } from "@/lib/hooks/use-comments";
import { SubmissionCommentTabs } from "./submission-comment-tabs";

export function SubmissionCommentDestination({ activityId, submissionId }: {
  activityId: string; submissionId: string;
}) {
  const userId = useCommentAccountId();
  const query = useCommentThread(userId ?? "", { submissionId }, !!userId);
  if (!userId || query.isPending) return <p role="status" className="p-4">Loading conversation…</p>;
  if (query.isError || !query.data || query.data.activity_id !== activityId)
    return <div role="status" className="flex flex-col gap-3 p-4">
      <p>This conversation is unavailable.</p>
      <Button variant="outline" onClick={() => void query.retry()}>Try again</Button>
    </div>;
  return <section className="flex min-h-0 flex-col gap-3" aria-label="Submission conversation">
    <Link href={`/activities/${activityId}`} className="inline-flex min-h-10 items-center text-sm underline">Back to activity</Link>
    <h1 className="font-heading text-xl font-semibold">Private comments</h1>
    <SubmissionCommentTabs key={`${userId}:${submissionId}`} submissionId={submissionId} initialView="comments"
      location={{ submissionId, activityId, studentId: query.data.student_id }}>
      <div className="p-4"><Link href={`/activities/${activityId}/submissions/${submissionId}`} className="inline-flex min-h-10 items-center text-sm underline">Open worksheet details</Link></div>
    </SubmissionCommentTabs>
  </section>;
}
