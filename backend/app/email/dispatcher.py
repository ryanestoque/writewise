"""A bounded sequence of committed SQL operations around each external send."""

import asyncio
from time import monotonic

from app.email.contracts import DispatchCounts
from app.email.provider import ResendSender
from app.email.queue import EmailQueue
from app.email.retry import retry_at
from app.email.templates import render_email


async def dispatch_emails(
    queue: EmailQueue, sender: ResendSender, *, sender_address: str, app_origin: str
) -> DispatchCounts:
    counts = DispatchCounts()
    deadline = monotonic() + 20.0
    try:
        async with asyncio.timeout(20.0):
            while counts.claimed < 10 and deadline - monotonic() >= 6.5:
                claim = await queue.claim()
                if claim is None:
                    break
                counts.claimed += 1
                prepared = await queue.prepare(claim)
                if prepared.state == "lost":
                    break
                if prepared.state == "skipped":
                    counts.skipped += 1
                    continue
                mail = render_email(
                    prepared.event_type,
                    prepared.recipient.get_secret_value(),
                    sender_address,
                    app_origin,
                )
                if deadline - monotonic() < 9.5:
                    if not await queue.finish(claim.outbox_id, claim.claim_token, "released"):
                        raise RuntimeError("Email claim could not be released.")
                    break
                authorized = await queue.authorize(claim, mail)
                if authorized.state == "lost":
                    break
                if authorized.state == "skipped":
                    counts.skipped += 1
                    continue
                result = await sender.send(mail, claim.outbox_id)
                next_at = None
                outcome = result.disposition
                if outcome == "retry":
                    next_at = retry_at(
                        authorized.attempts,
                        authorized.authorized_at,
                        authorized.first_attempt_at,
                        result.retry_not_before,
                    )
                    if next_at is None:
                        outcome = "failed"
                if not await queue.finish(
                    claim.outbox_id,
                    authorized.claim_token,
                    outcome,
                    provider_id=result.message_id,
                    error_code=result.code,
                    retry_at=next_at,
                ):
                    raise RuntimeError("Email delivery outcome was not acknowledged.")
                if outcome == "sent":
                    counts.sent += 1
                elif outcome == "retry":
                    counts.retried += 1
                else:
                    counts.failed += 1
                if result.stop_batch:
                    break
    except TimeoutError:
        # A reservation or acceptance may have committed. Its lease is the recovery evidence.
        raise RuntimeError("Email dispatch exceeded its time budget.") from None
    return counts
