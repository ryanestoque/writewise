"use client";

import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommentAccountId, useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import { SubmissionCommentThread } from "./submission-comment-thread";
import type { CommentLocation } from "@/lib/comments/types";

export function SubmissionCommentTabs({ submissionId, open = true, initialView = "details", children, location, studentName }: {
  submissionId?: string; open?: boolean; initialView?: "details" | "comments"; children: ReactNode; location?: CommentLocation; studentName?: string;
}) {
  const userId = useCommentAccountId();
  const unread = useUnreadCommentThreads(userId ?? "", open && !!submissionId && !!userId);
  const [view, setView] = useState<"details" | "comments">(initialView);
  if (!submissionId) return <>{children}</>;
  return <Tabs value={view} onValueChange={value => setView(value as "details" | "comments")}
    className="flex min-h-0 flex-1 flex-col">
    <TabsList className="mx-4 mt-3 shrink-0" aria-label="Submission view">
      <TabsTrigger value="details">Details</TabsTrigger>
      <TabsTrigger value="comments" className="gap-1.5">
        Comments
        {unread.data?.has(submissionId) && (
          <span className="inline-flex items-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
            Unread
          </span>
        )}
      </TabsTrigger>
    </TabsList>
    <TabsContent value="details" className="flex min-h-0 flex-1 flex-col">{children}</TabsContent>
    <TabsContent value="comments" className="flex min-h-0 flex-1 flex-col">
      {open && view === "comments" && (userId ?
        <div className="flex min-h-72 min-w-0 flex-1 flex-col">
          <SubmissionCommentThread
            key={`${userId}:${submissionId}`}
            userId={userId}
            target={{ submissionId }}
            location={location}
            studentName={studentName}
            open
          />
        </div> : (
          <div className="p-4 space-y-3" role="status" aria-label="Loading conversation">
            <Skeleton className="h-6 w-48 rounded-md" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ))}
    </TabsContent>
  </Tabs>;
}
