"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Message, MessageContent, MessageFooter, MessageHeader } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Button } from "@/components/ui/button";
import { commentFeedback } from "@/lib/comments/presentation";
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

export function ThreadEntryView({
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
      ? (teacherName ?? "Teacher")
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
              <span className="text-muted-foreground italic">This note was deleted.</span>
            ) : (
              entry.body
            )}
          </BubbleContent>
        </Bubble>
        <MessageFooter className="flex-wrap gap-2">
          {time}
          {entry.is_mine && !entry.deleted_at && !confirm && (
            <Button
              size="xs"
              variant="ghost"
              className="h-10 sm:h-7 min-h-10 sm:min-h-7 px-2.5 cursor-pointer touch-manipulation"
              onClick={() => {
                setDeleteError(null);
                setConfirm(true);
              }}
            >
              Delete
            </Button>
          )}
        </MessageFooter>
        {confirm && !entry.deleted_at && (
          <Alert role="group" aria-label="Delete your note">
            <AlertTitle>Delete this note?</AlertTitle>
            <AlertDescription className="flex flex-col gap-2.5">
              <span>Its text will be removed for everyone.</span>
              {deleteError && (
                <span role="alert" className="text-destructive text-xs sm:text-sm">
                  {deleteError}
                </span>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-11 sm:h-8 min-h-11 sm:min-h-8 w-full sm:w-auto cursor-pointer touch-manipulation"
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
                  {deleting ? "Deleting…" : "Delete note"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 sm:h-8 min-h-11 sm:min-h-8 w-full sm:w-auto cursor-pointer touch-manipulation"
                  disabled={deleting}
                  onClick={() => {
                    setDeleteError(null);
                    setConfirm(false);
                  }}
                >
                  Keep note
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </MessageContent>
    </Message>
  );
}
