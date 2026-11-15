import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeacherGradebook } from "@/components/gradebook/teacher-gradebook";

export const metadata: Metadata = {
  title: "Gradebook",
};

export default async function GradebookPage() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) redirect("/login");
  return <TeacherGradebook userId={user.id} />;
}
