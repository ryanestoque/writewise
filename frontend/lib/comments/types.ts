export type ThreadTarget = { activityId: string; studentId: string };
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
  activity_id: string;
  student_id: string;
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
  student_id: string;
  activity_id: string;
};
export type ThreadSummary = {
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

export const threadPair = ({ activityId, studentId }: ThreadTarget) => `${activityId}:${studentId}`;
