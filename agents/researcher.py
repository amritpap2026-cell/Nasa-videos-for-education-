"""Stage 1: live topic research and structured education briefs.

Uses Gemini for topic analysis and public search feeds for current signals. If an
external service is unavailable, the brief still returns a useful local result.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from typing import Any

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

@dataclass
class ResearchBrief:
    topic: str
    audience: str
    language: str
    research_status: str
    current_search_signals: list[dict[str, str]]
    why_trending: list[str]
    learning_goals: list[str]
    sections: list[str]
    image_queries: list[str]
    seo_keywords: list[str]
    source_notes: list[str]


def _fetch_json(url: str, timeout: int = 8) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": "Cosmos-Education-Research/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _fetch_text(url: str, timeout: int = 8) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Cosmos-Education-Research/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def search_current_signals(topic: str, limit: int = 8) -> list[dict[str, str]]:
    """Collect current public search signals without scraping search-result pages."""
    query = urllib.parse.quote(topic)
    signals: list[dict[str, str]] = []
    try:
        nasa = _fetch_json(f"https://images-api.nasa.gov/search?q={query}&media_type=image,video", 10)
        for item in nasa.get("collection", {}).get("items", [])[:limit]:
            data = (item.get("data") or [{}])[0]
            signals.append({"source": "NASA Image and Video Library", "title": data.get("title", topic), "url": item.get("href", "")})
    except Exception:
        pass
    try:
        rss = _fetch_text(f"https://news.google.com/rss/search?q={query}%20NASA&hl=en-US&gl=US&ceid=US:en", 10)
        for title in re.findall(r"<title>(.*?)</title>", rss)[1:limit + 1]:
            signals.append({"source": "Google News RSS", "title": re.sub(r"<!\[CDATA\[|\]\]>", "", title), "url": ""})
    except Exception:
        pass
    return signals[:limit]


def _gemini_research(subject: str, language: str, audience: str, signals: list[dict[str, str]]) -> dict[str, Any] | None:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    prompt = f"""You are a current-topic research editor for a NASA education channel.
Topic/niche: {subject}
Audience: {audience}
Output language: {language}
Current public search signals (use as clues, never invent facts): {json.dumps(signals, ensure_ascii=False)}

Return ONLY valid JSON with these keys: why_trending (array of 3 strings), learning_goals (array), sections (array of 6-10 detailed sections), image_queries (array of 8 specific NASA/Pexels search queries), seo_keywords (array of 12 search-friendly phrases), research_status (string), source_notes (array).
Create a topic-specific brief, not generic filler. Explain why the topic is timely or curiosity-driven, while clearly separating current signals from verified science. Keep it suitable for students in {audience}. Use {language} for all explanations. Include source_notes with the public sources used and say when live signals were unavailable."""
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.35, "responseMimeType": "application/json"}}
    try:
        url = GEMINI_URL.format(model=GEMINI_MODEL, key=urllib.parse.quote(key, safe=""))
        request = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode())
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)
    except Exception:
        return None


def research(topic: str, language: str = "English", audience: str = "Class 8-12") -> dict[str, Any]:
    subject = topic.strip() or "NASA and space exploration"
    signals = search_current_signals(subject)
    generated = _gemini_research(subject, language, audience, signals)
    if generated:
        generated.update({"topic": subject, "audience": audience, "language": language, "current_search_signals": signals})
        return generated
    return asdict(ResearchBrief(subject, audience, language, "Live signals collected; Gemini enrichment unavailable.", signals,
        [f"{subject} connects to current NASA discoveries and student curiosity", f"It supports visual explainers and question-led learning", "Verify current claims against the linked sources before publishing"],
        [f"Define {subject} in student-friendly language", f"Explain why {subject} matters", f"Show how {subject} works", "Connect evidence to curriculum and curiosity"],
        ["Opening question and current hook", "Essential scientific background", f"How {subject} works, step by step", "Evidence, missions, and discoveries", "Misconceptions and safety notes", "Student recap and questions"],
        [subject, f"{subject} NASA mission", f"{subject} diagram for students", f"{subject} space observation", f"{subject} Pexels science background"],
        [subject, f"{subject} explained", "NASA education", "space science", "astronomy for students", "STEM lesson", "universe facts"],
        ["NASA Image and Video Library", "Google News RSS current-topic signals", "Gemini enrichment was unavailable; review live claims before use"]))


def create_brief(topic: str, language: str = "English") -> dict[str, Any]:
    return research(topic, language)


def generate_topics(niche: str, count: int = 8) -> list[str]:
    signals = search_current_signals(niche, max(5, count))
    titles = [item["title"] for item in signals if item.get("title")]
    return titles[:count] or [f"{niche.strip()}: the science students should understand #{index}" for index in range(1, max(1, count) + 1)]


def write_brief(brief: dict[str, Any], path: str) -> None:
    with open(path, "w", encoding="utf-8") as file:
        json.dump(brief, file, ensure_ascii=False, indent=2)


def load_brief(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def main() -> None:
    parser = argparse.ArgumentParser(description="Research current topics and create a Cosmos education brief")
    parser.add_argument("topic")
    parser.add_argument("--language", default="English")
    parser.add_argument("--audience", default="Class 8-12")
    parser.add_argument("--topics", action="store_true", help="Print current topic ideas instead of a brief")
    parser.add_argument("--count", type=int, default=8)
    args = parser.parse_args()
    result = generate_topics(args.topic, args.count) if args.topics else research(args.topic, args.language, args.audience)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()


__all__ = ["ResearchBrief", "research", "create_brief", "generate_topics", "search_current_signals", "write_brief", "load_brief"]
