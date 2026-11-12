"""Activity request/response contracts; database/API types are generated from these."""

from datetime import datetime
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, field_validator, model_validator

from app.gradebook.contracts import ActivityPointsUpdate, PointAmount, PointsPossible


class AssignmentTarget(BaseModel):
    model_config = ConfigDict(extra="forbid")

    section_id: UUID | None = None
    student_id: UUID | None = None

    @model_validator(mode="after")
    def exactly_one_target(self):
        if (self.section_id is None) == (self.student_id is None):
            raise ValueError("Choose exactly one section or student")
        return self


class ActivityCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    target_text: str
    assignments: list[AssignmentTarget]
    instructions: str | None = None
    is_take_home: bool = False
    due_at: AwareDatetime | None = None
    close_after_due: bool = False
    points_possible: PointsPossible | None = None

    @field_validator("title", "target_text")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Must not be blank")
        return value.strip()


class ActivityUpdate(ActivityPointsUpdate):
    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    target_text: str | None = None
    assignments: list[AssignmentTarget] | None = None
    instructions: str | None = None
    is_take_home: bool | None = None
    due_at: AwareDatetime | None = None
    close_after_due: bool | None = None

    @field_validator(
        "title", "target_text", "assignments", "is_take_home", "close_after_due", mode="before"
    )
    @classmethod
    def not_null_when_present(cls, value):
        if value is None:
            raise ValueError("Must not be null")
        return value

    @field_validator("title", "target_text")
    @classmethod
    def nonblank(cls, value: str) -> str:
        return ActivityCreate.nonblank(value)


class ActivityResponse(BaseModel):
    id: UUID
    title: str
    target_text: str
    assignments: list[AssignmentTarget]
    instructions: str | None
    is_take_home: bool
    is_archived: bool
    due_at: datetime | None
    close_after_due: bool
    created_by: UUID
    created_at: datetime
    points_possible: PointAmount | None = None
