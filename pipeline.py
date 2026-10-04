"""Orchestration entry point for the two universal YouTube writing modes."""
from agents.researcher import research
from agents.scriptwriter import write_script


def prepare(topic: str, language: str = "English", minutes: int = 10, audience: str = "General public") -> dict:
    dossier = research(topic, language, audience)
    script = write_script(dossier, minutes)
    return {"research": dossier, "script": script}


if __name__ == "__main__":
    import argparse, json
    parser = argparse.ArgumentParser(description="Prepare a universal researched YouTube story")
    parser.add_argument("topic")
    parser.add_argument("--language", default="English")
    parser.add_argument("--minutes", type=int, default=10)
    parser.add_argument("--audience", default="General public")
    args = parser.parse_args()
    print(json.dumps(prepare(args.topic, args.language, args.minutes, args.audience), ensure_ascii=False, indent=2))
