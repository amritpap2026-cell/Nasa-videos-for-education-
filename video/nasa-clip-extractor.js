/**
 * NASA Clip Extractor
 * Resolves a real NASA/SVS video URL and extracts a short muted clip
 * around a caption timestamp.
 */

const fs = require("fs")
const path = require("path")
const { execFileSync } = require("child_process")

async function fetchJson(url, label) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${label} failed: ${res.status}`)
  return res.json()
}

async function resolveVideoUrl(nasaId) {
  try {
    const manifest = await fetchJson(
      `https://images-api.nasa.gov/asset/${encodeURIComponent(nasaId)}`,
      "NASA asset manifest lookup"
    )

    const files = manifest.collection?.items || []
    const video = files
      .map((item) => item.href)
      .filter(Boolean)
      .find((url) => /\.(?:mp4|mov|webm)(?:[?#]|$)/i.test(url))

    if (video) return { videoUrl: video, source: "images.nasa.gov" }
  } catch {}

  const idMatch = String(nasaId).match(/M(\d+)/i)
  if (!idMatch) throw new Error(`Cannot derive NASA SVS ID from ${nasaId}`)

  const svsId = idMatch[1]
  const data = await fetchJson(
    `https://svs.gsfc.nasa.gov/api/search/?q=${encodeURIComponent(svsId)}`,
    "NASA SVS search"
  )

  const results = data.results || []
  const exact = results.find((item) => String(item.id) === String(svsId))
  const candidate = exact || results[0]
  const videoUrl = candidate?.main_video?.url || null

  if (!videoUrl) {
    throw new Error(`No downloadable NASA/SVS video URL found for ${nasaId}`)
  }

  return {
    videoUrl,
    source: "svs.gsfc.nasa.gov",
    svsId,
    title: candidate.title || null,
  }
}

function clampClipWindow(start, end, maxDuration = 5, minDuration = 2) {
  const cueStart = Math.max(0, Number(start))
  const cueEnd = Math.max(cueStart, Number(end))
  const cueDuration = cueEnd - cueStart

  let duration = Math.min(maxDuration, Math.max(minDuration, cueDuration))
  let clipStart = cueStart

  if (cueDuration >= minDuration) {
    duration = Math.min(maxDuration, cueDuration)
  } else {
    const center = (cueStart + cueEnd) / 2
    clipStart = Math.max(0, center - duration / 2)
  }

  return {
    start: Number(clipStart.toFixed(3)),
    duration: Number(duration.toFixed(3)),
    end: Number((clipStart + duration).toFixed(3)),
  }
}

function extractMutedClip(videoUrl, window, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-ss", String(window.start),
      "-i", videoUrl,
      "-t", String(window.duration),
      "-an",
      "-map", "0:v:0",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-movflags", "+faststart",
      outputPath,
    ],
    { stdio: "inherit" }
  )

  return outputPath
}

async function extractNasaClip({
  nasaId,
  start,
  end,
  outputPath = path.join("tmp", "nasa-clips", `${nasaId}-clip.mp4`),
}) {
  if (!nasaId) throw new Error("nasaId is required")

  const resolved = await resolveVideoUrl(nasaId)
  const window = clampClipWindow(start, end)
  const file = extractMutedClip(resolved.videoUrl, window, outputPath)

  return {
    nasaId,
    source: resolved.source,
    videoUrl: resolved.videoUrl,
    start: window.start,
    end: window.end,
    duration: window.duration,
    audio: false,
    outputPath: file,
  }
}

module.exports = {
  resolveVideoUrl,
  clampClipWindow,
  extractMutedClip,
  extractNasaClip,
}

if (require.main === module) {
  const [nasaId, start, end, outputPath] = process.argv.slice(2)

  if (!nasaId || start === undefined || end === undefined) {
    throw new Error(
      "Usage: node video/nasa-clip-extractor.js <nasaId> <startSeconds> <endSeconds> [outputPath]"
    )
  }

  extractNasaClip({
    nasaId,
    start: Number(start),
    end: Number(end),
    outputPath,
  })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
