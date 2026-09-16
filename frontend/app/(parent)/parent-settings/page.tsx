import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParentProfileSettingsCard } from "@/components/settings/parent-profile-settings-card";
import { SecuritySettingsCard } from "@/components/settings/security-settings-card";

export const metadata: Metadata = {
  title: "Account Settings — WriteWise",
  description: "Manage your parent profile and account credentials.",
};

export default async function ParentSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: parentProfile } = await supabase
    .from("parent")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const fullName =
    parentProfile?.full_name ||
    (user.user_metadata?.full_name as string) ||
    "";
  const email = user.email || parentProfile?.email || "";

  return (
    <div className="w-full min-w-0 space-y-10 pb-20 sm:pb-16">
      {/* Page Header */}
      <div className="border-b border-border pb-6">
        <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-foreground tracking-tight">
          Account Settings
        </h1>
      </div>

      {/* Profile Section */}
      <ParentProfileSettingsCard
        initialFullName={fullName}
        email={email}
      />

      {/* Section Divider */}
      <div className="border-t border-border" />

      {/* Password & Security Section */}
      <SecuritySettingsCard email={email} />
    </div>
  );
}
