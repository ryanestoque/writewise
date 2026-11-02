"""Typed lifecycle contracts; generated OpenAPI is the browser contract source."""

from datetime import datetime
from enum import Enum
from typing import Any, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, field_validator, model_validator


class ReturnReason(str, Enum):
    WRONG_WORKSHEET = "wrong_worksheet"
    BLURRY_OR_CROPPED = "blurry_or_cropped"
    WRONG_TARGET_TEXT = "wrong_target_text"
    INCOMPLETE = "incomplete"
    OTHER = "other"


class ReturnSubmissionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: ReturnReason
    note: str | None = None
    resubmit_due_at: AwareDatetime | None = None

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if len(value) > 2000:
            raise ValueError("Note must be 2,000 characters or fewer")
        return value or None


class StudentWorkUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    due_at_override: AwareDatetime | None = None
    pinned_submission_id: UUID | None = None

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("Provide a deadline or pinned attempt change")
        return self


class SubmissionCreateResponse(BaseModel):
    submission_id: UUID
    status: Literal["completed"]
    released_at: datetime | None = None
    measurement: dict[str, Any] | None


def create_upload_response(
    submission_id: str, measurement: dict[str, Any], caller_role: str
) -> SubmissionCreateResponse:
    return SubmissionCreateResponse(
        submission_id=UUID(submission_id),
        status="completed",
        released_at=None,
        measurement=measurement if caller_role == "teacher" else None,
    )


class ReturnSubmissionResponse(BaseModel):
    submission_id: UUID
    status: Literal["returned"]
    returned_at: datetime
    returned_by: UUID
    return_reason: ReturnReason
    return_note: str | None
    released_at: datetime | None
    effective_due_at: datetime | None


class ReleaseSubmissionResponse(BaseModel):
    submission_id: UUID
    released_at: datetime


class ReleaseActivityResponse(BaseModel):
    released_count: int
    submission_ids: list[UUID]


class StudentWorkResponse(BaseModel):
    activity_id: UUID
    student_id: UUID
    due_at_override: datetime | None
    pinned_submission_id: UUID | None
    effective_due_at: datetime | None
    updated_at: datetime
