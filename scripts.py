"""Small free automation helpers for Cosmos Studio.

Run with: python scripts.py --topic "black holes"
This prints ideas locally; the web app uses the same prompt contract for Gemini.
"""
import argparse


def create_ideas(topic: str, count: int = 8) -> list[str]:
    subject = topic.strip() or "NASA and space exploration"
    templates = [
        f"What NASA just discovered about {subject}",
        f"{subject}: the space mystery scientists still cannot explain",
        f"The hidden science behind {subject}",
        f"Could {subject} change life on Earth?",
        f"{subject} explained: the facts beginners miss",
        f"The future of {subject} and humanity's next leap",
        f"What students should know about {subject}",
        f"The surprising scale of {subject}",
        f"NASA facts about {subject} that sound impossible",
        f"The biggest unanswered question about {subject}",
    ]
    return templates[: max(5, min(count, len(templates)))]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create Cosmos video topic ideas")
    parser.add_argument("--topic", required=True, help="Seed topic")
    parser.add_argument("--count", type=int, default=8, help="Number of ideas")
    args = parser.parse_args()
    for index, idea in enumerate(create_ideas(args.topic, args.count), 1):
        print(f"{index}. {idea}")

