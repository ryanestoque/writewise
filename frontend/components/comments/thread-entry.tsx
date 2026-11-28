"use client";

import { memo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Message, MessageContent, MessageFooter, MessageHeader } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { commentFeedback, formatTeacherLabel } from "@/lib/comments/presentation";
import type { ThreadEntry } from "@/lib/comments/types";

const REASONS = {
  wrong_worksheet: "Different worksheet needed",
  blurry_or_cropped: "Clearer photo needed",
  wrong_target_text: "Different practice text needed",
  incomplete: "Worksheet needs completing",
  other: "Another attempt requested",
};

const ENTRY_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const ThreadEntryView = memo(function ThreadEntryView({
  entry,
  onDelete,
  deleting = false,
  actorRole,
  teacherName,
}: {
  entry: ThreadEntry;
  onDelete: (id: string) => Promise<void>;
  deleting?: boolean;
  actorRole?: "teacher" | "parent";
  teacherName?: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const time = (
    <time dateTime={entry.event_at} className="font-sans tabular-nums">
      {ENTRY_TIME_FORMAT.format(new Date(entry.event_at))}
    </time>
  );
  if (entry.kind === "return")
    return (
      <Marker className="rounded-xl border border-primary/25 bg-secondary/45 px-4 py-3 text-foreground">
        <MarkerContent className="flex flex-col gap-1">
          <span className="text-primary text-xs font-medium">Teacher requested a new photo</span>
          <span className="text-foreground font-medium">{REASONS[entry.return_reason]}</span>
          {entry.return_note && (
            <span className="text-foreground/90 break-words whitespace-pre-wrap">
              {entry.return_note}
            </span>
          )}
          <span className="text-muted-foreground text-xs">{time}</span>
        </MarkerContent>
      </Marker>
    );

  const authorLabel = entry.is_mine
    ? "You"
    : entry.author_role === "teacher"
      ? formatTeacherLabel(teacherName)
      : actorRole === "parent"
        ? "Co-parent / Guardian"
        : "Parent";

  return (
    <Message align={entry.is_mine ? "end" : "start"}>
      <MessageContent>
        <MessageHeader>{authorLabel}</MessageHeader>
        <Bubble
          variant={entry.is_mine ? "secondary" : "outline"}
          align={entry.is_mine ? "end" : "start"}
        >
          <BubbleContent className="break-words whitespace-pre-wrap">
            {entry.deleted_at ? (
              <span className="text-muted-foreground italic">This comment was deleted.</span>
            ) : (
              entry.body
            )}
          </BubbleContent>
        </Bubble>
        <MessageFooter className="flex-wrap gap-2">
          {time}
          {entry.is_mine && !entry.deleted_at && (
            <AlertDialog
              open={confirm}
              onOpenChange={(next) => {
                if (!deleting) {
                  setDeleteError(null);
                  setConfirm(next);
                }
              }}
            >
              <AlertDialogTrigger
                render={
                  <Button
                    size="xs"
                    variant="ghost"
                    className="h-11 md:h-7 min-h-11 md:min-h-7 px-3 md:px-2.5 cursor-pointer touch-manipulation"
                  />
                }
              >
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Its text will be removed for everyone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteError && (
                  <Alert variant="destructive">
                    <AlertDescription>{deleteError}</AlertDescription>
                  </Alert>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Keep comment</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={deleting}
                    onClick={async () => {
                      setDeleteError(null);
                      try {
                        await onDelete(entry.id);
                        setConfirm(false);
                      } catch (error) {
                        setDeleteError(commentFeedback(error));
                      }
                    }}
                  >
                    {deleting ? (
                      <>
                        <Spinner data-icon="inline-start" aria-hidden="true" />
                        <span>Deleting…</span>
                      </>
                    ) : (
                      "Delete comment"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
});
