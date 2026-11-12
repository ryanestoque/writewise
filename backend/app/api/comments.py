"""Private-comment writes are authorized twice; reads stay under caller RLS."""

from uuid import UUID

from fastapi import APIRouter, Depends, Response

from app.api.deps import get_current_user
from app.comments.access import require_authored_comment, require_comment_submission
from app.comments.contracts import (
    CommentLockRequest,
    CommentLockState,
    CommentPosted,
    CommentPostRequest,
)
from app.comments.errors import comment_error
from app.comments.repository import comment_rpc, safe_comment_operation

router = APIRouter()


@router.post(
    "/submissions/{submission_id}/comments",
    response_model=CommentPosted,
    status_code=201,
)
def post_comment_route(
    submission_id: UUID,
    body: CommentPostRequest,
    response: Response,
    user: dict = Depends(get_current_user),
):
    def post():
        actor, submission = user["sub"], str(submission_id)
        require_comment_submission(actor, submission)
        return comment_rpc(
            "post_submission_comment",
            {
                "actor_id": actor,
                "target_submission_id": submission,
                "comment_body": body.body,
            },
        )

    response.headers["Cache-Control"] = "no-store"
    return safe_comment_operation(post)


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment_route(comment_id: UUID, user: dict = Depends(get_current_user)):
    def delete():
        actor, comment = user["sub"], str(comment_id)
        require_authored_comment(actor, comment)
        comment_rpc("delete_private_comment", {"actor_id": actor, "target_comment_id": comment})

    safe_comment_operation(delete)
    return Response(status_code=204, headers={"Cache-Control": "no-store"})


@router.put("/submissions/{submission_id}/comments/lock", response_model=CommentLockState)
def set_comment_lock_route(
    submission_id: UUID,
    body: CommentLockRequest,
    response: Response,
    user: dict = Depends(get_current_user),
):
    def set_lock():
        actor, submission = user["sub"], str(submission_id)
        require_comment_submission(actor, submission, owner_only=True)
        return comment_rpc(
            "set_submission_comment_lock",
            {
                "actor_id": actor,
                "target_submission_id": submission,
                "locked": body.locked,
            },
        )

    response.headers["Cache-Control"] = "no-store"
    return safe_comment_operation(set_lock)


@router.post("/activities/{activity_id}/students/{student_id}/comments", include_in_schema=False)
@router.put(
    "/activities/{activity_id}/students/{student_id}/comments/lock", include_in_schema=False
)
def retired_work_comment_route(activity_id: str, student_id: str):
    """An obsolete pair-only link never selects an attempt or accepts private text."""
    raise comment_error("WW404")
