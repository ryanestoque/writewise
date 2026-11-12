"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import { useCommentActions, useCommentThread } from "@/lib/hooks/use-comments";
import { useNotificationRead } from "@/lib/hooks/use-notifications";
import { canAcknowledge } from "@/lib/comments/data";
import { commentFeedback } from "@/lib/comments/presentation";
import { ApiError } from "@/lib/utils/api-error";
import type { CommentLocation, ThreadTarget } from "@/lib/comments/types";
import { matchesCommentLocation } from "@/lib/comments/selection";
import { CommentComposer } from "./comment-composer";
import { ThreadEntryView } from "./thread-entry";

const READ_ONLY = {
  unassigned: "This activity is no longer assigned. Conversation history stays available.",
  archived: "This activity is archived. Comments are read-only until it is unarchived.",
  locked: "The teacher has locked this conversation. New comments are paused for everyone.",
};

export function SubmissionCommentThread({
  userId,
  target,
  open,
  location,
}: {
  userId: string;
  target: ThreadTarget;
  open: boolean;
  location?: CommentLocation;
}) {
  const query = useCommentThread(userId, target, open);
  const actions = useCommentActions(userId, target);
  const read = useNotificationRead(userId);
  const attempted = useRef(new Set<string>());
  const [feedback, setFeedback] = useState<string | null>(null);
  const thread = query.data;
  const matchesLocation = !thread || !location || matchesCommentLocation(thread, location);
  const refetch = query.refetch;
  const markRead = read.mutateAsync;
  const resetPost = actions.post.reset;
  const resetDelete = actions.deleteComment.reset;
  const resetLock = actions.setLocked.reset;
  useEffect(() => {
    if (query.isError || !query.isAccountActive || !matchesLocation) {
      resetPost();
      resetDelete();
      resetLock();
      attempted.current.clear();
    }
  }, [query.isError, query.isAccountActive, matchesLocation, resetPost, resetDelete, resetLock]);
  useEffect(() => {
    if (!open || !query.isAccountActive || !thread || !matchesLocation || !canAcknowledge(thread)) return;
    const notice = thread.unread_notice!;
    const key = `${notice.id}:${notice.comment_version}`;
    if (attempted.current.has(key)) return;
    attempted.current.add(key);
    void markRead({ id: notice.id, expectedCommentVersion: notice.comment_version }).catch(
      (error) => {
        if (error instanceof ApiError && error.code === "COMMENT_READ_CONFLICT") {
          void refetch();
          return;
        }
        if (!(error instanceof Error && error.name === "AbortError"))
          setFeedback("Could not update unread status. Refresh to try again.");
      }
    );
  }, [open, query.isAccountActive, thread, matchesLocation, markRead, refetch]);

  if (!open) return null;
  if (!matchesLocation) return <p role="status" className="p-4">This conversation is unavailable.</p>;
  if (!query.isAccountActive)
    return (
      <p className="p-4" role="status">
        Sign in again to view this conversation.
      </p>
    );
  if (query.isError)
    return (
      <div className="space-y-3 p-4" role="status">
        <p>
          {query.error instanceof ApiError && query.error.code === "NOT_FOUND"
            ? "This conversation is no longer available."
            : "Could not load the conversation."}
        </p>
        <Button variant="outline" onClick={() => void query.retry()}>
          Try again
        </Button>
      </div>
    );
  if (!thread)
    return (
      <p className="text-muted-foreground p-4" role="status">
        Loading conversation…
      </p>
    );
  return (
    <section aria-label="Private conversation" className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b px-4 py-3">
        <p className="font-medium">{thread.activity_title}</p>
        <p className="text-muted-foreground text-xs">
          Uploaded <time dateTime={thread.submitted_at}>{new Date(thread.submitted_at).toLocaleString()}</time>
          {" · "}{{ processing: "Analyzing", rejected: "Needs a new photo", completed: "Uploaded", returned: "Returned" }[thread.submission_status]}
        </p>
        <p className="text-muted-foreground text-xs">
          Visible to the teacher and all linked parents immediately, even before results are
          released.
        </p>
        {thread.read_only_reasons.map((reason) => (
          <p key={reason} className="text-muted-foreground text-sm">
            {READ_ONLY[reason]}
          </p>
        ))}
        {thread.can_lock && (
          <Button
            size="sm"
            variant="outline"
            disabled={actions.setLocked.isPending}
            onClick={() => {
              setFeedback(null);
              actions.setLocked.mutate(
                { locked: !thread.comments_locked },
                { onError: (error) => setFeedback(commentFeedback(error)) }
              );
            }}
          >
            {actions.setLocked.isPending
              ? "Saving…"
              : thread.comments_locked
                ? "Unlock comments"
                : "Lock comments"}
          </Button>
        )}
      </div>
      {(feedback || query.loadMoreError) && (
        <div className="border-b px-4 py-3" role="status">
          <p className="text-sm">{feedback ?? "Could not load older comments."}</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              attempted.current.clear();
              setFeedback(null);
              void query.retry();
            }}
          >
            Refresh conversation
          </Button>
        </div>
      )}
      {thread.next_cursor && (
        <div className="px-4 pt-3">
          <Button
            variant="outline"
            size="sm"
            disabled={query.isLoadingMore || query.isFetching}
            onClick={query.loadMore}
          >
            {query.isLoadingMore ? "Loading…" : "Load older comments"}
          </Button>
        </div>
      )}
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport aria-label="Conversation entries" preserveScrollOnPrepend>
            <MessageScrollerContent className="gap-4 p-4">
              {thread.entries.length === 0 && (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No comments yet. Start a conversation about this worksheet upload.
                </p>
              )}
              {[...thread.entries].reverse().map((entry) => (
                <MessageScrollerItem
                  key={`${entry.kind}:${entry.id}`}
                  messageId={`${entry.kind}:${entry.id}`}
                >
                  <ThreadEntryView
                    entry={entry}
                    deleting={actions.deleteComment.isPending}
                    onDelete={async (id) => {
                      setFeedback(null);
                      try {
                        await actions.deleteComment.mutateAsync(id);
                      } catch (error) {
                        setFeedback(commentFeedback(error));
                        throw error;
                      }
                    }}
                  />
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton direction="end" className="px-3">
            Jump to latest
          </MessageScrollerButton>
        </MessageScroller>
      </MessageScrollerProvider>
      <CommentComposer
        disabled={!thread.can_post}
        pending={actions.post.isPending}
        onSend={async (body) => {
          await actions.post.mutateAsync({ body });
        }}
      />
    </section>
  );
}
