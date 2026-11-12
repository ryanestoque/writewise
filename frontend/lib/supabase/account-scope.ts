import { createClient as createCaller, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowser } from "@/lib/supabase/client";
import { getAuthToken } from "@/lib/supabase/auth-helper";
import { ApiError } from "@/lib/utils/api-error";
import type { Database } from "@/types/database";

const accounts = new Map<string, AbortController>();

export function accountRequestSignal(userId: string, signal?: AbortSignal): AbortSignal {
  let controller = accounts.get(userId);
  if (!controller || controller.signal.aborted) {
    controller = new AbortController();
    accounts.set(userId, controller);
  }
  return signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
}

export function abortAccountRequests(userId: string) {
  accounts.get(userId)?.abort();
  accounts.delete(userId);
}

export async function withAccountScope<T>(
  userId: string,
  signal: AbortSignal | undefined,
  operation: (
    caller: SupabaseClient<Database>,
    token: string,
    assertCurrent: () => Promise<void>
  ) => Promise<T>
): Promise<T> {
  signal?.throwIfAborted();
  const browser = createBrowser();
  const token = await getAuthToken(browser);
  signal?.throwIfAborted();
  const verified = await browser.auth.getUser(token);
  signal?.throwIfAborted();
  if (verified.error || verified.data.user?.id !== userId) {
    throw new ApiError({ code: "UNAUTHORIZED", message: "Sign in again to view comments." });
  }
  const assertCurrent = async () => {
    signal?.throwIfAborted();
    const current = await browser.auth.getSession();
    signal?.throwIfAborted();
    if (
      current.error ||
      current.data.session?.user.id !== userId ||
      current.data.session.access_token !== token
    ) {
      throw new DOMException("The account changed.", "AbortError");
    }
  };
  await assertCurrent();
  const caller = createCaller<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Keep the request client independent of the browser's auth storage/locks.
      accessToken: async () => token,
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );
  try {
    return await operation(caller, token, assertCurrent);
  } finally {
    await assertCurrent();
  }
}
