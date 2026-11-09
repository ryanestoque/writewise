import type { ThreadTarget } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Params = Pick<URLSearchParams, "get" | "getAll">;
type ParsedTarget =
  { kind: "none" } | { kind: "invalid" } | { kind: "valid"; target: ThreadTarget };

export function commentThreadHref(target: ThreadTarget, role: "teacher" | "parent"): string {
  if (role === "teacher") {
    const params = new URLSearchParams({ student: target.studentId, view: "comments" });
    return `/activities/${encodeURIComponent(target.activityId)}?${params}`;
  }
  const params = new URLSearchParams({
    child: target.studentId,
    activity: target.activityId,
    view: "comments",
  });
  return `/progress?${params}`;
}

export function parseTeacherCommentTarget(params: Params, activityId: string): ParsedTarget {
  if (!params.getAll("view").includes("comments")) return { kind: "none" };
  const studentId = params.get("student");
  if (
    params.getAll("view").length !== 1 ||
    params.getAll("student").length !== 1 ||
    !studentId ||
    !UUID.test(studentId) ||
    !UUID.test(activityId)
  )
    return { kind: "invalid" };
  return {
    kind: "valid",
    target: { activityId: activityId.toLowerCase(), studentId: studentId.toLowerCase() },
  };
}

export function parseParentCommentTarget(params: Params): ParsedTarget {
  if (!params.getAll("view").includes("comments")) return { kind: "none" };
  const activityId = params.get("activity");
  if (
    !activityId ||
    !UUID.test(activityId) ||
    params.getAll("activity").length !== 1 ||
    params.getAll("child").length !== 1
  )
    return { kind: "invalid" };
  const adapted = new URLSearchParams();
  for (const view of params.getAll("view")) adapted.append("view", view);
  adapted.set("student", params.get("child") ?? "");
  return parseTeacherCommentTarget(adapted, activityId);
}
