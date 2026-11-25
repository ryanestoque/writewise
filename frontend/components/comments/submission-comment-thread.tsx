"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Camera, Eye, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { useCommentActions, useCommentThread } from "@/lib/hooks/use-comments";
import { useNotificationRead } from "@/lib/hooks/use-notifications";
import { canAcknowledge } from "@/lib/comments/data";
import { buildCommentDraftKey } from "@/lib/comments/drafts";
import { commentFeedback, formatTeacherLabel } from "@/lib/comments/presentation";
import type { CommentLocation, CommentWorksheetContext, ThreadTarget } from "@/lib/comments/types";
import { matchesCommentLocation } from "@/lib/comments/selection";
import { ApiError } from "@/lib/utils/api-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDate, getRelativeTime, normalizeActivityPrompt } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { CommentComposer } from "./comment-composer";
import { ThreadEntryView } from "./thread-entry";

const READ_ONLY = {
  unassigned: "This activity is no longer assigned. Past notes stay readable.",
  archived: "This activity is archived. Notes are read-only until it is unarchived.",
  locked: "The teacher has closed new notes on this worksheet.",
};

const STATUS_LABELS = {
  processing: "Analyzing strokes",
  rejected: "Needs a new photo",
  completed: "Uploaded",
  returned: "Returned for redo",
};

