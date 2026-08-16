import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TeacherSidebar } from "@/components/teacher-sidebar";

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

  const fullName =
    (user.user_metadata?.full_name as string) || user.email || "Teacher";
  const email = user.email || "";

  return (
    <SidebarProvider>
      <TeacherSidebar user={{ fullName, email }} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
