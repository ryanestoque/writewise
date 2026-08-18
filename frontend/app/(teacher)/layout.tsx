import { redirect } from "next/navigation";
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
    .select("full_name")
    .eq("id", user.id)
    .single();

  const fullName =
    teacherProfile?.full_name ||
    (user.user_metadata?.full_name as string) ||
    user.email ||
    "Teacher";
  const email = user.email || "";

  return (
    <TeacherModalsProvider>
      <SidebarProvider>
        <TeacherSidebar user={{ fullName, email }} />
        <SidebarInset>
          <TeacherHeader />
          <div className="flex-1 p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TeacherModalsProvider>
  );
}

