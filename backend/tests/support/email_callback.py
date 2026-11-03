"""Synthetic pg_net callback, isolated inside the disposable DB network namespace."""

import json
from http.server import BaseHTTPRequestHandler, HTTPServer

SECRET = "synthetic-email-dispatch-secret-00000001"
state = {"calls": 0, "authenticated": False, "path_ok": False, "body_ok": False}


class Callback(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def reply(self, status, data):
        encoded = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        self.reply(200 if self.path == "/state" else 404, state)

    def do_POST(self):
        size = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(min(size, 1024))
        state.update(
            calls=state["calls"] + 1,
            authenticated=self.headers.get("X-Dispatch-Secret") == SECRET,
            path_ok=self.path == "/api/internal/dispatch-emails",
            body_ok=body == b"{}",
        )
        valid = all(state[key] for key in ("authenticated", "path_ok", "body_ok"))
        self.reply(
            200 if valid else 400,
            dict.fromkeys(("claimed", "sent", "retry", "failed", "skipped"), 0),
        )


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 8765), Callback).serve_forever()
