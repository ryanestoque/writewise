"""Delivery values that never print recipient addresses or rendered payloads."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

EmailType = Literal["submission_returned", "due_soon"]


@dataclass(frozen=True)
class RenderedEmail:
    body: dict[str, object] = field(repr=False)
    recipient: str = field(repr=False)
    digest: str


@dataclass(frozen=True)
class ProviderResult:
    disposition: Literal["sent", "retry", "failed"]
    code: str | None = None
    message_id: str | None = None
    retry_not_before: datetime | None = None
    stop_batch: bool = False
