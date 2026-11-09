"""Private-comment writes are authorized twice; reads stay under caller RLS."""

from uuid import UUID

from fastapi import APIRouter, Depends, Response

from app.api.deps import get_current_user
from app.comments.access import require_authored_comment, require_comment_work
from app.comments.contracts import (
    CommentLockRequest,
    CommentLockState,
    CommentPosted,
    CommentPostRequest,
)
from app.comments.repository import comment_rpc, safe_comment_operation

router = APIRouter()


@router.post(
    "/activities/{activity_id}/students/{student_id}/comments",
    response_model=CommentPosted,
    status_code=201,
)
def post_comment_route(
    activity_id: UUID,
    student_id: UUID,
    body: CommentPostRequest,
    response: Response,
    user: dict = Depends(get_current_user),
):
    def post():
        actor, activity, student = user["sub"], str(activity_id), str(student_id)
        require_comment_work(actor, activity, student)
        return comment_rpc(
            "post_private_comment",
            {
                "actor_id": actor,
                "target_activity_id": activity,
                "target_student_id": student,
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


@router.put(
    "/activities/{activity_id}/students/{student_id}/comments/lock", response_model=CommentLockState
)
def set_comment_lock_route(
    activity_id: UUID,
    student_id: UUID,
    body: CommentLockRequest,
    response: Response,
    user: dict = Depends(get_current_user),
):
    def set_lock():
        actor, activity, student = user["sub"], str(activity_id), str(student_id)
        require_comment_work(actor, activity, student, owner_only=True)
        return comment_rpc(
            "set_comment_thread_lock",
            {
                "actor_id": actor,
                "target_activity_id": activity,
                "target_student_id": student,
                "locked": body.locked,
            },
        )

    response.headers["Cache-Control"] = "no-store"
    return safe_comment_operation(set_lock)
