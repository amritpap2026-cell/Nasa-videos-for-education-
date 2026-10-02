"""Stage 1: create structured research briefs and topic ideas."""
from dataclasses import asdict, dataclass
from typing import Any

@dataclass
class ResearchBrief:
    topic: str
    audience: str
    language: str
    learning_goals: list[str]
    sections: list[str]
    image_queries: list[str]
    seo_keywords: list[str]

def research(topic: str, language: str = "English", audience: str = "Class 8-12") -> dict[str, Any]:
    subject = topic.strip() or "NASA and space exploration"
    return asdict(ResearchBrief(subject, audience, language, [f"Explain what {subject} is", f"Explain why {subject} matters", f"Explain how {subject} works"], ["Hook and question", "Scientific background", "How it works", "Evidence and discoveries", "Student takeaway"], [subject, f"{subject} NASA", f"{subject} space education"], [subject, "NASA", "space science", "astronomy", "STEM"]))

def create_brief(topic: str, language: str = "English") -> dict[str, Any]:
    return research(topic, language)

def generate_topics(niche: str, count: int = 8) -> list[str]:
    return [f"{niche.strip()}: the science students should understand #{index}" for index in range(1, max(1, count) + 1)]

def write_brief(brief: dict[str, Any], path: str) -> None:
    import json
    with open(path, "w", encoding="utf-8") as file:
        json.dump(brief, file, ensure_ascii=False, indent=2)

def load_brief(path: str) -> dict[str, Any]:
    import json
    with open(path, encoding="utf-8") as file:
        return json.load(file)

def main() -> None:
    import argparse, json
    parser = argparse.ArgumentParser(description="Create a Cosmos research brief")
    parser.add_argument("topic")
    parser.add_argument("--language", default="English")
    args = parser.parse_args()
    print(json.dumps(research(args.topic, args.language), ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
