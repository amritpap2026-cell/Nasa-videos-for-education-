"""Stage 3: generate a cinematic MP3 with Edge-TTS."""
import asyncio
from pathlib import Path

VOICE_MAP = {"English": "en-US-AriaNeural", "Hindi": "hi-IN-SwaraNeural", "Nepali": "ne-NP-HemkalaNeural"}

async def _save(text: str, output: Path, language: str) -> Path:
    try:
        import edge_tts
    except ImportError as error:
        raise RuntimeError("Install edge-tts to generate MP3 audio.") from error
    communicate = edge_tts.Communicate(text, VOICE_MAP.get(language, VOICE_MAP["English"]), rate="-5%", pitch="+0Hz")
    await communicate.save(str(output))
    return output

def create_voiceover(text: str, output: str = "output/voiceover.mp3", language: str = "English") -> Path:
    path = Path(output)
    path.parent.mkdir(parents=True, exist_ok=True)
    return asyncio.run(_save(text, path, language))

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("script")
    parser.add_argument("--output", default="output/voiceover.mp3")
    parser.add_argument("--language", default="English")
    args = parser.parse_args()
    create_voiceover(Path(args.script).read_text(encoding="utf-8"), args.output, args.language)
