import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");
  const next = searchParams.get("next") || "/accept-invite";
  const errorTarget = next.startsWith("/reset-password") ? "/reset-password" : "/accept-invite";

  if (error || errorDescription || errorCode) {
    const redirectUrl = new URL(errorTarget, origin);
    if (errorCode) redirectUrl.searchParams.set("error_code", errorCode);
    if (error) redirectUrl.searchParams.set("error", error);
    if (errorDescription) redirectUrl.searchParams.set("error_description", errorDescription);
    return NextResponse.redirect(redirectUrl);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      const redirectUrl = new URL(errorTarget, origin);
      redirectUrl.searchParams.set("error", exchangeError.message);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
