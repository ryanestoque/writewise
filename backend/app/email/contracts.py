"""Delivery values that never print recipient addresses or rendered payloads."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, SecretStr, model_validator

EmailType = Literal["submission_returned", "due_soon"]
SkipCode = Literal[
    "preference_off",
    "recipient_unavailable",
    "relationship_revoked",
    "activity_archived",
    "event_obsolete",
    "deadline_changed",
    "payload_changed",
]


class _DeliveryModel(BaseModel):
    model_config = ConfigDict(extra="forbid", hide_input_in_errors=True)


class DeliveryClaim(_DeliveryModel):
    outbox_id: UUID
    notification_id: UUID
    event_type: EmailType
    claim_token: UUID
    lease_expires_at: AwareDatetime
    attempts: int = Field(ge=0, le=3)


class PreparationResult(_DeliveryModel):
    state: Literal["ready", "skipped", "lost"]
    recipient: SecretStr | None = None
    event_type: EmailType | None = None
    code: SkipCode | None = None

    @model_validator(mode="after")
    def consistent_state(self):
        if self.state == "ready":
            if not self.recipient or not self.recipient.get_secret_value().strip():
                raise ValueError("Ready delivery requires a recipient.")
            if self.event_type is None or self.code is not None:
                raise ValueError("Invalid ready delivery state.")
        elif self.recipient is not None or self.event_type is not None:
            raise ValueError("Inactive delivery cannot carry recipient context.")
        elif (self.state == "skipped") != (self.code is not None):
            raise ValueError("Invalid inactive delivery state.")
        return self


class AuthorizationResult(_DeliveryModel):
    state: Literal["authorized", "skipped", "lost"]
    claim_token: UUID | None = None
    attempts: int | None = Field(default=None, ge=1, le=3)
    first_attempt_at: AwareDatetime | None = None
    authorized_at: AwareDatetime | None = None
    code: SkipCode | None = None

    @model_validator(mode="after")
    def consistent_state(self):
        authorization = [self.claim_token, self.attempts, self.first_attempt_at, self.authorized_at]
        if self.state == "authorized":
            if any(value is None for value in authorization) or self.code is not None:
                raise ValueError("Incomplete email send authorization.")
            if self.first_attempt_at > self.authorized_at:
                raise ValueError("Invalid email authorization clock.")
        elif any(value is not None for value in authorization):
            raise ValueError("Inactive delivery cannot carry a send authorization.")
        elif (self.state == "skipped") != (self.code is not None):
            raise ValueError("Invalid inactive authorization state.")
        return self


class DispatchCounts(_DeliveryModel):
    claimed: int = Field(default=0, ge=0)
    sent: int = Field(default=0, ge=0)
    retried: int = Field(default=0, ge=0)
    failed: int = Field(default=0, ge=0)
    skipped: int = Field(default=0, ge=0)


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
