import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const error = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");
  const rawNext = searchParams.get("next") || "/accept-invite";
  // Open-redirect guard: require relative path that does not start with protocol-relative '//'
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/accept-invite";
  const isSignupConfirm = next === "/login";
  const errorTarget = isSignupConfirm
    ? "/login?error=confirmation_failed"
    : next.startsWith("/reset-password")
      ? "/reset-password"
      : "/accept-invite";

  if (error || errorDescription || errorCode) {
    const redirectUrl = new URL(errorTarget, origin);
    if (errorCode) redirectUrl.searchParams.set("error_code", errorCode);
    if (error) redirectUrl.searchParams.set("error", error);
    if (errorDescription) redirectUrl.searchParams.set("error_description", errorDescription);
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createClient();

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      const redirectUrl = new URL(errorTarget, origin);
      redirectUrl.searchParams.set("error", exchangeError.message);
      redirectUrl.searchParams.set("error_code", "otp_expired");
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (tokenHash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (verifyError) {
      const redirectUrl = new URL(errorTarget, origin);
      redirectUrl.searchParams.set("error", verifyError.message);
      redirectUrl.searchParams.set("error_code", "otp_expired");
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (isSignupConfirm) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?confirmed=true", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
