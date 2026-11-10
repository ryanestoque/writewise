"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCommentAccountId } from "@/lib/hooks/use-comments";
import type { WorkCommentScope } from "@/lib/comments/types";
import { SubmissionCommentPicker } from "./submission-comment-picker";

export function WorkCommentsButton({ scope, activeSubmissionId }: {
  scope: WorkCommentScope; activeSubmissionId: string | null;
}) {
  const [open, setOpen] = useState(false);
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger render={<Button variant="outline" size="sm" />}>Comments</SheetTrigger>
    <SheetContent className="w-full sm:max-w-lg">
      <SheetHeader className="shrink-0 border-b pr-14">
        <SheetTitle>Private comments</SheetTitle>
        <SheetDescription>Choose a worksheet upload to open its conversation.</SheetDescription>
      </SheetHeader>
      {open && <PickerContent scope={scope} activeSubmissionId={activeSubmissionId} />}
    </SheetContent>
  </Sheet>;
}

function PickerContent({ scope, activeSubmissionId }: { scope: WorkCommentScope; activeSubmissionId: string | null }) {
  const userId = useCommentAccountId();
  return userId ? <SubmissionCommentPicker userId={userId} scope={scope} activeSubmissionId={activeSubmissionId} open />
    : <p role="status" className="p-4">Loading conversation…</p>;
}
