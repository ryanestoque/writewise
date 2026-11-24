"use client";

import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommentAccountId, useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import { SubmissionCommentThread } from "./submission-comment-thread";
import type { CommentLocation } from "@/lib/comments/types";

export function SubmissionCommentTabs({
  submissionId,
  open = true,
  initialView = "details",
  children,
  location,
  studentName,
  teacherName,
  commentsLabel = "Comments",
  onViewChange,
}: {
  submissionId?: string;
  open?: boolean;
  initialView?: "details" | "comments";
  children: ReactNode;
  location?: CommentLocation;
  studentName?: string;
  teacherName?: string;
  commentsLabel?: string;
  onViewChange?: (view: "details" | "comments") => void;
}) {
  const userId = useCommentAccountId();
  const unread = useUnreadCommentThreads(userId ?? "", open && !!submissionId && !!userId);
  const [view, setView] = useState<"details" | "comments">(initialView);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setView(initialView);
    }
  }

  if (!submissionId) return <>{children}</>;

  const handleViewChange = (value: string) => {
    const next = value as "details" | "comments";
    setView(next);
    onViewChange?.(next);
  };

  return (
    <Tabs value={view} onValueChange={handleViewChange} className="flex min-h-0 flex-1 flex-col">
      <TabsList className="mx-4 mt-3 shrink-0 h-auto min-h-10 sm:min-h-9" aria-label="Submission view">
        <TabsTrigger value="details" className="min-h-10 sm:min-h-9 px-3 touch-manipulation">
          Details
        </TabsTrigger>
        <TabsTrigger value="comments" className="min-h-10 sm:min-h-9 px-3 gap-2 touch-manipulation">
          {commentsLabel}
          {unread.data?.has(submissionId) && (
            <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              Unread
            </span>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="flex min-h-0 flex-1 flex-col">
        {children}
      </TabsContent>
      <TabsContent value="comments" className="flex min-h-0 flex-1 flex-col">
        {open &&
          view === "comments" &&
          (userId ? (
            <div className="flex min-h-72 min-w-0 flex-1 flex-col">
              <SubmissionCommentThread
                key={`${userId}:${submissionId}`}
                userId={userId}
                target={{ submissionId }}
                location={location}
                studentName={studentName}
                teacherName={teacherName}
                compactHeader
                open
              />
            </div>
          ) : (
            <div className="p-4 space-y-3" role="status" aria-label="Loading notes">
              <Skeleton className="h-6 w-48 rounded-md" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ))}
      </TabsContent>
    </Tabs>
  );
}
