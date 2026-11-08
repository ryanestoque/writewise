import { createClient } from "@/lib/supabase/client";
import { getAuthToken } from "@/lib/supabase/auth-helper";
import { ApiError, handleApiResponse } from "@/lib/utils/api-error";

function aborted(): never {
  throw new DOMException("The gradebook account or request changed.", "AbortError");
}

async function authorizedFetch(userId: string, path: string, init: RequestInit) {
  if (!path.startsWith("/api/")) {
    throw new ApiError({ code: "VALIDATION_ERROR", message: "Invalid gradebook destination." });
  }
  if (init.signal?.aborted) aborted();
  const supabase = createClient();
  const token = await getAuthToken(supabase);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || data.user?.id !== userId) {
    throw new ApiError({ code: "UNAUTHORIZED", message: "Sign in again to view grades." });
  }
  const assertCurrent = async () => {
    if (init.signal?.aborted) aborted();
    const { data: current, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || current.session?.user.id !== userId || current.session.access_token !== token) {
      aborted();
    }
  };
  await assertCurrent();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers, cache: "no-store" });
  await assertCurrent();
  return { response, assertCurrent };
}

export async function gradebookRequest<T>(
  userId: string,
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const { response, assertCurrent } = await authorizedFetch(userId, path, { method: "GET", signal });
  const result = await handleApiResponse<T>(response);
  await assertCurrent();
  return result;
}

export async function gradebookMutation<T>(
  userId: string,
  path: string,
  method: "POST" | "PUT",
  body: object,
): Promise<T> {
  const { response, assertCurrent } = await authorizedFetch(userId, path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await handleApiResponse<T>(response);
  await assertCurrent();
  return result;
}

export async function downloadGradebookCsv(userId: string, sectionId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(sectionId)) {
    throw new ApiError({ code: "VALIDATION_ERROR", message: "Choose a valid section." });
  }
  const { response, assertCurrent } = await authorizedFetch(
    userId, `/api/sections/${encodeURIComponent(sectionId)}/gradebook.csv`, { method: "GET" },
  );
  if (!response.ok) {
    await handleApiResponse(response);
    return;
  }
  const blob = await response.blob();
  await assertCurrent();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  try {
    anchor.href = url;
    anchor.download = `gradebook-${sectionId}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
