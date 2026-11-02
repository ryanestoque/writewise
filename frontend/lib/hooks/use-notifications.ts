"use client";

import { useRef, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { readNotificationState } from "@/lib/notifications/read";
import {
  readNotificationLabels,
  readNotificationPage,
  readNotificationWindow,
  type NotificationCursor,
  type NotificationRow,
  type NotificationWindow,
} from "@/lib/notifications/data";
import { notificationKeys } from "@/lib/notifications/query-keys";
import type { components } from "@/types/api";

export function invalidateNotifications(client: QueryClient) {
  return client.invalidateQueries({ queryKey: notificationKeys.root });
}

export function useNotificationCount(userId: string, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.count(userId),
    queryFn: async ({ signal }) => {
      const { count, error } = await createClient()
        .from("notification")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .is("read_at", null)
        .abortSignal(signal);
      if (error) throw error;
      if (count === null) throw new Error("Unread count unavailable");
      return count;
    },
    enabled: enabled && !!userId,
    refetchInterval: 60_000,
    refetchOnWindowFocus: "always",
  });
}

export function useNotificationFeed(
  userId: string,
  open: boolean,
  enabled = true,
  sessionSignal?: AbortSignal
) {
  const client = useQueryClient();
  const [through, setThrough] = useState<NotificationCursor | null>(null);
  const [paging, setPaging] = useState(false);
  const pagingRef = useRef(false);
  const key = notificationKeys.feed(userId, through);
  const feed = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => {
      const cached = client.getQueryData<NotificationWindow>(key);
      if (pagingRef.current && cached) return cached;
      return readNotificationWindow(
        createClient(),
        userId,
        through ?? cached?.oldest ?? null,
        signal
      );
    },
    placeholderData: keepPreviousData,
    enabled: enabled && !paging && !!userId && (open || !!client.getQueryData(key)),
    refetchInterval: 60_000,
    refetchOnWindowFocus: "always",
  });
  const more = useMutation({
    onMutate: () => client.cancelQueries({ queryKey: key, exact: true }),
    mutationFn: async () => {
      sessionSignal?.throwIfAborted();
      const current = client.getQueryData<NotificationWindow>(key);
      if (!current?.oldest || !current.hasMore) return null;
      const page = await readNotificationPage(
        createClient(),
        userId,
        current.oldest,
        sessionSignal
      );
      return readNotificationWindow(
        createClient(),
        userId,
        page.oldest ?? current.oldest,
        sessionSignal
      );
    },
    onSuccess: async (next) => {
      if (!next) return;
      const { data } = await createClient().auth.getUser();
      sessionSignal?.throwIfAborted();
      if (data.user?.id !== userId) return;
      client.setQueryData(notificationKeys.feed(userId, next.oldest), next);
      setThrough(next.oldest);
    },
    onSettled: () => {
      pagingRef.current = false;
      setPaging(false);
      void invalidateNotifications(client);
    },
  });
  return {
    ...feed,
    retry: () => {
      more.reset();
      return feed.refetch();
    },
    loadMore: () => {
      if (pagingRef.current || !enabled) return;
      pagingRef.current = true;
      setPaging(true);
      more.mutate();
    },
    isLoadingMore: paging || more.isPending,
    loadMoreError: more.error,
  };
}

export function useNotificationLabels(userId: string, rows: NotificationRow[], enabled = true) {
  const identity = [...new Set(rows.map((row) => `${row.student_id}:${row.activity_id}`))]
    .sort()
    .join(",");
  return useQuery({
    queryKey: notificationKeys.labels(userId, identity),
    queryFn: ({ signal }) => readNotificationLabels(createClient(), rows, signal),
    enabled: enabled && rows.length > 0,
    refetchInterval: 60_000,
  });
}

export function useNotificationRead(userId: string, sessionSignal?: AbortSignal) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      readNotificationState<components["schemas"]["NotificationReadResponse"]>(
        createClient(),
        userId,
        `/api/notifications/${id}/read`,
        sessionSignal
      ),
    onSettled: () => invalidateNotifications(client),
  });
}

export function useNotificationReadAll(userId: string, sessionSignal?: AbortSignal) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      readNotificationState<components["schemas"]["NotificationsReadAllResponse"]>(
        createClient(),
        userId,
        "/api/notifications/read-all",
        sessionSignal
      ),
    onSettled: () => invalidateNotifications(client),
  });
}
