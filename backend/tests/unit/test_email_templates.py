"""Email payload minimization and deterministic retry fingerprints."""

import pytest


@pytest.mark.parametrize(
    "kind,subject,sentence",
    [
        (
            "due_soon",
            "WriteWise: an activity is due soon",
            "Your child has a handwriting activity due within 24 hours.",
        ),
        (
            "submission_returned",
            "WriteWise: another attempt requested",
            "Your child's handwriting activity needs another attempt.",
        ),
    ],
)
def test_payload_has_generic_copy_and_plain_portal_links(kind, subject, sentence):
    from app.email.templates import render_email

    mail = render_email(
        kind, "parent@example.com", "WriteWise <classroom@example.com>", "https://portal.example"
    )
    assert mail.body["subject"] == subject
    assert sentence in mail.body["text"]
    assert sentence in mail.body["html"]
    assert "https://portal.example/login" in mail.body["text"]
    assert "https://portal.example/parent-settings" in mail.body["html"]
    assert mail.body["to"] == ["parent@example.com"]
    assert set(mail.body) == {"from", "to", "subject", "html", "text"}
    assert "<img" not in mail.body["html"]
    assert "?" not in mail.body["html"]
    assert "parent@example.com" not in repr(mail)
    assert "classroom@example.com" not in repr(mail)


def test_payload_fingerprint_has_literal_canonical_encoding():
    from app.email.templates import payload_digest

    assert payload_digest({"b": 2, "a": 1}) == (
        "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777"
    )
    assert payload_digest({"a": 1, "b": 2}) == payload_digest({"b": 2, "a": 1})
    assert payload_digest({"a": 1, "b": 3}) != payload_digest({"a": 1, "b": 2})


def test_unsupported_event_cannot_become_an_email():
    from app.email.templates import render_email

    with pytest.raises(ValueError, match="Unsupported email event"):
        render_email(
            "score_released", "parent@example.com", "sender@example.com", "https://app.example"
        )


@pytest.mark.parametrize(
    "origin",
    [
        "http://remote.example",
        "https://app.example/redirect",
        "https://user:pass@app.example",
        "https://app.example?token=private",
        "https://app.example#secret",
        "https://app.example\r\nX: y",
    ],
)
def test_renderer_rejects_unsafe_origins(origin):
    from app.email.templates import render_email

    with pytest.raises(ValueError):
        render_email("due_soon", "parent@example.com", "sender@example.com", origin)


def test_renderer_rejects_sender_header_injection():
    from app.email.templates import render_email

    with pytest.raises(ValueError):
        render_email(
            "due_soon",
            "parent@example.com",
            "sender@example.com\r\nBcc: other@example.com",
            "https://app.example",
        )
