import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/utils/api-error";

/**
 * Retrieves a valid Supabase access token.
 * If the current access token is missing, expired, or expiring within 60 seconds
 * (e.g. after camera app use, mobile screen sleep, or background tab pause),
 * this attempts an explicit session refresh before throwing an error.
 *
 * Throws a typed ApiError with code "UNAUTHORIZED" if a valid session cannot be established.
 */
export async function getAuthToken(supabase: SupabaseClient): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData.session?.access_token;
  const expiresAt = sessionData.session?.expires_at;
  const isExpiringSoon = expiresAt ? expiresAt * 1000 < Date.now() + 60_000 : false;

  if (!token || isExpiringSoon) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshData.session?.access_token) {
      token = refreshData.session.access_token;
    }
  }

  if (!token) {
    throw new ApiError({
      code: "UNAUTHORIZED",
      message: "Your session has expired. Please sign in again to continue.",
    });
  }

  return token;
}
