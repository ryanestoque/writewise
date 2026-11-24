"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { WorkCommentScope } from "@/lib/comments/types";
import { SubmissionCommentPicker } from "./submission-comment-picker";

export function WorkCommentsButton({
  scope,
  activeSubmissionId,
  studentName,
  activityTitle,
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
  hasUnread?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  className?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const accessibleLabel = activityTitle
    ? `Teacher comments for ${activityTitle}${hasUnread ? ", unread comments" : ""}`
    : studentName
      ? `Comments for ${studentName}${hasUnread ? ", unread comments" : ""}`
      : `Teacher comments${hasUnread ? ", unread comments" : ""}`;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-11 sm:h-9 text-xs sm:text-sm font-medium gap-1.5 cursor-pointer border-border/80 hover:bg-muted/50",
                className
              )}
              aria-label={accessibleLabel}
            />
          }
        >
          <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>Comments</span>
          {hasUnread && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              Unread
            </span>
          )}
        </SheetTrigger>
      )}
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b pr-14">
          <SheetTitle>
            Teacher comments
            {activityTitle ? ` · ${activityTitle}` : studentName ? ` · ${studentName}` : ""}
          </SheetTitle>
          <SheetDescription>View and send private teacher feedback for this worksheet.</SheetDescription>
        </SheetHeader>
        {open && <PickerContent scope={scope} activeSubmissionId={activeSubmissionId} studentName={studentName} />}
      </SheetContent>
    </Sheet>
  );
}

function PickerContent({
  scope,
  activeSubmissionId,
  studentName,
}: {
  scope: WorkCommentScope;
  activeSubmissionId: string | null;
  studentName?: string;
}) {
  const userId = useCommentAccountId();
  return userId ? (
    <SubmissionCommentPicker
      userId={userId}
      scope={scope}
      activeSubmissionId={activeSubmissionId}
      studentName={studentName}
      open
    />
  ) : (
    <p role="status" className="p-4">
      Loading conversation…
    </p>
  );
}
