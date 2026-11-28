import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParentProfileSettingsCard } from "@/components/settings/parent-profile-settings-card";
import { SecuritySettingsCard } from "@/components/settings/security-settings-card";
import { NotificationSettingsCard } from "@/components/settings/notification-settings-card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Account Settings",
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

  const { data: parentProfile, error: profileError } = await supabase
    .from("parent")
    .select("full_name, email, email_notifications")
    .eq("id", user.id)
    .single();

  const fullName = parentProfile?.full_name || (user.user_metadata?.full_name as string) || "";
  const email = user.email || parentProfile?.email || "";

  return (
    <div className="w-full min-w-0 px-4 py-6 sm:px-6 flex flex-col gap-8 pb-20 sm:pb-16">
      {/* Return to Progress Navigation */}
      <div>
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="-ml-2 h-10 min-h-10 text-muted-foreground hover:text-foreground sm:h-9 sm:min-h-9"
          render={<Link href="/progress" />}
        >
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          <span>Back to progress</span>
        </Button>
      </div>

      {/* Page Header */}
      <div className="border-border flex flex-col gap-1 border-b pb-6">
        <h1 className="font-heading text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
          Account Settings
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage your profile, password, and email notifications.
        </p>
      </div>

      <ParentProfileSettingsCard initialFullName={fullName} email={email} />

      <Separator />

      <SecuritySettingsCard email={email} />

      <Separator />

      <NotificationSettingsCard
        key={`${user.id}:parent`}
        accountId={user.id}
        role="parent"
        initialEnabled={
          !profileError && typeof parentProfile?.email_notifications === "boolean"
            ? parentProfile.email_notifications
            : null
        }
      />
    </div>
  );
}
