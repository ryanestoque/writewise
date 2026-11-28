"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityThreadsSkeleton } from "@/components/teacher/teacher-portal-skeletons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { MessageSquare, AlertCircle } from "lucide-react";
import { formatDate, getRelativeTime } from "@/lib/utils/formatters";
import { useCommentSummaries, useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import type { CommentLocation } from "@/lib/comments/types";

export function ActivityThreads({
  userId,
  activityId,
  onOpen,
}: {
  userId: string;
  activityId: string;
  onOpen: (target: CommentLocation, studentName?: string) => void;
}) {
  const query = useCommentSummaries(userId, { activityId }, true);
  const unread = useUnreadCommentThreads(userId);
  return (
    <Card size="sm" aria-label="Conversation history">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Conversation history</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {query.isError ? (
          <div className="flex flex-col gap-3 py-2">
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Could not load conversations</AlertTitle>
              <AlertDescription>
                Unable to retrieve student conversation threads from the server.
              </AlertDescription>
            </Alert>
            <Button className="min-h-11 sm:min-h-9 w-fit" size="sm" variant="outline" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </div>
        ) : !query.data ? (
          <ActivityThreadsSkeleton />
        ) : !query.data.rows.length ? (
          <Empty className="py-8">
            <EmptyMedia variant="icon">
              <MessageSquare aria-hidden="true" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No conversations yet</EmptyTitle>
              <EmptyDescription>
                Open any student worksheet upload above to start or view a private conversation with parents.
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
                <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold text-foreground">{row.student_label}</p>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <time dateTime={row.submitted_at} className="font-sans tabular-nums">
                    Uploaded {formatDate(row.submitted_at)} ({getRelativeTime(row.submitted_at)})
                  </time>
                  <span className="text-muted-foreground/50 select-none" aria-hidden="true">·</span>
                  <span className="font-medium text-foreground/75">
                    {!row.assigned
                      ? "Previous assignment"
                      : row.is_archived
                        ? "Archived"
                        : row.comments_locked
                          ? "Comments closed after review"
                          : "Active conversation"}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 sm:min-h-9 gap-2"
                aria-label={
                  unread.data?.has(row.submission_id)
                    ? `Comments for ${row.student_label}, has unread messages`
                    : `Comments for ${row.student_label}`
                }
                onClick={() =>
                  onOpen(
                    { activityId: row.activity_id, studentId: row.student_id, submissionId: row.submission_id },
                    row.student_label
                  )
                }
              >
                <span>Comments</span>
                {unread.data?.has(row.submission_id) && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    Unread
                  </Badge>
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
      </CardContent>
    </Card>
  );
}
