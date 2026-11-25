"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SubmissionCommentThread } from "./submission-comment-thread";
import type { CommentLocation, CommentWorksheetContext } from "@/lib/comments/types";

export function SubmissionCommentThreadSheet({
  userId,
  target,
  open,
  onOpenChange,
  studentName,
  teacherName,
  activityTitle,
  audience = "teacher",
  worksheetContext,
}: {
  userId: string;
  target: CommentLocation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName?: string;
  teacherName?: string;
  activityTitle?: string;
  audience?: "parent" | "teacher";
  worksheetContext?: CommentWorksheetContext;
}) {
  const isParent = audience === "parent";
  const title = isParent
    ? (activityTitle || (studentName ? `Notes · ${studentName}` : "Notes"))
    : (activityTitle || studentName || "Comments");
  const description = isParent
    ? "Message your child's teacher about this worksheet."
    : "A private conversation about this worksheet upload.";

  return (
    <Sheet open={open && !!target} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="shrink-0 px-4 pt-4 pb-2 pr-14">
          <SheetTitle className="line-clamp-2" title={title}>
            {title}
          </SheetTitle>
          <SheetDescription className="sr-only">{description}</SheetDescription>
        </SheetHeader>
        {open && target && (
          <SubmissionCommentThread
            key={`${userId}:${target.submissionId}`}
            userId={userId}
            target={target}
            location={target}
            studentName={studentName}
            teacherName={teacherName}
            compactHeader
            showCompactMeta
            worksheetContext={worksheetContext}
            open={open}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
