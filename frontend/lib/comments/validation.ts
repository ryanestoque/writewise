import { z } from "zod";
import { ApiError } from "@/lib/utils/api-error";
import type { CommentThread, ThreadSummaries, ThreadTarget } from "./types";

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const version = z.number().int().positive().max(2147483647);
const cursor = z
  .object({ event_at: timestamp, kind: z.enum(["comment", "return"]), id: uuid })
  .strict();
const comment = z
  .object({
    kind: z.literal("comment"),
    id: uuid,
    event_at: timestamp,
    author_role: z.enum(["teacher", "parent"]),
    is_mine: z.boolean(),
    body: z
      .string()
      .refine((text) => Array.from(text).length <= 1000)
      .nullable(),
    deleted_at: timestamp.nullable(),
    comment_version: version,
  })
  .strict();
const returned = z
  .object({
    kind: z.literal("return"),
    id: uuid,
    event_at: timestamp,
    return_reason: z.enum([
      "wrong_worksheet",
      "blurry_or_cropped",
      "wrong_target_text",
      "incomplete",
      "other",
    ]),
    return_note: z.string().nullable(),
  })
  .strict();
const thread = z
  .object({
    activity_id: uuid,
    student_id: uuid,
    activity_title: z.string(),
    actor_role: z.enum(["teacher", "parent"]),
    assigned: z.boolean(),
    is_archived: z.boolean(),
    comments_locked: z.boolean(),
    can_post: z.boolean(),
    can_lock: z.boolean(),
    read_only_reasons: z.array(z.enum(["unassigned", "archived", "locked"])),
    entries: z.array(z.discriminatedUnion("kind", [comment, returned])),
    next_cursor: cursor.nullable(),
    seen_comment_version: version.nullable(),
    unread_notice: z.object({ id: uuid, comment_version: version }).strict().nullable(),
  })
  .strict();
const summaryCursor = z
  .object({ last_comment_at: timestamp, student_id: uuid, activity_id: uuid })
  .strict();
const summaries = z
  .object({
    rows: z.array(
      z
        .object({
          activity_id: uuid,
          student_id: uuid,
          activity_title: z.string(),
          student_label: z.string(),
          last_comment_at: timestamp,
          assigned: z.boolean(),
          is_archived: z.boolean(),
          comments_locked: z.boolean(),
        })
        .strict()
    ),
    next_cursor: summaryCursor.nullable(),
  })
  .strict();

function invalid(): never {
  throw new ApiError({
    code: "INTERNAL_ERROR",
    message: "Could not load the conversation. Try again.",
  });
}

export function parseThread(value: unknown, target: ThreadTarget): CommentThread {
  const parsed = thread.safeParse(value);
  if (!parsed.success) invalid();
  const result = parsed.data;
  if (result.activity_id !== target.activityId || result.student_id !== target.studentId) invalid();
  const comments = result.entries.filter((entry) => entry.kind === "comment");
  const seen = comments.length ? Math.max(...comments.map((entry) => entry.comment_version)) : null;
  if (
    seen !== result.seen_comment_version ||
    comments.some((entry) => (entry.body === null) !== (entry.deleted_at !== null))
  )
    invalid();
  const reasons = [
    !result.assigned && "unassigned",
    result.is_archived && "archived",
    result.comments_locked && "locked",
  ].filter(Boolean);
  if (
    reasons.join() !== result.read_only_reasons.join() ||
    result.can_post !== (reasons.length === 0) ||
    result.can_lock !== (result.actor_role === "teacher")
  )
    invalid();
  return result;
}

export function parseSummaries(value: unknown): ThreadSummaries {
  const parsed = summaries.safeParse(value);
  if (!parsed.success) invalid();
  return parsed.data;
}
