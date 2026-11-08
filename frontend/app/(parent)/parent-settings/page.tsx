import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParentProfileSettingsCard } from "@/components/settings/parent-profile-settings-card";
import { SecuritySettingsCard } from "@/components/settings/security-settings-card";
import { NotificationSettingsCard } from "@/components/settings/notification-settings-card";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

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

  const { data: parentProfile, error: profileError } = await supabase
    .from("parent")
    .select("full_name, email, email_notifications")
    .eq("id", user.id)
    .single();

  const fullName = parentProfile?.full_name || (user.user_metadata?.full_name as string) || "";
  const email = user.email || parentProfile?.email || "";

  return (
    <div className="w-full max-w-4xl mx-auto min-w-0 space-y-8 pb-20 sm:pb-16">
      {/* Return to Progress Navigation */}
      <div>
        <Link
          href="/progress"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "text-foreground/80 hover:text-foreground hover:bg-muted/50 border-border/80 hover:border-brand-500/40 bg-card focus-visible:ring-primary inline-flex h-10 min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-3.5 text-xs font-medium shadow-2xs transition-all focus-visible:ring-2 sm:h-9 sm:min-h-[36px]"
          )}
        >
          <ArrowLeft className="text-brand-600 dark:text-brand-400 size-3.5" aria-hidden="true" />
          <span>Back to Child Progress</span>
        </Link>
      </div>

      {/* Page Header */}
      <div className="border-border space-y-1 border-b pb-6">
        <h1 className="font-heading text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
          Account Settings
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Manage your parent profile display name and security credentials.
        </p>
      </div>

      {/* Profile Section */}
      <ParentProfileSettingsCard initialFullName={fullName} email={email} />

      {/* Section Divider */}
      <div className="border-border border-t" />

      {/* Password & Security Section */}
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
