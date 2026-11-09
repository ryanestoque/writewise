"""Synthetic comment rows; callers use real signed-in clients to prove access."""

from app.core.supabase import supabase_client as admin


def post_comment(actor_id, activity_id, student_id, body="Synthetic reply"):
    return (
        admin.rpc(
            "post_private_comment",
            {
                "actor_id": actor_id,
                "target_activity_id": activity_id,
                "target_student_id": student_id,
                "comment_body": body,
            },
        )
        .execute()
        .data
    )


def seed_comment(
    family,
    activity_id,
    *,
    actor_id=None,
    body="Synthetic private message",
    student_id=None,
):
    student_id = student_id or family["students"][0]
    actor_id = actor_id or family["teacher"]
    pair = {"activity_id": activity_id, "student_id": student_id}
    work = (
        admin.table("student_work")
        .select("comment_version")
        .eq("activity_id", activity_id)
        .eq("student_id", student_id)
        .execute()
        .data
    )
    if not work:
        admin.table("student_work").insert(pair).execute()
    version = (work[0]["comment_version"] if work else 0) + 1
    row = (
        admin.table("private_comment")
        .insert(
            {
                **pair,
                "author_id": actor_id,
                "author_role": "teacher" if actor_id == family["teacher"] else "parent",
                "body": body,
                "comment_version": version,
            }
        )
        .execute()
        .data[0]
    )
    admin.table("student_work").update({"comment_version": version}).eq(
        "activity_id", activity_id
    ).eq("student_id", student_id).execute()
    return row
