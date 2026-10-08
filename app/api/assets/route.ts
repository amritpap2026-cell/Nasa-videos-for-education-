import { NextResponse } from "next/server"

export const maxDuration = 300

const IMAGE_MODELS = [
  "gemini-3.1-flash-image",
  "gemini-2.5-flash-image",
  "gemini-3-pro-image",
]
const VIDEO_MODELS = [
  "gemini-omni-1.1-flash",
  "veo-3.1-generate-preview",
]
const CLOUDFLARE_IMAGE_MODELS = [
  "@cf/stabilityai/stable-diffusion-xl-base-1.0",
  "@cf/bytedance/stable-diffusion-xl-lightning",
]
const HF_IMAGE_MODEL = "black-forest-labs/FLUX.1-schnell"
const POLLINATIONS_IMAGE_MODEL = "black-forest-labs/flux.1-schnell"
const POLLINATIONS_VIDEO_MODEL = "google/veo-3.1-fast"
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

function cloudflareConfig() {
  return {
    account: (process.env.CLOUDFLARE_ACCOUNT_ID || "").trim(),
    token: (process.env.CLOUDFLARE_API_TOKEN || "").trim(),
  }
}
function pollinationsKey() { return (process.env.POLLINATIONS_API_KEY || "").trim() }
function hfToken() { return (process.env.HF_TOKEN || "").trim() }
function json2videoKey() { return (process.env.JSON2VIDEO_API_KEY || "").trim() }
function toBase64(bytes: ArrayBuffer) { return Buffer.from(bytes).toString("base64") }
async function providerError(r: Response) {
  const d = await r.json().catch(() => ({}))
  return d?.error?.message || d?.message || d?.error || "HTTP " + r.status
}

async function cloudflareImageGenerate(prompt: string) {
  const cfg = cloudflareConfig()
  if (!cfg.account || !cfg.token) throw new Error("Cloudflare image provider is not configured.")
  let lastError = "Cloudflare image generation failed."
  for (const model of CLOUDFLARE_IMAGE_MODELS) {
    try {
      const r = await fetch("https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(cfg.account) + "/ai/run/" + encodeURIComponent(model), {
        method: "POST",
        headers: { Authorization: "Bearer " + cfg.token, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: AbortSignal.timeout(120000),
      })
      const ct = r.headers.get("content-type") || ""
      if (!r.ok) { lastError = await providerError(r); continue }
      if (ct.startsWith("image/")) return { kind: "image", data: toBase64(await r.arrayBuffer()), mimeType: ct.split(";")[0] || "image/png", model: "Cloudflare/" + model }
      const d = await r.json().catch(() => ({}))
      const result = d?.result
      const data = typeof result === "string" ? result : result?.image || result?.data || result?.b64_json || result?.output
      if (data) return { kind: "image", data, mimeType: result?.mimeType || result?.mime_type || "image/png", model: "Cloudflare/" + model }
      lastError = "Cloudflare model " + model + " returned no image."
    } catch (e) { lastError = e instanceof Error ? e.message : "Cloudflare image model failed." }
  }
  throw new Error(lastError)
}

async function huggingFaceImageGenerate(prompt: string) {
  const token = hfToken()
  if (!token) throw new Error("Hugging Face image provider is not configured.")
  const r = await fetch("https://router.huggingface.co/hf-inference/models/" + encodeURIComponent(HF_IMAGE_MODEL), {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: prompt }),
    signal: AbortSignal.timeout(120000),
  })
  if (!r.ok) throw new Error(await providerError(r))
  return { kind: "image", data: toBase64(await r.arrayBuffer()), mimeType: (r.headers.get("content-type") || "image/png").split(";")[0], model: "HuggingFace/" + HF_IMAGE_MODEL }
}

async function pollinationsImageGenerate(prompt: string) {
  const token = pollinationsKey()
  if (!token) throw new Error("Pollinations image provider is not configured.")
  const url = "https://gen.pollinations.ai/image/" + encodeURIComponent(prompt) + "?model=" + encodeURIComponent(POLLINATIONS_IMAGE_MODEL) + "&width=1280&height=720&nologo=true"
  const r = await fetch(url, { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(120000) })
  if (!r.ok) throw new Error(await providerError(r))
  return { kind: "image", data: toBase64(await r.arrayBuffer()), mimeType: (r.headers.get("content-type") || "image/jpeg").split(";")[0], model: "Pollinations/" + POLLINATIONS_IMAGE_MODEL }
}

async function pollinationsVideoStart(prompt: string) {
  const token = pollinationsKey()
  if (!token) throw new Error("Pollinations video provider is not configured.")
  const url = "https://gen.pollinations.ai/video/" + encodeURIComponent(prompt) + "?model=" + encodeURIComponent(POLLINATIONS_VIDEO_MODEL) + "&duration=5"
  return { kind: "video", operation: "pollinations:" + Buffer.from(url).toString("base64url"), model: "Pollinations/" + POLLINATIONS_VIDEO_MODEL }
}

