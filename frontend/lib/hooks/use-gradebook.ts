"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { gradebookRequest } from "@/lib/gradebook/transport";
import { ApiError } from "@/lib/utils/api-error";
import type { components } from "@/types/api";

export type SectionGradebook = components["schemas"]["SectionGradebook"];
export type ChildGradebook = components["schemas"]["ChildGradebook"];
export type GradebookCell = components["schemas"]["GradebookCell"];

function useActiveGradebookAccount(userId: string) {
  const [account, setAccount] = useState<string | null>(userId);
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      setAccount(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [userId]);
  return account === userId;
}

function retryGradebook(count: number, error: Error) {
  if (error.name === "AbortError") return false;
  if (error instanceof ApiError && ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(error.code)) {
    return false;
  }
  return count < 2;
}

export function useSectionGradebook(userId: string, sectionId: string | null) {
  const active = useActiveGradebookAccount(userId);
  return useQuery<SectionGradebook>({
    queryKey: ["gradebook", userId, "section", sectionId],
    enabled: active && !!userId && !!sectionId,
    queryFn: ({ signal }) => gradebookRequest<SectionGradebook>(
      userId, `/api/sections/${encodeURIComponent(sectionId!)}/gradebook`, signal,
    ),
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: retryGradebook,
  });
}

export function useChildGradebook(userId: string, childId: string | null, enabled: boolean) {
  const active = useActiveGradebookAccount(userId);
  return useQuery<ChildGradebook>({
    queryKey: ["gradebook", userId, "child", childId],
    enabled: active && enabled && !!userId && !!childId,
    queryFn: ({ signal }) => gradebookRequest<ChildGradebook>(
      userId, `/api/students/${encodeURIComponent(childId!)}/gradebook`, signal,
    ),
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: retryGradebook,
  });
}
