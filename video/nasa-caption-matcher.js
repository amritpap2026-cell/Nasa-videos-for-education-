/**
 * NASA Caption Matcher
 * Resolves real NASA video captions and finds timestamped matches
 * for title, description, script, and scene/visual requirements.
 */

async function fetchJson(url, label) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status}`)
  }
  return response.json()
}

function collectUrls(value, results = []) {
  if (!value) return results

  if (typeof value === "string") {
    if (/\.(?:srt|vtt)(?:$|[?#])/i.test(value)) results.push(value)
    return results
  }

  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, results)
    return results
  }

  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (/caption|subtitle|transcript/i.test(key)) collectUrls(item, results)
      else if (typeof item === "object") collectUrls(item, results)
      else if (typeof item === "string" && /\.(?:srt|vtt)(?:$|[?#])/i.test(item)) {
        results.push(item)
      }
    }
  }

  return results
}


async function getSvsCaptionFallback(nasaId) {
  // Many NASA SVS videos are surfaced through images.nasa.gov with a
  // composite ID such as GSFC_20200302_M13568_OSIRISReXBH. The same
  // video has its downloadable SRT/VTT on the NASA SVS page.
  const match = String(nasaId).match(/M(\d+)/i)
  if (!match) return null

  const svsId = match[1]
  const pageUrl = `https://svs.gsfc.nasa.gov/${svsId}/`
  const pageRes = await fetch(pageUrl)
  if (!pageRes.ok) return null

  const html = await pageRes.text()
  const links = []
  const attributePattern = /(?:href|src|data-url|data-href)=["']([^"']+)["']/gi

  for (const match of html.matchAll(attributePattern)) {
    const link = match[1].replace(/&amp;/g, "&")
    if (/\.(?:srt|vtt)(?:[?#]|$)/i.test(link)) links.push(link)
  }

  const captionUrls = [...new Set(
    links.map((link) => {
      try {
        return new URL(link, pageUrl).href
      } catch {
        return null
      }
    }).filter(Boolean)
  )]

  for (const captionUrl of captionUrls) {
    const captionRes = await fetch(captionUrl)
    if (!captionRes.ok) continue

    const text = await captionRes.text()
    if (/-->/.test(text)) {
      return {
        nasaId,
        captionUrl,
        text,
        source: "svs.gsfc.nasa.gov",
        svsId,
        pageUrl,
      }
    }
  }

  return null
}


async function getImageLibraryDetailCaptionFallback(nasaId) {
  const pageUrl = \`https://images.nasa.gov/details-\${encodeURIComponent(nasaId)}\`
  const pageRes = await fetch(pageUrl)
  if (!pageRes.ok) return null

  const html = await pageRes.text()
  const links = []
  const attributePattern = /(?:href|src|data-url|data-href)=["']([^"']+)["']/gi

  for (const match of html.matchAll(attributePattern)) {
    const link = match[1].replace(/&amp;/g, "&")
    if (/\.(?:srt|vtt)(?:[?#]|$)/i.test(link)) links.push(link)
  }

  const captionUrls = [...new Set(
    links.map((link) => {
      try {
        return new URL(link, pageUrl).href
      } catch {
        return null
      }
    }).filter(Boolean)
  )]

  for (const captionUrl of captionUrls) {
    const captionRes = await fetch(captionUrl)
    if (!captionRes.ok) continue

    const text = await captionRes.text()
    if (/-->/.test(text)) {
      return { nasaId, captionUrl, text, source: "images.nasa.gov detail page", pageUrl }
    }
  }

  return null
}

async function getNasaCaptions(nasaId) {
  if (!nasaId) throw new Error("nasaId is required")

  // NASA documents /captions/{nasa_id}, but some library assets return 404
  // there even though the downloadable detail page exposes captions.
  // Resolve the real caption file from the asset manifest as a fallback.
  const captionsEndpoint = `https://images-api.nasa.gov/captions/${encodeURIComponent(nasaId)}`
  const locationRes = await fetch(captionsEndpoint)

  if (locationRes.ok) {
    const locationData = await locationRes.json()
    const captionUrl = locationData.location

    if (captionUrl) {
      const captionRes = await fetch(captionUrl)
      if (captionRes.ok) {
        return {
          nasaId,
          captionUrl,
          text: await captionRes.text(),
        }
      }
    }
  }

  try {
    const manifest = await fetchJson(
      `https://images-api.nasa.gov/asset/${encodeURIComponent(nasaId)}`,
      "NASA asset manifest lookup"
    )

    const captionUrls = [...new Set(collectUrls(manifest))]
    for (const captionUrl of captionUrls) {
      const captionRes = await fetch(captionUrl)
      if (!captionRes.ok) continue

      const text = await captionRes.text()
      if (/-->/.test(text)) {
        return { nasaId, captionUrl, text, source: "images.nasa.gov" }
      }
    }
  } catch {}

  const detailFallback = await getImageLibraryDetailCaptionFallback(nasaId)
  if (detailFallback) return detailFallback

  const svsFallback = await getSvsCaptionFallback(nasaId)
  if (svsFallback) return svsFallback

  throw new Error(\`NASA caption lookup failed for \${nasaId}: no readable SRT/VTT found in captions API, asset manifest, detail page, or NASA SVS\`)
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
    const cueText = lines
      .slice(timingIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim()

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
