"use client";

import type { ReactNode } from "react";
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function getCommentSheetCopy({
  audience = "teacher",
  activityTitle,
  studentName,
}: {
  audience?: "parent" | "teacher";
  activityTitle?: string;
  studentName?: string;
}) {
  const isParent = audience === "parent";
  const title = isParent
    ? activityTitle || (studentName ? `Comments · ${studentName}` : "Comments")
    : activityTitle || studentName || "Comments";
  const description = isParent
    ? "Message your child's teacher about this worksheet."
    : "Private conversation about this worksheet upload.";

  return { isParent, title, description };
}

export function CommentSheetContent({
  audience = "teacher",
  activityTitle,
  studentName,
  className,
  children,
}: {
  audience?: "parent" | "teacher";
  activityTitle?: string;
  studentName?: string;
  className?: string;
  children: ReactNode;
}) {
  const { title, description } = getCommentSheetCopy({
    audience,
    activityTitle,
    studentName,
  });

  return (
    <SheetContent className={cn("w-full overflow-y-auto sm:max-w-lg", className)}>
      <SheetHeader className="shrink-0 px-4 pt-3.5 pb-2 pr-14 sm:pt-4">
        <SheetTitle className="line-clamp-2" title={title}>
          {title}
        </SheetTitle>
        <SheetDescription className="sr-only">{description}</SheetDescription>
      </SheetHeader>
      {children}
    </SheetContent>
  );
}
