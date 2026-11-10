"""Synthetic comment rows; callers use real signed-in clients to prove access."""

from app.core.supabase import supabase_client as admin


def post_comment(actor_id, submission_id, body="Synthetic reply"):
    return (
        admin.rpc(
            "post_submission_comment",
            {
                "actor_id": actor_id,
                "target_submission_id": submission_id,
                "comment_body": body,
            },
        )
        .execute()
        .data
    )


def seed_comment(
    family,
    submission_id,
    *,
    actor_id=None,
    body="Synthetic private message",
):
    actor_id = actor_id or family["teacher"]
    source = {"submission_id": submission_id}
    work = (
        admin.table("submission_comment_thread")
        .select("comment_version")
        .eq("submission_id", submission_id)
        .execute()
        .data
    )
    if not work:
        admin.table("submission_comment_thread").insert(source).execute()
    version = (work[0]["comment_version"] if work else 0) + 1
    row = (
        admin.table("private_comment")
        .insert(
            {
                **source,
                "author_id": actor_id,
                "author_role": "teacher" if actor_id == family["teacher"] else "parent",
                "body": body,
                "comment_version": version,
            }
        )
        .execute()
        .data[0]
    )
    admin.table("submission_comment_thread").update({"comment_version": version}).eq(
        "submission_id", submission_id
    ).execute()
    return row
