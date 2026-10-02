/**
 * NASA Caption Matcher
 * Resolves real NASA video captions and finds timestamped matches
 * for title, description, script, and scene/visual requirements.
 */

async function getNasaCaptions(nasaId) {
  if (!nasaId) throw new Error("nasaId is required")

  const locationRes = await fetch(
    `https://images-api.nasa.gov/captions/${encodeURIComponent(nasaId)}`
  )

  if (!locationRes.ok) {
    throw new Error(`NASA captions lookup failed: ${locationRes.status}`)
  }

  const locationData = await locationRes.json()
  const captionUrl = locationData.location

  if (!captionUrl) {
    throw new Error(`No captions available for NASA asset: ${nasaId}`)
  }

  const captionRes = await fetch(captionUrl)
  if (!captionRes.ok) {
    throw new Error(`NASA caption file fetch failed: ${captionRes.status}`)
  }

  return {
    nasaId,
    captionUrl,
    text: await captionRes.text(),
  }
}

function timestampToSeconds(value) {
  const normalized = value.trim().replace(",", ".")
  const parts = normalized.split(":").map(Number)

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }

  return Number(normalized) || 0
}

function parseCaptionFile(text) {
  const normalized = text.replace(/\r/g, "").trim()
  if (!normalized) return []

  const blocks = normalized.split(/\n\s*\n/)
  const cues = []

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean)
    if (!lines.length) continue

    const timingIndex = lines.findIndex((line) => line.includes("-->"))
    if (timingIndex === -1) continue

    const timing = lines[timingIndex]
    const [startRaw, endRaw] = timing.split("-->").map((part) => part.trim())
    if (!startRaw || !endRaw) continue

    const cleanTime = (value) => value.split(/\s+/)[0]
    const start = timestampToSeconds(cleanTime(startRaw))
    const end = timestampToSeconds(cleanTime(endRaw))
    const cueText = lines.slice(timingIndex + 1).join(" ").replace(/<[^>]+>/g, "").trim()

    if (!cueText || end <= start) continue

    cues.push({
      start,
      end,
      duration: Number((end - start).toFixed(3)),
      text: cueText,
    })
  }

  return cues
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function keywords(text) {
  const stopWords = new Set([
    "about", "after", "also", "because", "being", "between", "could",
    "from", "have", "into", "more", "other", "that", "their", "there",
    "these", "they", "this", "those", "through", "what", "when", "where",
    "which", "while", "with", "would", "your", "the", "and", "for",
    "are", "was", "were", "has", "had", "how", "why", "its", "our",
    "you", "can", "will", "than", "then", "them", "not", "but", "does",
    "doesn", "is", "in", "of", "to", "a", "an", "on", "as", "at", "by"
  ])

  return [...new Set(
    normalizeText(text)
      .split(" ")
      .filter((word) => word.length >= 4 && !stopWords.has(word))
  )]
}

function scoreCaptionCue(cue, context) {
  const cueWords = new Set(keywords(cue.text))
  const contextWords = keywords([
    context.title,
    context.description,
    context.script,
    context.scene,
    context.visualRequirement,
  ].filter(Boolean).join(" "))

  if (!cueWords.size || !contextWords.length) return 0

  let matches = 0
  for (const word of contextWords) {
    if (cueWords.has(word)) matches += 1
  }

  return Number((matches / Math.max(1, Math.min(contextWords.length, 12))).toFixed(4))
}

function findCaptionMatches(cues, context, options = {}) {
  const minimumScore = options.minimumScore ?? 0.08
  const limit = options.limit ?? 5

  return cues
    .map((cue) => ({
      ...cue,
      score: scoreCaptionCue(cue, context),
    }))
    .filter((cue) => cue.score >= minimumScore)
    .sort((a, b) => b.score - a.score || a.start - b.start)
    .slice(0, limit)
}

async function matchNasaCaptions(nasaId, context, options = {}) {
  const captions = await getNasaCaptions(nasaId)
  const cues = parseCaptionFile(captions.text)
  const matches = findCaptionMatches(cues, context, options)

  return {
    nasaId,
    captionUrl: captions.captionUrl,
    cueCount: cues.length,
    matches,
    audio: false,
    source: "images.nasa.gov",
  }
}

module.exports = {
  getNasaCaptions,
  parseCaptionFile,
  findCaptionMatches,
  matchNasaCaptions,
}

if (require.main === module) {
  const [nasaId, ...queryParts] = process.argv.slice(2)
  if (!nasaId || !queryParts.length) {
    throw new Error("Usage: node video/nasa-caption-matcher.js <nasaId> <target text>")
  }

  matchNasaCaptions(nasaId, { script: queryParts.join(" ") })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
