"use client";

import { useId, useState } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { commentFeedback } from "@/lib/comments/presentation";
import { clearCommentDraft, getCommentDraft, setCommentDraft } from "@/lib/comments/drafts";
import { cn } from "@/lib/utils";

export function CommentComposer({
  disabled,
  pending,
  onSend,
  draftKey,
  recipientLabel,
}: {
  disabled: boolean;
  pending: boolean;
  onSend: (body: string) => Promise<void>;
  draftKey?: string;
  recipientLabel?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(() => getCommentDraft(draftKey));
  const [prevDraftKey, setPrevDraftKey] = useState(draftKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (draftKey !== prevDraftKey) {
    setPrevDraftKey(draftKey);
    setDraft(getCommentDraft(draftKey));
    setError(null);
  }

  const body = draft.trim();
  const rawCount = Array.from(draft).length;
  const trimmedCount = Array.from(body).length;
  const overLimit = trimmedCount > 1000;
  const valid = trimmedCount > 0 && !overLimit && !body.includes("\0");
  const displayCount = overLimit ? trimmedCount : rawCount;

  const updateDraft = (next: string) => {
    setDraft(next);
    setCommentDraft(draftKey, next);
  };

  return (
    <form
      className="bg-card shrink-0 border-t px-4 py-3 sm:py-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!valid || disabled || pending || busy) return;
        setBusy(true);
        setError(null);
        try {
          await onSend(body);
          clearCommentDraft(draftKey);
          setDraft("");
        } catch (failure) {
          if (!(failure instanceof Error && failure.name === "AbortError"))
            setError(commentFeedback(failure));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field data-invalid={overLimit || undefined}>
        <FieldLabel htmlFor={id}>
          {recipientLabel ? `Note for ${recipientLabel}` : "Your note"}
        </FieldLabel>
        <Textarea
          className="max-h-32 overflow-y-auto"
          id={id}
          value={draft}
          rows={3}
          disabled={disabled || pending || busy}
          aria-describedby={error ? `${id}-count ${id}-error` : `${id}-count`}
          aria-invalid={overLimit || undefined}
          aria-keyshortcuts="Control+Enter Meta+Enter"
          placeholder="Write a note or question…"
          onChange={(event) => updateDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <FieldDescription
            id={`${id}-count`}
            className={cn("font-sans tabular-nums", overLimit && "text-destructive")}
          >
            {displayCount}/1000 characters
          </FieldDescription>
          <Button
            type="submit"
            size="sm"
            className="h-11 sm:h-9 px-4 cursor-pointer touch-manipulation"
            disabled={disabled || pending || busy || !valid}
          >
            {pending || busy ? "Sending…" : "Send note"}
          </Button>
        </div>
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </Field>
    </form>
  );
}
