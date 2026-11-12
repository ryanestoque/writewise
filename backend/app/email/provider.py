"""One asynchronous Resend request; all retained outcomes are privacy-safe codes."""

import asyncio
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from uuid import UUID

import httpx

from app.email.contracts import ProviderResult, RenderedEmail


def _retry_hint(value: str | None) -> datetime | None:
    if not value:
        return None
    value = value.strip()
    if value.isascii() and value.isdecimal():
        try:
            return datetime.now(timezone.utc) + timedelta(seconds=int(value))
        except (ValueError, OverflowError):
            return datetime.max.replace(tzinfo=timezone.utc)
    try:
        parsed = parsedate_to_datetime(value)
        return parsed.astimezone(timezone.utc) if parsed.tzinfo is not None else None
    except (ValueError, TypeError, OverflowError):
        return None


class ResendSender:
    def __init__(self, client: httpx.AsyncClient, api_key: str):
        self.client = client
        self.api_key = api_key

    async def send(self, mail: RenderedEmail, outbox_id: UUID) -> ProviderResult:
        try:
            async with asyncio.timeout(5.0):
                response = await self.client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Idempotency-Key": f"writewise-email/{outbox_id}",
                    },
                    json=mail.body,
                    timeout=httpx.Timeout(5.0, connect=2.0),
                    follow_redirects=False,
                )
        except (TimeoutError, httpx.TimeoutException):
            return ProviderResult("retry", code="provider_timeout")
        except httpx.HTTPError:
            return ProviderResult("retry", code="provider_unavailable")

        if response.status_code == 429:
            return ProviderResult(
                "retry",
                code="provider_throttled",
                retry_not_before=_retry_hint(response.headers.get("Retry-After")),
                stop_batch=True,
            )
        if response.status_code in {401, 403}:
            return ProviderResult("failed", code="provider_configuration", stop_batch=True)
        if len(response.content) > 16384:
            return ProviderResult("retry", code="provider_unavailable")
        try:
            data = response.json()
        except ValueError:
            data = {}
        if not isinstance(data, dict):
            data = {}
        if 200 <= response.status_code < 300:
            try:
                identifier = data.get("id")
                if not isinstance(identifier, str):
                    raise ValueError
                identifier = str(UUID(identifier))
            except ValueError:
                return ProviderResult("retry", code="provider_unavailable")
            return ProviderResult("sent", message_id=identifier)
        if response.status_code >= 500:
            return ProviderResult("retry", code="provider_unavailable")
        if response.status_code == 409:
            if data.get("name") == "concurrent_idempotent_requests":
                return ProviderResult("retry", code="provider_unavailable")
            if data.get("name") == "invalid_idempotent_request":
                return ProviderResult("failed", code="idempotency_conflict")
        return ProviderResult("failed", code="provider_rejected")
