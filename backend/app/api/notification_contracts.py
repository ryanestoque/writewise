"""Read receipts expose only their identity, timestamp, and changed-row count."""

from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictInt


class NotificationReadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)

    expected_comment_version: StrictInt | None = Field(default=None, gt=0, le=2147483647)


class NotificationReadResponse(BaseModel):
    id: UUID
    read_at: AwareDatetime


class NotificationsReadAllResponse(BaseModel):
    updated_count: int = Field(ge=0)
    read_at: AwareDatetime
