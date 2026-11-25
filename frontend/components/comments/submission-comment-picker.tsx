"use client";

import { useId, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const UPLOAD_STATUS_LABELS = {
  processing: "Analyzing",
  rejected: "Needs new photo",
  completed: "Uploaded",
  returned: "Returned",
} as const;

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
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>Sign-in required</AlertTitle>
          <AlertDescription>Sign in again to view notes.</AlertDescription>
        </Alert>
      </div>
    );
  if (query.isError)
    return (
      <div role="alert" className="flex flex-col gap-3 p-4">
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
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
      <div className="flex flex-col gap-3 p-4" role="status" aria-label="Loading worksheet uploads">
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
  const selectedIndex = rows.findIndex((row) => row.submission_id === selectedId);
  const selected = selectedIndex >= 0 ? rows[selectedIndex] : undefined;
  if (!rows.length)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No worksheet uploaded</EmptyTitle>
          <EmptyDescription>Notes are available after a worksheet photo is uploaded.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  const renderUploadSummary = (row: CommentAttempt, index: number, multiline = false) => {
    const timestamp = UPLOAD_TIME_FORMAT.format(new Date(row.submitted_at));
    const statusLabel = UPLOAD_STATUS_LABELS[row.submission_status];
    const isUnread = Boolean(unread.data?.has(row.submission_id));
    return (
      <span
        className={
          multiline
            ? "flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1"
            : "flex min-w-0 flex-1 items-center justify-between gap-2"
        }
      >
        <span className={multiline ? undefined : "truncate"}>
          {`Upload ${rows.length - index} · ${timestamp}`}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span>{statusLabel}</span>
          {isUnread && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              Unread
            </span>
          )}
        </span>
      </span>
    );
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
        <Field className="shrink-0 px-4 pt-1 pb-3">
          <FieldLabel htmlFor={id}>Worksheet upload</FieldLabel>
          <Select
            value={selected?.submission_id ?? ""}
            onValueChange={(value) => {
              if (value) handleUploadChange(value);
            }}
          >
            <SelectTrigger
              id={id}
              className="h-11 sm:h-9 w-full bg-card border-border font-sans tabular-nums cursor-pointer touch-manipulation"
            >
              <SelectValue placeholder="Choose an upload">
                {selected ? renderUploadSummary(selected, selectedIndex) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                {rows.map((row, index) => (
                  <SelectItem
                    key={row.submission_id}
                    value={row.submission_id}
                    className="font-sans tabular-nums cursor-pointer"
                  >
                    {renderUploadSummary(row, index, true)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {pendingSwitchId && (
            <Alert className="mt-2 bg-secondary/45">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>
                You have an unsent note on this upload. Keep editing or switch uploads anyway?
              </AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <span className="text-xs">
                  Your draft stays saved on this upload if you return to it later.
                </span>
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
              </AlertDescription>
            </Alert>
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
