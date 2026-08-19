import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "../supabase/client";

export interface Submission {
  id: string;
  activity_id: string;
  student_id: string;
  image_path: string;
  status: "processing" | "completed" | "rejected";
  uploader_id: string;
  uploader_role: "teacher" | "parent";
  rejection_code: string | null;
  created_at: string;
  updated_at: string;
  student: {
    full_name: string;
  };
}

export function useSubmissions(activityId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["submissions", activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submission")
        .select(
          `id, activity_id, student_id, image_path, status, uploader_id,
           uploader_role, rejection_code, created_at, updated_at,
           student:student_id(full_name)`
        )
        .eq("activity_id", activityId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data as unknown as Submission[];
    },
    enabled: !!activityId,
  });
}

export function useUploadSubmission() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      image,
      activityId,
      studentId,
    }: {
      image: File;
      activityId: string;
      studentId: string;
    }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No active session");
      }

      const formData = new FormData();
      formData.append("image", image);
      formData.append("activity_id", activityId);
      formData.append("student_id", studentId);

      // No Content-Type header — let the browser set multipart/form-data
      // with the correct boundary automatically.
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Backend returned error:", data.error);
        throw data.error;
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate all submission lists so any visible list refreshes
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });
}

export function useSubmissionImageUrl(imagePath: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["submission-image", imagePath],
    queryFn: async () => {
      if (!imagePath) return null;

      const { data, error } = await supabase.storage
        .from("submission-images")
        .createSignedUrl(imagePath, 3600); // 1-hour signed URL

      if (error) {
        throw new Error(error.message);
      }

      return data.signedUrl;
    },
    enabled: !!imagePath,
    // Cache for 30 minutes — well within the 1-hour signing window
    staleTime: 30 * 60 * 1000,
  });
}
