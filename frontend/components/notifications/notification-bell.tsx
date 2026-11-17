"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationList } from "./notification-list";
import { createClient } from "@/lib/supabase/client";
import { abortAccountRequests } from "@/lib/supabase/account-scope";
import { ApiError } from "@/lib/utils/api-error";
import { cn } from "@/lib/utils";
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
  const [confirmingReadAll, setConfirmingReadAll] = useState(false);
  const [sessionController, setSessionController] = useState(() => new AbortController());
  const client = useQueryClient();
  const count = useNotificationCount(userId, active);
  const feed = useNotificationFeed(userId, open, active, sessionController.signal);
  const rows = feed.data?.rows ?? EMPTY_ROWS;
  const labels = useNotificationLabels(userId, rows, active);
  const read = useNotificationRead(userId, sessionController.signal);
  const readAll = useNotificationReadAll(userId, sessionController.signal);

  useEffect(() => {
    const clear = (id: string) => {
      abortAccountRequests(id);
      for (const mutation of client.getMutationCache().findAll({ mutationKey: ["comments", id] })) {
        client.getMutationCache().remove(mutation);
      }
      void client.cancelQueries({ queryKey: ["comments", id] }).then(() => {
        client.removeQueries({ queryKey: ["comments", id] });
      });
      void client.cancelQueries({ queryKey: ["gradebook", id] }).then(() => {
        client.removeQueries({ queryKey: ["gradebook", id] });
      });
      void client.cancelQueries({ queryKey: notificationKeys.account(id) }).then(() => {
        client.removeQueries({ queryKey: notificationKeys.account(id) });
      });
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
        sessionController.abort();
        setActive(false);
        setOpen(false);
        clear(userId);
      } else if (session?.user.id === userId) {
        if (sessionController.signal.aborted) setSessionController(new AbortController());
        setActive(true);
      }
    });
    return () => {
      data.subscription.unsubscribe();
      sessionController.abort();
    };
  }, [client, userId, sessionController]);

  function feedback(error: unknown) {
    if (error instanceof Error && error.name === "AbortError") return;
    toast.error(
      error instanceof ApiError && error.code === "UNAUTHORIZED"
        ? "Sign in again to update notifications."
        : "Could not mark notifications read. Try again."
    );
  }
  function markRead(id: string) {
    const row = rows.find((row) => row.id === id);
    if (row?.type === "comment_posted" && !row.comment_version) return;
    read.mutate(
      {
        id,
        ...(row?.type === "comment_posted" ? { expectedCommentVersion: row.comment_version! } : {}),
      },
      { onError: feedback }
    );
  }
  function activate(row: NotificationRow) {
    if (!row.read_at && row.type !== "comment_posted") markRead(row.id);
    setOpen(false);
  }
  const isMobile = useIsMobile();
  const label =
    count.data === undefined || count.isError
      ? "Notifications, unread count unavailable"
      : `Notifications, ${count.data} unread`;

  useEffect(() => {
    if (!confirmingReadAll) return;
    const timer = setTimeout(() => {
      setConfirmingReadAll(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [confirmingReadAll]);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setConfirmingReadAll(false);
    }
    if (value) {
      void count.refetch();
      void feed.refetch();
      void labels.refetch();
    }
  };

  const handleReadAllClick = () => {
    if (!confirmingReadAll) {
      setConfirmingReadAll(true);
      return;
    }
    setConfirmingReadAll(false);
    readAll.mutate(undefined, {
      onError: feedback,
      onSuccess: () => {
        toast.success("All notifications marked as read");
      },
    });
  };

  const markAllButton = (
    <Button
      variant={confirmingReadAll ? "secondary" : "ghost"}
      size="xs"
      className={cn(
        "min-h-10 px-2.5 sm:min-h-7 transition-colors cursor-pointer",
        confirmingReadAll &&
          "border border-primary/30 bg-primary/10 text-primary font-medium hover:bg-primary/15"
      )}
      disabled={readAll.isPending || count.data === 0}
      onClick={handleReadAllClick}
      aria-label={
        confirmingReadAll
          ? "Confirm marking all notifications as read"
          : "Mark all notifications as read"
      }
    >
      {readAll.isPending
        ? "Saving…"
        : confirmingReadAll
          ? "Confirm all read?"
          : "Mark all read"}
    </Button>
  );

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      className="relative size-10 min-h-[40px] min-w-[40px] shrink-0 sm:size-9 sm:min-h-0 sm:min-w-0"
      disabled={!active}
    >
      <Bell aria-hidden="true" />
      {count.data !== undefined && count.data > 0 && (
        <Badge
          aria-hidden="true"
          className="absolute -top-1 -right-1 min-w-5 justify-center px-1 text-[11px] font-sans font-medium bg-primary text-primary-foreground shadow-xs"
        >
          {count.data > 99 ? "99+" : count.data}
        </Badge>
      )}
    </Button>
  );

  const list = (
    <>
      {count.isError && (
        <p role="status" className="text-muted-foreground text-xs pb-1">
          Unread count unavailable.
        </p>
      )}
      <NotificationList
        rows={rows}
        labels={labels.data ?? EMPTY_LABELS}
        role={role}
        loading={feed.isPending && feed.isFetching}
        error={feed.isError || labels.isError || !!feed.loadMoreError}
        retry={() => {
          void feed.retry();
          void labels.refetch();
          void count.refetch();
        }}
        hasMore={feed.data?.hasMore ?? false}
        loadingMore={feed.isLoadingMore}
        loadMore={() => feed.loadMore()}
        pendingId={read.isPending ? read.variables.id : null}
        onRead={markRead}
        onActivate={activate}
      />
    </>
  );

  if (isMobile) {
    return (
      <Drawer
        open={open && active}
        onOpenChange={handleOpenChange}
        showSwipeHandle
      >
        <DrawerTrigger render={trigger} />
        <DrawerContent className="p-4 pt-2">
          <DrawerHeader className="flex flex-row items-center justify-between gap-2 p-0 pb-3">
            <DrawerTitle>Notifications</DrawerTitle>
            <div className="flex items-center gap-1.5">
              {markAllButton}
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close notifications"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </DrawerHeader>
          {list}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover
      open={open && active}
      onOpenChange={handleOpenChange}
    >
      <PopoverTrigger render={trigger} />
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))]">
        <PopoverHeader className="flex-row items-center justify-between gap-2">
          <PopoverTitle>Notifications</PopoverTitle>
          {markAllButton}
        </PopoverHeader>
        {list}
      </PopoverContent>
    </Popover>
  );
}
