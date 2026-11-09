"use client";

import { Button } from "@/components/ui/button";
import { useCommentSummaries, useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import type { ThreadTarget } from "@/lib/comments/types";

export function ActivityThreads({
  userId,
  activityId,
  onOpen,
}: {
  userId: string;
  activityId: string;
  onOpen: (target: ThreadTarget, studentName?: string) => void;
}) {
  const query = useCommentSummaries(userId, { activityId }, true);
  const unread = useUnreadCommentThreads(userId);
  return (
    <section className="bg-card space-y-3 rounded-xl border p-4" aria-label="Conversation history">
      <h2 className="font-heading text-lg font-semibold">Conversation history</h2>
      <p className="text-muted-foreground text-sm">
        Activity conversations stay here when assignments change.
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
          No conversations yet. Use Comments beside an assigned student to start one.
        </p>
      ) : (
        <ul className="divide-y">
          {query.data.rows.map((row) => (
            <li
              key={row.student_id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="text-sm font-medium">{row.student_label}</p>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onOpen(
                    { activityId: row.activity_id, studentId: row.student_id },
                    row.student_label
                  )
                }
              >
                Comments
                {unread.data?.has(`${row.activity_id}:${row.student_id}`) && (
                  <span className="text-primary text-xs"> · Unread</span>
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
