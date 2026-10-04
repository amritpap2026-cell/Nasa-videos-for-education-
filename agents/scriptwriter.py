"""Universal creative scriptwriter for researched YouTube topics.

Unlike the strict master-prompt engine, this writer is free to choose the best documentary,
news, explainer, investigation, history, science, politics, geology, technology, social or
other narrative structure. It still receives the same live research dossier.
"""
from __future__ import annotations

import argparse, json, os, urllib.parse, urllib.request
from typing import Any
from config1 import GEMINI_API_URL, candidates

GEMINI_MODELS = candidates("scriptwriter")
GEMINI_URL = GEMINI_API_URL


def _call_gemini(prompt: str) -> dict[str, Any] | None:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.78, "responseMimeType": "application/json"}}
    for model in GEMINI_MODELS:
        try:
            url = GEMINI_URL.format(model=model, key=urllib.parse.quote(key, safe=""))
            request = urllib.request.Request(url, data=json.dumps(body).encode(),
                                             headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(request, timeout=90) as response:
                data = json.loads(response.read().decode())
            return json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
        except Exception:
            continue
    return None


def _fallback(brief: dict[str, Any], minutes: int) -> dict[str, Any]:
    topic = str(brief.get("topic", "an interesting topic"))
    return {
        "topic": topic,
        "language": brief.get("language", "English"),
        "audience": brief.get("audience", "General public"),
        "duration_minutes": minutes,
        "title": topic,
        "sections": [{
            "heading": "The question",
            "duration_seconds": minutes * 60,
            "narration": f"Every good story begins with a question: what is really happening with {topic}? "
                         f"We can start with what is known, examine the evidence, and then follow the strongest "
                         f"explanations and unanswered questions. The available research should guide the story, "
                         f"while uncertain claims remain clearly identified.",
            "image_queries": [topic, f"{topic} documentary"],
            "video_queries": [f"{topic} footage", f"{topic} documentary footage"],
        }],
        "full_script": f"Every good story begins with a question: what is really happening with {topic}? "
                       f"We can start with what is known, examine the evidence, and then follow the strongest "
                       f"explanations and unanswered questions.",
        "source": "local fallback",
    }


def write_script(brief: dict[str, Any], minutes: int = 10) -> dict[str, Any]:
    minutes = max(1, int(minutes))
    topic = str(brief.get("topic", "an interesting topic"))
    language = str(brief.get("language", "English"))
    audience = str(brief.get("audience", "General public"))
    target_words = minutes * 125
    prompt = f"""You are the lead documentary scriptwriter for a professional general-audience
YouTube channel. You have already received a research dossier, so do not invent facts beyond it.

TOPIC: {topic}
LANGUAGE: {language}
AUDIENCE: {audience}
TARGET LENGTH: {minutes} minutes, approximately {target_words} spoken words.
RESEARCH DOSSIER:
{json.dumps(brief, ensure_ascii=False)}

Write the strongest possible story for this subject. You are free to choose the format: current
affairs, investigative documentary, science explainer, history, politics, economics, geology,
technology, social experiment, biography, mystery, human story, or another format when appropriate.
Do not force every topic into a school lesson. General viewers are the default.

Use a strong opening, clear narrative momentum, evidence, context, meaningful transitions and a
satisfying ending. For current topics, make the time-sensitive nature explicit and distinguish
reported facts from analysis. Never fabricate quotes, statistics, sources or certainty. Do not
add filler merely to reach the target length. Longer videos should gain depth through evidence,
examples, context, competing explanations and consequences.

Return ONLY JSON:
{{
  "topic": "...",
  "language": "...",
  "audience": "...",
  "duration_minutes": {minutes},
  "title": "...",
  "logline": "...",
  "sections": [
    {{
      "heading": "...",
      "duration_seconds": 0,
      "narration": "complete spoken narration for this section",
      "image_queries": ["...", "..."],
      "video_queries": ["...", "..."]
    }}
  ],
  "full_script": "the complete word-for-word narration only",
  "visual_strategy": ["..."],
  "thumbnail_direction": "...",
  "seo_keywords": ["..."],
  "tags": ["..."],
  "description": "complete YouTube description",
  "source_notes": ["..."]
}}

The full_script must be the complete narration, not an outline or summary. Do not put timestamps,
camera directions, labels or production notes inside full_script."""
    result = _call_gemini(prompt)
    if not isinstance(result, dict) or not isinstance(result.get("sections"), list) or not result["sections"]:
        return _fallback(brief, minutes)

    sections = []
    for raw in result["sections"]:
        if not isinstance(raw, dict) or not str(raw.get("narration", "")).strip():
            continue
        sections.append({
            "heading": str(raw.get("heading", "Story")).strip(),
            "duration_seconds": max(20, int(raw.get("duration_seconds", minutes * 60 // max(1, len(result["sections"]))))),
            "narration": str(raw.get("narration", "")).strip(),
            "image_queries": [str(x).strip() for x in raw.get("image_queries", []) if str(x).strip()][:5],
            "video_queries": [str(x).strip() for x in raw.get("video_queries", []) if str(x).strip()][:5],
        })
    if not sections:
        return _fallback(brief, minutes)
    result["topic"] = topic
    result["language"] = language
    result["audience"] = audience
    result["duration_minutes"] = minutes
    result["sections"] = sections
    result["full_script"] = "\n\n".join(x["narration"] for x in sections)
    return result


create_script = write_script

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Write a free-form researched YouTube documentary.")
    parser.add_argument("topic")
    parser.add_argument("--minutes", type=int, default=10)
    parser.add_argument("--language", default="English")
    parser.add_argument("--audience", default="General public")
    args = parser.parse_args()
    from researcher import research
    brief = research(args.topic, language=args.language, audience=args.audience)
    print(json.dumps(write_script(brief, args.minutes), indent=2, ensure_ascii=False))


__all__ = ["write_script", "create_script"]
