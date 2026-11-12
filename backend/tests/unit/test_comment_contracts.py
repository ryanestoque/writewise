"""Public comment requests cannot smuggle identity, grade writes or unusable text."""

from datetime import timedelta
from uuid import UUID

import pytest
from pydantic import ValidationError

ACTIVITY = UUID("33333333-3333-3333-3333-333333333333")
STUDENT = UUID("22222222-2222-2222-2222-222222222222")
COMMENT = UUID("44444444-4444-4444-4444-444444444444")
SUBMISSION = UUID("77777777-7777-4777-8777-777777777777")


@pytest.mark.parametrize(
    "value",
    [None, "", " \t\n", "\u2003\u00a0", "x" * 1001, "\x00", "a\x00b", "\ud800", 7, True, [], {}],
    ids=[
        "null",
        "empty",
        "blank",
        "unicode_blank",
        "too_long",
        "nul",
        "embedded_nul",
        "surrogate",
        "number",
        "boolean",
        "array",
        "object",
    ],
)
def test_post_rejects_unusable_or_non_text_body(value):
    from app.comments.contracts import CommentPostRequest

    with pytest.raises(ValidationError):
        CommentPostRequest(body=value)


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        ("\u2003 hello\nagain \u00a0", "hello\nagain"),
        ("x", "x"),
        ("x" * 1000, "x" * 1000),
        ("\U0001f642" * 1000, "\U0001f642" * 1000),
        (
            " <b>Hello</b> https://example.com **plain** ",
            "<b>Hello</b> https://example.com **plain**",
        ),
    ],
    ids=["unicode_edges", "one_character", "limit", "unicode_limit", "plain_text"],
)
def test_post_trims_edges_without_rewriting_plain_text_or_unicode(body, expected):
    from app.comments.contracts import CommentPostRequest

    assert CommentPostRequest(body=body).body == expected


@pytest.mark.parametrize("field", ["author_id", "author_role", "recipient_id", "created_at", "id"])
def test_post_rejects_caller_selected_identity_and_metadata(field):
    from app.comments.contracts import CommentPostRequest

    with pytest.raises(ValidationError):
        CommentPostRequest.model_validate({"body": "Synthetic text", field: "forged"})


@pytest.mark.parametrize("value", [None, "false", "true", "0", 0, 1, [], {}])
def test_lock_requires_a_real_boolean(value):
    from app.comments.contracts import CommentLockRequest

    with pytest.raises(ValidationError):
        CommentLockRequest(locked=value)


def test_lock_cannot_mix_grade_or_identity_changes():
    from app.comments.contracts import CommentLockRequest

    for field in ("points_override", "excused", "released_at", "actor_id"):
        with pytest.raises(ValidationError):
            CommentLockRequest.model_validate({"locked": True, field: "forged"})
    assert CommentLockRequest(locked=False).model_dump() == {"locked": False}


@pytest.mark.parametrize("value", [True, "1", 1.0, 0, -1, 2147483648])
def test_notification_read_rejects_non_exact_or_out_of_range_versions(value):
    from app.api.notification_contracts import NotificationReadRequest

    with pytest.raises(ValidationError):
        NotificationReadRequest(expected_comment_version=value)


def test_notification_read_keeps_ordinary_no_version_request_and_forbids_recipient():
    from app.api.notification_contracts import NotificationReadRequest

    assert NotificationReadRequest().expected_comment_version is None
    assert NotificationReadRequest(expected_comment_version=1).expected_comment_version == 1
    with pytest.raises(ValidationError):
        NotificationReadRequest.model_validate({"recipient_id": str(STUDENT)})


def test_posted_metadata_requires_aware_time_and_cannot_echo_the_body():
    from app.comments.contracts import CommentPosted

    payload = {
        "id": COMMENT,
        "submission_id": SUBMISSION,
        "activity_id": ACTIVITY,
        "student_id": STUDENT,
        "author_role": "parent",
        "created_at": "2030-01-01T10:00:00+08:00",
        "comment_version": 1,
        "body": "Synthetic private body must not be echoed",
    }
    response = CommentPosted.model_validate(payload)
    assert "body" not in response.model_dump()
    assert response.model_dump()["submission_id"] == SUBMISSION
    assert response.created_at.utcoffset() == timedelta(hours=8)
    with pytest.raises(ValidationError):
        CommentPosted.model_validate({**payload, "created_at": "2030-01-01T10:00:00"})


def test_invalid_text_error_repr_does_not_echo_private_input():
    from app.comments.contracts import CommentPostRequest

    sentinel = "SYNTHETIC_PRIVATE_SENTINEL"
    with pytest.raises(ValidationError) as failure:
        CommentPostRequest(body=sentinel * 100)
    assert sentinel not in str(failure.value)
