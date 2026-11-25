"use client";

import { Sheet } from "@/components/ui/sheet";
import { CommentSheetContent } from "./comment-sheet-shell";
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
  return (
    <Sheet open={open && !!target} onOpenChange={onOpenChange}>
      <CommentSheetContent
        audience={audience}
        activityTitle={activityTitle}
        studentName={studentName}
      >
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
      </CommentSheetContent>
    </Sheet>
  );
}
