"""Universal live research agent for any YouTube topic.

The researcher is deliberately topic-agnostic. It gathers current public signals and lets
the language model choose appropriate source types instead of assuming NASA, students, or
science. The returned dossier is shared by both the strict master-prompt writer and the
free-form scriptwriter.
"""
from __future__ import annotations

import argparse, json, os, re, urllib.parse, urllib.request
from dataclasses import asdict, dataclass
from typing import Any
from config1 import GEMINI_API_URL, candidates

GEMINI_MODELS = candidates("research")
GEMINI_URL = GEMINI_API_URL


@dataclass
class ResearchDossier:
    topic: str
    language: str
    audience: str
    research_status: str
    current_search_signals: list[dict[str, str]]
    key_claims: list[str]
    verified_facts: list[str]
    uncertainties: list[str]
    important_people: list[str]
    organizations: list[str]
    statistics: list[str]
    counterpoints: list[str]
    timeline: list[str]
    source_notes: list[str]
    image_queries: list[str]
    video_queries: list[str]
    seo_keywords: list[str]


def _fetch_text(url: str, timeout: int = 10) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Cosmos-Universal-Research/2.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def search_current_signals(topic: str, limit: int = 12) -> list[dict[str, str]]:
    """Collect current public signals without assuming a NASA-only subject."""
    query = urllib.parse.quote(topic)
    signals: list[dict[str, str]] = []
    feeds = [
        ("Google News RSS", f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"),
        ("Google News RSS recent", f"https://news.google.com/rss/search?q={query}%20when:30d&hl=en-US&gl=US&ceid=US:en"),
    ]
    for source, url in feeds:
        try:
            xml = _fetch_text(url)
            for item in re.findall(r"<item>(.*?)</item>", xml, flags=re.S)[:limit]:
                title = re.search(r"<title>(.*?)</title>", item, flags=re.S)
                link = re.search(r"<link>(.*?)</link>", item, flags=re.S)
                if title:
                    clean = re.sub(r"<[^>]+>", "", title.group(1))
                    clean = re.sub(r"<!\[CDATA\[|\]\]>", "", clean).strip()
                    signals.append({"source": source, "title": clean, "url": link.group(1).strip() if link else ""})
        except Exception:
            continue

    # NASA is an optional source, not the identity of the researcher.
    try:
        nasa = json.loads(_fetch_text(f"https://images-api.nasa.gov/search?q={query}&media_type=image,video", 10))
        for item in nasa.get("collection", {}).get("items", [])[:limit]:
            data = (item.get("data") or [{}])[0]
            signals.append({"source": "NASA Image and Video Library", "title": data.get("title", topic), "url": item.get("href", "")})
    except Exception:
        pass

    unique, seen = [], set()
    for item in signals:
        key = item.get("title", "").strip().lower()
        if key and key not in seen:
            seen.add(key)
            unique.append(item)
    return unique[:limit]


def _gemini_research(topic: str, language: str, audience: str, signals: list[dict[str, str]]) -> dict[str, Any] | None:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    prompt = f"""You are the Universal Research Agent for a professional YouTube production studio.
Research topic: {topic}
Output language: {language}
Intended audience: {audience}
Current public signals collected today: {json.dumps(signals, ensure_ascii=False)}

Research before any script is written. Use signals as leads, not proof. Choose source types
appropriate to the topic: primary documents, government agencies, official organizations,
academic papers, universities, original studies, reputable journalism, archives, company
documentation, or other authoritative sources. For politics/news prioritize current reporting
and primary statements. For science prioritize research and scientific institutions.
Separate established facts from interpretation, disputed claims and speculation.
Return ONLY JSON with arrays named key_claims, verified_facts, uncertainties, important_people,
organizations, statistics, counterpoints, timeline, source_notes, image_queries, video_queries,
seo_keywords, plus research_status. Do not invent statistics, quotations, dates, sources, or
expert opinions."""
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.25, "responseMimeType": "application/json"}}
    for model in GEMINI_MODELS:
        try:
            url = GEMINI_URL.format(model=model, key=urllib.parse.quote(key, safe=""))
            request = urllib.request.Request(url, data=json.dumps(body).encode(),
                                             headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(request, timeout=45) as response:
                data = json.loads(response.read().decode())
            return json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
        except Exception:
            continue
    return None


def research(topic: str, language: str = "English", audience: str = "General public") -> dict[str, Any]:
    subject = topic.strip() or "a topic worth investigating"
    signals = search_current_signals(subject)
    generated = _gemini_research(subject, language, audience, signals)
    if generated:
        generated.update({"topic": subject, "language": language, "audience": audience, "current_search_signals": signals})
        return generated
    return asdict(ResearchDossier(
        subject, language, audience, "Live public signals collected; AI enrichment unavailable.", signals,
        [f"Investigate the strongest current claims about {subject}"],
        [f"Current signals exist for {subject}; verify each claim before publication."],
        ["AI enrichment was unavailable; claims require manual verification."], [], [], [], [], [],
        ["Public search signals only; no unsupported claims should be published."],
        [subject, f"{subject} explained", f"{subject} latest"],
        [f"{subject} footage", f"{subject} documentary visuals"],
        [subject, f"{subject} explained", f"{subject} latest"]
    ))


create_brief = research


def generate_topics(niche: str, count: int = 8, language: str = "English") -> list[str]:
    subject = niche.strip() or "interesting current events"
    signals = search_current_signals(subject, max(8, count))
    key = os.getenv("GEMINI_API_KEY")
    if key:
        prompt = f"""You are a universal YouTube research editor. Based on the seed "{subject}"
and these current public signals {json.dumps(signals, ensure_ascii=False)}, create exactly {count}
distinct, accurate, curiosity-driven topic ideas for a general audience in {language}. Mix current
developments and evergreen questions. Do not claim search volume or rankings. Return only a JSON array."""
        body = {"contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.8, "responseMimeType": "application/json"}}
        for model in GEMINI_MODELS:
            try:
                url = GEMINI_URL.format(model=model, key=urllib.parse.quote(key, safe=""))
                request = urllib.request.Request(url, data=json.dumps(body).encode(),
                                                 headers={"Content-Type": "application/json"}, method="POST")
                with urllib.request.urlopen(request, timeout=35) as response:
                    data = json.loads(response.read().decode())
                ideas = json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
                if isinstance(ideas, list):
                    return list(dict.fromkeys(str(x).strip() for x in ideas if str(x).strip()))[:count]
            except Exception:
                continue
    return list(dict.fromkeys([x["title"] for x in signals if x.get("title")] + [
        f"Why {subject} matters", f"What is really happening with {subject}",
        f"The story behind {subject}", f"{subject} explained"
    ]))[:count]


def write_brief(brief: dict[str, Any], path: str) -> None:
    with open(path, "w", encoding="utf-8") as file:
        json.dump(brief, file, ensure_ascii=False, indent=2)


def load_brief(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def main() -> None:
    parser = argparse.ArgumentParser(description="Universal current-topic research")
    parser.add_argument("topic")
    parser.add_argument("--language", default="English")
    parser.add_argument("--audience", default="General public")
    parser.add_argument("--topics", action="store_true")
    parser.add_argument("--count", type=int, default=8)
    args = parser.parse_args()
    result = generate_topics(args.topic, args.count, args.language) if args.topics else research(args.topic, args.language, args.audience)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()


__all__ = ["ResearchDossier", "research", "create_brief", "generate_topics", "search_current_signals", "write_brief", "load_brief"]
