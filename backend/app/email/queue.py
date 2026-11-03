"""Bounded service-only PostgREST RPCs; never perform synchronous I/O in dispatch."""

import asyncio
from datetime import datetime
from typing import TypeVar
from uuid import UUID

import httpx
from pydantic import BaseModel

from app.email.contracts import (
    AuthorizationResult,
    DeliveryClaim,
    PreparationResult,
    RenderedEmail,
)

Model = TypeVar("Model", bound=BaseModel)


class EmailQueue:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    async def _rpc(self, name: str, payload: dict[str, object]) -> object:
        try:
            async with asyncio.timeout(2.0):
                response = await self.client.post(f"rpc/{name}", json=payload)
                response.raise_for_status()
                return response.json()
        except (httpx.HTTPError, TimeoutError, ValueError):
            raise RuntimeError("Email queue operation failed.") from None

    def _model(self, model: type[Model], value: object) -> Model:
        try:
            return model.model_validate(value)
        except ValueError:
            raise RuntimeError("Email queue returned an invalid result.") from None

    async def claim(self) -> DeliveryClaim | None:
        value = await self._rpc("claim_email_delivery", {})
        return None if value is None else self._model(DeliveryClaim, value)

    async def prepare(self, claim: DeliveryClaim) -> PreparationResult:
        value = await self._rpc(
            "prepare_email_delivery",
            {
                "target_outbox_id": str(claim.outbox_id),
                "expected_claim_token": str(claim.claim_token),
            },
        )
        return self._model(PreparationResult, value)

    async def authorize(self, claim: DeliveryClaim, mail: RenderedEmail) -> AuthorizationResult:
        value = await self._rpc(
            "authorize_email_delivery",
            {
                "target_outbox_id": str(claim.outbox_id),
                "expected_claim_token": str(claim.claim_token),
                "payload_recipient": mail.recipient,
                "payload_sha256": mail.digest,
            },
        )
        return self._model(AuthorizationResult, value)

    async def finish(
        self,
        outbox_id: UUID,
        token: UUID,
        outcome: str,
        provider_id: str | None = None,
        error_code: str | None = None,
        retry_at: datetime | None = None,
    ) -> bool:
        value = await self._rpc(
            "finish_email_delivery",
            {
                "target_outbox_id": str(outbox_id),
                "expected_claim_token": str(token),
                "delivery_outcome": outcome,
                "provider_id": provider_id,
                "error_code": error_code,
                "retry_at": retry_at.isoformat() if retry_at is not None else None,
            },
        )
        if not isinstance(value, bool):
            raise RuntimeError("Email queue returned an invalid outcome.")
        return value
