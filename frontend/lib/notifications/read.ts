import type { createClient } from "@/lib/supabase/client";
import { getAuthToken } from "@/lib/supabase/auth-helper";
import { ApiError, handleApiResponse } from "@/lib/utils/api-error";

export async function readNotificationState<T>(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  path: string,
  signal?: AbortSignal
): Promise<T> {
  signal?.throwIfAborted();
  const token = await getAuthToken(supabase);
  signal?.throwIfAborted();
  // Verify the very token sent below, rather than a different session snapshot.
  const { data, error } = await supabase.auth.getUser(token);
  signal?.throwIfAborted();
  if (error || data.user?.id !== userId) {
    throw new ApiError({ code: "UNAUTHORIZED", message: "Sign in again to update notifications." });
  }
  const response = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  return handleApiResponse<T>(response);
}
