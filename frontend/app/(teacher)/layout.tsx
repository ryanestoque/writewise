import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TeacherSidebar } from "@/components/teacher-sidebar";
import { TeacherHeader } from "@/components/teacher-header";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware should have caught this, but guard defensively
  if (!user) {
    redirect("/login");
  }

  // Fetch teacher profile and live counts in parallel
  const [{ data: teacherProfile }, { count: studentCount }, { count: activityCount }] =
    await Promise.all([
      supabase
        .from("teacher")
        .select("full_name")
        .eq("id", user.id)
        .single(),
      supabase
        .from("teacher_student")
        .select("*", { count: "exact", head: true })
        .eq("teacher_id", user.id),
      supabase
        .from("activity")
        .select("*", { count: "exact", head: true })
        .eq("created_by", user.id),
    ]);

  const fullName =
    teacherProfile?.full_name ||
    (user.user_metadata?.full_name as string) ||
    user.email ||
    "Teacher";
  const email = user.email || "";

  return (
    <SidebarProvider>
      <TeacherSidebar
        user={{ fullName, email }}
        badgeCounts={{
          roster: studentCount ?? undefined,
          activities: activityCount ?? undefined,
        }}
      />
      <SidebarInset>
        <TeacherHeader />
        <div className="flex-1 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
