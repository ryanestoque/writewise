import type { Database } from "@/types/database";

export type ThreadTarget = { submissionId: string };
export type CommentLocation = ThreadTarget & { activityId: string; studentId: string };
export type WorkCommentScope = { activityId: string; studentId: string };
export type SubmissionStatus = Database["public"]["Enums"]["submission_status"];
export type ThreadCursor = { event_at: string; kind: "comment" | "return"; id: string };
export type CommentEntry = {
  kind: "comment";
  id: string;
  event_at: string;
  author_role: "teacher" | "parent";
  is_mine: boolean;
  body: string | null;
  deleted_at: string | null;
  comment_version: number;
};
export type ReturnEntry = {
  kind: "return";
  id: string;
  event_at: string;
  return_reason:
    "wrong_worksheet" | "blurry_or_cropped" | "wrong_target_text" | "incomplete" | "other";
  return_note: string | null;
};
export type ThreadEntry = CommentEntry | ReturnEntry;
export type CommentThread = {
  submission_id: string;
  activity_id: string;
  student_id: string;
  submitted_at: string;
  submission_status: SubmissionStatus;
  activity_title: string;
  actor_role: "teacher" | "parent";
  assigned: boolean;
  is_archived: boolean;
  comments_locked: boolean;
  can_post: boolean;
  can_lock: boolean;
  read_only_reasons: ("unassigned" | "archived" | "locked")[];
  entries: ThreadEntry[];
  next_cursor: ThreadCursor | null;
  seen_comment_version: number | null;
  unread_notice: { id: string; comment_version: number } | null;
};
export type ThreadSummaryCursor = {
  last_comment_at: string;
  submission_id: string;
};
export type ThreadSummary = {
  submission_id: string;
  submitted_at: string;
  submission_status: SubmissionStatus;
  activity_id: string;
  student_id: string;
  activity_title: string;
  student_label: string;
  last_comment_at: string;
  assigned: boolean;
  is_archived: boolean;
  comments_locked: boolean;
};
export type ThreadSummaries = { rows: ThreadSummary[]; next_cursor: ThreadSummaryCursor | null };
export type ThreadScope =
  { activityId: string; studentId?: never } | { studentId: string; activityId?: never };

export type CommentAttempt = Pick<CommentThread,
  "submission_id" | "activity_id" | "student_id" | "submitted_at" | "submission_status" | "comments_locked"
>;
export type AttemptCursor = { submitted_at: string; submission_id: string };
export type CommentAttempts = { rows: CommentAttempt[]; next_cursor: AttemptCursor | null };
export type UnreadCommentNotice = {
  id: string; submission_id: string; activity_id: string; student_id: string; comment_version: number;
};
export type UnreadCommentThreads = Map<string, UnreadCommentNotice>;
export const threadIdentity = ({ submissionId }: ThreadTarget) => submissionId;
