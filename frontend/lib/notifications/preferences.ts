import type { createClient } from "@/lib/supabase/client";
import { getAuthToken } from "@/lib/supabase/auth-helper";
import { ApiError } from "@/lib/utils/api-error";

export type PreferenceRole = "parent" | "teacher";
type Client = ReturnType<typeof createClient>;

async function preferenceRequest(
  client: Client,
  accountId: string,
  role: PreferenceRole,
  enabled: boolean | undefined,
  signal?: AbortSignal
): Promise<boolean> {
  signal?.throwIfAborted();
  const token = await getAuthToken(client);
  signal?.throwIfAborted();
  const { data: authData, error: authError } = await client.auth.getUser(token);
  signal?.throwIfAborted();
  if (authError || authData.user?.id !== accountId) {
    throw new ApiError({
      code: "UNAUTHORIZED",
      message: "Sign in again to update email settings.",
    });
  }

  if (role !== "parent" && role !== "teacher") {
    throw new ApiError({ code: "INTERNAL_ERROR", message: "Email settings are unavailable." });
  }

  const table = role === "parent" ? "parent" : "teacher";

  if (enabled === undefined) {
    let query = client
      .from(table)
      .select("id,email_notifications")
      .eq("id", accountId);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.maybeSingle();
    signal?.throwIfAborted();
    if (error) {
      throw new ApiError({
        code: error.code === "PGRST116" ? "NOT_FOUND" : "INTERNAL_ERROR",
        message: "Email settings could not be confirmed.",
      });
    }
    if (!data || typeof data.email_notifications !== "boolean") {
      throw new ApiError({ code: "NOT_FOUND", message: "Email settings are unavailable." });
    }
    return data.email_notifications;
  } else {
    let query = client
      .from(table)
      .update({ email_notifications: enabled })
      .eq("id", accountId)
      .select("id,email_notifications");
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.maybeSingle();
    signal?.throwIfAborted();
    if (error) {
      throw new ApiError({
        code: error.code === "PGRST116" ? "NOT_FOUND" : "INTERNAL_ERROR",
        message: "Email settings could not be confirmed.",
      });
    }
    if (!data || typeof data.email_notifications !== "boolean") {
      throw new ApiError({ code: "NOT_FOUND", message: "Email settings could not be confirmed." });
    }
    return data.email_notifications;
  }
}

export function readEmailPreference(
  client: Client,
  accountId: string,
  role: PreferenceRole,
  signal?: AbortSignal
): Promise<boolean> {
  return preferenceRequest(client, accountId, role, undefined, signal);
}

export function saveEmailPreference(
  client: Client,
  accountId: string,
  role: PreferenceRole,
  enabled: boolean,
  signal?: AbortSignal
): Promise<boolean> {
  return preferenceRequest(client, accountId, role, enabled, signal);
}
