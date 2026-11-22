"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationList } from "./notification-list";
import { createClient } from "@/lib/supabase/client";
import { purgeAccountCaches } from "@/lib/supabase/account-scope";
import { ApiError } from "@/lib/utils/api-error";
import { notificationKeys } from "@/lib/notifications/query-keys";
import type { NotificationLabels, NotificationRow } from "@/lib/notifications/data";
import {
  useNotificationCount,
  useNotificationFeed,
  useNotificationLabels,
  useNotificationRead,
  useNotificationReadAll,
} from "@/lib/hooks/use-notifications";

const EMPTY_ROWS: NotificationRow[] = [];
const EMPTY_LABELS: NotificationLabels = { students: {}, activities: {} };

export function NotificationBell({ userId, role }: { userId: string; role: "teacher" | "parent" }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(true);
  const isMobile = useIsMobile();
  const [sessionController, setSessionController] = useState(() => new AbortController());
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    abortRef.current = () => sessionController.abort();
  }, [sessionController]);

  const client = useQueryClient();
  const listContainerRef = useRef<HTMLDivElement>(null);
  const count = useNotificationCount(userId, active);
  const feed = useNotificationFeed(userId, open, active, sessionController.signal);
  const rows = feed.data?.rows ?? EMPTY_ROWS;
  const labels = useNotificationLabels(userId, rows, active);
  const read = useNotificationRead(userId, sessionController.signal);
  const readAll = useNotificationReadAll(userId, sessionController.signal);

  useEffect(() => {
    const clear = (id: string) => {
      purgeAccountCaches(client, id);
    };
    for (const [key] of client.getQueriesData({ queryKey: notificationKeys.root })) {
      if (typeof key[1] === "string" && key[1] !== userId) clear(key[1]);
    }
    for (const [key] of client.getQueriesData({ queryKey: ["gradebook"] })) {
      if (typeof key[1] === "string" && key[1] !== userId) clear(key[1]);
    }
    for (const [key] of client.getQueriesData({ queryKey: ["comments"] })) {
      if (typeof key[1] === "string" && key[1] !== userId) clear(key[1]);
    }
    const { data } = createClient().auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_OUT" ||
        (event === "INITIAL_SESSION" && !session) ||
        (session && session.user.id !== userId)
      ) {
        abortRef.current?.();
        setActive(false);
        setOpen(false);
        clear(userId);
      } else if (session?.user.id === userId) {
        setSessionController((prev) => (prev.signal.aborted ? new AbortController() : prev));
        setActive(true);
      }
    });
    return () => {
      data.subscription.unsubscribe();
      abortRef.current?.();
    };
  }, [client, userId]);

  const feedback = useCallback((error: unknown) => {
    if (error instanceof Error && error.name === "AbortError") return;
    toast.error(
      error instanceof ApiError && error.code === "UNAUTHORIZED"
        ? "Sign in again to update notifications."
        : "Could not mark notifications read. Try again."
    );
  }, []);

  const markRead = useCallback(
    (id: string) => {
      const row = rows.find((row) => row.id === id);
      if (row?.type === "comment_posted" && !row.comment_version) return;
      read.mutate(
        {
          id,
          ...(row?.type === "comment_posted" ? { expectedCommentVersion: row.comment_version! } : {}),
        },
        { onError: feedback }
      );
    },
    [feedback, read, rows]
  );

  const activate = useCallback(
    (row: NotificationRow) => {
      if (!row.read_at && row.type !== "comment_posted") markRead(row.id);
      setOpen(false);
    },
    [markRead]
  );

  const handleMarkAllRead = useCallback(() => {
    readAll.mutate(undefined, {
      onError: feedback,
      onSettled: () => {
        listContainerRef.current?.focus();
      },
    });
  }, [feedback, readAll]);

  const label =
    count.data === undefined || count.isError
      ? "Notifications, unread count unavailable"
      : `Notifications, ${count.data} unread`;

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) {
      void count.refetch();
    }
  };

  const triggerButton = (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      className="relative size-10 min-h-[44px] min-w-[44px] shrink-0 md:size-9 md:min-h-0 md:min-w-0"
      disabled={!active}
    >
      <Bell aria-hidden="true" />
      {count.data !== undefined && count.data > 0 && (
        <Badge
          aria-hidden="true"
          className="absolute -top-1 -right-1 min-w-5 justify-center rounded-full px-1 text-xs leading-none bg-primary text-primary-foreground font-semibold shadow-xs"
        >
          {count.data > 99 ? "99+" : count.data}
        </Badge>
      )}
    </Button>
  );

  const listElement = (
    <NotificationList
      rows={rows}
      labels={labels.data ?? EMPTY_LABELS}
      role={role}
      loading={feed.isPending && feed.isFetching}
      error={feed.isError || labels.isError}
      retry={() => {
        void feed.retry();
        void labels.refetch();
        void count.refetch();
      }}
      hasMore={feed.data?.hasMore ?? false}
      loadingMore={feed.isLoadingMore}
      loadMoreError={feed.loadMoreError}
      loadMore={() => feed.loadMore()}
      pendingId={read.isPending ? read.variables.id : null}
      onRead={markRead}
      onActivate={activate}
      containerRef={listContainerRef}
      totalUnreadCount={count.data}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open && active} onOpenChange={handleOpenChange} showSwipeHandle>
        <DrawerTrigger render={triggerButton} />
        <DrawerContent className="max-h-[85dvh] px-5 pb-6 pt-3 flex flex-col">
          <DrawerHeader className="flex-row items-center justify-between gap-2 border-b pb-3 pt-4 px-2 text-left shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <DrawerTitle className="font-heading text-base font-semibold text-foreground shrink-0">
                Notifications
              </DrawerTitle>
              <DrawerDescription className="sr-only">
                Recent cursive handwriting submissions, updates, and diagnostic feedback
              </DrawerDescription>
            </div>
            {count.data !== undefined && count.data > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 min-h-[44px] px-2.5 sm:px-3 text-xs text-muted-foreground hover:text-foreground active:bg-muted touch-manipulation cursor-pointer shrink-0"
                disabled={readAll.isPending}
                onClick={handleMarkAllRead}
              >
                {readAll.isPending ? "Saving…" : "Mark all read"}
              </Button>
            )}
          </DrawerHeader>
          {count.isError && (
            <p role="status" className="text-muted-foreground text-xs py-1 px-2 shrink-0">
              Unread count unavailable.
            </p>
          )}
          <div className="flex-1 min-h-0 pt-2 px-1 flex flex-col overflow-hidden">
            {listElement}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open && active} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={triggerButton} />
      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-1.5rem))] max-h-[min(calc(100dvh-4rem),38rem)] flex flex-col overflow-hidden p-3 sm:p-4 gap-3"
      >
        <PopoverHeader className="flex-row items-center justify-between gap-2 border-b pb-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <PopoverTitle className="font-heading text-sm font-semibold text-foreground shrink-0">
              Notifications
            </PopoverTitle>
            <PopoverDescription className="sr-only">
              Recent cursive handwriting submissions, updates, and diagnostic feedback
            </PopoverDescription>
          </div>
          {count.data !== undefined && count.data > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              disabled={readAll.isPending}
              onClick={handleMarkAllRead}
            >
              {readAll.isPending ? "Saving…" : "Mark all read"}
            </Button>
          )}
        </PopoverHeader>
        {count.isError && (
          <p role="status" className="text-muted-foreground text-xs shrink-0">
            Unread count unavailable.
          </p>
        )}
        <div className="flex-1 min-h-0 flex flex-col">
          {listElement}
        </div>
      </PopoverContent>
    </Popover>
  );
}
