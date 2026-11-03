"""Verified-recipient read mutations. Notification reads stay behind browser RLS."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError

from app.api.deps import get_current_user
from app.api.notification_contracts import NotificationReadResponse, NotificationsReadAllResponse
from app.core.supabase import supabase_client

router = APIRouter()


def _error(code: str = "INTERNAL_ERROR") -> HTTPException:
    if code == "NOT_FOUND":
        return HTTPException(
            404, detail={"code": code, "message": "Notification not found.", "details": {}}
        )
    return HTTPException(
        500,
        detail={
            "code": "INTERNAL_ERROR",
            "message": "Could not mark notifications read.",
            "details": {},
        },
    )


def _read_rpc(name: str, payload: dict) -> dict:
    try:
        result = supabase_client.rpc(name, payload).execute().data
    except APIError as exc:
        raise _error("NOT_FOUND" if exc.code == "WW404" else "INTERNAL_ERROR") from exc
    if not isinstance(result, dict):
        raise _error()
    return result


@router.post("/read-all", response_model=NotificationsReadAllResponse)
def mark_all_read(user: dict = Depends(get_current_user)):
    return _read_rpc("mark_all_notifications_read", {"actor_id": user["sub"]})


@router.post("/{notification_id}/read", response_model=NotificationReadResponse)
def mark_read(notification_id: UUID, user: dict = Depends(get_current_user)):
    actor = user["sub"]
    try:
        rows = (
            supabase_client.table("notification")
            .select("id")
            .eq("id", str(notification_id))
            .eq("recipient_id", actor)
            .execute()
            .data
        )
    except APIError as exc:
        raise _error() from exc
    if not rows:
        raise _error("NOT_FOUND")
    return _read_rpc(
        "mark_notification_read",
        {"actor_id": actor, "target_notification_id": str(notification_id)},
    )
