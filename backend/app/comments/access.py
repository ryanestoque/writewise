"""Application authorization precedes each service-only comment mutation."""

from app.comments.errors import comment_error
from app.core.supabase import supabase_client


def require_comment_work(
    actor_id: str, activity_id: str, student_id: str, *, owner_only: bool = False
) -> None:
    activities = (
        supabase_client.table("activity")
        .select("id,created_by")
        .eq("id", activity_id)
        .limit(1)
        .execute()
        .data
    )
    if not activities:
        raise comment_error("WW404")
    owner = activities[0]["created_by"] == actor_id
    if owner_only and not owner:
        raise comment_error("WW404")
    if not owner:
        links = (
            supabase_client.table("student_parent")
            .select("student_id")
            .eq("parent_id", actor_id)
            .eq("student_id", student_id)
            .limit(1)
            .execute()
            .data
        )
        if not links:
            raise comment_error("WW404")
    assigned = (
        supabase_client.rpc(
            "is_assigned", {"target_activity_id": activity_id, "target_student_id": student_id}
        )
        .execute()
        .data
        is True
    )
    if not assigned:
        for table in ("private_comment", "submission", "student_work_grade"):
            rows = (
                supabase_client.table(table)
                .select("id")
                .eq("activity_id", activity_id)
                .eq("student_id", student_id)
                .limit(1)
                .execute()
                .data
            )
            if rows:
                break
        else:
            raise comment_error("WW404")


def require_authored_comment(actor_id: str, comment_id: str) -> None:
    rows = (
        supabase_client.table("private_comment")
        .select("id,activity_id,student_id,author_id")
        .eq("id", comment_id)
        .limit(1)
        .execute()
        .data
    )
    if not rows or rows[0]["author_id"] != actor_id:
        raise comment_error("WW404")
    row = rows[0]
    require_comment_work(actor_id, row["activity_id"], row["student_id"])
