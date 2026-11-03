"use client";

import { Bell } from "lucide-react";
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
import { NotificationRowItem } from "./notification-row";
import type { NotificationLabels, NotificationRow } from "@/lib/notifications/data";

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
  return (
    <div className="flex flex-col gap-2">
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
        <Empty className="py-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Bell />
            </EmptyMedia>
            <EmptyTitle>No notifications yet</EmptyTitle>
            <EmptyDescription>Activity updates will appear here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ScrollArea className="h-[min(60vh,24rem)]">
          <ul aria-label="Notifications" className="pr-3">
            {rows.map((row) => (
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
