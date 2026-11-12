import type { CommentLocation, ThreadTarget } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Params = Pick<URLSearchParams, "get" | "getAll">;
type ParsedTarget<T> = { kind: "none" } | { kind: "invalid" } | { kind: "valid"; target: T };

export function commentThreadHref(target: CommentLocation, role: "teacher" | "parent"): string {
  if (role === "teacher")
    return `/activities/${encodeURIComponent(target.activityId)}/submissions/${encodeURIComponent(target.submissionId)}?view=comments`;
  return `/progress?${new URLSearchParams({
    child: target.studentId, activity: target.activityId, submission: target.submissionId, view: "comments",
  })}`;
}

export function parseTeacherCommentTarget(
  params: Params, activityId: string, submissionId?: string
): ParsedTarget<ThreadTarget & { activityId: string }> {
  const views = params.getAll("view");
  if (!views.length) return { kind: "none" };
  if (views.length !== 1 || views[0] !== "comments" || !submissionId ||
    !UUID.test(submissionId) || !UUID.test(activityId) || params.getAll("student").length ||
    params.getAll("submission").length || params.getAll("tab").length)
    return { kind: "invalid" };
  return { kind: "valid", target: { activityId: activityId.toLowerCase(), submissionId: submissionId.toLowerCase() } };
}

export function parseParentCommentTarget(params: Params): ParsedTarget<CommentLocation> {
  const views = params.getAll("view");
  if (!views.length) return { kind: "none" };
  const fields = ["child", "activity", "submission"] as const;
  if (views.length !== 1 || views[0] !== "comments" || params.getAll("tab").length ||
    fields.some(field => params.getAll(field).length !== 1 || !UUID.test(params.get(field) ?? "")))
    return { kind: "invalid" };
  return { kind: "valid", target: {
    activityId: params.get("activity")!.toLowerCase(), studentId: params.get("child")!.toLowerCase(),
    submissionId: params.get("submission")!.toLowerCase(),
  } };
}
