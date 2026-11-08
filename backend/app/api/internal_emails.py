"""Secret-authenticated, bounded internal classroom email dispatch."""

from collections.abc import AsyncIterator
from hmac import compare_digest

import httpx
from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader

from app.core.config import settings
from app.email.contracts import DispatchCounts
from app.email.dispatcher import dispatch_emails
from app.email.provider import ResendSender
from app.email.queue import EmailQueue

router = APIRouter()
dispatch_header = APIKeyHeader(
    name="X-Dispatch-Secret", scheme_name="EmailDispatchSecret", auto_error=False
)


def require_dispatch_secret(provided: str | None = Security(dispatch_header)) -> None:
    expected = settings.EMAIL_DISPATCH_SECRET.get_secret_value()
    if not expected or not provided or not compare_digest(provided.encode(), expected.encode()):
        raise HTTPException(
            401,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Email dispatch authentication required.",
                "details": {},
            },
        )
    if not settings.EMAIL_DISPATCH_ENABLED:
        raise HTTPException(
            503,
            detail={
                "code": "EMAIL_DISPATCH_UNAVAILABLE",
                "message": "Email dispatch is disabled.",
                "details": {},
            },
        )


async def get_email_delivery_resources(
    _: None = Depends(require_dispatch_secret),
) -> AsyncIterator[tuple[EmailQueue, ResendSender]]:
    async with (
        httpx.AsyncClient(
            base_url=settings.SUPABASE_URL.rstrip("/") + "/rest/v1/",
            headers={
                "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": "Bearer " + settings.SUPABASE_SERVICE_ROLE_KEY,
            },
            timeout=2.0,
            follow_redirects=False,
            transport=httpx.AsyncHTTPTransport(retries=0),
        ) as rpc,
        httpx.AsyncClient(
            timeout=httpx.Timeout(5.0, connect=2.0),
            follow_redirects=False,
            transport=httpx.AsyncHTTPTransport(retries=0),
        ) as provider,
    ):
        yield EmailQueue(rpc), ResendSender(provider, settings.RESEND_API_KEY.get_secret_value())


@router.post("/dispatch-emails", response_model=DispatchCounts)
async def dispatch_email_route(
    _: None = Depends(require_dispatch_secret),
    resources: tuple[EmailQueue, ResendSender] = Depends(get_email_delivery_resources),
):
    queue, sender = resources
    try:
        return await dispatch_emails(
            queue, sender, sender_address=settings.EMAIL_FROM, app_origin=settings.APP_BASE_URL
        )
    except Exception:
        # Do not pass provider/validation payloads to the generic exception logger.
        raise HTTPException(
            500,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Email dispatch could not complete.",
                "details": {},
            },
        ) from None
