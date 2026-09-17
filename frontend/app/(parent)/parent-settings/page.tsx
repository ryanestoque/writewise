import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParentProfileSettingsCard } from "@/components/settings/parent-profile-settings-card";
import { SecuritySettingsCard } from "@/components/settings/security-settings-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, UserCog } from "lucide-react";

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
    <div className="w-full max-w-5xl mx-auto min-w-0 space-y-8 pb-20 sm:pb-16">
      {/* Return to Progress Navigation */}
      <div>
        <Link
          href="/progress"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-9 px-3.5 text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted/50 border-border/80 hover:border-brand-500/40 gap-2 cursor-pointer inline-flex items-center rounded-lg bg-card shadow-2xs transition-all focus-visible:ring-2 focus-visible:ring-primary"
          )}
        >
          <ArrowLeft className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          <span>Back to Child Progress</span>
        </Link>
      </div>

      {/* Page Header */}
      <div className="flex items-center gap-3.5 pb-5 border-b border-border/70">
        <div
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-bold border border-brand-200/60 dark:border-brand-800/60 shadow-xs shrink-0 select-none"
        >
          <UserCog className="size-5" />
        </div>
        <div className="space-y-0.5 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-foreground tracking-tight">
            Account Settings
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage your parent profile display name and security credentials.
          </p>
        </div>
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
