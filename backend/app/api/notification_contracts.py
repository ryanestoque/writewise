"""Read receipts expose only their identity, timestamp, and changed-row count."""

from uuid import UUID

from pydantic import AwareDatetime, BaseModel, Field


class NotificationReadResponse(BaseModel):
    id: UUID
    read_at: AwareDatetime


class NotificationsReadAllResponse(BaseModel):
    updated_count: int = Field(ge=0)
    read_at: AwareDatetime
