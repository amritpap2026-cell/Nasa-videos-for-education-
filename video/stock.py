"""Stage 4: collect real NASA/Pexels images and videos per script section."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen


def _get_json(url: str, headers: dict[str, str] | None = None) -> dict:
    request = Request(url, headers=headers or {"User-Agent": "Cosmos-Education/1.0"})
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def _download(url: str, path: Path) -> Path:
    request = Request(url, headers={"User-Agent": "Cosmos-Education/1.0"})
    with urlopen(request, timeout=60) as response:
        path.write_bytes(response.read())
    return path


def _safe_name(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-").lower()[:90] or "visual"


def search_nasa(query: str, media_type: str = "image", limit: int = 5) -> list[dict]:
    data = _get_json(f"https://images-api.nasa.gov/search?q={quote(query)}&media_type={media_type}")
    results = []
    for item in data.get("collection", {}).get("items", [])[:limit]:
        metadata = item.get("data", [{}])[0]
        nasa_id = metadata.get("nasa_id")
        files = []
        try:
            asset = _get_json(f"https://images-api.nasa.gov/asset/{quote(str(nasa_id))}")
            files = [entry.get("href") for entry in asset.get("collection", {}).get("items", []) if entry.get("href")]
        except Exception:
            pass
        media_file = next((file for file in files if media_type == "video" and file.lower().endswith((".mp4", ".mov", ".webm"))), None) if media_type == "video" else next((file for file in files if file.lower().endswith((".jpg", ".jpeg", ".png"))), None)
        results.append({"source": "NASA", "type": media_type, "id": nasa_id, "title": metadata.get("title", query), "thumbnail": (item.get("links") or [{}])[0].get("href"), "url": media_file, "files": files, "page_url": f"https://images.nasa.gov/details-{nasa_id}"})
    return results


def search_pexels(query: str, limit: int = 5) -> list[dict]:
    key = os.environ.get("PEXELS_API_KEY")
    if not key:
        return []
    headers = {"Authorization": key, "User-Agent": "Cosmos-Education/1.0"}
    photos = _get_json(f"https://api.pexels.com/v1/search?query={quote(query)}&per_page={limit}", headers).get("photos", [])
    videos = _get_json(f"https://api.pexels.com/videos/search?query={quote(query)}&per_page={limit}", headers).get("videos", [])
    results = []
    for item in photos:
        results.append({"source": "Pexels", "type": "image", "id": item.get("id"), "title": query, "url": item.get("src", {}).get("large2x"), "page_url": item.get("url")})
    for item in videos:
        files = sorted(item.get("video_files", []), key=lambda file: file.get("width", 0), reverse=True)
        results.append({"source": "Pexels", "type": "video", "id": item.get("id"), "title": query, "url": files[0].get("link") if files else None, "page_url": item.get("url")})
    return [result for result in results if result.get("url")]


def collect_section_visuals(sections: list[dict], output_dir: str = "output/visuals", per_query: int = 2) -> list[dict]:
    """Search NASA first, then Pexels, and download mixed media for every section."""
    root = Path(output_dir); root.mkdir(parents=True, exist_ok=True)
    manifest = []
    for index, section in enumerate(sections, 1):
        queries = list(dict.fromkeys(section.get("image_queries", []) + section.get("video_queries", [])))
        for query in queries:
            nasa = search_nasa(query, "video", per_query) + search_nasa(query, "image", per_query)
            candidates = nasa or search_pexels(query, per_query)
            downloaded = []
            for candidate in candidates:
                url = candidate.get("url") or candidate.get("thumbnail")
                if not url: continue
                suffix = ".mp4" if candidate.get("type") == "video" else ".jpg"
                path = root / f"section-{index}-{_safe_name(query)}-{candidate.get('id', len(downloaded))}{suffix}"
                try:
                    _download(url, path); downloaded.append({**candidate, "path": str(path)})
                except Exception: continue
            manifest.append({"section": index, "query": query, "source": candidates[0].get("source") if candidates else "none", "assets": downloaded})
    (root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def download_visuals(queries: list[str], output_dir: str = "output/visuals", per_query: int = 2) -> list[Path]:
    sections = [{"image_queries": [query], "video_queries": [query]} for query in queries]
    return [Path(asset["path"]) for item in collect_section_visuals(sections, output_dir, per_query) for asset in item["assets"]]
