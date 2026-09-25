from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["normal", "needs_attention"]


class GuideLinesData(BaseModel):
    baseline_y: list[int] = Field(default_factory=list)
    midline_y: list[int] = Field(default_factory=list)
    topline_y: list[int] = Field(default_factory=list)


class BaselineAnnotation(BaseModel):
    line_index: int
    word_index: int
    bbox: list[int]
    deviation_ratio: float
    severity: Severity
    note: str
    measured_y: int | None = None


class BaselineOverlay(BaseModel):
    guide_lines: GuideLinesData
    annotations: list[BaselineAnnotation] = Field(default_factory=list)


class SpacingAnnotation(BaseModel):
    line_index: int
    gap_index: int
    x1: int
    x2: int
    y: int
    gap_ratio: float
    severity: Severity
    note: str


class SpacingOverlay(BaseModel):
    annotations: list[SpacingAnnotation] = Field(default_factory=list)


class SizeAnnotation(BaseModel):
    line_index: int
    word_index: int
    bbox: list[int]
    size_ratio: float
    severity: Severity
    note: str


class SizeOverlay(BaseModel):
    annotations: list[SizeAnnotation] = Field(default_factory=list)


class SlantAnnotation(BaseModel):
    line_index: int
    word_index: int
    bbox: list[int]
    angle_deg: float
    vector: list[int]
    severity: Severity
    note: str


class SlantOverlay(BaseModel):
    annotations: list[SlantAnnotation] = Field(default_factory=list)


class FormationAnnotation(BaseModel):
    line_index: int
    word_index: int
    bbox: list[int]
    score: float
    band: str
    severity: Severity
    note: str


class FormationOverlay(BaseModel):
    annotations: list[FormationAnnotation] = Field(default_factory=list)


class OverlaySummary(BaseModel):
    weakest_criterion: str
    attention_item_count: int


class DiagnosticOverlay(BaseModel):
    summary: OverlaySummary
    baseline: BaselineOverlay
    spacing: SpacingOverlay
    size: SizeOverlay
    slant: SlantOverlay
    letter_formation: FormationOverlay
