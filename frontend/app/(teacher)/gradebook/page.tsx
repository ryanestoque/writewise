import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeacherGradebook } from "@/components/gradebook/teacher-gradebook";

export default async function GradebookPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string; section?: string }>;
}) {
  const { activity, section } = await searchParams;
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) redirect("/login");
  return (
    <TeacherGradebook
      userId={user.id}
      initialActivityId={typeof activity === "string" ? activity : undefined}
      initialSectionId={typeof section === "string" ? section : undefined}
    />
  );
}
