import { NextResponse } from "next/server"

const preferredModels = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
]

const requestTimeoutMs = 25_000
const masterPromptUrl = "https://raw.githubusercontent.com/amritpap2026-cell/Nasa-videos-for-education-/main/universal_youtube_master_prompt.txt"

async function getAvailableModels(key: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      { signal: controller.signal, cache: "no-store" },
    )
    if (!response.ok) return preferredModels
    const data = await response.json()
    const available = Array.isArray(data?.models)
      ? data.models
          .filter(
            (model: { name?: string; supportedGenerationMethods?: string[] }) =>
              model.name?.startsWith("models/gemini-") &&
              model.supportedGenerationMethods?.includes("generateContent"),
          )
          .map((model: { name: string }) => model.name.replace("models/", ""))
      : []

    const preferred = preferredModels.filter((model) => available.includes(model))
    return [...preferred, ...available.filter((model: string) => !preferred.includes(model))]
  } catch {
    return preferredModels
  } finally {
    clearTimeout(timeout)
  }
}

function createFallbackTopics(topic: string, language: string) {
  const subject = topic.trim() || "NASA and space exploration"
  const languageLabel = language === "English" ? "" : ` (${language})`
  return [
    `What NASA just discovered about ${subject}`,
    `${subject}: the space mystery scientists still cannot explain`,
    `The hidden science behind ${subject}`,
    `Could ${subject} change life on Earth?`,
    `NASA's most surprising facts about ${subject}`,
    `${subject} explained in 10 minutes for curious minds`,
    `The future of ${subject} and humanity's next giant leap`,
    `What students should know about ${subject}${languageLabel}`,
  ]
}

