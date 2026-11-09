"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StudentWorkThread } from "./student-work-thread";
import { threadPair, type ThreadTarget } from "@/lib/comments/types";

export function StudentWorkThreadSheet({
  userId,
  target,
  open,
  onOpenChange,
  studentName,
}: {
  userId: string;
  target: ThreadTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName?: string;
}) {
  return (
    <Sheet open={open && !!target} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b pr-14">
          <SheetTitle>Comments{studentName ? ` · ${studentName}` : ""}</SheetTitle>
          <SheetDescription>A private conversation about this child’s activity.</SheetDescription>
        </SheetHeader>
        {open && target && (
          <StudentWorkThread
            key={`${userId}:${threadPair(target)}`}
            userId={userId}
            target={target}
            open={open}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
