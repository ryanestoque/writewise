"""Private text is validated without accepting caller-selected identities or grades."""

from typing import Literal
from uuid import UUID

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictInt,
    StrictStr,
    field_validator,
)


class CommentPostRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)

    body: StrictStr

    @field_validator("body")
    @classmethod
    def clean_body(cls, value: str) -> str:
        value = value.strip()
        try:
            value.encode("utf-8")
        except UnicodeEncodeError:
            raise ValueError("Check the comment text.") from None
        if "\x00" in value or not 1 <= len(value) <= 1000:
            raise ValueError("Check the comment text.")
        return value


class CommentLockRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)

    locked: StrictBool


class CommentPosted(BaseModel):
    model_config = ConfigDict(hide_input_in_errors=True)

    id: UUID
    activity_id: UUID
    student_id: UUID
    author_role: Literal["teacher", "parent"]
    created_at: AwareDatetime
    comment_version: StrictInt = Field(gt=0, le=2147483647)


class CommentLockState(BaseModel):
    model_config = ConfigDict(hide_input_in_errors=True)

    activity_id: UUID
    student_id: UUID
    comments_locked: bool
