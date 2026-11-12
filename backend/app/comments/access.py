"""Application authorization precedes each service-only comment mutation."""

from app.comments.errors import comment_error
from app.core.supabase import supabase_client


def require_comment_submission(
    actor_id: str, submission_id: str, *, owner_only: bool = False
) -> dict:
    submissions = (
        supabase_client.table("submission")
        .select("id,activity_id,student_id")
        .eq("id", submission_id)
        .limit(1)
        .execute()
        .data
    )
    if not submissions:
        raise comment_error("WW404")
    source = submissions[0]
    activity_id, student_id = source["activity_id"], source["student_id"]
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
    return source


def require_authored_comment(actor_id: str, comment_id: str) -> None:
    rows = (
        supabase_client.table("private_comment")
        .select("id,submission_id,author_id")
        .eq("id", comment_id)
        .limit(1)
        .execute()
        .data
    )
    if not rows or rows[0]["author_id"] != actor_id:
        raise comment_error("WW404")
    row = rows[0]
    require_comment_submission(actor_id, row["submission_id"])
