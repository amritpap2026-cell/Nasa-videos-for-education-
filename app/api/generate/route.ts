import { NextResponse } from "next/server"

export const maxDuration = 300

const preferredModels = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]

function geminiKeys() {
  const values = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ]
  return values.map((v) => (v || "").trim()).filter((v, i, a) => v && a.indexOf(v) === i)
}
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

async function generateWithRotation(keys: string[], prompt: string, maxOutputTokens = 12000, temperature = 0.65) {
  const errors: string[] = []
  for (const key of keys) {
    const result = await generate(key, prompt, maxOutputTokens, temperature)
    if (result) return result
    errors.push("A configured Gemini key could not complete generation")
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

async function callPythonPipeline(request: Request, topic: string, language: string, minutes: number) {
  const url = new URL("/api/agents", request.url);
  const incomingCookie = request.headers.get("cookie") || "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (incomingCookie) headers.cookie = incomingCookie;
  const r = await fetch(url, {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify({ topic, language, audience: "General public", minutes }),
    signal: AbortSignal.timeout(280000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) {
    const error = data?.detail || data?.error;
    const message =
      typeof error === "string"
        ? error
        : error?.message || error?.detail || error?.code
          ? [error.message, error.detail, error.code].filter(Boolean).join(" — ")
          : "Python researcher/scriptwriter pipeline failed.";
    throw new Error(message);
  }
  return data;
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

const stableHeaders = "RESEARCH BRIEF;STORY ANGLE;VIDEO PROMISE + AUDIENCE;FORMAT + DURATION PLAN;STORY ARCHITECTURE;THREE HOOKS + SELECTED HOOK;RETENTION MAP;COMPLETE SCRIPT PLAN;FACT-CHECK + SOURCE MAP;PRODUCTION MANIFEST;FULL WORD-FOR-WORD SCRIPT (STORYTELLING SCRIPT);COMPLETE TIMESTAMPED STORYBOARD / FINAL TIMELINE;AI IMAGE GENERATION PROMPTS;AI VIDEO GENERATION PROMPTS;REAL / ARCHIVAL / STOCK FOOTAGE PLAN;MOTION GRAPHICS + DATA VISUALIZATION;ON-SCREEN TEXT + SUBTITLES;VOICEOVER DIRECTION;MUSIC + SOUND DESIGN;EDITING + COLOR BLUEPRINT;TITLE + SEO PACKAGE;DESCRIPTION + CHAPTERS + PINNED COMMENT;YOUTUBE SHORTS REPURPOSING;FINAL PRODUCTION / PUBLISHING / QC PLAN;THUMBNAIL CONCEPTS;FINAL COMPLETION AUDIT"

function fallback(topic: string, minutes: number) { return "TITLE + SEO PACKAGE\n" + topic + "\n\nRESEARCH BRIEF\nGeneral public\n\nFULL WORD-FOR-WORD SCRIPT (STORYTELLING SCRIPT)\n<<<STORYTELLING_SCRIPT_START>>>\nThe story of " + topic + " begins with a question. Examine the evidence, separate fact from uncertainty, and follow the consequences.\n<<<STORYTELLING_SCRIPT_END>>>\n\nCOMPLETE TIMESTAMPED STORYBOARD / FINAL TIMELINE\n00:00 Opening\n01:00 Context\n03:00 Evidence\n05:00 Consequences\n\nAI IMAGE GENERATION PROMPTS\nCreate factual cinematic 16:9 visuals for " + topic + ".\n\nAI VIDEO GENERATION PROMPTS\nCreate documentary-style 16:9 motion visuals for " + topic + ".\n\nTHUMBNAIL CONCEPTS\nCreate 10 distinct concepts.\n\nFINAL COMPLETION AUDIT\nFallback generated for " + minutes + " minutes." }

export async function POST(request: Request) {
  try {
    const b = await request.json(); const topic = typeof b?.topic === "string" ? b.topic.trim() : ""
    const language = ["English", "Hindi", "Nepali"].includes(b?.language) ? b.language : "English"
    const mode = typeof b?.mode === "string" ? b.mode : "master"; const keys = geminiKeys(); const key = keys[0] || ""
    if (mode !== "voiceover" && topic.length < 3) return NextResponse.json({ error: "Please enter a topic with at least 3 characters." }, { status: 400 })
    if (mode === "voiceover") {
      if (!key) return NextResponse.json({ error: "GEMINI_API_KEY is not configured for voiceover." }, { status: 503 })
      const script = typeof b?.script === "string"
        ? b.script.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ").replace(/\s*[—–-]\s*/g, " ").replace(/[<>*_#`]/g, " ").replace(/\s+/g, " ").trim()
        : ""
      const voice = typeof b?.voice === "string" ? b.voice : "Kore"
      if (!script) return NextResponse.json({ error: "Add the storytelling script first." }, { status: 400 })

      // Preserve the proven Gemini TTS engine: explicit TTS models first,
      // then any TTS-capable Gemini models returned by the model list.
      for (const voiceKey of keys) {
        const available = await models(voiceKey)
        const voiceModels = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts", ...available.filter((model: string) => model.includes("tts"))]

        for (const model of [...new Set(voiceModels)]) {
          try {
            const r = await fetch(
              "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(voiceKey),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: "Read only the following storytelling narration. Do not speak headings, labels, timestamps or production notes. Language: " + language + ". Narration:\n\n" + script }] }],
                generationConfig: {
                  responseModalities: ["AUDIO"],
                  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
                },
              }),
              signal: AbortSignal.timeout(45000),
            } as any,
          )
          if (!r.ok) continue
          const d = await r.json()
          const audio = d?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data)?.inlineData
          if (audio?.data) return NextResponse.json({ audio: audio.data, mimeType: audio.mimeType || "audio/wav", model })
        } catch {
          // Try the next available Gemini TTS model.
        }
      }

      return NextResponse.json({ error: "No Gemini TTS model is currently available. Please retry; your storytelling script was preserved." }, { status: 503 })
    }
    if (mode === "brainstorm") {
      const signals = await researchSignals(topic); const result = keys.length ? await generateWithRotation(keys, "Create 8 accurate curiosity-driven YouTube topics for a general audience from this seed: " + topic + ". Current signals: " + JSON.stringify(signals), 900, 0.9) : null
      const topics = result?.text.split("\n").map((x: string) => x.replace(/^\\s*\\d+[.)-]\\s*/, "").trim()).filter((x: string) => x.length > 5).slice(0, 8) || ["Why " + topic + " matters", "What is really happening with " + topic, "The story behind " + topic, topic + " explained"]
      return NextResponse.json({ topics, model: result?.model || "fallback" })
    }
    if (mode === "asset-prompt" || mode === "seo") {
      const type = b.assetType === "video" ? "AI VIDEO GENERATION PROMPTS" : b.assetType === "thumbnail" ? "THUMBNAIL CONCEPTS" : "AI IMAGE GENERATION PROMPTS"
      const packageContext = typeof b?.package === "string" && b.package.trim() ? "\n\nUSE THIS GENERATED VIDEO PACKAGE AS THE SOURCE OF TRUTH:\n" + b.package.slice(0, 50000) : ""
      const modeContext = b?.generationMode === "scriptwriter"
        ? "This package came from the free-form Scriptwriter engine. Preserve its chosen creative structure and topic-specific visual language."
        : "This package came from the Master Prompt engine. Respect its production manifest and named package structure."
      const p = mode === "seo"
        ? "Create the final SEO + tags workspace output for this exact generated video. Include 20 accurate title options, primary/secondary/long-tail keywords, tags, a complete description, chapters based on the package timeline, and a pinned comment. Do not invent facts. " + modeContext + ". Topic: " + topic + ". " + lang(language) + packageContext
        : "Create the final " + type + " workspace output for this exact generated video. Read the generated package first and derive assets from its actual scenes, story angle, production manifest and timeline. Do not make generic assets from the topic alone. Include specific subject, environment, composition, framing, lighting, camera/motion, continuity, factual/physical accuracy, 16:9 suitability and negative constraints. For thumbnails include 0-4 word text and strong contrast. " + modeContext + ". Topic: " + topic + ". " + lang(language) + packageContext
      const result = keys.length ? await generateWithRotation(keys, p, 5000, 0.72) : null
      return NextResponse.json(result || { text: type + "\nCreate production-ready assets for " + topic + ".", model: "fallback" })
    }
    const minutes = mins(b.length)
    let pipeline: any
    try {
      // Both generation buttons MUST pass through the real Python agents first.
      pipeline = await callPythonPipeline(request, topic, language, minutes)
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : "Python research/scriptwriter pipeline failed.",
        pipeline: "researcher.py -> scriptwriter.py",
      }, { status: 503 })
    }

    const research = JSON.stringify(pipeline.research, null, 2)
    const scriptDraft = JSON.stringify(pipeline.script, null, 2)
    let prompt = ""

    if (mode === "scriptwriter") {
      prompt = "You are the FREE-FORM SCRIPTWRITER production engine for a universal YouTube studio. " +
        "The Python researcher.py and scriptwriter.py have ALREADY run successfully. Do not ignore or replace their work. " +
        "Use their research dossier as the factual foundation and their scriptwriter draft as the creative foundation. " +
        "Now turn that foundation into a COMPLETE, latest, production-ready YouTube package for the requested runtime. " +
        "You have complete creative freedom over structure: choose whatever sections, pacing, storytelling devices and script form best fit the subject. " +
        "A politics story can be an investigation; a science story can be an explainer; history can be a narrative documentary; technology can be a comparison or investigation; " +
        "and any other field may use whatever structure makes the strongest video. Do not force the 26-section master protocol. " +
        "For current/trending subjects, preserve the research date/context and distinguish verified facts, reporting, analysis, disputed claims and uncertainty. " +
        "Never invent sources, quotes, statistics or events. Do not use filler to hit duration. Longer videos must add evidence, examples, context, consequences and narrative development. " +
        "Include all production material actually needed for this video, and ALWAYS output these exact named headers even when the subject is unusual: FULL WORD-FOR-WORD SCRIPT (STORYTELLING SCRIPT); COMPLETE TIMESTAMPED STORYBOARD / FINAL TIMELINE; AI IMAGE GENERATION PROMPTS; AI VIDEO GENERATION PROMPTS; REAL / ARCHIVAL / STOCK FOOTAGE PLAN; MOTION GRAPHICS + DATA VISUALIZATION; ON-SCREEN TEXT + SUBTITLES; VOICEOVER DIRECTION; MUSIC + SOUND DESIGN; EDITING + COLOR BLUEPRINT; TITLE + SEO PACKAGE; DESCRIPTION + CHAPTERS + PINNED COMMENT; YOUTUBE SHORTS REPURPOSING; THUMBNAIL CONCEPTS; FINAL PRODUCTION / PUBLISHING / QC PLAN; FINAL COMPLETION AUDIT. The FINAL COMPLETION AUDIT is compulsory and must verify research, word-for-word script, visuals, image prompts, video prompts, thumbnail, SEO/tags, motion graphics, sound/music, editing, subtitles, Shorts, publishing and factual QC. Generate freely inside these headers; do not omit a header because it is not explicitly requested. " +
        "The common application workspace will extract AI IMAGE GENERATION PROMPTS, AI VIDEO GENERATION PROMPTS, THUMBNAIL CONCEPTS, and SEO/TAGS from your result. " +
        "Do not use numeric part identifiers as machine identifiers. " +
        "Return the complete package, not an outline or summary. " +
        lang(language) + "\n\nRESEARCH DOSSIER FROM researcher.py:\n" + research +
        "\n\nCREATIVE SCRIPT DRAFT FROM scriptwriter.py:\n" + scriptDraft
    } else {
      const master = await masterPrompt()
      if (!master) return NextResponse.json({ error: "The universal_youtube_master_prompt.txt could not be loaded. Please retry after the deployment is ready." }, { status: 503 })
      prompt = "Use the authoritative UNIVERSAL AI YOUTUBE PRODUCTION MASTER PROMPT below as the final package protocol. " +
        "The Python researcher.py and scriptwriter.py have ALREADY run successfully. Use their research dossier and scriptwriter draft as inputs; do not skip the Python pipeline. " +
        "Follow the master protocol completely and produce the entire structured package for the requested runtime. " +
        "Keep the stable named headers used by the application and never depend on numeric part/section identifiers. " +
        "For current/trending topics, use the supplied current research and clearly separate verified facts, reporting, analysis, disputed claims and uncertainty. " +
        "Do not invent facts, statistics, quotes, sources or dates. " +
        "The narration belongs only between <<<STORYTELLING_SCRIPT_START>>> and <<<STORYTELLING_SCRIPT_END>>> under FULL WORD-FOR-WORD SCRIPT (STORYTELLING SCRIPT). " +
        "Complete every required master section and the final completion audit. " +
        lang(language) + "\n\nRESEARCH DOSSIER FROM researcher.py:\n" + research +
        "\n\nSCRIPTWRITER DRAFT FROM scriptwriter.py:\n" + scriptDraft +
        "\n\nMASTER PROMPT:\n" + master
    }

    if (!key) return NextResponse.json({ error: "GEMINI_API_KEY is not configured. Add it in the deployment environment before generating a YouTube package." }, { status: 503 })
    const result = await generateWithRotation(keys, prompt, Math.min(30000, Math.max(9000, minutes * 125 * 2)), mode === "scriptwriter" ? 0.78 : 0.58)
    if (!result) return NextResponse.json({ error: "No Gemini text model was available. Please retry or check the Gemini API key and model access." }, { status: 503 })
    return NextResponse.json({ ...result, pipeline: "researcher.py -> scriptwriter.py -> " + (mode === "master" ? "master prompt" : "scriptwriter production engine") })
  } catch { return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 }) }
}