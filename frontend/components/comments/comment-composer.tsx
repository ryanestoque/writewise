"use client";

import { useId, useState } from "react";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { commentFeedback } from "@/lib/comments/presentation";

export function CommentComposer({
  disabled,
  pending,
  onSend,
}: {
  disabled: boolean;
  pending: boolean;
  onSend: (body: string) => Promise<void>;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const body = draft.trim();
  const count = Array.from(body).length;
  const valid = count > 0 && count <= 1000 && !body.includes("\0");
  return (
    <form
      className="shrink-0 border-t p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!valid || disabled || pending || busy) return;
        setBusy(true);
        setError(null);
        try {
          await onSend(body);
          setDraft("");
        } catch (failure) {
          if (!(failure instanceof Error && failure.name === "AbortError"))
            setError(commentFeedback(failure));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field data-invalid={count > 1000 || undefined}>
        <FieldLabel htmlFor={id}>Your comment</FieldLabel>
        <Textarea
          className="max-h-32 overflow-y-auto"
          id={id}
          value={draft}
          rows={3}
          disabled={disabled || pending || busy}
          aria-describedby={`${id}-count ${id}-error`}
          aria-invalid={count > 1000 || undefined}
          placeholder="Ask a question or share a small update…"
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="flex items-center justify-between gap-3">
          <FieldDescription
            id={`${id}-count`}
            className={count > 1000 ? "text-destructive" : undefined}
          >
            {count}/1000 characters
          </FieldDescription>
          <Button type="submit" size="sm" disabled={disabled || pending || busy || !valid}>
            {pending || busy ? "Sending…" : "Send comment"}
          </Button>
        </div>
        <p id={`${id}-error`} role="status" className="text-destructive text-sm">
          {error}
        </p>
      </Field>
    </form>
  );
}
