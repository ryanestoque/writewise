"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { accountRequestSignal, withAccountScope } from "@/lib/supabase/account-scope";
import { ApiError } from "@/lib/utils/api-error";
import { commentKeys } from "@/lib/comments/query-keys";
import {
  readThreadPage,
  readThreadSummaries,
  readThreadWindow,
  readCommentAttempts,
  readUnreadCommentThreads,
} from "@/lib/comments/data";
import { commentMutation } from "@/lib/comments/transport";
import {
  threadIdentity,
  type CommentThread,
  type ThreadCursor,
  type ThreadScope,
  type ThreadSummary,
  type ThreadSummaryCursor,
  type ThreadTarget,
  type AttemptCursor,
  type CommentAttempt,
  type WorkCommentScope,
} from "@/lib/comments/types";
import { invalidateNotifications } from "@/lib/hooks/use-notifications";
import type { components } from "@/types/api";

function useActiveCommentAccount(userId: string) {
  const [account, setAccount] = useState<string | null>(null);
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((_event, session) =>
      setAccount(session?.user.id ?? null)
    );
    return () => data.subscription.unsubscribe();
  }, [userId]);
  return account === userId;
}

export function useCommentAccountId() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((_event, session) =>
      setUserId(session?.user.id ?? null)
    );
    return () => data.subscription.unsubscribe();
  }, []);
  return userId;
}

function retryRead(count: number, error: Error) {
  if (
    error.name === "AbortError" ||
    (error instanceof ApiError &&
      ["NOT_FOUND", "UNAUTHORIZED", "VALIDATION_ERROR"].includes(error.code))
  )
    return false;
  return count < 1;
}

export function useCommentThread(userId: string, target: ThreadTarget, open: boolean) {
  const client = useQueryClient();
  const active = useActiveCommentAccount(userId);
  const identity = `${userId}:${threadIdentity(target)}`;
  const moreController = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    moreController.current = controller;
    return () => controller.abort();
  }, [identity]);
  const [retained, setRetained] = useState<{ identity: string; through: ThreadCursor | null }>({
    identity,
    through: null,
  });
  const through = retained.identity === identity ? retained.through : null;
  const key = commentKeys.window(userId, target, through);
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const requestSignal = accountRequestSignal(userId, signal);
      try {
        return await withAccountScope(userId, requestSignal, (caller) =>
          readThreadWindow(caller, target, through, requestSignal)
        );
      } catch (error) {
        if (error instanceof ApiError && ["NOT_FOUND", "UNAUTHORIZED"].includes(error.code)) {
          // Removing the currently fetching query cancels its error transition
          // and can leave its observer displaying old bodies. Replace it with
          // a body-free successful sentinel; remove only other retained windows.
          client.removeQueries({
            queryKey: commentKeys.thread(userId, target),
            predicate: (cached) => JSON.stringify(cached.queryKey) !== JSON.stringify(key),
          });
          return null;
        }
        throw error;
      }
    },
    enabled: active && open && !!userId,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    staleTime: 0,
    retry: retryRead,
  });
  const more = useMutation({
    retry: false,
    gcTime: 0,
    mutationKey: [...commentKeys.thread(userId, target), "more"],
    mutationFn: async () => {
      const current = client.getQueryData<CommentThread>(key);
      if (!current?.next_cursor) return null;
      const requestSignal = accountRequestSignal(userId, moreController.current?.signal);
      const thread = await withAccountScope(userId, requestSignal, async (caller) => {
        const page = await readThreadPage(caller, target, current.next_cursor, requestSignal);
        const oldest = page.entries.at(-1);
        return readThreadWindow(
          caller,
          target,
          oldest
            ? { event_at: oldest.event_at, kind: oldest.kind, id: oldest.id }
            : current.next_cursor,
          requestSignal
        );
      });
      return { thread, requestSignal, identity, target, userId };
    },
    onSuccess: (result) => {
      if (!result || result.requestSignal.aborted) return;
      // Source deletion/denied reads leave sentinels while imperative history
      // requests may still finish. Never restore private data from that request.
      if (client.getQueriesData<CommentThread | null>({
        queryKey: commentKeys.thread(result.userId, result.target),
      }).some(([, cached]) => cached === null)) return;
      const oldest = result.thread.entries.at(-1);
      const nextThrough = oldest
        ? { event_at: oldest.event_at, kind: oldest.kind, id: oldest.id }
        : null;
      client.setQueryData(
        commentKeys.window(result.userId, result.target, nextThrough),
        result.thread
      );
      setRetained({ identity: result.identity, through: nextThrough });
    },
    onError: (error) => {
      if (error instanceof ApiError && ["NOT_FOUND", "UNAUTHORIZED"].includes(error.code)) {
        client.setQueriesData<CommentThread | null>(
          { queryKey: commentKeys.thread(userId, target) },
          null
        );
      }
    },
  });
  return {
    ...query,
    data: active && !query.isError ? (query.data ?? undefined) : undefined,
    isError: query.isError || query.data === null,
    error:
      query.data === null
        ? new ApiError({ code: "NOT_FOUND", message: "Conversation unavailable." })
        : query.error,
    isAccountActive: active,
    loadMore: () => {
      if (active && open && !more.isPending && !query.isFetching) more.mutate();
    },
    isLoadingMore: more.isPending,
    loadMoreError: more.error,
    retry: () => {
      more.reset();
      return query.refetch();
    },
  };
}

