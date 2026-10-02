"""Stage 5: render an approved slideshow video with FFmpeg."""
import subprocess
from pathlib import Path

def create_video(images: list[str], audio: str, output: str = "output/video.mp4", captions: str | None = None) -> Path:
    if not images:
        raise ValueError("At least one image is required.")
    destination = Path(output); destination.parent.mkdir(parents=True, exist_ok=True)
    concat = destination.with_suffix(".txt")
    duration = 5
    concat.write_text("\n".join(f"file '{Path(image).resolve()}'\nduration {duration}" for image in images) + f"\nfile '{Path(images[-1]).resolve()}'", encoding="utf-8")
    command = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-i", audio, "-vf", "scale=1920:1080,format=yuv420p", "-c:v", "libx264", "-c:a", "aac", "-shortest", str(destination)]
    subprocess.run(command, check=True)
    concat.unlink(missing_ok=True)
    return destination
