"""Stage 7: approval-gated YouTube publishing with complete SEO metadata."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
DEFAULT_PRIVACY = "private"


def _credentials():
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError as error:
        raise RuntimeError(
            "Install google-api-python-client google-auth-oauthlib before uploading."
        ) from error

    token_path = Path(os.getenv("YOUTUBE_TOKEN_FILE", "output/youtube-token.json"))
    client_path = Path(os.getenv("YOUTUBE_CLIENT_SECRET_FILE", "client_secret.json"))
    credentials = Credentials.from_authorized_user_file(str(token_path), SCOPES) if token_path.exists() else None
    if credentials and credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())
    if not credentials or not credentials.valid:
        if not client_path.exists():
            raise RuntimeError(
                f"YouTube OAuth client file not found: {client_path}. "
                "Create OAuth desktop credentials in Google Cloud and set YOUTUBE_CLIENT_SECRET_FILE."
            )
        flow = InstalledAppFlow.from_client_secrets_file(str(client_path), SCOPES)
        credentials = flow.run_local_server(port=0)
        token_path.parent.mkdir(parents=True, exist_ok=True)
        token_path.write_text(credentials.to_json(), encoding="utf-8")
    return credentials


def upload(
    video: str,
    title: str,
    description: str,
    tags: list[str],
    privacy: str = DEFAULT_PRIVACY,
    category_id: str = "27",
    thumbnail: str | None = None,
) -> dict[str, Any]:
    """Upload an approved MP4 with SEO metadata and return YouTube details.

    The upload cannot begin until review/app.py creates output/APPROVED.
    """
    approval = Path(os.getenv("APPROVAL_MARKER", "output/APPROVED"))
    if not approval.exists():
        raise RuntimeError("Review approval is required before upload. Approve the video in review/app.py first.")
    video_path = Path(video)
    if not video_path.exists():
        raise FileNotFoundError(f"Video not found: {video_path}")
    if privacy not in {"private", "unlisted", "public"}:
        raise ValueError("privacy must be private, unlisted, or public")
    if not title.strip():
        raise ValueError("A YouTube title is required.")

    try:
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
    except ImportError as error:
        raise RuntimeError("Install google-api-python-client google-auth-oauthlib before uploading.") from error

    youtube = build("youtube", "v3", credentials=_credentials())
    body = {
        "snippet": {
            "title": title.strip()[:100],
            "description": description.strip()[:5000],
            "tags": list(dict.fromkeys(tag.strip() for tag in tags if tag.strip()))[:500],
            "categoryId": category_id,
            "defaultLanguage": os.getenv("YOUTUBE_LANGUAGE", "en"),
        },
        "status": {"privacyStatus": privacy, "selfDeclaredMadeForKids": False},
    }
    request = youtube.videos().insert(
        part=",".join(body.keys()),
        body=body,
        media_body=MediaFileUpload(str(video_path), mimetype="video/mp4", resumable=True),
    )
    response = None
    while response is None:
        _, response = request.next_chunk()
    video_id = response["id"]
    if thumbnail and Path(thumbnail).exists():
        youtube.thumbnails().set(videoId=video_id, media_body=MediaFileUpload(thumbnail, mimetype="image/jpeg")).execute()
    result = {"id": video_id, "url": f"https://www.youtube.com/watch?v={video_id}", "privacy": privacy, "metadata": body}
    Path("output").mkdir(exist_ok=True)
    Path("output/youtube-upload.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload an approved Cosmos video to YouTube")
    parser.add_argument("video")
    parser.add_argument("--title", required=True)
    parser.add_argument("--description", default="")
    parser.add_argument("--tags", nargs="*", default=[])
    parser.add_argument("--privacy", choices=["private", "unlisted", "public"], default=DEFAULT_PRIVACY)
    parser.add_argument("--category-id", default="27")
    parser.add_argument("--thumbnail")
    args = parser.parse_args()
    print(json.dumps(upload(args.video, args.title, args.description, args.tags, args.privacy, args.category_id, args.thumbnail), indent=2))


if __name__ == "__main__":
    main()


def publish(*args, **kwargs):
    """Backward-compatible alias for pipeline callers."""
    return upload(*args, **kwargs)


def build_metadata(package: dict[str, Any]) -> dict[str, Any]:
    """Map a generated package into upload-ready SEO fields."""
    return {
        "title": package.get("title", "Cosmos Education"),
        "description": package.get("description", ""),
        "tags": package.get("tags", []) if isinstance(package.get("tags", []), list) else str(package.get("tags", "")).split(","),
    }
