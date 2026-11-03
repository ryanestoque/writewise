"""Literal retry times and strict reservation/hour limits."""

from datetime import datetime, timedelta, timezone

import pytest

FIRST = datetime(2030, 1, 1, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    "attempts,authorized_minutes,hint_minutes,expected_minutes",
    [
        (1, 0, None, 5),
        (2, 8, None, 23),
        (1, 0, 1, 5),
        (1, 0, 20, 20),
        (3, 20, None, None),
        (1, 0, 60, None),
        (2, 45, None, None),
        (1, 60, None, None),
    ],
)
def test_retry_schedule_is_bounded(attempts, authorized_minutes, hint_minutes, expected_minutes):
    from app.email.retry import retry_at

    hint = FIRST + timedelta(minutes=hint_minutes) if hint_minutes is not None else None
    actual = retry_at(attempts, FIRST + timedelta(minutes=authorized_minutes), FIRST, hint)
    expected = FIRST + timedelta(minutes=expected_minutes) if expected_minutes is not None else None
    assert actual == expected


def test_naive_retry_clock_is_rejected():
    from app.email.retry import retry_at

    with pytest.raises(ValueError):
        retry_at(1, FIRST.replace(tzinfo=None), FIRST, None)
