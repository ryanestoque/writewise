import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParentPortalProvider } from "@/components/parent-portal-provider";

export default async function ParentLayout({
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

  // Fetch parent profile name
  const { data: parentProfile } = await supabase
    .from("parent")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const fullName =
    parentProfile?.full_name ||
    (user.user_metadata?.full_name as string) ||
    user.email ||
    "Parent";
  const email = user.email || "";

  return (
    <ParentPortalProvider user={{ fullName, email }}>
      {children}
    </ParentPortalProvider>
  );
}
