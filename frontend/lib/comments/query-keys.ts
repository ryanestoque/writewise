import type { ThreadCursor, ThreadScope, ThreadTarget, WorkCommentScope } from "./types";

export const commentKeys = {
  root: ["comments"] as const,
  account: (userId: string) => ["comments", userId] as const,
  thread: (userId: string, target: ThreadTarget) =>
    ["comments", userId, "thread", target.submissionId] as const,
  window: (userId: string, target: ThreadTarget, through: ThreadCursor | null) =>
    [...commentKeys.thread(userId, target), through] as const,
  attempts: (userId: string, scope: WorkCommentScope) =>
    ["comments", userId, "attempts", scope.activityId, scope.studentId] as const,
  summaries: (userId: string, scope: ThreadScope) =>
    ["comments", userId, "summaries", scope] as const,
  unread: (userId: string) => ["notifications", userId, "comment-threads"] as const,
};
