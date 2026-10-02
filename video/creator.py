"""Stage 5: render a cinematic 16:9 educational video with FFmpeg.

The renderer uses real downloaded assets, gentle Ken Burns movement, crossfades,
optional per-section captions, optional background music, and narration audio.
"""
from __future__ import annotations

import shlex
import subprocess
from pathlib import Path


def _escape_drawtext(value: str) -> str:
    return value.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace("%", "%%")


def _run(command: list[str]) -> None:
    try:
        subprocess.run(command, check=True)
    except FileNotFoundError as error:
        raise RuntimeError("FFmpeg is required for video rendering.") from error


def create_video(
    images: list[str],
    audio: str,
    output: str = "output/video.mp4",
    captions: str | None = None,
    music: str | None = None,
    image_duration: float = 5.0,
    width: int = 1920,
    height: int = 1080,
) -> Path:
    """Render a slideshow with motion, crossfades, captions, music, and narration."""
    if not images:
        raise ValueError("At least one image or video asset is required.")
    if not Path(audio).exists():
        raise FileNotFoundError(f"Narration audio not found: {audio}")
    destination = Path(output); destination.parent.mkdir(parents=True, exist_ok=True)
    valid_assets = [Path(item) for item in images if Path(item).exists()]
    if not valid_assets:
        raise FileNotFoundError("None of the visual assets exist.")

    inputs: list[str] = []
    filter_parts: list[str] = []
    for index, asset in enumerate(valid_assets):
        inputs.extend(["-loop", "1", "-t", str(image_duration), "-i", str(asset)])
        zoom = "zoompan=z='min(zoom+0.0008,1.12)':d=1:s=1920x1080:fps=30" if index % 2 == 0 else "zoompan=z='if(lte(zoom,1.0),1.12,max(zoom-0.0008,1.0))':d=1:s=1920x1080:fps=30"
        filter_parts.append(f"[{index}:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},{zoom},format=yuv420p[v{index}]")
    current = "[v0]"
    offset = max(0.2, image_duration - 0.6)
    for index in range(1, len(valid_assets)):
        output_label = f"[xf{index}]"
        filter_parts.append(f"{current}[v{index}]xfade=transition=fade:duration=0.6:offset={offset * index:.2f}{output_label}")
        current = output_label
    if captions:
        text = _escape_drawtext(captions)
        filter_parts.append(f"{current}drawtext=text='{text}':fontcolor=white:fontsize=42:box=1:boxcolor=black@0.55:boxborderw=18:x=(w-text_w)/2:y=h-140[vout]")
        video_map = "[vout]"
    else:
        video_map = current
    command = ["ffmpeg", "-y", *inputs, "-i", audio]
    has_music = bool(music and Path(music).exists())
    if has_music: command.extend(["-stream_loop", "-1", "-i", str(music)])
    filter_graph = ";".join(filter_parts)
    if has_music:
        filter_graph += f";[{len(valid_assets)}:a]volume=1[narration];[{len(valid_assets)+1}:a]volume=0.12[music];[narration][music]amix=inputs=2:duration=first[aout]"
        audio_map = "[aout]"
    else:
        audio_map = f"{len(valid_assets)}:a"
    command.extend(["-filter_complex", filter_graph, "-map", video_map, "-map", audio_map, "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", str(destination)])
    _run(command)
    return destination
