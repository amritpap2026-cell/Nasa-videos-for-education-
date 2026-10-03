/**
 * NASA Scene Clip Engine
 *
 * Connects the real caption matcher to the real clip extractor:
 * candidate NASA videos + educational scene context
 * -> caption timestamps
 * -> short muted MP4 clips.
 */

const fs = require("fs")
const path = require("path")
const { matchNasaCaptions } = require("./nasa-caption-matcher")
const { extractMultipleNasaClips } = require("./nasa-multi-clip-extractor")

async function buildSceneClips(candidates, context, options = {}) {
  if (!Array.isArray(candidates) || !candidates.length) {
    throw new Error("candidates must contain at least one NASA video")
  }

  const matchOptions = {
    minimumScore: options.minimumScore ?? 0.08,
    limit: options.matchesPerVideo ?? 2,
  }

  const matchedVideos = []

  for (const candidate of candidates) {
    if (!candidate?.nasaId) continue

    try {
      const result = await matchNasaCaptions(
        candidate.nasaId,
        {
          title: candidate.title || context.title,
          description: candidate.description || context.description,
          script: context.script,
          scene: context.scene,
          visualRequirement: context.visualRequirement,
        },
        matchOptions
      )

      matchedVideos.push({
        ...candidate,
        captionUrl: result.captionUrl,
        cueCount: result.cueCount,
        matches: result.matches,
        source: result.source,
      })
    } catch (error) {
      matchedVideos.push({
        ...candidate,
        matches: [],
        error: error.message,
      })
    }
  }

  const extractionMatches = matchedVideos.flatMap((video) =>
    video.matches.map((match) => ({
      nasaId: video.nasaId,
      start: match.start,
      end: match.end,
      text: match.text,
      score: match.score,
    }))
  )

  const clips = extractionMatches.length
    ? await extractMultipleNasaClips(extractionMatches, {
        outputDir: options.outputDir || path.join("tmp", "nasa-scene-clips"),
      })
    : {
        count: 0,
        successful: 0,
        failed: 0,
        audio: false,
        clips: [],
      }

  return {
    context,
    candidateCount: candidates.length,
    matchedVideoCount: matchedVideos.filter((video) => video.matches.length).length,
    matchedVideos,
    ...clips,
  }
}

module.exports = { buildSceneClips }

if (require.main === module) {
  const [inputFile, outputDir] = process.argv.slice(2)

  if (!inputFile) {
    throw new Error(
      "Usage: node video/nasa-scene-clip-engine.js <scene.json> [outputDir]"
    )
  }

  const input = JSON.parse(fs.readFileSync(inputFile, "utf8"))

  buildSceneClips(input.candidates, input.context, { outputDir })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
