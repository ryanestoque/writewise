import { commentMutation } from "@/lib/comments/transport";
import type { components } from "@/types/api";

export async function readNotificationState<T>(
  userId: string,
  path: string,
  signal?: AbortSignal,
  body?: components["schemas"]["NotificationReadRequest"]
): Promise<T> {
  return commentMutation<T>(userId, path, "POST", body, signal);
}
