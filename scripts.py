"""Small free automation helpers for Cosmos Studio.

Run with: python scripts.py --topic "black holes"
This prints ideas locally; the web app uses the same prompt contract for Gemini.
"""
import argparse


def create_story(topic: str, language: str = "English") -> str:
    subject = topic.strip() or "NASA and space exploration"
    if language == "Hindi":
        return f"सोचिए, {subject} हमारे लिए क्यों महत्वपूर्ण है। इस कहानी में हम समझेंगे कि यह कैसे काम करता है या कैसे हुआ, वैज्ञानिकों ने कौन से प्रमाण पाए, और इससे पृथ्वी तथा हमारे भविष्य के बारे में क्या सीख मिलती है। अंत में, इस ज्ञान को विद्यार्थियों के लिए एक सरल और प्रेरक प्रश्न से जोड़ें।"
    if language == "Nepali":
        return f"कल्पना गर्नुहोस्, {subject} हाम्रा लागि किन महत्वपूर्ण छ। यस कथामा हामी यो कसरी काम गर्छ वा कसरी भयो, वैज्ञानिकहरूले कस्ता प्रमाण पाए, र यसबाट पृथ्वी तथा हाम्रो भविष्यबारे के सिक्न सकिन्छ भन्ने बुझ्नेछौँ। अन्त्यमा, यो ज्ञानलाई विद्यार्थीका लागि सरल र प्रेरणादायी प्रश्नसँग जोड्नुहोस्।"
    return f"Imagine beginning with a simple question: why does {subject} matter to us? Follow the story of how it works or happened, what evidence scientists discovered, and what those discoveries teach us about Earth and our future. Explain one idea at a time for students, then end with a hopeful question that invites them to keep learning."


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
    parser.add_argument("--language", default="English", choices=["English", "Hindi", "Nepali"])
    parser.add_argument("--story", action="store_true", help="Print the voiceover storytelling script")
    args = parser.parse_args()
    if args.story:
        print(create_story(args.topic, args.language))
    else:
        for index, idea in enumerate(create_ideas(args.topic, args.count), 1):
            print(f"{index}. {idea}")

