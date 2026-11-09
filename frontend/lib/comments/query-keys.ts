import type { ThreadCursor, ThreadScope, ThreadTarget } from "./types";

export const commentKeys = {
  root: ["comments"] as const,
  account: (userId: string) => ["comments", userId] as const,
  pair: (userId: string, target: ThreadTarget) =>
    ["comments", userId, "thread", target.activityId, target.studentId] as const,
  window: (userId: string, target: ThreadTarget, through: ThreadCursor | null) =>
    [...commentKeys.pair(userId, target), through] as const,
  summaries: (userId: string, scope: ThreadScope) =>
    ["comments", userId, "summaries", scope] as const,
  unread: (userId: string) => ["notifications", userId, "comment-threads"] as const,
};
