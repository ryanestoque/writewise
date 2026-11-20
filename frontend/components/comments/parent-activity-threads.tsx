"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { MessageSquare, AlertCircle } from "lucide-react";
import { formatDate, getRelativeTime } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { useCommentSummaries, useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import { commentThreadHref } from "@/lib/comments/targets";

export function ParentActivityThreads({
  userId,
  studentId,
}: {
  userId: string;
  studentId: string;
}) {
  const query = useCommentSummaries(userId, { studentId }, true);
  const unread = useUnreadCommentThreads(userId);
  return (
    <section
      className="bg-card space-y-3 rounded-xl border p-4"
      aria-label="Activity conversation history"
    >
      <div className="space-y-1">
        <h2 className="font-heading text-lg font-semibold text-foreground">Teacher feedback &amp; conversations</h2>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Keep in touch with your child’s teacher about worksheet practice, feedback, and handwriting growth.
        </p>
      </div>
      {query.isError ? (
        <div role="status" className="space-y-3 py-2">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Could not load conversations</AlertTitle>
            <AlertDescription>
              Unable to retrieve teacher feedback threads. Check your connection and try again.
            </AlertDescription>
          </Alert>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : !query.data ? (
        <div className="space-y-3 py-2" role="status" aria-label="Loading conversations">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : !query.data.rows.length ? (
        <Empty className="py-8">
          <EmptyMedia variant="icon">
            <MessageSquare className="size-5 text-muted-foreground" aria-hidden="true" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No conversations yet</EmptyTitle>
            <EmptyDescription>
              Open any completed worksheet upload to ask a question or read notes from your child’s teacher.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="divide-y">
          {query.data.rows.map((row) => (
            <li
              key={row.submission_id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">{row.activity_title}</p>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <time dateTime={row.submitted_at} className="font-sans tabular-nums">
                    Uploaded {formatDate(row.submitted_at)} ({getRelativeTime(row.submitted_at)})
                  </time>
                  <span className="text-muted-foreground/50 select-none" aria-hidden="true">·</span>
                  <span className="font-medium text-foreground/75">
                    {!row.assigned
                      ? "Past practice"
                      : row.is_archived
                        ? "Archived activity"
                        : row.comments_locked
                          ? "Comments closed after review"
                          : "Active conversation"}
                  </span>
                </div>
              </div>
              <Link
                href={commentThreadHref({ activityId: row.activity_id, studentId, submissionId: row.submission_id }, "parent")}
                scroll={false}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "min-h-11 sm:min-h-9 gap-2")}
                aria-label={
                  unread.data?.has(row.submission_id)
                    ? `Comments for ${row.activity_title}, has unread messages`
                    : `Comments for ${row.activity_title}`
                }
              >
                <span>Comments</span>
                {unread.data?.has(row.submission_id) && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    <span className="size-1.5 rounded-full bg-primary mr-1" aria-hidden="true" />
                    Unread
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
