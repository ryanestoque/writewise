"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getAuthToken } from "@/lib/supabase/auth-helper";
import { handleApiResponse } from "@/lib/utils/api-error";
import type { components } from "@/types/api";
import type { Database } from "@/types/database";
import { invalidateNotifications } from "./use-notifications";

export interface ActivityWorkState extends Omit<
  Database["public"]["Views"]["activity_work_state"]["Row"],
  "activity_id" | "student_id" | "work_status" | "late"
> {
  activity_id: string;
  student_id: string;
  work_status: "Assigned" | "Returned" | "Missing" | "Draft" | "Released" | "Turned in" | "Excused";
  late: boolean;
}

export function invalidateWorkQueries(client: QueryClient) {
  void invalidateNotifications(client);
  for (const key of [
    "activity-work",
    "submissions",
    "dashboard-scores",
    "student-score-history",
    "student-trend",
    "parent-child-latest-scores",
    "parent-child-score-history",
    "parent-take-home-activities",
    "parent-child-submission",
    "parent-all-submissions",
    "activities",
    "gradebook",
  ])
    void client.invalidateQueries({ queryKey: [key] });
}

export function useActivityWork(activityId: string) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["activity-work", activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_work_state")
        .select("*")
        .eq("activity_id", activityId);
      if (error) throw error;
      return (data ?? []) as ActivityWorkState[];
    },
    enabled: !!activityId,
    refetchInterval: 15000,
  });
}

async function mutateWork<T>(url: string, method: "POST" | "PUT", body?: object): Promise<T> {
  const token = await getAuthToken(createClient());
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return handleApiResponse<T>(response);
}

export function useReturnSubmission() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      submissionId,
      body,
    }: {
      submissionId: string;
      body: components["schemas"]["ReturnSubmissionRequest"];
    }) =>
      mutateWork<components["schemas"]["ReturnSubmissionResponse"]>(
        `/api/submissions/${submissionId}/return`,
        "POST",
        body
      ),
    onSuccess: () => invalidateWorkQueries(client),
  });
}

export function useReleaseSubmission() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (submissionId: string) =>
      mutateWork<components["schemas"]["ReleaseSubmissionResponse"]>(
        `/api/submissions/${submissionId}/release`,
        "POST"
      ),
    onSuccess: () => invalidateWorkQueries(client),
  });
}

export function useReleaseActivity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (activityId: string) =>
      mutateWork<components["schemas"]["ReleaseActivityResponse"]>(
        `/api/activities/${activityId}/release`,
        "POST"
      ),
    onSuccess: () => invalidateWorkQueries(client),
  });
}

export function useUpdateStudentWork() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      activityId,
      studentId,
      body,
    }: {
      activityId: string;
      studentId: string;
      body: components["schemas"]["StudentWorkUpdate"];
    }) =>
      mutateWork<components["schemas"]["StudentWorkResponse"]>(
        `/api/activities/${activityId}/students/${studentId}/work`,
        "PUT",
        body
      ),
    onSuccess: () => invalidateWorkQueries(client),
  });
}
