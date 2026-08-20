import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "../supabase/client";

export interface ActivitySubmissionSummary {
  id: string;
  status: "processing" | "completed" | "rejected";
}

export interface Activity {
  id: string;
  target_text: string;
  is_take_home: boolean;
  created_by: string;
  created_at: string;
  submissions?: ActivitySubmissionSummary[];
}

export function useActivities() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity")
        .select(
          "id, target_text, is_take_home, created_by, created_at, submissions:submission(id, status)"
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
        .select("id, target_text, is_take_home, created_by, created_at")
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
    mutationFn: async (activityData: {
      target_text: string;
      is_take_home?: boolean;
    }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No active session");
      }

      const response = await fetch("/api/activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(activityData),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Backend returned error:", data.error);
        throw data.error;
      }

      return data;
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
      data: {
        target_text?: string;
        is_take_home?: boolean;
      };
    }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No active session");
      }

      const response = await fetch(`/api/activities/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Backend returned error:", data.error);
        throw data.error;
      }

      return data;
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
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No active session");
      }

      const response = await fetch(`/api/activities/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Backend returned error:", data.error);
        throw data.error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}