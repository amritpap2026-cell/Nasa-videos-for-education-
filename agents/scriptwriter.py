"""Stage 2: expand a research brief into a complete narrated script and visual plan."""
from __future__ import annotations

import argparse
import json
import os
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from typing import Any

from config import GEMINI_API_URL, model_candidates

GEMINI_MODELS = model_candidates()
GEMINI_URL = GEMINI_API_URL


@dataclass
class ScriptSection:
    heading: str
    duration_seconds: int
    narration: str
    image_queries: list[str]
    video_queries: list[str]
    teaching_goal: str
    curiosity_question: str


def _call_gemini(prompt: str) -> dict[str, Any] | None:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.72, "responseMimeType": "application/json"}}
    for model in GEMINI_MODELS:
        url = GEMINI_URL.format(model=model, key=urllib.parse.quote(key, safe=""))
        request = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.loads(response.read().decode())
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text)
        except (urllib.error.URLError, KeyError, IndexError, json.JSONDecodeError):
            continue
    return None


def _fallback(brief: dict[str, Any], minutes: int) -> dict[str, Any]:
    topic = str(brief.get("topic", "NASA and space exploration"))
    language = brief.get("language", "English")
    seconds = max(60, minutes * 60 // 5)
    headings = ["The mystery", "Why it matters", "How it works", "Evidence and discovery", "What students can explore next"]
    sections = []
    for heading in headings:
        narration = f"Imagine looking closely at {topic} and asking the question that starts every scientific journey: why does it happen, and how can we know? We begin with the mystery, then connect it to what students already learn about evidence, patterns, energy, matter, Earth, and the universe. Step by step, we explain how scientists observe {topic}, what instruments and missions reveal, and which ideas remain open for discovery. By the end, the topic is not just a fact to remember; it becomes a question you can investigate for yourself."
        sections.append(asdict(ScriptSection(heading, seconds, narration, [f"NASA {topic} {heading}", f"scientific illustration {topic}"], [f"NASA {topic} mission footage", f"{topic} scientific animation"], f"Understand {heading.lower()} in the context of {topic}.", f"What would you investigate next about {topic}?")))
    return {"topic": topic, "language": language, "duration_minutes": minutes, "sections": sections, "full_script": "\n\n".join(s["narration"] for s in sections), "source": "local fallback"}


def write_script(brief: dict[str, Any], minutes: int = 10) -> dict[str, Any]:
    """Create an engaging, curriculum-aware script with image and video searches per section."""
    minutes = max(1, min(int(minutes), 60))
    topic = str(brief.get("topic", "NASA and space exploration"))
    language = brief.get("language", "English")
    target_words = minutes * 125
    prompt = f"""You are an expert science teacher and cinematic documentary writer.
Expand this research brief into a complete word-for-word narration for Class 8-12 students.
Topic: {topic}
Language: {language}
Target length: {minutes} minutes, approximately {target_words} spoken words.
Research brief: {json.dumps(brief, ensure_ascii=False)}

Make students want to keep listening: begin with a vivid question or mystery, explain why the
subject matters, teach the mechanism or history step by step, distinguish evidence from guesses,
connect to curriculum and Earth, use accurate NASA context, and end with a memorable curiosity
question. Use fluent cinematic transitions but never add stage directions, labels, or metadata to
narration. Divide the story into 5-8 balanced sections. For every section provide 2 searchable
image queries and 2 searchable video queries. Queries must describe real visual subjects, NASA
missions, instruments, diagrams, animations, or public-domain concepts; do not request copyrighted
characters or vague words.     Return ONLY valid JSON with this shape:
{{"topic":"...","language":"...","duration_minutes":{minutes},"sections":[{{"heading":"...","duration_seconds":0,"narration":"...","image_queries":["...","..."],"video_queries":["...","..."],"teaching_goal":"...","curiosity_question":"..."}}],"full_script":"..."}}"""
    result = _call_gemini(prompt)
    if not isinstance(result, dict) or not isinstance(result.get("sections"), list) or not result["sections"]:
        return _fallback(brief, minutes)

    clean_sections: list[dict[str, Any]] = []
    for raw_section in result["sections"]:
        if not isinstance(raw_section, dict):
            continue
        narration = str(raw_section.get("narration", "")).strip()
        if not narration:
            continue
        clean_sections.append({
            "heading": str(raw_section.get("heading", "Science explained")).strip(),
            "duration_seconds": max(30, int(raw_section.get("duration_seconds", minutes * 60 // max(1, len(result["sections"]))))),
            "narration": narration,
            "image_queries": [str(query).strip() for query in raw_section.get("image_queries", []) if str(query).strip()][:4] or [f"NASA {topic} scientific illustration"],
            "video_queries": [str(query).strip() for query in raw_section.get("video_queries", []) if str(query).strip()][:4] or [f"NASA {topic} mission footage"],
            "teaching_goal": str(raw_section.get("teaching_goal", f"Understand {topic}.")).strip(),
            "curiosity_question": str(raw_section.get("curiosity_question", f"What would you investigate next about {topic}?")).strip(),
        })
    if not clean_sections:
        return _fallback(brief, minutes)
    result["topic"] = topic
    result["language"] = language
    result["duration_minutes"] = minutes
    result["sections"] = clean_sections
    result["full_script"] = "\n\n".join(section["narration"] for section in clean_sections)
    return result


create_script = write_script

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Write a narrated educational script with visual queries.")
    parser.add_argument("topic")
    parser.add_argument("--minutes", type=int, default=10)
    parser.add_argument("--language", default="English")
    args = parser.parse_args()
    from researcher import research
    brief = research(args.topic, language=args.language)
    print(json.dumps(write_script(brief, args.minutes), indent=2, ensure_ascii=False))


__all__ = ["ScriptSection", "write_script", "create_script"]