async function createFallbackPackage(topic: string, language: string, length: string) {
  const safeTopic = topic.trim() || "NASA and space exploration"
  const languageNote = language === "English" ? "" : `\nLANGUAGE NOTE: Write narration and on-screen text in ${language}.`
  let styleGuide = ""
  try {
    const response = await fetch(masterPromptUrl, { signal: AbortSignal.timeout(8_000), cache: "no-store" })
    if (response.ok) styleGuide = await response.text()
  } catch {
    // The local structure below remains available when GitHub is unreachable.
  }

  const guideSections = [...styleGuide.matchAll(/^#{1,3}\\s+(.+)$/gm)]
    .map((match) => match[1].trim())
    .filter(Boolean)
    .slice(0, 12)
  const sectionNote = guideSections.length
    ? `\\nMASTER PROMPT SECTIONS APPLIED: ${guideSections.join(" | ")}`
    : "\\nMASTER PROMPT STYLE APPLIED: hook, educational clarity, SEO metadata, responsible NASA context, and duration-matched outline."

  return `TITLE: ${safeTopic} | The NASA Story You Need to Know

DESCRIPTION: Discover ${safeTopic} through clear, accurate space education. This episode explains the science, evidence, mission context, and why this topic matters for our shared future. Created for curious learners by Cosmos, an independent educational channel. This video is not affiliated with or endorsed by NASA.

TAGS: NASA, ${safeTopic}, space exploration, astronomy, cosmos, science education, universe, STEM, space explained

SEO KEYWORDS: ${safeTopic}, NASA education, space science, astronomy explained, universe facts, STEM learning

VIDEO LENGTH: ${length} minutes

VIDEO OUTLINE:
00:00 Hook: Why should we care about ${safeTopic}?
01:00 The big question and essential context
03:00 Science, evidence, and what NASA has learned
06:00 What this means for Earth and future exploration
08:00 Key takeaways and invitation to keep learning

CALL TO ACTION: Subscribe for accurate, inspiring NASA and space education in English, Hindi, and Nepali. Share this episode with a curious learner.${languageNote}${sectionNote}`
}

export async function POST(request: Request) {
  try {
    const { topic, language = "English", length = "0-10", mode = "package" } = await request.json()
    if (typeof topic !== "string" || topic.length > 300) return NextResponse.json({ error: "Please enter a topic no longer than 300 characters." }, { status: 400 })
    const normalizedLanguage = ["English", "Hindi", "Nepali"].includes(language) ? language : "English"
    const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim()

    if (mode === "brainstorm") {
      if (topic.trim().length < 2) return NextResponse.json({ error: "Enter a few words so we can brainstorm around them." }, { status: 400 })
      if (!key) return NextResponse.json({ topics: createFallbackTopics(topic, normalizedLanguage), model: "free brainstorm fallback" })
      const brainstormPrompt = `You are a brilliant YouTube trend researcher and producer for a NASA space education channel. Based on the seed ${topic.trim()}, brainstorm 8 catchy, intelligent, curiosity-driven video topic titles by analyzing common competitor-style hooks, questions, comparisons, mysteries, and explainers that perform well in educational YouTube search. This is a search-style brainstorm, not live YouTube results; do not claim you searched live YouTube data. Make every title accurate, educational, emotionally compelling, distinct, and suitable for ${normalizedLanguage}. Return only a numbered list of 8 titles, one per line, with no introduction.`
      const models = await getAvailableModels(key)
      for (const model of models) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: brainstormPrompt }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 700 } }), signal: controller.signal })
          if (!response.ok) continue
          const data = await response.json()
          const generated = data?.candidates?.[0]?.content?.parts?.[0]?.text
          const topics = typeof generated === "string" ? generated.split("\n").map((line: string) => line.replace(/^\s*\d+[.)-]\s*/, "").trim()).filter((line: string) => line.length >= 8 && line.length <= 180).slice(0, 10) : []
          if (topics.length >= 5) return NextResponse.json({ topics, model })
        } catch {
          // Continue through free Gemini models before using the local brainstorm.
        } finally {
          clearTimeout(timeout)
        }
      }
      return NextResponse.json({ topics: createFallbackTopics(topic, normalizedLanguage), model: "free brainstorm fallback" })
    }

    if (topic.trim().length < 3) return NextResponse.json({ error: "Please enter a topic with at least 3 characters." }, { status: 400 })
    const selectedLength = ["0-5", "0-10", "0-15", "0-30", "0-60"].includes(length) ? length : "0-10"
    if (!key) return NextResponse.json({ text: await createFallbackPackage(topic, normalizedLanguage, selectedLength), model: "local master-prompt fallback" })
    let masterPrompt = ""
    try {
      const promptResponse = await fetch(masterPromptUrl, { signal: AbortSignal.timeout(8_000), next: { revalidate: 3600 } })
      if (promptResponse.ok) masterPrompt = await promptResponse.text()
    } catch {
      // The concise prompt below remains available when GitHub is unreachable.
    }
    const prompt = `You are generating a complete YouTube production package.\n\nAUTHORITATIVE STYLE GUIDE:\n${masterPrompt || "Use a clear, accurate, curiosity-driven NASA space education style with a strong hook, student-friendly explanations, search-friendly metadata, and a practical timestamped structure."}\n\nFollow the AUTHORITATIVE STYLE GUIDE above for every field. Do not invent a different format, tone, or metadata strategy. Create every requested value from the topic, language, and duration below.\n\nTOPIC: ${topic.trim()}\nLANGUAGE: ${normalizedLanguage}\nDESIRED VIDEO LENGTH: ${selectedLength} minutes\n\nReturn a production-ready package containing every section required by the style guide, including TITLE, DESCRIPTION, TAGS, SEO KEYWORDS, and a timestamped VIDEO OUTLINE whose timing fits the selected duration. If the style guide names additional fields, include them too. Keep facts scientifically responsible, accessible to learners, inspiring, and do not claim NASA endorsement. Return only the finished package.`
    const models = await getAvailableModels(key)

    for (const model of models) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
            }),
            signal: controller.signal,
          },
        )
        if (!response.ok) continue
        const data = await response.json()
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (typeof text === "string" && text.trim()) return NextResponse.json({ text, model })
      } catch {
        // Try the next free model when a model is unavailable or times out.
      } finally {
        clearTimeout(timeout)
      }
    }

    return NextResponse.json({
      text: await createFallbackPackage(topic, normalizedLanguage, selectedLength),
      model: "fallback",
      notice: "Gemini models were unavailable. This package was created locally.",
    })
  } catch {
    return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 })
  }
}
