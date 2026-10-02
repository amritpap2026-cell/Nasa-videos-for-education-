"""Shared model and service configuration for the Python pipeline."""
from __future__ import annotations

import os

# Ordered from newest/preferred to oldest compatibility fallback.
GEMINI_MODEL_GROUPS: tuple[tuple[str, ...], ...] = (
    ("gemini-2.5-flash", "gemini-2.5-flash-lite", "gemma-4-31b-it"),
    ("gemini-2.0-flash", "gemini-2.0-flash-lite", "gemma-3-27b-it"),
    ("gemini-1.5-flash-001", "gemini-1.5-pro-001"),
)

GEMINI_MODELS: tuple[str, ...] = tuple(model for group in GEMINI_MODEL_GROUPS for model in group)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"


def model_candidates() -> list[str]:
    """Return configured models, optionally prioritizing GEMINI_MODEL."""
    preferred = os.getenv("GEMINI_MODEL", "").strip()
    if preferred in GEMINI_MODELS:
        return [preferred, *[model for model in GEMINI_MODELS if model != preferred]]
    return list(GEMINI_MODELS)
