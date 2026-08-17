import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "../supabase/client";

// Define the basic types based on the schema and API specs
export interface Student {
  id: string;
  full_name: string;
  section: string;
  created_at: string;
  parent_email?: string;
  status?: string; // from parent invitation status if joined
}

export function useStudents() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      // API_SPEC says list endpoints are direct Supabase reads using supabase-js
      // We're querying the student table, RLS (is_teacher_of_student) should handle filtering
      const { data, error } = await supabase
        .from("student")
        .select(`
          id,
          full_name,
          section,
          created_at
        `)
        .order("full_name");

      if (error) {
        throw new Error(error.message);
      }

      // Return typed data
      return data as unknown as Student[];
    },
  });
}

// Write mutations (FastAPI)
export function useCreateStudent() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (studentData: { full_name: string; section: string; parent_email?: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No active session");
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
      const response = await fetch(`${baseUrl}/api/students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(studentData),
      });

      const data = await response.json();

      if (!response.ok) {
        // Standardized error envelope: { error: { code, message, details } }
        throw data.error; 
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useUpdateStudent() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data: updateData }: { id: string; data: { full_name?: string; section?: string; parent_email?: string } }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No active session");
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
      const response = await fetch(`${baseUrl}/api/students/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw data.error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useRemoveStudent() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No active session");
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
      const response = await fetch(`${baseUrl}/api/students/${id}/teacher-link`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw data.error;
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}
