"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCommentAccountId } from "@/lib/hooks/use-comments";
import type { CommentWorksheetContext, WorkCommentScope } from "@/lib/comments/types";
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
      ? `Notes with ${teacherDisplay} for ${activityTitle}${hasUnread ? ", unread notes" : ""}`
      : `Notes with ${teacherDisplay}${hasUnread ? ", unread notes" : ""}`
    : activityTitle
      ? `Comments for ${activityTitle}${hasUnread ? ", unread comments" : ""}`
      : studentName
        ? `Comments for ${studentName}${hasUnread ? ", unread comments" : ""}`
        : `Comments${hasUnread ? ", unread comments" : ""}`;

  const sheetTitle = isParent
    ? `Notes with ${teacherDisplay}${activityTitle ? ` · ${activityTitle}` : ""}`
    : `Comments${studentName ? ` · ${studentName}` : activityTitle ? ` · ${activityTitle}` : ""}`;

  const sheetDescription = isParent
    ? "Message your child's teacher about this worksheet."
    : "Private conversation about this worksheet upload.";

  const wrappedContext: CommentWorksheetContext | undefined = worksheetContext
    ? {
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
      }
    : undefined;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-11 sm:h-9 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer border-border/80 hover:bg-muted/50 touch-manipulation",
                className
              )}
              aria-label={accessibleLabel}
            />
          }
        >
          <MessageSquare className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{isParent ? "Notes" : "Comments"}</span>
          {hasUnread && (
            <span className="inline-flex items-center rounded-full bg-primary/15 px-1.5 sm:px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-primary shrink-0">
              Unread
            </span>
          )}
        </SheetTrigger>
      )}
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b px-4 py-3.5 sm:px-6 sm:py-4 pr-14">
          <SheetTitle className="truncate">{sheetTitle}</SheetTitle>
          <SheetDescription>{sheetDescription}</SheetDescription>
        </SheetHeader>
        {open && (
          <PickerContent
            scope={scope}
            activeSubmissionId={activeSubmissionId}
            studentName={studentName}
            teacherName={teacherName}
            worksheetContext={wrappedContext}
          />
        )}
      </SheetContent>
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
    <div className="space-y-3 p-4" role="status" aria-label="Loading notes">
      <Skeleton className="h-5 w-44 rounded-md" />
      <Skeleton className="h-16 w-3/4 rounded-xl" />
      <Skeleton className="h-16 w-2/3 ml-auto rounded-xl" />
    </div>
  );
}
