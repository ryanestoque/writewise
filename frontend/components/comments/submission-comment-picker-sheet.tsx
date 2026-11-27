"use client";

import { useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Sheet, SheetTrigger } from "@/components/ui/sheet";
import { useCommentAccountId } from "@/lib/hooks/use-comments";
import type { CommentWorksheetContext, WorkCommentScope } from "@/lib/comments/types";
import { CommentSheetContent } from "./comment-sheet-shell";
import { SubmissionCommentPicker } from "./submission-comment-picker";

export function WorkCommentsButton({
  scope,
  activeSubmissionId,
  studentName,
  activityTitle,
  teacherName,
  audience = "teacher",
  worksheetContext,
  hasUnread = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  showTrigger = true,
  className,
}: {
  scope: WorkCommentScope;
  activeSubmissionId: string | null;
  studentName?: string;
  activityTitle?: string;
  teacherName?: string;
  audience?: "parent" | "teacher";
  worksheetContext?: CommentWorksheetContext;
  hasUnread?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  className?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const isParent = audience === "parent";
  const teacherDisplay = teacherName ?? "teacher";

  const accessibleLabel = isParent
    ? activityTitle
      ? `Comments for ${activityTitle}${hasUnread ? ", unread comments" : ""}`
      : `Comments with ${teacherDisplay}${hasUnread ? ", unread comments" : ""}`
    : activityTitle
      ? `Comments for ${activityTitle}${hasUnread ? ", unread comments" : ""}`
      : studentName
        ? `Comments for ${studentName}${hasUnread ? ", unread comments" : ""}`
        : `Comments${hasUnread ? ", unread comments" : ""}`;

  const wrappedContext = useMemo<CommentWorksheetContext | undefined>(() => {
    if (!worksheetContext) return undefined;
    return {
      ...worksheetContext,
      onViewWorksheet: worksheetContext.onViewWorksheet
        ? () => {
            setOpen(false);
            worksheetContext.onViewWorksheet?.();
          }
        : undefined,
      onSendNewPhoto: worksheetContext.onSendNewPhoto
        ? () => {
            setOpen(false);
            worksheetContext.onSendNewPhoto?.();
          }
        : undefined,
    };
  }, [worksheetContext, setOpen]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-11 md:h-9 min-h-11 md:min-h-9 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer border-border/80 hover:bg-muted/50 touch-manipulation",
                className
              )}
              aria-label={accessibleLabel}
            />
          }
        >
          <MessageSquare
            className="size-3.5 shrink-0 text-primary"
            aria-hidden="true"
            data-icon="inline-start"
          />
          <span className="truncate">Comments</span>
          {hasUnread && (
            <Badge
              variant="secondary"
              className="rounded-full bg-primary/15 px-1.5 sm:px-2 text-xs font-semibold text-primary shrink-0"
            >
              Unread
            </Badge>
          )}
        </SheetTrigger>
      )}
      <CommentSheetContent
        audience={audience}
        activityTitle={activityTitle}
        studentName={studentName}
      >
        {open && (
          <PickerContent
            scope={scope}
            activeSubmissionId={activeSubmissionId}
            studentName={studentName}
            teacherName={teacherName}
            worksheetContext={wrappedContext}
          />
        )}
      </CommentSheetContent>
    </Sheet>
  );
}

function PickerContent({
  scope,
  activeSubmissionId,
  studentName,
  teacherName,
  worksheetContext,
}: {
  scope: WorkCommentScope;
  activeSubmissionId: string | null;
  studentName?: string;
  teacherName?: string;
  worksheetContext?: CommentWorksheetContext;
}) {
  const userId = useCommentAccountId();
  return userId ? (
    <SubmissionCommentPicker
      userId={userId}
      scope={scope}
      activeSubmissionId={activeSubmissionId}
      studentName={studentName}
      teacherName={teacherName}
      worksheetContext={worksheetContext}
      open
    />
  ) : (
    <div className="flex flex-col gap-3 p-4" role="status" aria-label="Loading comments">
      <Skeleton className="h-5 w-44 rounded-md" />
      <Skeleton className="h-16 w-3/4 rounded-xl" />
      <Skeleton className="h-16 w-2/3 ml-auto rounded-xl" />
    </div>
  );
}
