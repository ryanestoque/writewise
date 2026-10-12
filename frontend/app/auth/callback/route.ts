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
      redirectUrl.searchParams.set("error_code", "otp_expired");
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (tokenHash && type) {
    const supabase = await createClient();
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

  return NextResponse.redirect(new URL(next, origin));
}
