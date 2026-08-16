import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const role = user.user_metadata?.role as string | undefined;
    if (role === "parent") {
      redirect("/progress");
    }
    redirect("/dashboard");
  }

  redirect("/login");
}
