"""Stage 6: local review dashboard."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

class ReviewHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        video = Path("output/video.mp4")
        html = "<h1>Cosmos Review</h1><p>Review before publishing.</p>"
        if video.exists(): html += '<video controls width="900" src="/video"></video><form method="POST"><button>Approve for YouTube</button></form>'
        else: html += "<p>No rendered video found.</p>"
        self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8"); self.end_headers(); self.wfile.write(html.encode())
    def do_POST(self):
        Path("output/APPROVED").touch(); self.send_response(303); self.send_header("Location", "/"); self.end_headers()

def run(port: int = 8765):
    HTTPServer(("127.0.0.1", port), ReviewHandler).serve_forever()

if __name__ == "__main__": run()
