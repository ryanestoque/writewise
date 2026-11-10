"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { useCommentAttempts, useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import { selectCommentAttempt } from "@/lib/comments/selection";
import type { CommentAttempt, WorkCommentScope } from "@/lib/comments/types";
import { SubmissionCommentThread } from "./submission-comment-thread";

export function SubmissionCommentPicker({ userId, scope, activeSubmissionId, explicitSubmissionId, open }: {
  userId: string; scope: WorkCommentScope; activeSubmissionId: string | null;
  explicitSubmissionId?: string; open: boolean;
}) {
  const query = useCommentAttempts(userId, scope, open);
  if (!open) return null;
  if (!query.isAccountActive) return <p role="status" className="p-4">Sign in again to view comments.</p>;
  if (query.isError) return <div role="status" className="flex flex-col gap-3 p-4">
    <p>Could not load worksheet uploads.</p>
    <Button variant="outline" onClick={() => void query.refetch()}>Try again</Button>
  </div>;
  if (!query.data) return <p role="status" className="p-4">Loading worksheet uploads…</p>;
  return <LoadedPicker key={`${userId}:${scope.activityId}:${scope.studentId}`} userId={userId}
    rows={query.data} activeSubmissionId={activeSubmissionId} explicitSubmissionId={explicitSubmissionId} />;
}

function LoadedPicker({ userId, rows, activeSubmissionId, explicitSubmissionId }: {
  userId: string; rows: CommentAttempt[]; activeSubmissionId: string | null; explicitSubmissionId?: string;
}) {
  const id = useId();
  const [selectedId, setSelectedId] = useState(() => selectCommentAttempt(rows, activeSubmissionId, explicitSubmissionId)?.submission_id ?? null);
  const unread = useUnreadCommentThreads(userId);
  const selected = rows.find(row => row.submission_id === selectedId);
  if (!rows.length) return <Empty><EmptyHeader><EmptyTitle>No worksheet uploaded</EmptyTitle>
    <EmptyDescription>Comments are available after a worksheet is uploaded.</EmptyDescription>
  </EmptyHeader></Empty>;
  return <div className="flex min-h-0 flex-1 flex-col">
    <Field className="shrink-0 border-b p-4">
      <FieldLabel htmlFor={id}>Worksheet upload</FieldLabel>
      <NativeSelect id={id} className="w-full" value={selected?.submission_id ?? ""}
        onChange={event => setSelectedId(event.target.value)}>
        <NativeSelectOption value="" disabled>Choose an upload</NativeSelectOption>
        <NativeSelectOptGroup label="Worksheet uploads">
          {rows.map((row, index) => <NativeSelectOption key={row.submission_id} value={row.submission_id}>
            Upload {rows.length - index} · {new Date(row.submitted_at).toLocaleString()}
            {" · "}{{ processing: "Analyzing", rejected: "Needs a new photo", completed: "Uploaded", returned: "Returned" }[row.submission_status]}
            {unread.data?.has(row.submission_id) ? " · Unread comments" : ""}
          </NativeSelectOption>)}
        </NativeSelectOptGroup>
      </NativeSelect>
    </Field>
    {selected ? <SubmissionCommentThread key={`${userId}:${selected.submission_id}`} userId={userId}
      target={{ submissionId: selected.submission_id }}
      location={{ submissionId: selected.submission_id, activityId: selected.activity_id, studentId: selected.student_id }} open />
      : <p role="status" className="p-4">Choose an upload to view its comments. The previous upload may no longer be available.</p>}
  </div>;
}
