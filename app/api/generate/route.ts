import { NextResponse } from "next/server"

const preferredModels = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
const masterPromptBranch = process.env.VERCEL_GIT_COMMIT_REF || "main"
const masterPromptUrl = "https://raw.githubusercontent.com/amritpap2026-cell/Nasa-videos-for-education-/" + encodeURI(masterPromptBranch) + "/universal_youtube_master_prompt.txt"

async function models(key: string) {
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + encodeURIComponent(key), { cache: "no-store", signal: AbortSignal.timeout(12000) })
    if (!r.ok) return preferredModels
    const d = await r.json()
    const a = Array.isArray(d?.models) ? d.models.filter((m: any) => m.name?.startsWith("models/gemini-") && m.supportedGenerationMethods?.includes("generateContent")).map((m: any) => m.name.replace("models/", "")) : []
    return [...preferredModels.filter((m) => a.includes(m)), ...a.filter((m: string) => !preferredModels.includes(m))]
  } catch { return preferredModels }
}

async function generate(key: string, prompt: string, maxOutputTokens = 12000, temperature = 0.65) {
  for (const model of await models(key)) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature, maxOutputTokens } }),
        signal: AbortSignal.timeout(45000),
      })
      if (!r.ok) continue
      const d = await r.json(); const text = d?.candidates?.[0]?.content?.parts?.[0]?.text
      if (typeof text === "string" && text.trim()) return { text, model }
    } catch {}
  }
  return null
}

async function researchSignals(topic: string) {
  const q = encodeURIComponent(topic); const out: any[] = []
  for (const url of ["https://news.google.com/rss/search?q=" + q + "&hl=en-US&gl=US&ceid=US:en", "https://news.google.com/rss/search?q=" + q + "%20when:30d&hl=en-US&gl=US&ceid=US:en"]) {
    try {
      const xml = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) }).then((r) => r.text())
      for (const item of [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10)) {
        const title = item[1].match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim()
        const link = item[1].match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || ""
        if (title) out.push({ source: "Google News RSS", title, url: link })
      }
    } catch {}
  }
  try {
    const d = await fetch("https://images-api.nasa.gov/search?q=" + q + "&media_type=image,video", { cache: "no-store", signal: AbortSignal.timeout(10000) }).then((r) => r.json())
    for (const item of (d?.collection?.items || []).slice(0, 8)) out.push({ source: "NASA Image and Video Library", title: item?.data?.[0]?.title || topic, url: item.href || "" })
  } catch {}
  const seen = new Set<string>(); return out.filter((x) => { const k = x.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 18)
}

async function masterPrompt() {
  try {
    const r = await fetch(masterPromptUrl, { cache: "no-store", signal: AbortSignal.timeout(10000) })
    return r.ok ? await r.text() : ""
  } catch {
    return ""
  }
}
function mins(v: string) { const m = String(v || "").match(/(\d+)\s*[-–]\s*(\d+)/); return m ? Number(m[2]) : Math.max(1, Number(v) || 10) }
function lang(v: string) { return v === "Hindi" ? "Write all user-facing prose in natural Hindi using Devanagari." : v === "Nepali" ? "Write all user-facing prose in natural Nepali using Devanagari." : "Write all user-facing prose in natural English." }

const stableHeaders = "RESEARCH BRIEF;STORY ANGLE;VIDEO PROMISE + AUDIENCE;FORMAT + DURATION PLAN;STORY ARCHITECTURE;RETENTION MAP;COMPLETE SCRIPT PLAN;FACT-CHECK + SOURCE MAP;PRODUCTION MANIFEST;FULL WORD-FOR-WORD SCRIPT (STORYTELLING SCRIPT);COMPLETE TIMESTAMPED STORYBOARD / FINAL TIMELINE;AI IMAGE GENERATION PROMPTS;AI VIDEO GENERATION PROMPTS;REAL / ARCHIVAL / STOCK FOOTAGE PLAN;MOTION GRAPHICS + DATA VISUALIZATION;ON-SCREEN TEXT + SUBTITLES;VOICEOVER DIRECTION;MUSIC + SOUND DESIGN;EDITING + COLOR BLUEPRINT;TITLE + SEO PACKAGE;DESCRIPTION + CHAPTERS + PINNED COMMENT;YOUTUBE SHORTS REPURPOSING;FINAL PRODUCTION / PUBLISHING / QC PLAN;THUMBNAIL CONCEPTS;FINAL COMPLETION AUDIT"

function fallback(topic: string, minutes: number) { return "TITLE + SEO PACKAGE\n" + topic + "\n\nRESEARCH BRIEF\nGeneral public\n\nFULL WORD-FOR-WORD SCRIPT (STORYTELLING SCRIPT)\n<<<STORYTELLING_SCRIPT_START>>>\nThe story of " + topic + " begins with a question. Examine the evidence, separate fact from uncertainty, and follow the consequences.\n<<<STORYTELLING_SCRIPT_END>>>\n\nCOMPLETE TIMESTAMPED STORYBOARD / FINAL TIMELINE\n00:00 Opening\n01:00 Context\n03:00 Evidence\n05:00 Consequences\n\nAI IMAGE GENERATION PROMPTS\nCreate factual cinematic 16:9 visuals for " + topic + ".\n\nAI VIDEO GENERATION PROMPTS\nCreate documentary-style 16:9 motion visuals for " + topic + ".\n\nTHUMBNAIL CONCEPTS\nCreate 10 distinct concepts.\n\nFINAL COMPLETION AUDIT\nFallback generated for " + minutes + " minutes." }

