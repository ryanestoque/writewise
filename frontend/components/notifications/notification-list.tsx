"use client";

import { useState } from "react";
import { isToday, isYesterday } from "date-fns";
import { PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { NotificationRowItem } from "./notification-row";
import type { NotificationLabels, NotificationRow } from "@/lib/notifications/data";

type FilterTab = "all" | "unread" | "notes";

type TemporalGroup = {
  title: string;
  rows: NotificationRow[];
};

function groupRowsByTime(rows: NotificationRow[]): TemporalGroup[] {
  const today: NotificationRow[] = [];
  const yesterday: NotificationRow[] = [];
  const earlier: NotificationRow[] = [];

  for (const row of rows) {
    const d = new Date(row.created_at);
    if (isToday(d)) {
      today.push(row);
    } else if (isYesterday(d)) {
      yesterday.push(row);
    } else {
      earlier.push(row);
    }
  }

  const groups: TemporalGroup[] = [];
  if (today.length > 0) groups.push({ title: "Today", rows: today });
  if (yesterday.length > 0) groups.push({ title: "Yesterday", rows: yesterday });
  if (earlier.length > 0) groups.push({ title: "Earlier", rows: earlier });
  return groups;
}

export function NotificationList({
  rows,
  labels,
  role,
  loading,
  error,
  retry,
  hasMore,
  loadingMore,
  loadMore,
  pendingId,
  onRead,
  onActivate,
}: {
  rows: NotificationRow[];
  labels: NotificationLabels;
  role: "teacher" | "parent";
  loading: boolean;
  error: boolean;
  retry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  pendingId: string | null;
  onRead: (id: string) => void;
  onActivate: (row: NotificationRow) => void;
}) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const unreadRows = rows.filter((r) => r.read_at === null);
  const noteRows = rows.filter((r) => r.type === "comment_posted");

  const filteredRows =
    filter === "unread" ? unreadRows : filter === "notes" ? noteRows : rows;

  const groups = groupRowsByTime(filteredRows);

  return (
    <div className="flex flex-col gap-2">
      {/* Category Filter Pills (All / Unread / Notes) */}
      {rows.length > 0 && (
        <div className="flex items-center gap-1.5 border-b border-border/40 pb-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
              filter === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            All ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
              filter === "unread"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            Unread{unreadRows.length > 0 ? ` (${unreadRows.length})` : ""}
          </button>
          {noteRows.length > 0 && (
            <button
              type="button"
              onClick={() => setFilter("notes")}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                filter === "notes"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Notes ({noteRows.length})
            </button>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs"
        >
          <p>Could not refresh notifications. Your last updates are still shown.</p>
          <Button variant="outline" size="xs" onClick={retry}>
            Try again
          </Button>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div role="status" aria-label="Loading notifications" className="flex flex-col gap-3 py-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : rows.length === 0 && !error ? (
        <Empty className="py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-secondary text-primary">
              <PenTool className="size-5" aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>All caught up!</EmptyTitle>
            <EmptyDescription>
              New cursive practice submissions, teacher notes, and diagnostic scores will appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : filteredRows.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          <p className="font-medium text-foreground">No {filter} notifications</p>
          <p className="mt-1">
            {filter === "unread"
              ? "You've read all recent notifications."
              : "No private notes or comments found."}
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[min(60vh,24rem)]">
          <div className="pr-3">
            {groups.map((group) => (
              <div key={group.title} className="mb-2 last:mb-0">
                <div className="sticky top-0 z-10 bg-popover/95 backdrop-blur-xs px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/75">
                  {group.title}
                </div>
                <ul aria-label={`${group.title} notifications`}>
                  {group.rows.map((row) => (
                    <NotificationRowItem
                      key={row.id}
                      row={row}
                      labels={labels}
                      role={role}
                      pending={row.id === pendingId}
                      onRead={onRead}
                      onActivate={onActivate}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {hasMore && (
        <Button variant="outline" size="sm" disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
