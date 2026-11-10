import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ApiError } from "@/lib/utils/api-error";
import { parseCommentAttempts, parseSummaries, parseThread } from "@/lib/comments/validation";
import {
  type CommentAttempts,
  type AttemptCursor,
  type UnreadCommentThreads,
  type WorkCommentScope,
  type CommentThread,
  type ThreadCursor,
  type ThreadScope,
  type ThreadSummaries,
  type ThreadSummaryCursor,
  type ThreadTarget,
} from "@/lib/comments/types";

type Caller = SupabaseClient<Database>;

function readError(error: { code?: string }): never {
  const code =
    error.code === "WW404" || error.code === "42501"
      ? "NOT_FOUND"
      : error.code === "WW422"
        ? "VALIDATION_ERROR"
        : "INTERNAL_ERROR";
  throw new ApiError({
    code,
    message:
      code === "NOT_FOUND"
        ? "Conversation unavailable."
        : "Could not load the conversation. Try again.",
  });
}

// Compare using all six fractional digits; keep the original wire value for cursors.
function timestampKey(value: string) {
  const match = value.match(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/
  );
  const date = new Date(value);
  if (!match || !Number.isFinite(date.getTime())) readError({});
  return `${date.toISOString().slice(0, 19)}.${(match[1] ?? "").padEnd(6, "0")}Z`;
}

export function compareCommentTimestamps(a: string, b: string): number {
  return timestampKey(a).localeCompare(timestampKey(b));
}

export function compareThreadCursor(a: ThreadCursor, b: ThreadCursor): number {
  return (
    timestampKey(b.event_at).localeCompare(timestampKey(a.event_at)) ||
    b.kind.localeCompare(a.kind) ||
    b.id.localeCompare(a.id)
  );
}

export function canAcknowledge(thread: CommentThread): boolean {
  const notice = thread.unread_notice;
  return (
    !!notice &&
    thread.seen_comment_version !== null &&
    notice.comment_version <= thread.seen_comment_version &&
    thread.entries.some(
      (entry) => entry.kind === "comment" && entry.comment_version === notice.comment_version
    )
  );
}

export async function readThreadPage(
  client: Caller,
  target: ThreadTarget,
  before: ThreadCursor | null,
  signal?: AbortSignal
): Promise<CommentThread> {
  signal?.throwIfAborted();
  const query = client.rpc("read_submission_comment_thread", {
    target_submission_id: target.submissionId,
    ...(before ? { before_cursor: before } : {}),
    page_size: 50,
  });
  const result = await (signal ? query.abortSignal(signal) : query);
  signal?.throwIfAborted();
  if (result.error) readError(result.error);
  return parseThread(result.data, target);
}

export async function readThreadWindow(
  client: Caller,
  target: ThreadTarget,
  through: ThreadCursor | null,
  signal?: AbortSignal
): Promise<CommentThread> {
  const head = await readThreadPage(client, target, null, signal);
  if (!through) return head;
  let page = head;
  let before: ThreadCursor | null = null;
  const retained = new Map<string, CommentThread["entries"][number]>();
  for (;;) {
    for (const entry of page.entries) {
      if (compareThreadCursor(entry, through) <= 0)
        retained.set(`${entry.kind}:${entry.id}`, entry);
    }
    const reached = page.entries.some((entry) => compareThreadCursor(entry, through) >= 0);
    if (reached || !page.next_cursor) {
      const entries = [...retained.values()].sort(compareThreadCursor);
      const last = entries.at(-1);
      const hasMore =
        !!page.next_cursor || page.entries.some((entry) => compareThreadCursor(entry, through) > 0);
      const versions = entries.flatMap((entry) =>
        entry.kind === "comment" ? [entry.comment_version] : []
      );
      return {
        ...head,
        entries,
        next_cursor:
          hasMore && last ? { event_at: last.event_at, kind: last.kind, id: last.id } : null,
        seen_comment_version: versions.length ? Math.max(...versions) : null,
      };
    }
    if (before && compareThreadCursor(page.next_cursor, before) <= 0) readError({});
    before = page.next_cursor;
    page = await readThreadPage(client, target, before, signal);
  }
}

export async function readThreadSummaries(
  client: Caller,
  scope: ThreadScope,
  before: ThreadSummaryCursor | null,
  signal?: AbortSignal
): Promise<ThreadSummaries> {
  signal?.throwIfAborted();
  const query = client.rpc("list_submission_comment_threads", {
    ...(scope.activityId
      ? { target_activity_id: scope.activityId }
      : { target_student_id: scope.studentId }),
    ...(before ? { before_cursor: before } : {}),
    page_size: 50,
  });
  const result = await (signal ? query.abortSignal(signal) : query);
  signal?.throwIfAborted();
  if (result.error) readError(result.error);
  const parsed = parseSummaries(result.data);
  if (
    parsed.rows.some((row) =>
      scope.activityId ? row.activity_id !== scope.activityId : row.student_id !== scope.studentId
    )
  )
    readError({});
  return parsed;
}

export async function readUnreadCommentThreads(
  client: Caller,
  userId: string,
  signal?: AbortSignal
): Promise<UnreadCommentThreads> {
  const result: UnreadCommentThreads = new Map();
  let after: string | null = null;
  for (;;) {
    signal?.throwIfAborted();
    let query = client
      .from("notification")
      .select("id,activity_id,student_id,submission_id,comment_version")
      .eq("recipient_id", userId)
      .eq("type", "comment_posted")
      .is("read_at", null)
      .order("id", { ascending: true })
      .limit(1000);
    if (after) query = query.gt("id", after);
    const page = await (signal ? query.abortSignal(signal) : query);
    signal?.throwIfAborted();
    if (page.error) readError(page.error);
    for (const row of page.data ?? []) {
      if (!row.submission_id || !row.comment_version || !Number.isInteger(row.comment_version)) readError({});
      result.set(row.submission_id, {
        id: row.id,
        comment_version: row.comment_version,
        submission_id: row.submission_id,
        activity_id: row.activity_id,
        student_id: row.student_id,
      });
    }
    if (!page.data || page.data.length < 1000) return result;
    const next = page.data.at(-1)!.id;
    if (next === after) readError({});
    after = next;
  }
}

export async function readCommentAttempts(
  client: Caller, scope: WorkCommentScope, before: AttemptCursor | null, signal?: AbortSignal
): Promise<CommentAttempts> {
  signal?.throwIfAborted();
  const query = client.rpc("list_submission_comment_attempts", {
    target_activity_id: scope.activityId, target_student_id: scope.studentId,
    ...(before ? { before_cursor: before } : {}), page_size: 50,
  });
  const result = await (signal ? query.abortSignal(signal) : query);
  signal?.throwIfAborted();
  if (result.error) readError(result.error);
  return parseCommentAttempts(result.data, scope);
}
