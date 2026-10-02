"""Small orchestration entry point for the seven-stage pipeline."""
from agents.researcher import research
from agents.scriptwriter import write_script


def prepare(topic: str, language: str = "English", minutes: int = 10) -> dict:
    brief = research(topic, language)
    script = write_script(brief, minutes)
    return {"brief": brief, "script": script}


if __name__ == "__main__":
    import argparse, json
    parser = argparse.ArgumentParser(description="Prepare a Cosmos education video pipeline")
    parser.add_argument("topic")
    parser.add_argument("--language", default="English")
    parser.add_argument("--minutes", type=int, default=10)
    args = parser.parse_args()
    print(json.dumps(prepare(args.topic, args.language, args.minutes), ensure_ascii=False, indent=2))
