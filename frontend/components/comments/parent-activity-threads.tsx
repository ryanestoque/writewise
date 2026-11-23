"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { useCommentSummaries, useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import { commentThreadHref } from "@/lib/comments/targets";

export function ParentActivityThreads({
  userId,
  studentId,
  className,
}: {
  userId: string;
  studentId: string;
  className?: string;
}) {
  const query = useCommentSummaries(userId, { studentId }, true);
  const unread = useUnreadCommentThreads(userId);

  if (query.data && !query.data.rows.length) {
    return null;
  }

  return (
    <section
      className={cn("bg-card space-y-3 rounded-xl border p-4 sm:p-5", className)}
      aria-labelledby="teacher-comments-heading"
    >
      <h2
        id="teacher-comments-heading"
        className="font-heading text-base sm:text-lg font-semibold text-foreground"
      >
        Teacher comments
      </h2>
      {query.isError ? (
        <div role="alert" className="space-y-3 py-2">
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Could not load conversations</AlertTitle>
            <AlertDescription>
              Unable to retrieve teacher feedback threads. Check your connection and try again.
            </AlertDescription>
          </Alert>
          <Button size="sm" variant="outline" className="min-h-11 sm:min-h-9 h-10 sm:h-9 text-xs sm:text-sm font-medium cursor-pointer" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : !query.data ? (
        <div className="space-y-3 py-2" role="status" aria-label="Loading conversations">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : (
        <ul className="divide-y divide-border/70">
          {query.data.rows.map((row) => (
            <li
              key={row.submission_id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1 last:pb-0"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">{row.activity_title}</p>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <time dateTime={row.submitted_at} className="font-sans tabular-nums">
                    {formatDate(row.submitted_at)}
                  </time>
                  {(!row.assigned || row.is_archived || row.comments_locked) && (
                    <>
                      <span className="text-muted-foreground/50 select-none" aria-hidden="true">·</span>
                      <span className="font-medium text-foreground/75">
                        {!row.assigned
                          ? "Past practice"
                          : row.is_archived
                            ? "Archived"
                            : "Closed"}
                      </span>
                    </>
                  )}
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
