import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParentPortalProvider } from "@/components/parent-portal-provider";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

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
    <Suspense
      fallback={
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center min-h-[50vh] gap-3"
        >
          <Loader2
            className="size-8 animate-spin text-brand-600 dark:text-brand-400"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">Loading parent portal...</p>
        </div>
      }
    >
      <ParentPortalProvider user={{ id: user.id, fullName, email }}>
        {children}
      </ParentPortalProvider>
    </Suspense>
  );
}
