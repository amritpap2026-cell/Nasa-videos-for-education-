import { NextResponse } from "next/server"

export const maxDuration = 300

const IMAGE_MODEL = "gemini-3.1-flash-image"
const VIDEO_MODEL = "veo-3.1-generate-preview"
function key() { return (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim() }

async function textGenerate(apiKey: string, prompt: string) {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash:generateContent?key=" + encodeURIComponent(apiKey), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 5000 } }),
    signal: AbortSignal.timeout(60000),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d?.error?.message || "Gemini generation failed.")
  const text = d?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error("Gemini returned no text.")
  return text.trim()
}

async function imageGenerate(apiKey: string, prompt: string, thumbnail: boolean) {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + IMAGE_MODEL + ":generateContent", {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], response_format: { image: { aspect_ratio: "16:9", image_size: thumbnail ? "2K" : "1K" } } },
    }),
    signal: AbortSignal.timeout(120000),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d?.error?.message || "Image generation failed.")
  const part = d?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data || p?.inline_data?.data)
  const inline = part?.inlineData || part?.inline_data
  if (!inline?.data) throw new Error("The image model returned no image.")
  return { kind: "image", data: inline.data, mimeType: inline.mimeType || inline.mime_type || "image/png", model: IMAGE_MODEL }
}

async function videoStart(apiKey: string, prompt: string) {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + VIDEO_MODEL + ":predictLongRunning", {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ instances: [{ prompt }], parameters: { aspectRatio: "16:9", resolution: "720p", numberOfVideos: 1 } }),
    signal: AbortSignal.timeout(30000),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d?.name) throw new Error(d?.error?.message || "Video generation could not be started.")
  return { kind: "video", operation: d.name, model: VIDEO_MODEL }
}

async function videoStatus(apiKey: string, operation: string) {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/" + operation, { headers: { "x-goog-api-key": apiKey }, cache: "no-store", signal: AbortSignal.timeout(30000) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d?.error?.message || "Could not check video generation.")
  const sample = d?.response?.generateVideoResponse?.generatedSamples?.[0]?.video
  return { done: Boolean(d?.done), failed: Boolean(d?.error), error: d?.error?.message || "", videoUri: sample?.uri || "" }
}

async function promptFor(apiKey: string, type: string, topic: string, packageText: string, language: string) {
  const instruction = type === "motion"
    ? "Create production-ready motion graphics specifications for this exact video. Return 3-6 concrete scenes with timing, text, data/diagram elements, animation behavior, typography, transitions, layout and factual constraints. End with one MASTER MOTION GRAPHICS PROMPT. Do not invent data."
    : type === "seo"
      ? "Create the final SEO + tags package for this exact video: 20 title options, primary/secondary/long-tail keywords, YouTube tags, description, chapters from the supplied timeline, and pinned comment. Do not invent facts."
      : "Create a production-ready " + type + " prompt for this exact video. Derive it from the supplied scenes, story angle, production manifest and timeline. Include subject, composition, lighting, camera/motion, continuity and factual constraints. For thumbnails use bold 0-4 word text and strong 16:9 composition."
  return textGenerate(apiKey, instruction + "\n\nTOPIC: " + topic + "\nLANGUAGE: " + language + "\n\nSOURCE VIDEO PACKAGE:\n" + packageText.slice(0, 50000))
}

export async function POST(request: Request) {
  try {
    const b = await request.json(); const apiKey = key();
    if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 503 })
    const action = String(b?.action || ""); const type = String(b?.assetType || "");
    if (action === "status") return NextResponse.json(await videoStatus(apiKey, String(b?.operation || "")))
    if (!["image","video","thumbnail","seo","motion"].includes(type)) return NextResponse.json({ error: "Unsupported asset type." }, { status: 400 })
    const topic = String(b?.topic || "").trim(); if (topic.length < 3) return NextResponse.json({ error: "Enter a topic with at least 3 characters." }, { status: 400 })
    if (action === "prompt") return NextResponse.json({ text: await promptFor(apiKey, type, topic, String(b?.package || ""), String(b?.language || "English")) })
    if (action !== "generate") return NextResponse.json({ error: "Unsupported action." }, { status: 400 })
    const prompt = String(b?.prompt || "").trim(); if (!prompt) return NextResponse.json({ error: "Add a generation prompt first." }, { status: 400 })
    if (type === "image" || type === "thumbnail") return NextResponse.json(await imageGenerate(apiKey, prompt, type === "thumbnail"))
    if (type === "video") return NextResponse.json(await videoStart(apiKey, prompt))
    if (type === "seo") return NextResponse.json({ kind: "seo", text: await textGenerate(apiKey, prompt) })
    const svg = await textGenerate(apiKey, "Turn this motion-graphics specification into one self-contained animated SVG. SVG/CSS only, 16:9 viewBox, CSS keyframes, readable labels, no external libraries, no markdown fences, and use only facts/data in the specification.\n\n" + prompt)
    return NextResponse.json({ kind: "motion", svg: svg.replace(/^```(?:svg|xml)?\s*/i, "").replace(/\s*```$/i, "").trim() })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Asset generation failed." }, { status: 500 }) }
}

export async function GET(request: Request) {
  const u = new URL(request.url); const action = u.searchParams.get("action"); const apiKey = key()
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 503 })
  if (action === "video-status") return NextResponse.json(await videoStatus(apiKey, u.searchParams.get("operation") || ""))
  if (action === "video-download") {
    const s = await videoStatus(apiKey, u.searchParams.get("operation") || "")
    if (!s.done) return new Response("Video is still generating.", { status: 202 })
    if (s.failed || !s.videoUri) return NextResponse.json({ error: s.error || "Video generation failed." }, { status: 500 })
    const r = await fetch(s.videoUri, { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(120000) })
    if (!r.ok) return new Response("Generated video could not be downloaded.", { status: 502 })
    return new Response(await r.arrayBuffer(), { headers: { "Content-Type": r.headers.get("content-type") || "video/mp4", "Cache-Control": "private, max-age=3600" } })
  }
  return NextResponse.json({ error: "Unsupported request." }, { status: 400 })
}