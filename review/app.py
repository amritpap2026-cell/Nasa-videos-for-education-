"""Stage 6: local approval dashboard for the rendered video."""
from __future__ import annotations

import html
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output"
VIDEO = OUTPUT / "video.mp4"
APPROVAL = OUTPUT / "APPROVED"
MANIFEST = OUTPUT / "visuals" / "manifest.json"


def page(message: str = "") -> bytes:
    approved = APPROVAL.exists()
    manifest = []
    if MANIFEST.exists():
        try:
            manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            manifest = []
    visuals = sum(len(item.get("assets", [])) for item in manifest)
    status = "Approved for YouTube" if approved else "Waiting for your approval"
    action = "Revoke approval" if approved else "Approve for YouTube"
    action_value = "revoke" if approved else "approve"
    video_block = (
        '<video controls playsinline class="player" src="/video"></video>'
        if VIDEO.exists() else '<div class="empty">No rendered video found in output/video.mp4.</div>'
    )
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cosmos Review</title><style>
:root{{color-scheme:light;--ink:#102d3a;--muted:#5e7480;--mint:#dff4ec;--line:#c8e1dc;--accent:#13795b}}
*{{box-sizing:border-box}}body{{margin:0;background:#f3faf8;color:var(--ink);font:16px system-ui,sans-serif}}main{{max-width:1100px;margin:0 auto;padding:32px 20px 60px}}header{{display:flex;justify-content:space-between;gap:20px;align-items:start;border-bottom:1px solid var(--line);padding-bottom:20px}}h1{{margin:0 0 8px;font-size:clamp(28px,5vw,48px)}}p{{color:var(--muted)}}.badge{{background:var(--mint);border-radius:999px;padding:9px 14px;color:var(--accent);font-weight:700;white-space:nowrap}}.card{{background:white;border:1px solid var(--line);border-radius:18px;padding:20px;margin-top:22px;box-shadow:0 10px 30px #164e3a0d}}.player{{display:block;width:100%;max-height:620px;background:#071a20;border-radius:12px}}.empty{{padding:80px 20px;text-align:center;background:#edf6f4;border-radius:12px;color:var(--muted)}}.stats{{display:flex;gap:24px;flex-wrap:wrap}}.stat strong{{display:block;font-size:26px}}button{{border:0;border-radius:10px;background:var(--accent);color:white;padding:12px 16px;font-weight:700;cursor:pointer}}button.secondary{{background:#e8f2f0;color:var(--ink)}}.danger{{background:#a13a3a}}.notice{{padding:12px 14px;border-radius:10px;background:#fff5d9}}a{{color:var(--accent)}}
</style></head><body><main><header><div><h1>Cosmos Review</h1><p>Watch the complete landscape video and approve it before anything is published.</p></div><span class="badge">{html.escape(status)}</span></header>
<section class="card">{video_block}<div class="stats"><div class="stat"><strong>{'Ready' if VIDEO.exists() else 'Missing'}</strong>Rendered video</div><div class="stat"><strong>{visuals}</strong>Downloaded visual assets</div><div class="stat"><strong>{'Yes' if approved else 'No'}</strong>YouTube approval</div></div></section>
<section class="card"><h2>Publishing gate</h2><p>Nothing is published automatically. Review the video above, then explicitly approve or revoke approval.</p><form method="post"><input type="hidden" name="action" value="{action_value}"><button class="{'danger' if approved else ''}" type="submit">{action}</button></form>{f'<p class="notice">Approval file: output/APPROVED</p>' if approved else ''}</section>
<section class="card"><h2>Workflow</h2><p>Research → Script → Narration → Images → Video → <strong>Review</strong> → YouTube upload.</p><p><a href="/health">View machine-readable review status</a></p></section></main></body></html>""".encode("utf-8")


class ReviewHandler(BaseHTTPRequestHandler):
    def _send(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/video" and VIDEO.exists():
            self._send(200, "video/mp4", VIDEO.read_bytes())
        elif parsed.path == "/health":
            self._send(200, "application/json", json.dumps({"video": VIDEO.exists(), "approved": APPROVAL.exists(), "visuals": MANIFEST.exists()}).encode())
        else:
            self._send(200, "text/html; charset=utf-8", page())

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        values = parse_qs(self.rfile.read(length).decode("utf-8"))
        if values.get("action", [""])[0] == "approve":
            OUTPUT.mkdir(parents=True, exist_ok=True); APPROVAL.write_text("Approved in local review dashboard.\n", encoding="utf-8")
        elif values.get("action", [""])[0] == "revoke":
            APPROVAL.unlink(missing_ok=True)
        self.send_response(303); self.send_header("Location", "/"); self.end_headers()


def run(port: int = 8765) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    print(f"Cosmos Review running at http://127.0.0.1:{port}")
    HTTPServer(("127.0.0.1", port), ReviewHandler).serve_forever()


if __name__ == "__main__":
    run()