async function json2VideoStart(prompt: string) {
  const token = json2videoKey()
  if (!token || !pollinationsKey()) throw new Error("JSON2Video fallback requires JSON2VIDEO_API_KEY and POLLINATIONS_API_KEY.")
  const imageUrl = "https://gen.pollinations.ai/image/" + encodeURIComponent(prompt) + "?model=" + encodeURIComponent(POLLINATIONS_IMAGE_MODEL) + "&width=1280&height=720&nologo=true"
  const r = await fetch("https://api.json2video.com/v2/movies", {
    method: "POST",
    headers: { "x-api-key": token, "Content-Type": "application/json" },
    body: JSON.stringify({ resolution: "full-hd", scenes: [{ duration: 6, elements: [
      { type: "image", src: imageUrl, duration: 6, zoom: 2, pan: "right" },
      { type: "text", text: "NASA EDUCATION", position: "top-left", duration: 6 },
    ] }] }),
    signal: AbortSignal.timeout(30000),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d?.project) throw new Error(d?.message || "JSON2Video render could not be started.")
  return { kind: "video", operation: "json2video:" + d.project, model: "JSON2Video" }
}

async function imageGenerate(apiKey: string, prompt: string, thumbnail: boolean) {
  const providers: Array<[string, () => Promise<any>]> = []
  if (apiKey) providers.push(["Gemini", () => geminiImageGenerate(apiKey, prompt, thumbnail)])
  if (cloudflareConfig().account && cloudflareConfig().token) providers.push(["Cloudflare", () => cloudflareImageGenerate(prompt)])
  if (hfToken()) providers.push(["HuggingFace", () => huggingFaceImageGenerate(prompt)])
  if (pollinationsKey()) providers.push(["Pollinations", () => pollinationsImageGenerate(prompt)])
  if (!providers.length) throw new Error("No image provider is configured.")
  const errors: string[] = []
  for (const [name, generate] of providers) {
    try { return await generate() }
    catch (e) { errors.push(name + ": " + (e instanceof Error ? e.message : "failed")) }
  }
  throw new Error("All image providers failed. " + errors.join(" | "))
}
async function videoStart(apiKey: string, prompt: string) {
  const errors: string[] = []
  if (apiKey) {
    try { return await geminiVideoStart(apiKey, prompt) }
    catch (e) { errors.push("Gemini: " + (e instanceof Error ? e.message : "failed")) }
  }
  if (pollinationsKey()) {
    try { return await pollinationsVideoStart(prompt) }
    catch (e) { errors.push("Pollinations: " + (e instanceof Error ? e.message : "failed")) }
  }
  if (json2videoKey() && pollinationsKey()) {
    try { return await json2VideoStart(prompt) }
    catch (e) { errors.push("JSON2Video: " + (e instanceof Error ? e.message : "failed")) }
  }
  throw new Error(errors.length ? "All video providers failed. " + errors.join(" | ") : "No video provider is configured.")
}
async function videoStatus(apiKey: string, operation: string) {
  if (operation.startsWith("gemini:")) return geminiVideoStatus(apiKey, operation.slice("gemini:".length))
  if (operation.startsWith("pollinations:")) return { done: true, failed: false, error: "", videoUri: Buffer.from(operation.slice("pollinations:".length), "base64url").toString("utf8") }
  if (operation.startsWith("json2video:")) {
    const token = json2videoKey()
    if (!token) throw new Error("JSON2VIDEO_API_KEY is not configured.")
    const r = await fetch("https://api.json2video.com/v2/movies?project=" + encodeURIComponent(operation.slice("json2video:".length)), { headers: { "x-api-key": token }, cache: "no-store", signal: AbortSignal.timeout(30000) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d?.message || "Could not check JSON2Video.")
    const movie = d?.movie || {}
    return { done: movie.status === "done", failed: movie.status === "error" || movie.status === "timeout", error: movie.message || "", videoUri: movie.url || "" }
  }
  throw new Error("Unknown video operation.")
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
    const operation = u.searchParams.get("operation") || ""
    const s = await videoStatus(apiKey, operation)
    if (!s.done) return new Response("Video is still generating.", { status: 202 })
    if (s.failed || !s.videoUri) return NextResponse.json({ error: s.error || "Video generation failed." }, { status: 500 })
    const headers: Record<string, string> = {}
    if (operation.startsWith("gemini:")) headers["x-goog-api-key"] = apiKey
    if (operation.startsWith("pollinations:")) headers.Authorization = "Bearer " + pollinationsKey()
    const r = await fetch(s.videoUri, { headers, signal: AbortSignal.timeout(120000) })
    if (!r.ok) return new Response("Generated video could not be downloaded.", { status: 502 })
    return new Response(await r.arrayBuffer(), { headers: { "Content-Type": r.headers.get("content-type") || "video/mp4", "Cache-Control": "private, max-age=3600" } })
  }
  return NextResponse.json({ error: "Unsupported request." }, { status: 400 })
}