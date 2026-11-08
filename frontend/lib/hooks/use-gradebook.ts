"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { gradebookMutation, gradebookRequest } from "@/lib/gradebook/transport";
import { invalidateWorkQueries } from "./use-activity-work";
import { ApiError } from "@/lib/utils/api-error";
import type { components } from "@/types/api";

export type SectionGradebook = components["schemas"]["SectionGradebook"];
export type ChildGradebook = components["schemas"]["ChildGradebook"];
export type GradebookCell = components["schemas"]["GradebookCell"];

export function useGradebookActions(userId: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["gradebook", userId] });
    invalidateWorkQueries(client);
  };
  const updateWork = useMutation({
    mutationFn: ({
      activityId,
      studentId,
      body,
    }: {
      activityId: string;
      studentId: string;
      body: components["schemas"]["StudentWorkUpdate"];
    }) =>
      gradebookMutation<components["schemas"]["StudentWorkResponse"]>(
        userId,
        `/api/activities/${activityId}/students/${studentId}/work`,
        "PUT",
        body
      ),
    onSettled: refresh,
  });
  const releaseGrade = useMutation({
    mutationFn: ({
      activityId,
      studentId,
      revision,
    }: {
      activityId: string;
      studentId: string;
      revision: number;
    }) =>
      gradebookMutation<components["schemas"]["GradeReleaseResponse"]>(
        userId,
        `/api/activities/${activityId}/students/${studentId}/release-grade`,
        "POST",
        { expected_revision: revision }
      ),
    onSettled: refresh,
  });
  const assignZeroMissing = useMutation({
    mutationFn: ({ activityId, studentIds }: { activityId: string; studentIds?: string[] }) =>
      gradebookMutation<components["schemas"]["BulkGradeResponse"]>(
        userId,
        `/api/activities/${activityId}/assign-zero-missing`,
        "POST",
        studentIds ? { student_ids: studentIds } : {}
      ),
    onSettled: refresh,
  });
  const excuseStudents = useMutation({
    mutationFn: ({
      activityId,
      studentIds,
      excused,
    }: {
      activityId: string;
      studentIds: string[];
      excused: boolean;
    }) =>
      gradebookMutation<components["schemas"]["BulkGradeResponse"]>(
        userId,
        `/api/activities/${activityId}/excuse-students`,
        "POST",
        { student_ids: studentIds, excused }
      ),
    onSettled: refresh,
  });
  return { updateWork, releaseGrade, assignZeroMissing, excuseStudents };
}

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
  if (
    error instanceof ApiError &&
    ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND"].includes(error.code)
  ) {
    return false;
  }
  return count < 2;
}

export function useSectionGradebook(userId: string, sectionId: string | null) {
  const active = useActiveGradebookAccount(userId);
  return useQuery<SectionGradebook>({
    queryKey: ["gradebook", userId, "section", sectionId],
    enabled: active && !!userId && !!sectionId,
    queryFn: ({ signal }) =>
      gradebookRequest<SectionGradebook>(
        userId,
        `/api/sections/${encodeURIComponent(sectionId!)}/gradebook`,
        signal
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
    queryFn: ({ signal }) =>
      gradebookRequest<ChildGradebook>(
        userId,
        `/api/students/${encodeURIComponent(childId!)}/gradebook`,
        signal
      ),
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: retryGradebook,
  });
}
