"""Normalize private SDK failures before generic logging or response validation."""

from collections.abc import Callable
from typing import TypeVar

from fastapi import HTTPException
from postgrest.exceptions import APIError
from pydantic import BaseModel

from app.api.notification_contracts import NotificationReadResponse
from app.comments.contracts import CommentLockState, CommentPosted
from app.comments.errors import comment_error
from app.core.supabase import supabase_client

T = TypeVar("T")
_RESULTS = {
    "post_private_comment": CommentPosted,
    "set_comment_thread_lock": CommentLockState,
    "mark_comment_notification_read": NotificationReadResponse,
}
_PARAMETERS = {
    "post_private_comment": {"actor_id", "target_activity_id", "target_student_id", "comment_body"},
    "set_comment_thread_lock": {"actor_id", "target_activity_id", "target_student_id", "locked"},
    "mark_comment_notification_read": {
        "actor_id",
        "target_notification_id",
        "expected_comment_version",
    },
    "delete_private_comment": {"actor_id", "target_comment_id"},
}


def safe_comment_operation(operation: Callable[[], T]) -> T:
    try:
        return operation()
    except HTTPException:
        raise
    except APIError as exc:
        raise comment_error(exc.code) from None
    except Exception:
        # Provider exceptions and validation input may contain the private text.
        # They must never reach the application's generic exception logger.
        raise comment_error() from None


def comment_rpc(name: str, parameters: dict) -> BaseModel | dict:
    if name not in _PARAMETERS or set(parameters) != _PARAMETERS[name]:
        raise comment_error()
    result = supabase_client.rpc(name, parameters).execute().data
    if not isinstance(result, dict):
        raise comment_error()
    if name == "delete_private_comment":
        if set(result) != {"deleted"} or result["deleted"] is not True:
            raise comment_error()
        return result
    return _RESULTS[name].model_validate(result)
