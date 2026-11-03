"""Compute retry times without sleeping or changing a delivery's identity."""

from datetime import datetime, timedelta


def retry_at(
    attempts: int,
    authorized_at: datetime,
    first_attempt_at: datetime,
    provider_retry_at: datetime | None,
) -> datetime | None:
    times = [authorized_at, first_attempt_at]
    if provider_retry_at is not None:
        times.append(provider_retry_at)
    if any(value.tzinfo is None or value.utcoffset() is None for value in times):
        raise ValueError("Email retry clocks must be timezone-aware.")
    if attempts not in {1, 2, 3}:
        raise ValueError("Invalid email reservation count.")
    if attempts == 3:
        return None
    candidate = authorized_at + timedelta(minutes=5 if attempts == 1 else 15)
    if provider_retry_at is not None:
        candidate = max(candidate, provider_retry_at)
    return candidate if candidate < first_attempt_at + timedelta(hours=1) else None
