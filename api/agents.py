"""Vercel entrypoint that makes the existing Python research -> scriptwriter pipeline callable by the Next.js app."""
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler
from pipeline import prepare


class handler(BaseHTTPRequestHandler):
    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("content-length", "0"))
            raw = self.rfile.read(length)
            body = json.loads(raw.decode("utf-8") or "{}")
            topic = str(body.get("topic", "")).strip()
            if len(topic) < 3:
                self._send(400, {"error": "Topic must contain at least 3 characters."})
                return

            language = str(body.get("language", "English"))
            audience = str(body.get("audience", "General public"))
            minutes = max(1, min(120, int(body.get("minutes", 10))))

            # This is the actual Python path:
            # researcher.py -> scriptwriter.py
            result = prepare(topic, language, minutes, audience)
            self._send(200, {
                "ok": True,
                "pipeline": "researcher.py -> scriptwriter.py",
                "topic": topic,
                "language": language,
                "audience": audience,
                "minutes": minutes,
                "research": result["research"],
                "script": result["script"],
            })
        except Exception as exc:
            self._send(500, {
                "ok": False,
                "error": "Python research/scriptwriter pipeline failed.",
                "detail": str(exc),
            })

    def do_GET(self) -> None:
        self._send(200, {
            "ok": True,
            "service": "python-agent-pipeline",
            "pipeline": "researcher.py -> scriptwriter.py",
        })
