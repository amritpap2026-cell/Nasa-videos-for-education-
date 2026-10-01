import { NextResponse } from "next/server"

const models = ["gemini-2.0-flash", "gemini-1.5-flash"]

function createFallbackPackage(topic: string, language: string) {
  const safeTopic = topic.trim()
  const languageNote = language === "English" ? "" : ` Write the package in ${language}.`
  return `TITLE: ${safeTopic} | A NASA Space Story Explained\n\nDESCRIPTION: Explore ${safeTopic} with Cosmos, an independent space education channel. In this episode, we explain the science, mission context, discoveries, and why this topic matters for humanity in clear, student-friendly language. This educational video is not affiliated with or endorsed by NASA.\n\nTAGS: NASA, space exploration, astronomy, cosmos, science education, ${safeTopic}\n\nSEO KEYWORDS: ${safeTopic}, NASA education, space science, astronomy explained, universe facts\n\nVIDEO OUTLINE:\n1. Hook: What makes ${safeTopic} fascinating?\n2. Explore the science, mission, and latest known context.\n3. Close with learning takeaways and ways students can explore space science.${languageNote}`
}

export async function POST(request: Request) {
  try {
    const { topic, language = "English" } = await request.json()
    if (typeof topic !== "string" || topic.trim().length < 3 || topic.length > 300) return NextResponse.json({ error: "Please enter a topic between 3 and 300 characters." }, { status: 400 })
    const key = process.env.GEMINI_API_KEY
    if (!key) return NextResponse.json({ text: createFallbackPackage(topic, language), model: "fallback" })
    const prompt = `You are a NASA space education producer. Create a YouTube package in ${language} for the topic: ${topic.trim()}. Return clear sections: TITLE, DESCRIPTION, TAGS, SEO KEYWORDS, and a 3-part VIDEO OUTLINE. Be accurate, inspiring, accessible to students, and never claim NASA endorsement.`
    for (const model of models) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 1200 } }) })
      if (response.ok) { const data = await response.json(); const text = data?.candidates?.[0]?.content?.parts?.[0]?.text; if (text) return NextResponse.json({ text, model }) }
    }
    return NextResponse.json({ text: createFallbackPackage(topic, language), model: "fallback" })
  } catch { return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 }) }
}
