"""Version-one fixed classroom messages and canonical request fingerprints."""

import hashlib
import json
from email.utils import parseaddr
from html import escape
from urllib.parse import urlsplit, urlunsplit

from app.email.contracts import EmailType, RenderedEmail

_COPY = {
    "due_soon": (
        "WriteWise: an activity is due soon",
        "Your child has a handwriting activity due within 24 hours.",
        "Sign in to WriteWise to check the deadline.",
    ),
    "submission_returned": (
        "WriteWise: another attempt requested",
        "Your child's handwriting activity needs another attempt.",
        "Sign in to WriteWise to view the teacher's feedback.",
    ),
}


def normalize_origin(value: str) -> str:
    """Accept a plain HTTPS origin or a literal HTTP loopback development origin."""
    diagnostic = "Invalid email application origin."
    if not value or any(character.isspace() or ord(character) < 32 for character in value):
        raise ValueError(diagnostic)
    try:
        parts = urlsplit(value)
        _ = parts.port
        if (
            not parts.hostname
            or parts.username is not None
            or parts.password is not None
            or parts.query
            or parts.fragment
            or parts.path not in {"", "/"}
            or parts.scheme not in {"http", "https"}
            or (parts.scheme == "http" and parts.hostname not in {"localhost", "127.0.0.1", "::1"})
        ):
            raise ValueError(diagnostic)
    except ValueError:
        raise ValueError(diagnostic) from None
    return urlunsplit((parts.scheme, parts.netloc, "", "", ""))


def validate_sender(value: str) -> str:
    """Validate a single configured mailbox without echoing its value on failure."""
    diagnostic = "Invalid email sender."
    if not value or any(ord(character) < 32 or ord(character) == 127 for character in value):
        raise ValueError(diagnostic)
    try:
        _, address = parseaddr(value, strict=True)
    except ValueError:
        raise ValueError(diagnostic) from None
    if not address or address.count("@") != 1 or not all(address.split("@")):
        raise ValueError(diagnostic)
    return value.strip()


def payload_digest(body: dict[str, object]) -> str:
    encoded = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode(
        "utf-8"
    )
    return hashlib.sha256(encoded).hexdigest()


def render_email(
    event_type: EmailType, recipient: str, sender: str, app_origin: str
) -> RenderedEmail:
    if event_type not in _COPY:
        raise ValueError("Unsupported email event.")
    origin = normalize_origin(app_origin)
    sender = validate_sender(sender)
    subject, sentence, instruction = _COPY[event_type]
    login, settings = f"{origin}/login", f"{origin}/parent-settings"
    footer = "You can change classroom email updates in Account Settings."
    body = {
        "from": sender,
        "to": [recipient],
        "subject": subject,
        "text": f"{sentence} {instruction}\n\nOpen WriteWise: {login}\n\n{footer}\n{settings}",
        "html": (
            f"<p>{sentence} {instruction}</p>"
            f'<p><a href="{escape(login, quote=True)}">Open WriteWise</a></p>'
            f"<p>{footer} "
            f'<a href="{escape(settings, quote=True)}">Account Settings</a></p>'
        ),
    }
    return RenderedEmail(body=body, recipient=recipient, digest=payload_digest(body))
