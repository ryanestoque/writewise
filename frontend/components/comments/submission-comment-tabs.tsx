"use client";

import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommentAccountId, useUnreadCommentThreads } from "@/lib/hooks/use-comments";
import { SubmissionCommentThread } from "./submission-comment-thread";
import type { CommentLocation } from "@/lib/comments/types";
import { cn } from "@/lib/utils";

export function SubmissionCommentTabs({
  submissionId,
  open = true,
  initialView = "details",
  children,
  location,
  studentName,
  teacherName,
  detailsLabel = "Details",
  commentsLabel = "Comments",
  variant = "line",
  tabBarClassName,
  className,
  onViewChange,
}: {
  submissionId?: string;
  open?: boolean;
  initialView?: "details" | "comments";
  children: ReactNode;
  location?: CommentLocation;
  studentName?: string;
  teacherName?: string;
  detailsLabel?: string;
  commentsLabel?: string;
  variant?: "line" | "default";
  tabBarClassName?: string;
  className?: string;
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

  const hasUnread = Boolean(unread.data?.has(submissionId));

  return (
    <Tabs value={view} onValueChange={handleViewChange} className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {variant === "line" ? (
        <div
          className={cn(
            "w-full border-b border-border/80 bg-card/80 px-4 sm:px-6 shrink-0",
            tabBarClassName
          )}
        >
          <TabsList
            variant="line"
            className="w-full sm:w-fit flex h-auto -mb-px gap-4 sm:gap-6 rounded-none bg-transparent p-0"
            aria-label="Submission view"
          >
            <TabsTrigger
              value="details"
              className="min-h-11 sm:min-h-10 flex-1 sm:flex-none px-2 py-2 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap rounded-none touch-manipulation data-active:text-primary data-active:after:bg-primary"
            >
              {detailsLabel}
            </TabsTrigger>
            <TabsTrigger
              value="comments"
              className="min-h-11 sm:min-h-10 flex-1 sm:flex-none px-2 py-2 gap-2 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap rounded-none touch-manipulation data-active:text-primary data-active:after:bg-primary"
            >
              <span>{commentsLabel}</span>
              {hasUnread && (
                <Badge
                  variant="secondary"
                  className="h-auto rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary text-xs"
                >
                  Unread
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>
      ) : (
        <TabsList
          className={cn(
            "w-full h-auto group-data-horizontal/tabs:h-auto p-1 sm:p-1.5 rounded-xl bg-muted/60 border border-border/80 gap-1 sm:gap-1.5 shrink-0",
            tabBarClassName
          )}
          aria-label="Submission view"
        >
          <TabsTrigger
            value="details"
            className="flex-1 min-h-11 sm:min-h-0 h-auto group-data-[variant=default]/tabs-list:h-auto py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg group-data-[variant=default]/tabs-list:rounded-lg text-xs sm:text-sm font-semibold cursor-pointer touch-manipulation data-active:bg-surface dark:data-active:bg-card data-active:text-foreground data-active:shadow-xs data-active:border-border/60!"
          >
            {detailsLabel}
          </TabsTrigger>
          <TabsTrigger
            value="comments"
            className="flex-1 min-h-11 sm:min-h-0 h-auto group-data-[variant=default]/tabs-list:h-auto py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg group-data-[variant=default]/tabs-list:rounded-lg text-xs sm:text-sm font-semibold gap-1.5 sm:gap-2 cursor-pointer touch-manipulation data-active:bg-surface dark:data-active:bg-card data-active:text-foreground data-active:shadow-xs data-active:border-border/60!"
          >
            <span>{commentsLabel}</span>
            {hasUnread && (
              <Badge
                variant="secondary"
                className="h-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary"
              >
                Unread
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      )}

      <TabsContent value="details" className={cn("flex min-h-0 flex-1 flex-col", variant === "default" && "mt-3")}>
        {children}
      </TabsContent>
      <TabsContent value="comments" className={cn("flex min-h-0 flex-1 flex-col", variant === "default" && "mt-3")}>
        {open &&
          view === "comments" &&
          (userId ? (
            <div
              className={cn(
                "flex min-h-72 min-w-0 flex-1 flex-col",
                variant === "default" && "rounded-xl border border-border/80 bg-surface dark:bg-card shadow-xs overflow-hidden"
              )}
            >
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
            <div className="p-4 space-y-3" role="status" aria-label="Loading comments">
              <Skeleton className="h-6 w-48 rounded-md" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ))}
      </TabsContent>
    </Tabs>
  );
}
