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
  const { data, error } = await client.auth.getUser(token);
  signal?.throwIfAborted();
  if (error || data.user?.id !== accountId) {
    throw new ApiError({
      code: "UNAUTHORIZED",
      message: "Sign in again to update email settings.",
    });
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !publicKey || (role !== "parent" && role !== "teacher")) {
    throw new ApiError({ code: "INTERNAL_ERROR", message: "Email settings are unavailable." });
  }
  const endpoint = new URL(`/rest/v1/${role}`, base);
  endpoint.searchParams.set("id", `eq.${accountId}`);
  endpoint.searchParams.set("select", "id,email_notifications");
  const response = await fetch(endpoint, {
    method: enabled === undefined ? "GET" : "PATCH",
    headers: {
      apikey: publicKey,
      Authorization: `Bearer ${token}`,
      ...(enabled === undefined
        ? {}
        : { "Content-Type": "application/json", Prefer: "return=representation" }),
    },
    body: enabled === undefined ? undefined : JSON.stringify({ email_notifications: enabled }),
    signal,
  });
  signal?.throwIfAborted();
  if (!response.ok) {
    throw new ApiError({
      code: response.status === 401 || response.status === 403 ? "UNAUTHORIZED" : "INTERNAL_ERROR",
      message: "Email settings could not be confirmed.",
    });
  }
  let rows: unknown;
  try {
    rows = await response.json();
  } catch {
    throw new ApiError({
      code: "INTERNAL_ERROR",
      message: "Email settings could not be confirmed.",
    });
  }
  signal?.throwIfAborted();
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new ApiError({ code: "NOT_FOUND", message: "Email settings are unavailable." });
  }
  const row = rows[0] as Record<string, unknown> | null;
  if (row?.id !== accountId || typeof row.email_notifications !== "boolean") {
    throw new ApiError({
      code: "INTERNAL_ERROR",
      message: "Email settings could not be confirmed.",
    });
  }
  return row.email_notifications;
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
