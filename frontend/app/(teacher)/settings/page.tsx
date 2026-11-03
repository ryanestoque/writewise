import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileSettingsCard } from "@/components/settings/profile-settings-card";
import { SecuritySettingsCard } from "@/components/settings/security-settings-card";
import { NotificationSettingsCard } from "@/components/settings/notification-settings-card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Account Settings — WriteWise",
  description: "Manage your teacher profile and account credentials.",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: teacherProfile, error: profileError } = await supabase
    .from("teacher")
    .select("full_name, school_name, email, email_notifications")
    .eq("id", user.id)
    .single();

  const fullName = teacherProfile?.full_name || (user.user_metadata?.full_name as string) || "";
  const schoolName =
    teacherProfile?.school_name || (user.user_metadata?.school_name as string) || "";
  const email = user.email || teacherProfile?.email || "";

  return (
    <div className="w-full min-w-0 space-y-10 pb-20 sm:pb-16">
      {/* Page Header */}
      <div className="border-border border-b pb-6">
        <h1 className="font-heading text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
          Account Settings
        </h1>
      </div>

      {/* Profile Section */}
      <ProfileSettingsCard
        initialFullName={fullName}
        initialSchoolName={schoolName}
        email={email}
      />

      {/* Section Divider */}
      <div className="border-border border-t" />

      {/* Password & Security Section */}
      <SecuritySettingsCard email={email} />
      <Separator />
      <NotificationSettingsCard
        key={`${user.id}:teacher`}
        accountId={user.id}
        role="teacher"
        initialEnabled={
          !profileError && typeof teacherProfile?.email_notifications === "boolean"
            ? teacherProfile.email_notifications
            : null
        }
      />
    </div>
  );
}
