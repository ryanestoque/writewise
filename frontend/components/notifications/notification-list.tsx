"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isToday, isYesterday } from "date-fns";
import { Check, PenTool } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
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
  loadMoreError,
  loadMore,
  pendingId,
  onRead,
  onActivate,
  containerRef,
  totalUnreadCount,
}: {
  rows: NotificationRow[];
  labels: NotificationLabels;
  role: "teacher" | "parent";
  loading: boolean;
  error: boolean;
  retry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError?: unknown;
  loadMore: () => void;
  pendingId: string | null;
  onRead: (id: string) => void;
  onActivate: (row: NotificationRow) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  totalUnreadCount?: number;
}) {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const fallbackRef = useRef<HTMLDivElement>(null);
  const listContainerRef = containerRef ?? fallbackRef;
  const wasLoadingMoreRef = useRef(false);
  const lastPendingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (wasLoadingMoreRef.current && !loadingMore) {
      wasLoadingMoreRef.current = false;
      if (!hasMore) {
        // Prevent focus loss to body when the Load More button unmounts
        listContainerRef.current?.focus();
      }
    }
  }, [hasMore, loadingMore, listContainerRef]);

  const unreadCount = useMemo(
    () => rows.filter((r) => r.read_at === null).length,
    [rows]
  );

  const displayedRows = useMemo(
    () => (filter === "unread" ? rows.filter((r) => r.read_at === null) : rows),
    [rows, filter]
  );

  useEffect(() => {
    if (pendingId) {
      lastPendingIdRef.current = pendingId;
    } else if (lastPendingIdRef.current) {
      const completedId = lastPendingIdRef.current;
      lastPendingIdRef.current = null;
      // If the row that was just marked read is no longer in displayedRows (e.g. in unread filter)
      // or if the focused check button inside the row unmounted (e.g. in all filter),
      // restore focus defensively so it is not dropped to body.
      const frame = requestAnimationFrame(() => {
        const active = typeof document !== "undefined" ? document.activeElement : null;
        const isLost = !active || active === document.body || !listContainerRef.current?.contains(active);
        if (isLost) {
          const rowLink = listContainerRef.current?.querySelector<HTMLElement>(
            `[data-notification-id="${completedId}"] a`
          );
          if (rowLink) {
            rowLink.focus();
          } else {
            listContainerRef.current?.focus();
          }
        }
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [pendingId, displayedRows, listContainerRef]);

  const groups = useMemo(() => {
    const today: NotificationRow[] = [];
    const yesterday: NotificationRow[] = [];
    const earlier: NotificationRow[] = [];

    for (const row of displayedRows) {
      const d = new Date(row.created_at);
      if (isToday(d)) {
        today.push(row);
      } else if (isYesterday(d)) {
        yesterday.push(row);
      } else {
        earlier.push(row);
      }
    }

    const result: { label: string; items: NotificationRow[] }[] = [];
    if (today.length > 0) result.push({ label: "Today", items: today });
    if (yesterday.length > 0) result.push({ label: "Yesterday", items: yesterday });
    if (earlier.length > 0) result.push({ label: "Earlier", items: earlier });
    return result;
  }, [displayedRows]);

  return (
    <div
      ref={listContainerRef}
      tabIndex={-1}
      aria-label="Notifications"
      className="flex-1 min-h-0 flex flex-col gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-lg"
    >
      {error && (
        <Alert
          variant="destructive"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg p-2.5 text-xs shrink-0"
        >
          <AlertDescription className="font-medium text-xs">
            Could not refresh notifications. Your last updates are still shown.
          </AlertDescription>
          <Button
            variant="outline"
            size="xs"
            onClick={retry}
            className="h-9 min-h-[44px] px-3 border-destructive/30 hover:bg-destructive/15 shrink-0 md:h-7 md:min-h-0 md:px-2.5 touch-manipulation cursor-pointer"
          >
            Try again
          </Button>
        </Alert>
      )}

      {/* Filter controls */}
      {rows.length > 0 && (
        <ToggleGroup
          value={[filter]}
          multiple={false}
          spacing={1}
          onValueChange={(vals) => {
            if (vals.length > 0) {
              setFilter(vals[0] as "all" | "unread");
            }
          }}
          aria-label="Filter notifications"
          className="w-full justify-start border-b pb-2 px-1 text-xs shrink-0"
        >
          <ToggleGroupItem
            value="all"
            className="h-auto min-h-[44px] md:min-h-[28px] rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 aria-pressed:bg-muted aria-pressed:text-foreground aria-pressed:font-semibold aria-pressed:shadow-2xs cursor-pointer touch-manipulation"
          >
            All ({rows.length})
          </ToggleGroupItem>
          <ToggleGroupItem
            value="unread"
            aria-label={
              totalUnreadCount !== undefined && totalUnreadCount > unreadCount
                ? `Unread (${unreadCount} loaded, ${totalUnreadCount} total)`
                : undefined
            }
            className="h-auto min-h-[44px] md:min-h-[28px] gap-1.5 rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 aria-pressed:bg-muted aria-pressed:text-foreground aria-pressed:font-semibold aria-pressed:shadow-2xs cursor-pointer touch-manipulation"
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <Badge
                variant="secondary"
                className="h-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary tabular-nums"
              >
                {unreadCount}
              </Badge>
            )}
          </ToggleGroupItem>
        </ToggleGroup>
      )}

      {/* Screen reader dynamic status announcement */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {loading && rows.length === 0
          ? "Loading notifications…"
          : filter === "all"
            ? `Showing all ${rows.length} notifications (${unreadCount} unread).`
            : displayedRows.length === 0 && totalUnreadCount && totalUnreadCount > 0 && hasMore
              ? `No unread in recent updates. You have ${totalUnreadCount} older unread notification${totalUnreadCount === 1 ? "" : "s"}.`
              : `Showing ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`}
      </div>

      {loading && rows.length === 0 ? (
        <div role="status" aria-label="Loading notifications" className="flex flex-col gap-3 py-2 flex-1">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : rows.length === 0 && !error ? (
        <Empty className="py-8 my-auto">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PenTool className="size-5 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle className="font-heading text-sm font-semibold">No notifications yet</EmptyTitle>
            <EmptyDescription className="text-xs text-muted-foreground">
              Worksheet submissions, practice attempts, and penmanship diagnostic results will appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : displayedRows.length === 0 && filter === "unread" ? (
        <Empty className="py-8 my-auto">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
              <Check className="size-4" aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle className="font-heading text-sm font-semibold">
              {totalUnreadCount && totalUnreadCount > 0 && hasMore
                ? "No unread in recent updates"
                : "All caught up!"}
            </EmptyTitle>
            <EmptyDescription className="text-xs text-muted-foreground">
              {totalUnreadCount && totalUnreadCount > 0 && hasMore
                ? `You have ${totalUnreadCount} older unread notification${totalUnreadCount === 1 ? "" : "s"}. Load older updates to view them.`
                : "No unread notifications right now."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="max-w-xs gap-2 pt-1">
            {totalUnreadCount && totalUnreadCount > 0 && hasMore ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="min-h-[44px] md:min-h-[36px] touch-manipulation cursor-pointer w-full text-xs font-medium"
                  disabled={loadingMore}
                  onClick={() => {
                    wasLoadingMoreRef.current = true;
                    loadMore();
                  }}
                >
                  {loadingMore ? (
                    <>
                      <Spinner data-icon="inline-start" />
                      Loading older updates…
                    </>
                  ) : (
                    "Load older updates"
                  )}
                </Button>
                {Boolean(loadMoreError) && (
                  <Alert
                    variant="destructive"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg p-2 text-xs w-full"
                  >
                    <AlertDescription className="font-medium text-xs">
                      Failed to load more.
                    </AlertDescription>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        wasLoadingMoreRef.current = true;
                        loadMore();
                      }}
                      className="h-9 min-h-[44px] md:h-7 md:min-h-0 px-3 md:px-2 border-destructive/30 hover:bg-destructive/15 text-xs touch-manipulation cursor-pointer shrink-0"
                    >
                      Retry
                    </Button>
                  </Alert>
                )}
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setFilter("all")}
                  className="h-10 md:h-8 text-xs text-muted-foreground hover:text-foreground touch-manipulation cursor-pointer"
                >
                  Show all notifications
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="xs"
                onClick={() => setFilter("all")}
                className="h-10 md:h-8 px-3 text-xs text-muted-foreground hover:text-foreground touch-manipulation cursor-pointer"
              >
                Show all notifications
              </Button>
            )}
          </EmptyContent>
        </Empty>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-3 pr-2 pb-2">
            {groups.map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <h3 className="sticky top-0 z-10 bg-popover/95 backdrop-blur-xs px-2 py-1 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                  {group.label}
                </h3>
                <ul aria-label={`${group.label} notifications`} className="flex flex-col gap-1">
                  {group.items.map((row) => (
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
            {hasMore && (
              <div className="flex flex-col gap-1.5 pt-2 pb-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] md:min-h-[36px] touch-manipulation cursor-pointer w-full text-xs font-medium"
                  disabled={loadingMore}
                  onClick={() => {
                    wasLoadingMoreRef.current = true;
                    loadMore();
                  }}
                >
                  {loadingMore ? (
                    <>
                      <Spinner data-icon="inline-start" />
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
                {Boolean(loadMoreError) && (
                  <Alert
                    variant="destructive"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg p-2 text-xs"
                  >
                    <AlertDescription className="font-medium text-xs">
                      Failed to load more.
                    </AlertDescription>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        wasLoadingMoreRef.current = true;
                        loadMore();
                      }}
                      className="h-9 min-h-[44px] md:h-7 md:min-h-0 px-3 md:px-2 border-destructive/30 hover:bg-destructive/15 text-xs touch-manipulation cursor-pointer shrink-0"
                    >
                      Retry
                    </Button>
                  </Alert>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
