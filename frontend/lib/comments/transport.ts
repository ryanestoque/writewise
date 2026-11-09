import { accountRequestSignal, withAccountScope } from "@/lib/supabase/account-scope";
import { ApiError, handleApiResponse } from "@/lib/utils/api-error";

export async function commentMutation<T>(
  userId: string,
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: object,
  signal?: AbortSignal
): Promise<T> {
  if (!path.startsWith("/api/") || path.includes("\\")) {
    throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid conversation destination." });
  }
  const requestSignal = accountRequestSignal(userId, signal);
  return withAccountScope(userId, requestSignal, async (_caller, token, assertCurrent) => {
    const response = await fetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: requestSignal,
      cache: "no-store",
    });
    await assertCurrent();
    if (response.ok && response.status === 204) return undefined as T;
    return handleApiResponse<T>(response);
  });
}
