"use client";

import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCommentAccountId } from "@/lib/hooks/use-comments";
import { SubmissionCommentThread } from "./submission-comment-thread";
import type { CommentLocation } from "@/lib/comments/types";

export function SubmissionCommentTabs({ submissionId, open = true, initialView = "details", children, location }: {
  submissionId?: string; open?: boolean; initialView?: "details" | "comments"; children: ReactNode; location?: CommentLocation;
}) {
  const userId = useCommentAccountId();
  const [view, setView] = useState<"details" | "comments">(initialView);
  if (!submissionId) return <>{children}</>;
  return <Tabs value={view} onValueChange={value => setView(value as "details" | "comments")}
    className="flex min-h-0 flex-1 flex-col">
    <TabsList className="mx-4 mt-3 shrink-0" aria-label="Submission view">
      <TabsTrigger value="details">Details</TabsTrigger>
      <TabsTrigger value="comments">Comments</TabsTrigger>
    </TabsList>
    <TabsContent value="details" className="flex min-h-0 flex-1 flex-col">{children}</TabsContent>
    <TabsContent value="comments" className="flex min-h-0 flex-1 flex-col">
      {open && view === "comments" && (userId ?
        <div className="flex min-h-72 min-w-0 flex-1 flex-col">
          <SubmissionCommentThread key={`${userId}:${submissionId}`} userId={userId} target={{ submissionId }} location={location} open />
        </div> : <p role="status" className="p-4">Loading conversation…</p>)}
    </TabsContent>
  </Tabs>;
}
