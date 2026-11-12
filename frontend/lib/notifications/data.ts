import type { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

export type NotificationRow = Database["public"]["Tables"]["notification"]["Row"];
export type NotificationCursor = Pick<NotificationRow, "created_at" | "id">;
export type NotificationWindow = {
  rows: NotificationRow[];
  oldest: NotificationCursor | null;
  hasMore: boolean;
};
export type NotificationLabels = {
  students: Record<string, string>;
  activities: Record<string, string>;
};
type BrowserClient = ReturnType<typeof createClient>;
export const NOTIFICATION_PAGE_SIZE = 20;

export type ParentNotificationTarget = {
  childId: string;
  activityId: string;
  submissionId: string | null;
  view?: "grades" | "comments";
};
export type ParsedNotificationTarget =
  { kind: "none" } | { kind: "invalid" } | { kind: "valid"; target: ParentNotificationTarget };

export function parseParentNotificationTarget(
  params: Pick<URLSearchParams, "getAll">
): ParsedNotificationTarget {
  const child = params.getAll("child"),
    activity = params.getAll("activity"),
    submission = params.getAll("submission"),
    tab = params.getAll("tab"),
    view = params.getAll("view");
  if (!child.length && !activity.length && !submission.length && !view.length)
    return { kind: "none" };
  if (
    child.length !== 1 ||
    activity.length !== 1 ||
    submission.length > 1 ||
    tab.length > 1 ||
    view.length > 1 ||
    (view.length === 1 && (view[0] !== "comments" || submission.length !== 1 || tab.length > 0)) ||
    (tab.length === 1 && (tab[0] !== "grades" || submission.length > 0)) ||
    !isNotificationUuid(child[0]) ||
    !isNotificationUuid(activity[0]) ||
    (submission.length === 1 && !isNotificationUuid(submission[0]))
  )
    return { kind: "invalid" };
  return {
    kind: "valid",
    target: {
      childId: child[0].toLowerCase(),
      activityId: activity[0].toLowerCase(),
      submissionId: submission[0]?.toLowerCase() ?? null,
      ...(tab[0] === "grades" ? { view: "grades" as const } : {}),
      ...(view[0] === "comments" ? { view: "comments" as const } : {}),
    },
  };
}

export function isNotificationUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function timestampKey(value: string): string {
  const match = value.match(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/
  );
  const date = new Date(value);
  if (!match || !Number.isFinite(date.getTime())) throw new Error("Invalid notification cursor");
  return `${date.toISOString().slice(0, 19)}.${(match[1] ?? "").padEnd(6, "0")}Z`;
}

export function compareNotificationCursor(a: NotificationCursor, b: NotificationCursor): number {
  return (
    timestampKey(b.created_at).localeCompare(timestampKey(a.created_at)) || b.id.localeCompare(a.id)
  );
}

export function mergeNotificationRows(rows: NotificationRow[]): NotificationRow[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()].sort(compareNotificationCursor);
}

export async function readNotificationPage(
  client: BrowserClient,
  userId: string,
  before: NotificationCursor | null,
  signal?: AbortSignal
): Promise<NotificationWindow> {
  let query = client
    .from("notification")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(NOTIFICATION_PAGE_SIZE + 1);
  if (before) {
    if (!isNotificationUuid(before.id)) throw new Error("Invalid notification cursor");
    timestampKey(before.created_at);
    query = query.or(
      `created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`
    );
  }
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw error;
  const all = (data ?? []) as NotificationRow[];
  const rows = all.slice(0, NOTIFICATION_PAGE_SIZE);
  const last = rows.at(-1);
  return {
    rows,
    oldest: last ? { id: last.id, created_at: last.created_at } : null,
    hasMore: all.length > NOTIFICATION_PAGE_SIZE,
  };
}

// Refresh all previously loaded work, including a gap of more than one new page.
export async function readNotificationWindow(
  client: BrowserClient,
  userId: string,
  through: NotificationCursor | null,
  signal?: AbortSignal
): Promise<NotificationWindow> {
  if (!through) return readNotificationPage(client, userId, null, signal);
  let cursor: NotificationCursor | null = null;
  const collected: NotificationRow[] = [];
  for (;;) {
    const page = await readNotificationPage(client, userId, cursor, signal);
    const reached = page.rows.some((row) => compareNotificationCursor(row, through) >= 0);
    collected.push(...page.rows.filter((row) => compareNotificationCursor(row, through) <= 0));
    if (reached || !page.hasMore || !page.oldest) {
      const rows = mergeNotificationRows(collected);
      const last = rows.at(-1);
      return {
        rows,
        oldest: last ? { id: last.id, created_at: last.created_at } : null,
        hasMore:
          page.hasMore || page.rows.some((row) => compareNotificationCursor(row, through) > 0),
      };
    }
    if (page.oldest.id === cursor?.id) throw new Error("Notification page did not advance");
    cursor = page.oldest;
  }
}

export async function readNotificationLabels(
  client: BrowserClient,
  rows: NotificationRow[],
  signal?: AbortSignal
): Promise<NotificationLabels> {
  const students = [...new Set(rows.map((row) => row.student_id))];
  const activities = [...new Set(rows.map((row) => row.activity_id))];
  async function labels(
    table: "student" | "activity",
    ids: string[],
    column: "full_name" | "title"
  ) {
    const result: Record<string, string> = {};
    for (let index = 0; index < ids.length; index += 200) {
      let query = client
        .from(table)
        .select(`id,${column}`)
        .in("id", ids.slice(index, index + 200));
      if (signal) query = query.abortSignal(signal);
      const response = await query;
      if (response.error) throw response.error;
      for (const row of (response.data ?? []) as unknown as Record<string, string>[]) {
        if (row[column]) result[row.id] = row[column];
      }
    }
    return result;
  }
  const [studentLabels, activityLabels] = await Promise.all([
    labels("student", students, "full_name"),
    labels("activity", activities, "title"),
  ]);
  return { students: studentLabels, activities: activityLabels };
}
