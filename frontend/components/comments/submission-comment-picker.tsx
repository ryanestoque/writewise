"use client";

import { useId, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { hasCommentDraft, buildCommentDraftKey } from "@/lib/comments/drafts";
import { useCommentAttempts, useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import { selectCommentAttempt } from "@/lib/comments/selection";
import type { CommentAttempt, CommentWorksheetContext, WorkCommentScope } from "@/lib/comments/types";
import { SubmissionCommentThread } from "./submission-comment-thread";

const UPLOAD_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function SubmissionCommentPicker({
  userId,
  scope,
  activeSubmissionId,
  explicitSubmissionId,
  open,
  studentName,
  teacherName,
  worksheetContext,
}: {
  userId: string;
  scope: WorkCommentScope;
  activeSubmissionId: string | null;
  explicitSubmissionId?: string;
  open: boolean;
  studentName?: string;
  teacherName?: string;
  worksheetContext?: CommentWorksheetContext;
}) {
  const query = useCommentAttempts(userId, scope, open);
  if (!open) return null;
  if (!query.isAccountActive)
    return (
      <div className="p-4" role="status">
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Sign-in required</AlertTitle>
          <AlertDescription>Sign in again to view notes.</AlertDescription>
        </Alert>
      </div>
    );
  if (query.isError)
    return (
      <div role="alert" className="flex flex-col gap-3 p-4">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Could not load worksheet uploads</AlertTitle>
          <AlertDescription>Unable to retrieve upload attempts for this worksheet.</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          size="sm"
          className="h-11 sm:h-9 w-fit text-xs sm:text-sm font-medium cursor-pointer touch-manipulation"
          onClick={() => void query.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  if (!query.data)
    return (
      <div className="space-y-3 p-4" role="status" aria-label="Loading worksheet uploads">
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-16 w-3/4 rounded-xl" />
        <Skeleton className="h-16 w-2/3 ml-auto rounded-xl" />
      </div>
    );
  return (
    <LoadedPicker
      key={`${userId}:${scope.activityId}:${scope.studentId}`}
      userId={userId}
      rows={query.data}
      activeSubmissionId={activeSubmissionId}
      explicitSubmissionId={explicitSubmissionId}
      studentName={studentName}
      teacherName={teacherName}
      worksheetContext={worksheetContext}
    />
  );
}

function LoadedPicker({
  userId,
  rows,
  activeSubmissionId,
  explicitSubmissionId,
  studentName,
  teacherName,
  worksheetContext,
}: {
  userId: string;
  rows: CommentAttempt[];
  activeSubmissionId: string | null;
  explicitSubmissionId?: string;
  studentName?: string;
  teacherName?: string;
  worksheetContext?: CommentWorksheetContext;
}) {
  const id = useId();
  const [selectedId, setSelectedId] = useState(
    () => selectCommentAttempt(rows, activeSubmissionId, explicitSubmissionId)?.submission_id ?? null
  );
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const unread = useUnreadCommentThreads(userId);
  const selected = rows.find((row) => row.submission_id === selectedId);
  if (!rows.length)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No worksheet uploaded</EmptyTitle>
          <EmptyDescription>Notes are available after a worksheet photo is uploaded.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  const formatUploadLabel = (row: CommentAttempt, index: number) => {
    const timestamp = UPLOAD_TIME_FORMAT.format(new Date(row.submitted_at));
    const statusLabel = {
      processing: "Analyzing",
      rejected: "Needs a new photo",
      completed: "Uploaded",
      returned: "Returned",
    }[row.submission_status];
    const unreadLabel = unread.data?.has(row.submission_id) ? " · Unread" : "";
    return `Upload ${rows.length - index} · ${timestamp} · ${statusLabel}${unreadLabel}`;
  };

  const handleUploadChange = (nextSubmissionId: string) => {
    if (!nextSubmissionId || nextSubmissionId === selected?.submission_id) return;
    if (selected && hasCommentDraft(buildCommentDraftKey(userId, selected.submission_id))) {
      setPendingSwitchId(nextSubmissionId);
      return;
    }
    setPendingSwitchId(null);
    setSelectedId(nextSubmissionId);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {rows.length > 1 && (
        <Field className="shrink-0 border-b px-4 py-3">
          <FieldLabel htmlFor={id}>Worksheet upload</FieldLabel>
          <NativeSelect
            id={id}
            className="w-full font-sans tabular-nums"
            value={selected?.submission_id ?? ""}
            onChange={(event) => handleUploadChange(event.target.value)}
          >
            <NativeSelectOption value="" disabled>
              Choose an upload
            </NativeSelectOption>
            <NativeSelectOptGroup label="Worksheet uploads">
              {rows.map((row, index) => (
                <NativeSelectOption key={row.submission_id} value={row.submission_id}>
                  {formatUploadLabel(row, index)}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          </NativeSelect>
          {pendingSwitchId && (
            <div
              role="alert"
              className="mt-2 rounded-lg border border-border bg-secondary/45 p-3 text-xs sm:text-sm space-y-2"
            >
              <p className="text-foreground font-medium">
                You have an unsent note on this upload. Keep editing or switch uploads anyway?
              </p>
              <p className="text-muted-foreground text-xs">
                Your draft stays saved on this upload if you return to it later.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-11 sm:h-8 w-full sm:w-auto cursor-pointer touch-manipulation"
                  onClick={() => setPendingSwitchId(null)}
                >
                  Keep editing
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-11 sm:h-8 w-full sm:w-auto cursor-pointer touch-manipulation"
                  onClick={() => {
                    setSelectedId(pendingSwitchId);
                    setPendingSwitchId(null);
                  }}
                >
                  Switch upload
                </Button>
              </div>
            </div>
          )}
        </Field>
      )}
      {selected ? (
        <SubmissionCommentThread
          key={`${userId}:${selected.submission_id}`}
          userId={userId}
          target={{ submissionId: selected.submission_id }}
          location={{
            submissionId: selected.submission_id,
            activityId: selected.activity_id,
            studentId: selected.student_id,
          }}
          studentName={studentName}
          teacherName={teacherName}
          compactHeader
          showCompactMeta={rows.length === 1}
          worksheetContext={worksheetContext}
          open
        />
      ) : (
        <p role="status" className="p-4 text-sm text-muted-foreground">
          Choose an upload to view its notes. The previous upload may no longer be available.
        </p>
      )}
    </div>
  );
}
