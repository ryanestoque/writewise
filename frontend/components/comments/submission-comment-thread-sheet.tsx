"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SubmissionCommentThread } from "./submission-comment-thread";
import type { CommentLocation } from "@/lib/comments/types";

export function SubmissionCommentThreadSheet({
  userId,
  target,
  open,
  onOpenChange,
  studentName,
}: {
  userId: string;
  target: CommentLocation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName?: string;
}) {
  return (
    <Sheet open={open && !!target} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b pr-14">
          <SheetTitle>Comments{studentName ? ` · ${studentName}` : ""}</SheetTitle>
          <SheetDescription>A private conversation about this worksheet upload.</SheetDescription>
        </SheetHeader>
        {open && target && (
          <SubmissionCommentThread
            key={`${userId}:${target.submissionId}`}
            userId={userId}
            target={target}
            location={target}
            open={open}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
