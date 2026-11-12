"use client";

import { useState } from "react";
import { Message, MessageContent, MessageFooter, MessageHeader } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Marker, MarkerContent } from "@/components/ui/marker";
import { Button } from "@/components/ui/button";
import type { ThreadEntry } from "@/lib/comments/types";

const REASONS = {
  wrong_worksheet: "Different worksheet needed",
  blurry_or_cropped: "Clearer photo needed",
  wrong_target_text: "Different practice text needed",
  incomplete: "Worksheet needs completing",
  other: "Another attempt requested",
};

export function ThreadEntryView({
  entry,
  onDelete,
  deleting = false,
}: {
  entry: ThreadEntry;
  onDelete: (id: string) => Promise<void>;
  deleting?: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const time = (
    <time dateTime={entry.event_at}>
      {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(entry.event_at)
      )}
    </time>
  );
  if (entry.kind === "return")
    return (
      <Marker className="rounded-xl border px-4 py-3">
        <MarkerContent className="flex flex-col gap-1">
          <span className="text-foreground font-medium">{REASONS[entry.return_reason]}</span>
          {entry.return_note && (
            <span className="break-words whitespace-pre-wrap">{entry.return_note}</span>
          )}
          <span className="text-xs">{time}</span>
        </MarkerContent>
      </Marker>
    );
  return (
    <Message align={entry.is_mine ? "end" : "start"}>
      <MessageContent>
        <MessageHeader>
          {entry.is_mine ? "You" : entry.author_role === "teacher" ? "Teacher" : "Parent"}
        </MessageHeader>
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
          {entry.is_mine && !entry.deleted_at && !confirm && (
            <Button size="xs" variant="ghost" onClick={() => setConfirm(true)}>
              Delete
            </Button>
          )}
        </MessageFooter>
        {confirm && !entry.deleted_at && (
          <div
            role="group"
            aria-label="Delete your comment"
            className="rounded-xl border p-3 text-sm"
          >
            <p>Delete this comment? Its text will be removed for everyone.</p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={deleting}
                onClick={async () => {
                  try {
                    await onDelete(entry.id);
                    setConfirm(false);
                  } catch {
                    /* The thread shows fixed error feedback. */
                  }
                }}
              >
                {deleting ? "Deleting…" : "Delete comment"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={deleting}
                onClick={() => setConfirm(false)}
              >
                Keep comment
              </Button>
            </div>
          </div>
        )}
      </MessageContent>
    </Message>
  );
}