export function useCommentActions(userId: string, target: ThreadTarget) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: commentKeys.account(userId) });
    void invalidateNotifications(client);
  };
  const path = `/api/submissions/${encodeURIComponent(target.submissionId)}/comments`;
  const post = useMutation({
    retry: false,
    gcTime: 0,
    mutationKey: [...commentKeys.thread(userId, target), "post"],
    mutationFn: (body: components["schemas"]["CommentPostRequest"]) =>
      commentMutation<components["schemas"]["CommentPosted"]>(userId, path, "POST", body),
    onSettled: refresh,
  });
  const deleteComment = useMutation({
    retry: false,
    gcTime: 0,
    mutationKey: [...commentKeys.thread(userId, target), "delete"],
    mutationFn: (id: string) =>
      commentMutation<void>(userId, `/api/comments/${encodeURIComponent(id)}`, "DELETE"),
    onSuccess: (_data, id) => {
      client.setQueriesData<CommentThread>(
        { queryKey: commentKeys.thread(userId, target) },
        (current) =>
          current
            ? {
                ...current,
                entries: current.entries.map((entry) =>
                  entry.kind === "comment" && entry.id === id
                    ? { ...entry, body: null, deleted_at: new Date().toISOString() }
                    : entry
                ),
              }
            : current
      );
    },
    onSettled: refresh,
  });
  const setLocked = useMutation({
    retry: false,
    gcTime: 0,
    mutationKey: [...commentKeys.thread(userId, target), "lock"],
    mutationFn: (body: components["schemas"]["CommentLockRequest"]) =>
      commentMutation<components["schemas"]["CommentLockState"]>(
        userId,
        `${path}/lock`,
        "PUT",
        body
      ),
    onSettled: refresh,
  });
  return { post, deleteComment, setLocked };
}

export function useCommentSummaries(userId: string, scope: ThreadScope, open: boolean) {
  const active = useActiveCommentAccount(userId);
  const query = useQuery({
    queryKey: commentKeys.summaries(userId, scope),
    queryFn: ({ signal }) => {
      const requestSignal = accountRequestSignal(userId, signal);
      return withAccountScope(userId, requestSignal, async (caller) => {
        const rows: ThreadSummary[] = [];
        let before: ThreadSummaryCursor | null = null;
        for (;;) {
          const page = await readThreadSummaries(caller, scope, before, requestSignal);
          rows.push(...page.rows);
          if (!page.next_cursor) return { rows, next_cursor: null };
          if (JSON.stringify(before) === JSON.stringify(page.next_cursor))
            throw new ApiError({
              code: "INTERNAL_ERROR",
              message: "Could not load conversations. Try again.",
            });
          before = page.next_cursor;
        }
      });
    },
    enabled: active && open && !!userId,
    retry: retryRead,
    refetchInterval: 60_000,
    refetchOnWindowFocus: "always",
  });
  return { ...query, data: active && !query.isError ? query.data : undefined };
}

export function useUnreadCommentThreads(userId: string, enabled = true) {
  const active = useActiveCommentAccount(userId);
  const query = useQuery({
    queryKey: commentKeys.unread(userId),
    queryFn: ({ signal }) => {
      const requestSignal = accountRequestSignal(userId, signal);
      return withAccountScope(userId, requestSignal, (caller) =>
        readUnreadCommentThreads(caller, userId, requestSignal)
      );
    },
    enabled: enabled && active && !!userId,
    retry: retryRead,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: "always",
  });
  return { ...query, data: active && !query.isError ? query.data : undefined };
}

export function useCommentAttempts(userId: string, scope: WorkCommentScope, open: boolean) {
  const active = useActiveCommentAccount(userId);
  const query = useQuery({
    queryKey: commentKeys.attempts(userId, scope),
    queryFn: ({ signal }) => {
      const requestSignal = accountRequestSignal(userId, signal);
      return withAccountScope(userId, requestSignal, async caller => {
        const rows: CommentAttempt[] = [];
        let before: AttemptCursor | null = null;
        for (;;) {
          const page = await readCommentAttempts(caller, scope, before, requestSignal);
          rows.push(...page.rows);
          if (!page.next_cursor) return rows;
          if (JSON.stringify(before) === JSON.stringify(page.next_cursor))
            throw new ApiError({ code: "INTERNAL_ERROR", message: "Could not load uploads. Try again." });
          before = page.next_cursor;
        }
      });
    },
    enabled: active && open && !!userId,
    retry: retryRead,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
  });
  return { ...query, data: active && !query.isError ? query.data : undefined, isAccountActive: active };
}
