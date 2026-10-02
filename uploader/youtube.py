"""Stage 7: publish only after explicit review approval."""
from pathlib import Path

def upload(video: str, title: str, description: str, tags: list[str], privacy: str = "private") -> str:
    if not Path("output/APPROVED").exists():
        raise RuntimeError("Review approval is required before upload.")
    try:
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
    except ImportError as error:
        raise RuntimeError("Install Google API client and configure YouTube OAuth before uploading.") from error
    raise NotImplementedError("Add OAuth credentials, then implement the resumable YouTube upload.")

if __name__ == "__main__":
    print("Upload is intentionally approval-gated. Use upload() after review.")
