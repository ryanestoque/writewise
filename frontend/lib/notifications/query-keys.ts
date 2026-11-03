export const notificationKeys = {
  root: ["notifications"] as const,
  account: (userId: string) => ["notifications", userId] as const,
  count: (userId: string) => ["notifications", userId, "count"] as const,
  feed: (userId: string, through: { created_at: string; id: string } | null) =>
    ["notifications", userId, "feed", 20, through] as const,
  labels: (userId: string, ids: string) => ["notifications", userId, "labels", ids] as const,
};
