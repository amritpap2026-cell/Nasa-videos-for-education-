/**
 * NASA Multi-Clip Extractor
 * Extracts multiple caption-matched timestamp windows from NASA videos.
 * Every output clip is muted and stored as a separate MP4.
 */

const fs = require("fs")
const path = require("path")
const { extractNasaClip } = require("./nasa-clip-extractor")

async function extractMultipleNasaClips(matches, options = {}) {
  if (!Array.isArray(matches) || !matches.length) {
    throw new Error("matches must contain at least one caption match")
  }

  const outputDir = options.outputDir || path.join("tmp", "nasa-clips")
  fs.mkdirSync(outputDir, { recursive: true })

  const results = []

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]

    if (!match?.nasaId) {
      results.push({
        index: index + 1,
        status: "failed",
        error: "Missing nasaId",
      })
      continue
    }

    if (match.start === undefined || match.end === undefined) {
      results.push({
        index: index + 1,
        nasaId: match.nasaId,
        status: "failed",
        error: "Missing start/end timestamp",
      })
      continue
    }

    const safeId = String(match.nasaId).replace(/[^a-zA-Z0-9_-]/g, "_")
    const outputPath = path.join(
      outputDir,
      `clip_${String(index + 1).padStart(3, "0")}_${safeId}.mp4`
    )

    try {
      const clip = await extractNasaClip({
        nasaId: match.nasaId,
        start: Number(match.start),
        end: Number(match.end),
        outputPath,
      })

      results.push({
        index: index + 1,
        status: "success",
        ...clip,
        captionText: match.text || null,
        score: match.score ?? null,
      })
    } catch (error) {
      results.push({
        index: index + 1,
        nasaId: match.nasaId,
        start: Number(match.start),
        end: Number(match.end),
        status: "failed",
        error: error.message,
      })
    }
  }

  return {
    count: results.length,
    successful: results.filter((item) => item.status === "success").length,
    failed: results.filter((item) => item.status === "failed").length,
    audio: false,
    clips: results,
  }
}

module.exports = { extractMultipleNasaClips }

if (require.main === module) {
  const [matchesFile, outputDir] = process.argv.slice(2)

  if (!matchesFile) {
    throw new Error(
      "Usage: node video/nasa-multi-clip-extractor.js <matches.json> [outputDir]"
    )
  }

  const matches = JSON.parse(fs.readFileSync(matchesFile, "utf8"))

  extractMultipleNasaClips(matches, { outputDir })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
