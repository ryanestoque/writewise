"""Assemble one caller-authorized fact snapshot for either portal and CSV."""

from decimal import Decimal
from typing import Literal
from uuid import UUID

from app.gradebook.contracts import (
    ChildGradebook,
    GradebookActivity,
    GradebookCell,
    GradebookRow,
    GradebookTeacherGroup,
    GradebookTotals,
    SectionGradebook,
)
from app.scoring.gradebook import overall_percentage
from app.scoring.provider import ScoreProvider


def build_cell(
    fact: dict, *, audience: Literal["teacher", "parent"], provider: ScoreProvider
) -> GradebookCell:
    applicable = bool(fact["applicable"])
    excused = bool(fact["excused"])
    active = fact["active_submission_id"] if applicable else None
    score = (
        provider.recorded_grade_score(fact.get("measurement"), fact.get("manual_score"))
        if active else None
    )
    possible = Decimal(fact["points_possible"]) if (
        applicable and fact["points_possible"] is not None
    ) else None
    visible = bool(fact["grade_visible"])
    published = bool(fact["publication_current"])
    can_show = applicable and visible and (audience == "teacher" or published)
    automatic = provider.activity_points(possible, score) if (
        can_show and possible is not None and score is not None
    ) else None
    override = Decimal(fact["points_override"]) if (
        can_show and possible is not None and fact["points_override"] is not None
    ) else None
    final = override if override is not None else automatic
    status = fact["coursework_status"]
    if not applicable:
        status = "Not assigned"
    elif excused:
        status = "Excused"
    elif audience == "parent" and status == "Draft":
        status = "Turned in"
    publication: Literal["draft", "released", "unavailable"] = "unavailable"
    if can_show and final is not None:
        publication = "released" if published else "draft"
    return GradebookCell(
        activity_id=fact["activity_id"], student_id=fact["student_id"],
        applicable=applicable, coursework_status=status,
        late=bool(fact["late"]) and applicable and not excused,
        points_possible=possible, automatic_points=automatic, points_override=override,
        final_points=final,
        assessment_composite=score.composite if score is not None else None,
        assessment_source=score.source if score is not None else None,
        publication=publication,
        grade_revision=fact["grade_revision"] if can_show and audience == "teacher" else None,
        active_submission_id=active,
        included=can_show and not excused and possible is not None and final is not None,
    )


def _activities(facts: list[dict]) -> list[GradebookActivity]:
    activities = [GradebookActivity.model_validate(item) for item in facts]
    if len({item.id for item in activities}) != len(activities):
        raise ValueError("Duplicate activity in gradebook snapshot")
    return sorted(activities, key=lambda item: (item.created_at, str(item.id)), reverse=True)


def _row(
    fact: dict, activities: list[GradebookActivity],
    audience: Literal["teacher", "parent"], provider: ScoreProvider,
) -> GradebookRow:
    cells = [build_cell(cell, audience=audience, provider=provider) for cell in fact["cells"]]
    if len({cell.activity_id for cell in cells}) != len(cells):
        raise ValueError("Duplicate student/activity pair in gradebook snapshot")
    student_id = UUID(str(fact["student_id"]))
    positions = {activity.id: index for index, activity in enumerate(activities)}
    if {cell.activity_id for cell in cells} != set(positions):
        raise ValueError("Incomplete gradebook row snapshot")
    if any(cell.student_id != student_id or cell.activity_id not in positions for cell in cells):
        raise ValueError("Gradebook cell does not match its authorized scope")
    cells.sort(key=lambda cell: positions[cell.activity_id])
    included = [(cell.final_points, cell.points_possible) for cell in cells if cell.included]
    totals = GradebookTotals(
        earned=sum((earned for earned, _ in included), Decimal(0)),
        possible=sum((possible for _, possible in included), Decimal(0)),
        percentage=overall_percentage(included),
    )
    return GradebookRow(
        student_id=student_id, student_name=fact["student_name"], cells=cells, totals=totals
    )


def assemble_section(facts: dict, provider: ScoreProvider) -> SectionGradebook:
    activities = _activities(facts["activities"])
    rows = [_row(row, activities, "teacher", provider) for row in facts["rows"]]
    if len({row.student_id for row in rows}) != len(rows):
        raise ValueError("Duplicate student in gradebook snapshot")
    rows.sort(key=lambda row: (row.student_name.casefold(), str(row.student_id)))
    return SectionGradebook(
        section_id=facts["section_id"], section_name=facts["section_name"],
        teacher_id=facts["teacher_id"], activities=activities, rows=rows,
    )


def assemble_child(facts: dict, provider: ScoreProvider) -> ChildGradebook:
    student_id = UUID(str(facts["student_id"]))
    groups = []
    for group in facts["groups"]:
        activities = _activities(group["activities"])
        row = _row(group["row"], activities, "parent", provider)
        if row.student_id != student_id:
            raise ValueError("Gradebook row does not match the selected child")
        groups.append(GradebookTeacherGroup(
            teacher_id=group["teacher_id"], teacher_name=group["teacher_name"],
            activities=activities, row=row,
        ))
    if len({group.teacher_id for group in groups}) != len(groups):
        raise ValueError("Duplicate teacher group in gradebook snapshot")
    groups.sort(key=lambda group: (group.teacher_name.casefold(), str(group.teacher_id)))
    return ChildGradebook(student_id=student_id, groups=groups)