export function SubmissionCommentThread({
  userId,
  target,
  open,
  location,
  studentName,
  teacherName,
  compactHeader = false,
  showCompactMeta = false,
  worksheetContext,
}: {
  userId: string;
  target: ThreadTarget;
  open: boolean;
  location?: CommentLocation;
  studentName?: string;
  teacherName?: string;
  compactHeader?: boolean;
  showCompactMeta?: boolean;
  worksheetContext?: CommentWorksheetContext;
}) {
  const query = useCommentThread(userId, target, open);
  const actions = useCommentActions(userId, target);
  const read = useNotificationRead(userId);
  const attempted = useRef(new Set<string>());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [unreadBoundary, setUnreadBoundary] = useState<{
    submissionId: string;
    version: number;
  } | null>(null);
  const thread = query.data;
  const matchesLocation = !thread || !location || matchesCommentLocation(thread, location);
  const refetch = query.refetch;
  const markRead = read.mutateAsync;
  const resetPost = actions.post.reset;
  const resetDelete = actions.deleteComment.reset;
  const resetLock = actions.setLocked.reset;
  const deleteCommentMutateAsync = actions.deleteComment.mutateAsync;

  const chronologicalEntries = useMemo(
    () => (thread ? [...thread.entries].reverse() : []),
    [thread]
  );

  const handleDeleteEntry = useCallback(
    async (id: string) => {
      setFeedback(null);
      await deleteCommentMutateAsync(id);
    },
    [deleteCommentMutateAsync]
  );

  useEffect(() => {
    if (query.isError || !query.isAccountActive || !matchesLocation) {
      resetPost();
      resetDelete();
      resetLock();
      attempted.current.clear();
    }
  }, [query.isError, query.isAccountActive, matchesLocation, resetPost, resetDelete, resetLock]);

  useEffect(() => {
    if (!open || !query.isAccountActive || !thread || !matchesLocation || !canAcknowledge(thread))
      return;
    const notice = thread.unread_notice!;
    const key = `${notice.id}:${notice.comment_version}`;
    if (attempted.current.has(key)) return;
    attempted.current.add(key);
    const submissionId = thread.submission_id;
    void markRead({ id: notice.id, expectedCommentVersion: notice.comment_version })
      .then(() => {
        setUnreadBoundary((prev) =>
          prev?.submissionId === submissionId
            ? prev
            : { submissionId, version: notice.comment_version }
        );
      })
      .catch((error) => {
        if (error instanceof ApiError && error.code === "COMMENT_READ_CONFLICT") {
          void refetch();
          return;
        }
        if (!(error instanceof Error && error.name === "AbortError"))
          setFeedback("Could not update unread status. Refresh to try again.");
      });
  }, [open, query.isAccountActive, thread, matchesLocation, markRead, refetch]);

  if (!open) return null;
  if (!matchesLocation)
    return (
      <div className="p-4" role="status">
        <Alert>
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>Conversation unavailable</AlertTitle>
          <AlertDescription>This conversation does not match the selected worksheet.</AlertDescription>
        </Alert>
      </div>
    );
  if (!query.isAccountActive)
    return (
      <div className="p-4" role="status">
        <Alert>
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>Sign-in required</AlertTitle>
          <AlertDescription>Sign in again to view these notes.</AlertDescription>
        </Alert>
      </div>
    );
  if (query.isError)
    return (
      <div className="flex flex-col gap-3 p-4" role="alert">
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>Could not load notes</AlertTitle>
          <AlertDescription>
            {query.error instanceof ApiError && query.error.code === "NOT_FOUND"
              ? "These notes are no longer available."
              : "Unable to retrieve notes from the server."}
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          size="sm"
          className="h-11 sm:h-9 px-4 cursor-pointer touch-manipulation"
          onClick={() => void query.retry()}
        >
          Try again
        </Button>
      </div>
    );
  if (!thread)
    return (
      <div className="flex flex-col gap-3 p-4" role="status" aria-label="Loading notes">
        <Skeleton className="h-5 w-44 rounded-md" />
        <Skeleton className="h-4 w-64 rounded-md" />
        <div className="flex flex-col gap-2 pt-3">
          <Skeleton className="h-16 w-3/4 rounded-xl" />
          <Skeleton className="h-16 w-2/3 ml-auto rounded-xl" />
        </div>
      </div>
    );

  const studentFirstName = studentName?.trim().split(/\s+/)[0] || "your child";

  const canRetakePhoto = Boolean(
    worksheetContext?.onSendNewPhoto &&
      (worksheetContext.canSendNewPhoto ||
        thread.submission_status === "returned" ||
        thread.submission_status === "rejected")
  );
  const showContextStrip =
    Boolean(worksheetContext?.onViewWorksheet) ||
    canRetakePhoto ||
    Boolean(worksheetContext?.targetText) ||
    showCompactMeta;

  const activeUnreadVersion =
    (unreadBoundary?.submissionId === thread.submission_id ? unreadBoundary.version : null) ??
    thread.unread_notice?.comment_version ??
    null;
  const firstUnreadEntryId =
    activeUnreadVersion !== null
      ? chronologicalEntries.find(
          (entry) =>
            entry.kind === "comment" &&
            !entry.is_mine &&
            entry.comment_version >= activeUnreadVersion
        )?.id ?? null
      : null;

  const formattedTeacherName = formatTeacherLabel(teacherName);

  const recipientLabel =
    thread.actor_role === "parent" ? formattedTeacherName : `${studentFirstName}'s family`;

  const emptyDescription = thread.can_post
    ? thread.actor_role === "parent"
      ? `Write a quick note to ${formattedTeacherName} about this worksheet.`
      : `Write a quick note to ${studentFirstName}'s family about this worksheet.`
    : "No notes were added before notes closed.";

  const hasSubHeaderContent = !compactHeader || showContextStrip || thread.can_lock || !thread.can_post;
  const compactPrimaryLabel = worksheetContext?.targetText
    ? `"${normalizeActivityPrompt(worksheetContext.targetText)}"`
    : thread.activity_title;

  return (
    <section aria-label="Worksheet notes" className="flex min-h-0 flex-1 flex-col">
      {hasSubHeaderContent ? (
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
          {!compactHeader && (
            <>
              <div className="flex flex-wrap items-baseline gap-2 min-w-0">
                {studentName && (
                  <h2 className="font-heading text-base font-semibold text-foreground truncate">
                    {studentName}
                  </h2>
                )}
                <p
                  className={cn(
                    "text-xs sm:text-sm truncate",
                    studentName ? "text-muted-foreground" : "font-heading font-semibold text-foreground"
                  )}
                >
                  {studentName ? `· ${thread.activity_title}` : thread.activity_title}
                </p>
              </div>
              <p className="text-muted-foreground text-xs">
                Uploaded{" "}
                <time
                  dateTime={thread.submitted_at}
                  className="font-sans tabular-nums font-medium text-foreground/80"
                >
                  {formatDate(thread.submitted_at)} ({getRelativeTime(thread.submitted_at)})
                </time>
                {" · "}
                <span className="font-medium text-foreground/80">
                  {STATUS_LABELS[thread.submission_status]}
                </span>
              </p>
            </>
          )}

          {compactHeader && showContextStrip && (
            <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                {(showCompactMeta || worksheetContext?.targetText) && (
                  <p
                    className="text-xs font-medium text-foreground line-clamp-2"
                    title={compactPrimaryLabel}
                  >
                    {compactPrimaryLabel}
                  </p>
                )}
                {showCompactMeta && (
                  <p className="text-muted-foreground text-xs font-sans tabular-nums truncate">
                    {formatDate(thread.submitted_at)}
                  </p>
                )}
              </div>
              {(worksheetContext?.onViewWorksheet || canRetakePhoto) && (
                <div className="flex items-center gap-2 sm:gap-1.5 shrink-0">
                  {worksheetContext?.onViewWorksheet && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={worksheetContext.onViewWorksheet}
                      aria-label="View worksheet"
                      className="h-10 sm:h-8 min-h-10 sm:min-h-8 px-3 sm:px-2.5 text-xs gap-1.5 cursor-pointer touch-manipulation"
                    >
                      <Eye className="size-3.5 shrink-0" aria-hidden="true" data-icon="inline-start" />
                      <span className="min-[360px]:hidden">View</span>
                      <span className="hidden min-[360px]:inline sm:hidden">Worksheet</span>
                      <span className="hidden sm:inline">View worksheet</span>
                    </Button>
                  )}
                  {canRetakePhoto && worksheetContext?.onSendNewPhoto && (
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      onClick={worksheetContext.onSendNewPhoto}
                      aria-label="Send new photo"
                      className="h-10 sm:h-8 min-h-10 sm:min-h-8 px-3 sm:px-2.5 text-xs gap-1.5 cursor-pointer touch-manipulation"
                    >
                      <Camera className="size-3.5 shrink-0" aria-hidden="true" data-icon="inline-start" />
                      <span className="min-[360px]:hidden">Photo</span>
                      <span className="hidden min-[360px]:inline sm:hidden">New photo</span>
                      <span className="hidden sm:inline">Send new photo</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {thread.can_lock && (
            <Button
              size="sm"
              variant="outline"
              className="h-11 sm:h-9 px-3 cursor-pointer touch-manipulation"
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
                  ? "Unlock notes"
                  : "Lock notes"}
            </Button>
          )}
        </div>
      ) : null}

      {(feedback || query.loadMoreError) && (
        <div className="border-b px-4 py-3" role="alert">
          <Alert variant="destructive" className="py-3">
            <AlertCircle className="size-4" aria-hidden="true" />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>{feedback ?? "Could not load older notes."}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-10 sm:h-8 min-h-10 sm:min-h-8 px-3 cursor-pointer touch-manipulation"
                onClick={() => {
                  attempted.current.clear();
                  setFeedback(null);
                  void query.retry();
                }}
              >
                Refresh
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Worksheet notes history"
            preserveScrollOnPrepend
          >
            <MessageScrollerContent className="gap-4 p-4">
              {thread.next_cursor && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 sm:h-8 min-h-10 sm:min-h-8 px-3.5 text-xs cursor-pointer touch-manipulation"
                    disabled={query.isLoadingMore || query.isFetching}
                    onClick={query.loadMore}
                  >
                    {query.isLoadingMore ? "Loading older notes…" : "Load older notes"}
                  </Button>
                </div>
              )}

              {chronologicalEntries.length === 0 && (
                <Empty className="my-auto p-6">
                  <EmptyMedia variant="icon">
                    <MessageSquare className="size-5 text-muted-foreground" aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyTitle>No notes yet</EmptyTitle>
                    <EmptyDescription>{emptyDescription}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}

              {chronologicalEntries.map((entry) => (
                <MessageScrollerItem
                  key={`${entry.kind}:${entry.id}`}
                  messageId={`${entry.kind}:${entry.id}`}
                >
                  {entry.kind === "comment" && entry.id === firstUnreadEntryId && (
                    <Marker variant="separator" className="mb-3 text-xs font-medium text-primary">
                      <MarkerContent>New</MarkerContent>
                    </Marker>
                  )}
                  <ThreadEntryView
                    entry={entry}
                    actorRole={thread.actor_role}
                    teacherName={teacherName}
                    deleting={actions.deleteComment.isPending}
                    onDelete={handleDeleteEntry}
                  />
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton
            direction="end"
            size="sm"
            className="h-10 sm:h-8 w-auto rounded-full px-3.5 shadow-warm-sm"
          >
            Jump to latest
          </MessageScrollerButton>
        </MessageScroller>
      </MessageScrollerProvider>

      {thread.can_post ? (
        <CommentComposer
          draftKey={buildCommentDraftKey(userId, thread.submission_id)}
          recipientLabel={recipientLabel}
          disabled={!thread.can_post}
          pending={actions.post.isPending}
          onSend={async (body) => {
            await actions.post.mutateAsync({ body });
          }}
        />
      ) : (
        <div className="bg-muted/35 text-muted-foreground shrink-0 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-3 text-xs sm:text-sm">
          {thread.read_only_reasons.map((reason) => READ_ONLY[reason]).join(" ")}
        </div>
      )}
    </section>
  );
}
