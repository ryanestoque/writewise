"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
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
import { NotificationList } from "./notification-list";
import { createClient } from "@/lib/supabase/client";
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
      void client.cancelQueries({ queryKey: notificationKeys.account(id) }).then(() => {
        client.removeQueries({ queryKey: notificationKeys.account(id) });
      });
    };
    for (const [key] of client.getQueriesData({ queryKey: notificationKeys.root })) {
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
    read.mutate(id, { onError: feedback });
  }
  function activate(row: NotificationRow) {
    if (!row.read_at) markRead(row.id);
    setOpen(false);
  }
  const label =
    count.data === undefined || count.isError
      ? "Notifications, unread count unavailable"
      : `Notifications, ${count.data} unread`;
  return (
    <Popover
      open={open && active}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) {
          void count.refetch();
          void feed.refetch();
          void labels.refetch();
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            className="relative shrink-0"
            disabled={!active}
          />
        }
      >
        <Bell aria-hidden="true" />
        {count.data !== undefined && count.data > 0 && (
          <Badge
            aria-hidden="true"
            variant="secondary"
            className="absolute -top-1 -right-1 min-w-5 justify-center px-1 text-[10px]"
          >
            {count.data > 99 ? "99+" : count.data}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))]">
        <PopoverHeader className="flex-row items-center justify-between gap-2">
          <PopoverTitle>Notifications</PopoverTitle>
          <Button
            variant="ghost"
            size="xs"
            disabled={readAll.isPending || count.data === 0}
            onClick={() => readAll.mutate(undefined, { onError: feedback })}
          >
            {readAll.isPending ? "Saving…" : "Mark all read"}
          </Button>
        </PopoverHeader>
        {count.isError && (
          <p role="status" className="text-muted-foreground text-xs">
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
          pendingId={read.isPending ? read.variables : null}
          onRead={markRead}
          onActivate={activate}
        />
      </PopoverContent>
    </Popover>
  );
}