export async function POST(request: Request) {
  try {
    const b = await request.json(); const topic = typeof b?.topic === "string" ? b.topic.trim() : ""
    const language = ["English", "Hindi", "Nepali"].includes(b?.language) ? b.language : "English"
    const mode = typeof b?.mode === "string" ? b.mode : "master"; const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim()
    if (mode !== "voiceover" && topic.length < 3) return NextResponse.json({ error: "Please enter a topic with at least 3 characters." }, { status: 400 })
    if (mode === "voiceover") {
      if (!key) return NextResponse.json({ error: "GEMINI_API_KEY is not configured for voiceover." }, { status: 503 })
      const script = typeof b?.script === "string" ? b.script.replace(/\\([^)]*\\)|\\[[^\\]]*\\]|\\{[^}]*\\}/g, " ").replace(/\\s+/g, " ").trim() : ""
      if (!script) return NextResponse.json({ error: "Add the storytelling script first." }, { status: 400 })
      for (const model of ["gemini-2.5-flash-preview-tts", "gemini-2.5-flash-tts"]) {
        try {
          const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: "Read only the following storytelling narration. Do not speak headings, labels, timestamps or production notes. Language: " + language + ". Narration:\n\n" + script }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: b.voice || "Kore" } } } } }), signal: AbortSignal.timeout(45000) })
          if (!r.ok) continue; const d = await r.json(); const audio = d?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data)?.inlineData
          if (audio?.data) return NextResponse.json({ audio: audio.data, mimeType: audio.mimeType || "audio/wav", model })
        } catch {}
      }
      return NextResponse.json({ error: "No Gemini TTS model is currently available." }, { status: 503 })
    }
    if (mode === "brainstorm") {
      const signals = await researchSignals(topic); const result = key ? await generate(key, "Create 8 accurate curiosity-driven YouTube topics for a general audience from this seed: " + topic + ". Current signals: " + JSON.stringify(signals), 900, 0.9) : null
      const topics = result?.text.split("\n").map((x: string) => x.replace(/^\\s*\\d+[.)-]\\s*/, "").trim()).filter((x: string) => x.length > 5).slice(0, 8) || ["Why " + topic + " matters", "What is really happening with " + topic, "The story behind " + topic, topic + " explained"]
      return NextResponse.json({ topics, model: result?.model || "fallback" })
    }
    if (mode === "asset-prompt" || mode === "seo") {
      const type = b.assetType === "video" ? "AI VIDEO GENERATION PROMPTS" : b.assetType === "thumbnail" ? "THUMBNAIL CONCEPTS" : "AI IMAGE GENERATION PROMPTS"
      const p = mode === "seo" ? "Create a complete YouTube metadata package using exact headers TITLE + SEO PACKAGE and DESCRIPTION + CHAPTERS + PINNED COMMENT. Include 20 accurate titles, keywords, tags, description, chapters and pinned comment. Topic: " + topic + ". " + lang(language) : "Create 8 production-ready " + type + " for topic: " + topic + ". Include specific subject, composition, lighting, camera/motion, continuity, 16:9, realism and negative constraints. For thumbnails include 0-4 word text and strong contrast. " + lang(language)
      const result = key ? await generate(key, p, 5000, 0.72) : null
      return NextResponse.json(result || { text: type + "\nCreate production-ready assets for " + topic + ".", model: "fallback" })
    }
    const minutes = mins(b.length); const signals = await researchSignals(topic); const research = JSON.stringify(signals); let prompt = ""
    if (mode === "scriptwriter") {
      prompt = "You are the FREE-FORM SCRIPTWRITER for a universal YouTube studio. Topic: " + topic + ". Audience: General public. Language: " + language + ". Runtime: " + minutes + " minutes, about " + minutes * 125 + " spoken words. Current public research signals: " + research + ". Write a complete creative documentary package. Choose the best structure for politics, news, science, geology, technology, economics, history, social experiments, investigations or any other subject. Do not force student/lesson language. Separate facts, reporting, analysis and uncertainty. No invented sources, quotes or statistics. No filler. Use these exact stable headers without numeric identifiers: " + stableHeaders + ". Under FULL WORD-FOR-WORD SCRIPT (STORYTELLING SCRIPT), put only narration between <<<STORYTELLING_SCRIPT_START>>> and <<<STORYTELLING_SCRIPT_END>>>. Complete every header. " + lang(language)
    } else {
      const master = await masterPrompt()
      if (!master) return NextResponse.json({ error: "The universal_youtube_master_prompt.txt could not be loaded. Please retry after the deployment is ready." }, { status: 503 })
      prompt = "Use the existing authoritative UNIVERSAL AI YOUTUBE PRODUCTION MASTER PROMPT below. Topic: " + topic + ". Audience: General public. Language: " + language + ". Runtime: " + minutes + " minutes. Current public research signals: " + research + ". Keep the master protocol, but remove any NASA/student-only assumptions. Complete the entire package and final audit. IMPORTANT: application identifiers must be header-based, never numeric. Use these exact stable headers: " + stableHeaders + ". The narration belongs only between <<<STORYTELLING_SCRIPT_START>>> and <<<STORYTELLING_SCRIPT_END>>> under FULL WORD-FOR-WORD SCRIPT (STORYTELLING SCRIPT). Never return an incomplete package. " + lang(language) + "\n\nMASTER PROMPT:\n" + master
    }
    if (!key) return NextResponse.json({ error: "GEMINI_API_KEY is not configured. Add it in the deployment environment before generating a YouTube package." }, { status: 503 })
    const result = await generate(key, prompt, Math.min(30000, Math.max(9000, minutes * 125 * 2)), mode === "scriptwriter" ? 0.78 : 0.58)
    if (!result) return NextResponse.json({ error: "No Gemini text model was available. Please retry or check the Gemini API key and model access." }, { status: 503 })
    return NextResponse.json(result)
  } catch { return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 }) }
}