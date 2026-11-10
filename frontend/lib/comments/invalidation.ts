import type { QueryClient } from "@tanstack/react-query";
import { notificationKeys } from "@/lib/notifications/query-keys";
import type { CommentThread } from "./types";

export async function clearDeletedSubmissionComments(client: QueryClient, submissionIds: readonly string[]): Promise<void> {
  const deleted = new Set(submissionIds);
  if (!deleted.size) return;
  const matches = (key: readonly unknown[]) => key[0] === "comments" && key[2] === "thread" &&
    typeof key[3] === "string" && deleted.has(key[3]);
  const filter = { predicate: (query: { queryKey: readonly unknown[] }) => matches(query.queryKey) };
  await client.cancelQueries(filter);
  client.setQueriesData<CommentThread | null>(filter, null);
  for (const mutation of client.getMutationCache().findAll({
    predicate: mutation => matches(mutation.options.mutationKey ?? []),
  })) client.getMutationCache().remove(mutation);
  await Promise.all([
    client.invalidateQueries({ predicate: query => query.queryKey[0] === "comments" && query.queryKey[2] !== "thread" }),
    client.invalidateQueries({ queryKey: notificationKeys.root }),
  ]);
}
