"""Role-specific Gemini fallback configuration for the seven-stage pipeline."""
from __future__ import annotations

import os

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
RESEARCH_MODELS = ("gemini-2.0-flash",)
SCRIPTWRITER_MODELS = ("gemini-2.5-flash",)
PACKAGE_MODELS = ("gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash")
VOICEOVER_MODELS = ("gemini-2.5-flash-preview-tts", "gemini-2.5-flash-tts")
EDGE_TTS_VOICES = {"English": "en-US-AndrewMultilingualNeural", "Hindi": "hi-IN-MadhurNeural", "Nepali": "ne-NP-HemkalaNeural"}


def candidates(role: str) -> list[str]:
    """Return role-specific models, with GEMINI_MODEL optionally first."""
    groups = {"research": RESEARCH_MODELS, "scriptwriter": SCRIPTWRITER_MODELS, "package": PACKAGE_MODELS, "voiceover": VOICEOVER_MODELS}
    models = list(groups.get(role, PACKAGE_MODELS))
    preferred = os.getenv("GEMINI_MODEL", "").strip()
    return [preferred, *[model for model in models if model != preferred]] if preferred in models else models


def fallback_summary() -> dict[str, object]:
    return {"research": RESEARCH_MODELS, "scriptwriter": SCRIPTWRITER_MODELS, "package": PACKAGE_MODELS, "voiceover": VOICEOVER_MODELS, "edge_tts": EDGE_TTS_VOICES}
