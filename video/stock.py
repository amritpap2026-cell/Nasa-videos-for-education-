"""Stage 4: download topic-aware visuals from Pexels."""
import os
from pathlib import Path
from urllib.request import Request, urlopen
import json

def download_visuals(queries: list[str], output_dir: str = "output/visuals", per_query: int = 2) -> list[Path]:
    key = os.environ.get("PEXELS_API_KEY")
    if not key:
        raise RuntimeError("PEXELS_API_KEY is required for stock visuals.")
    directory = Path(output_dir); directory.mkdir(parents=True, exist_ok=True)
    paths = []
    for query in queries:
        request = Request(f"https://api.pexels.com/v1/search?query={query}&per_page={per_query}", headers={"Authorization": key})
        with urlopen(request, timeout=30) as response:
            data = json.load(response)
        for item in data.get("photos", []):
            path = directory / f"{item['id']}.jpg"
            with urlopen(item["src"]["large2x"], timeout=30) as image:
                path.write_bytes(image.read())
            paths.append(path)
    return paths
