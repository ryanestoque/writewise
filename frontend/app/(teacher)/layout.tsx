import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TeacherSidebar } from "@/components/teacher-sidebar";
import { TeacherHeader } from "@/components/teacher-header";
import { TeacherModalsProvider } from "@/components/teacher-modals-provider";

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

  // Fetch teacher profile
  const { data: teacherProfile } = await supabase
    .from("teacher")
    .select("full_name, school_name")
    .eq("id", user.id)
    .single();

  const fullName =
    teacherProfile?.full_name ||
    (user.user_metadata?.full_name as string) ||
    user.email ||
    "Teacher";
  const email = user.email || "";
  const schoolName =
    teacherProfile?.school_name ||
    (user.user_metadata?.school_name as string) ||
    undefined;

  // Query pending submissions awaiting teacher review
  const { count: pendingSubmissionsCount } = await supabase
    .from("activity_work_state")
    .select("active_submission_id", { count: "exact", head: true })
    .eq("work_status", "Turned in");

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <TeacherModalsProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <TeacherSidebar
          user={{ fullName, email, schoolName }}
          pendingSubmissionsCount={pendingSubmissionsCount ?? 0}
        />
        <SidebarInset>
          <TeacherHeader userId={user.id} />
          <div className="flex flex-1 flex-col gap-6 min-w-0 w-full px-4 sm:px-6 py-6 [&:has([data-page-studio])]:py-4 sm:[&:has([data-page-studio])]:py-5">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TeacherModalsProvider>
  );
}

