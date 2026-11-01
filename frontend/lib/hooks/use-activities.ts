import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "../supabase/client";
import { getAuthToken } from "../supabase/auth-helper";
import { handleApiResponse } from "../utils/api-error";

import type { components } from "@/types/api";
import type { Database } from "@/types/database";

export interface ActivitySubmissionSummary {
  id: string;
  status: "processing" | "completed" | "rejected";
  student_id: string;
  created_at: string;
}

export type Activity = Database["public"]["Tables"]["activity"]["Row"] & {
  assignments: Pick<Database["public"]["Tables"]["activity_assignment"]["Row"], "section_id" | "student_id">[];
  submissions?: ActivitySubmissionSummary[];
};

export function useActivities() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity")
        .select(
          "*, assignments:activity_assignment(section_id, student_id), submissions:submission(id, status, student_id, created_at)"
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data as unknown as Activity[];
    },
  });
}

export function useActivity(id: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["activities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity")
        .select("*, assignments:activity_assignment(section_id, student_id)")
        .eq("id", id)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as unknown as Activity;
    },
    enabled: !!id,
  });
}

export function useCreateActivity() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activityData: components["schemas"]["ActivityCreate"]) => {
      const token = await getAuthToken(supabase);

      const response = await fetch("/api/activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(activityData),
      });

      return handleApiResponse<components["schemas"]["ActivityResponse"]>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useUpdateActivity() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data: updateData,
    }: {
      id: string;
      data: components["schemas"]["ActivityUpdate"];
    }) => {
      const token = await getAuthToken(supabase);

      const response = await fetch(`/api/activities/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      return handleApiResponse<components["schemas"]["ActivityResponse"]>(response);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activities", variables.id] });
    },
  });
}

export function useDeleteActivity() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getAuthToken(supabase);

      const response = await fetch(`/api/activities/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return handleApiResponse<{ id: string; deleted: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useToggleArchive() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getAuthToken(supabase);

      const response = await fetch(`/api/activities/${id}/archive`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      return handleApiResponse<{ id: string; is_archived: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useBulkArchive() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { ids: string[]; archived: boolean }) => {
      const token = await getAuthToken(supabase);

      const response = await fetch("/api/activities/bulk-archive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      return handleApiResponse<{ updated: string[]; skipped: string[] }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}
