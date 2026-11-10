"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
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
      <h2 className="font-heading text-lg font-semibold">Worksheet conversations</h2>
      <p className="text-muted-foreground text-sm">
        Your child’s conversation history stays available when assignments change.
      </p>
      {query.isError ? (
        <div role="status">
          <p>Could not load conversations.</p>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : query.isPending ? (
        <p role="status" className="text-muted-foreground text-sm">
          Loading conversations…
        </p>
      ) : !query.data.rows.length ? (
        <p className="text-muted-foreground text-sm">
          No conversations yet. Open a worksheet upload to talk with the teacher.
        </p>
      ) : (
        <ul className="divide-y">
          {query.data.rows.map((row) => (
            <li
              key={row.submission_id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="text-sm font-medium">{row.activity_title}</p>
                <p className="text-muted-foreground text-xs">Uploaded {new Date(row.submitted_at).toLocaleString()}</p>
                <p className="text-muted-foreground text-xs">
                  {!row.assigned
                    ? "No longer assigned"
                    : row.is_archived
                      ? "Archived"
                      : row.comments_locked
                        ? "Locked"
                        : "Assigned"}
                </p>
              </div>
              <Link
                href={commentThreadHref({ activityId: row.activity_id, studentId, submissionId: row.submission_id }, "parent")}
                scroll={false}
                className="inline-flex min-h-10 items-center gap-2 text-sm underline"
              >
                Comments
                {unread.data?.has(row.submission_id) && (
                  <span className="text-primary text-xs">Unread</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
