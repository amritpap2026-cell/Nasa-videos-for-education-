"""Stage 3: generate a cinematic MP3 with Edge-TTS."""
import asyncio
import re
from pathlib import Path


def clean_voice_text(text: str) -> str:
    """Remove production directions and punctuation that must not be spoken."""
    text = re.sub(r"\([^)]*\)|\[[^\]]*\]|\{[^}]*\}", " ", text)
    text = re.sub(r"\b(?:pause|पॉज़|विराम)\s*\d*\s*(?:seconds?|सेकंड)?\b", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*[—–-]\s*", " ", text)
    text = re.sub(r"[<>*_#`]", " ", text)
    return re.sub(r"\s+", " ", text).strip()

# Natural, expressive Edge Neural voices selected for educational storytelling.
# These are public Edge-TTS voice IDs; no provider API key is required.
from config1 import EDGE_TTS_VOICES

VOICE_MAP = EDGE_TTS_VOICES

LANGUAGE_SETTINGS = {
    "English": {"rate": "-8%", "pitch": "+0Hz", "volume": "+0%"},
    "Hindi": {"rate": "-10%", "pitch": "+0Hz", "volume": "+0%"},
    "Nepali": {"rate": "-10%", "pitch": "+0Hz", "volume": "+0%"},
}

async def _save(text: str, output: Path, language: str) -> Path:
    try:
        import edge_tts
    except ImportError as error:
        raise RuntimeError("Install edge-tts to generate MP3 audio: pip install edge-tts") from error
    clean_text = clean_voice_text(text)
    if not clean_text:
        raise ValueError("The storytelling script is empty.")
    selected_language = language if language in VOICE_MAP else "English"
    settings = LANGUAGE_SETTINGS[selected_language]
    communicate = edge_tts.Communicate(
        clean_text,
        VOICE_MAP[selected_language],
        rate=settings["rate"],
        pitch=settings["pitch"],
        volume=settings["volume"],
    )
    await communicate.save(str(output))
    return output


def available_voices() -> dict[str, str]:
    """Return the cinematic voice selected for each supported language."""
    return VOICE_MAP.copy()

def create_voiceover(text: str, output: str = "output/voiceover.mp3", language: str = "English") -> Path:
    path = Path(output)
    path.parent.mkdir(parents=True, exist_ok=True)
    return asyncio.run(_save(text, path, language))

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("script")
    parser.add_argument("--output", default="output/voiceover.mp3")
    parser.add_argument("--language", choices=sorted(VOICE_MAP), default="English")
    parser.add_argument("--list-voices", action="store_true", help="List the cinematic voice used for each language")
    args = parser.parse_args()
    if args.list_voices:
        for language, voice in available_voices().items():
            print(f"{language}: {voice}")
    else:
        create_voiceover(Path(args.script).read_text(encoding="utf-8"), args.output, args.language)
