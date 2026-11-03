"""Delivery values that never print recipient addresses or rendered payloads."""

from dataclasses import dataclass, field
from typing import Literal

EmailType = Literal["submission_returned", "due_soon"]


@dataclass(frozen=True)
class RenderedEmail:
    body: dict[str, object] = field(repr=False)
    recipient: str = field(repr=False)
    digest: str
