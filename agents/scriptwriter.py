"""Stage 2: turn a research brief into a narrated script and visual plan."""
from dataclasses import asdict, dataclass
from typing import Any

@dataclass
class ScriptSection:
    heading: str
    narration: str
    image_queries: list[str]

def write_script(brief: dict[str, Any], minutes: int = 10) -> dict[str, Any]:
    topic = brief["topic"]
    sections = []
    for heading in brief.get("sections", ["Hook", "Science", "How it works", "Evidence", "Takeaway"]):
        sections.append(asdict(ScriptSection(heading, f"Today we explore {topic}. {heading} helps us understand why this topic matters and how scientists study it.", [f"{topic} {heading}", f"NASA {topic}"])))
    return {"topic": topic, "language": brief.get("language", "English"), "duration_minutes": minutes, "sections": sections, "full_script": "\n\n".join(section["narration"] for section in sections)}

create_script = write_script

if __name__ == "__main__":
    import argparse, json
    parser = argparse.ArgumentParser()
    parser.add_argument("topic")
    parser.add_argument("--minutes", type=int, default=10)
    args = parser.parse_args()
    from researcher import research
    print(json.dumps(write_script(research(args.topic), args.minutes), indent=2, ensure_ascii=False))
