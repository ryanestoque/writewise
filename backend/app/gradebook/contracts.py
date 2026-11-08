"""Typed coursework contracts; draft publication is independent of assessment history."""

from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    PlainSerializer,
    StrictBool,
    StrictInt,
    field_validator,
    model_validator,
)


def _input_decimal(value: object) -> Decimal:
    if isinstance(value, bool):
        raise ValueError("Enter a decimal number")
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError("Enter a decimal number") from exc
    if not result.is_finite() or result.as_tuple().exponent < -2:
        raise ValueError("Use a finite number with at most two decimal places")
    return result


def _decimal_text(value: Decimal) -> str:
    return format(value, ".2f")


PointsPossible = Annotated[
    Decimal,
    BeforeValidator(_input_decimal),
    Field(gt=0, le=Decimal("9999.99"), allow_inf_nan=False),
]
PointsOverride = Annotated[
    Decimal,
    BeforeValidator(_input_decimal),
    Field(ge=0, le=Decimal("9999.99"), allow_inf_nan=False),
]
PointAmount = Annotated[
    Decimal,
    Field(ge=0, allow_inf_nan=False),
    PlainSerializer(_decimal_text, return_type=str, when_used="json"),
]
PercentageAmount = Annotated[
    Decimal,
    Field(ge=0, le=100, allow_inf_nan=False),
    PlainSerializer(_decimal_text, return_type=str, when_used="json"),
]
CourseworkStatus = Literal[
    "Assigned", "Returned", "Missing", "Draft", "Released", "Turned in", "Excused", "Not assigned"
]


class GradebookModel(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class ActivityPointsUpdate(GradebookModel):
    points_possible: PointsPossible | None = None
    confirm_remove_points: StrictBool = False

    @model_validator(mode="after")
    def confirmation_only_for_removal(self):
        if self.confirm_remove_points and (
            "points_possible" not in self.model_fields_set or self.points_possible is not None
        ):
            raise ValueError("Confirmation requires an explicit removal of activity points")
        return self


class WorkGradeUpdate(GradebookModel):
    points_override: PointsOverride | None = None
    excused: StrictBool | None = None

    @field_validator("excused", mode="before")
    @classmethod
    def excused_is_not_null(cls, value):
        if value is None:
            raise ValueError("Excused must be true or false")
        return value

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("Provide a points override or excused change")
        return self


class GradeReleaseRequest(GradebookModel):
    expected_revision: Annotated[StrictInt, Field(gt=0)]


class AssignZeroMissingRequest(GradebookModel):
    student_ids: Annotated[list[UUID], Field(min_length=1)] | None = None

    @field_validator("student_ids", mode="before")
    @classmethod
    def explicit_selection_is_not_null(cls, value):
        if value is None:
            raise ValueError("Omit the selection to include all eligible missing work")
        return value

    @field_validator("student_ids")
    @classmethod
    def unique_sorted_students(cls, value):
        return sorted(set(value)) if value is not None else None


class ExcuseStudentsRequest(GradebookModel):
    student_ids: Annotated[list[UUID], Field(min_length=1)]
    excused: StrictBool

    @field_validator("student_ids")
    @classmethod
    def unique_sorted_students(cls, value):
        return sorted(set(value))


class WorkGradeRecord(GradebookModel):
    id: UUID
    activity_id: UUID
    student_id: UUID
    points_override: PointAmount | None
    source_submission_id: UUID | None
    revision: Annotated[int, Field(gt=0)]
    released_revision: Annotated[int, Field(gt=0)] | None
    released_at: datetime | None


class GradeReleaseResponse(GradebookModel):
    activity_id: UUID
    student_id: UUID
    revision: Annotated[int, Field(gt=0)]
    released_at: datetime
    submission_id: UUID | None
    rubric_released: bool
    grade_released: bool


class BulkGradeResponse(GradebookModel):
    changed_student_ids: list[UUID]
    skipped_student_ids: list[UUID]


class GradebookCell(GradebookModel):
    activity_id: UUID
    student_id: UUID
    applicable: bool
    coursework_status: CourseworkStatus
    late: bool
    points_possible: PointAmount | None
    automatic_points: PointAmount | None
    points_override: PointAmount | None
    final_points: PointAmount | None
    assessment_composite: PercentageAmount | None
    assessment_source: Literal["manual", "calibrated"] | None
    publication: Literal["draft", "released", "unavailable"]
    grade_revision: Annotated[int, Field(gt=0)] | None
    active_submission_id: UUID | None
    included: bool


class GradebookTotals(GradebookModel):
    earned: PointAmount
    possible: PointAmount
    percentage: PercentageAmount | None


class GradebookRow(GradebookModel):
    student_id: UUID
    student_name: str
    cells: list[GradebookCell]
    totals: GradebookTotals


class GradebookActivity(GradebookModel):
    id: UUID
    title: str
    created_at: datetime
    is_archived: bool
    points_possible: PointAmount | None


class SectionGradebook(GradebookModel):
    section_id: UUID
    section_name: str
    teacher_id: UUID
    activities: list[GradebookActivity]
    rows: list[GradebookRow]


class GradebookTeacherGroup(GradebookModel):
    teacher_id: UUID
    teacher_name: str
    activities: list[GradebookActivity]
    row: GradebookRow


class ChildGradebook(GradebookModel):
    student_id: UUID
    groups: list[GradebookTeacherGroup]
