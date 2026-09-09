import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileSettingsCard } from "@/components/settings/profile-settings-card";
import { SecuritySettingsCard } from "@/components/settings/security-settings-card";

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

  const { data: teacherProfile } = await supabase
    .from("teacher")
    .select("full_name, school_name, email")
    .eq("id", user.id)
    .single();

  const fullName =
    teacherProfile?.full_name ||
    (user.user_metadata?.full_name as string) ||
    "";
  const schoolName =
    teacherProfile?.school_name ||
    (user.user_metadata?.school_name as string) ||
    "";
  const email = user.email || teacherProfile?.email || "";

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8 py-2 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Account Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your teacher profile information and account security credentials.
        </p>
      </div>

      {/* Profile Card */}
      <ProfileSettingsCard
        initialFullName={fullName}
        initialSchoolName={schoolName}
        email={email}
      />

      {/* Password & Security Card */}
      <SecuritySettingsCard email={email} />
    </div>
  );
}
