/**
 * NASA Scene Clip Engine
 *
 * Connects NASA candidate selection, reuse-aware diversity, caption matching,
 * and real muted clip extraction.
 */

const fs = require("fs")
const path = require("path")
const { matchNasaCaptions } = require("./nasa-caption-matcher")
const { extractMultipleNasaClips } = require("./nasa-multi-clip-extractor")
const {
  chooseDiverseCandidates,
  recordSelectedUsage,
} = require("./nasa-visual-diversity")

async function buildSceneClips(candidates, context, options = {}) {
  if (!Array.isArray(candidates) || !candidates.length) {
    throw new Error("candidates must contain at least one NASA video")
  }

  const historyPath =
    options.historyPath || path.join("tmp", "nasa-visual-history.json")

  const selectedCandidates = chooseDiverseCandidates(candidates, {
    historyPath,
    limit: options.candidateLimit ?? candidates.length,
  }).selected

  const matchOptions = {
    minimumScore: options.minimumScore ?? 0.08,
    limit: options.matchesPerVideo ?? 2,
  }

  const matchedVideos = []

  for (const candidate of selectedCandidates) {
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

  // Keep at most one caption match per source video for scene-level diversity.
  // A later scene can still reuse the same NASA asset after the history penalty.
  const extractionMatches = matchedVideos
    .filter((video) => video.matches.length)
    .map((video) => {
      const match = video.matches[0]
      return {
        nasaId: video.nasaId,
        start: match.start,
        end: match.end,
        text: match.text,
        score: match.score,
      }
    })

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

  const successfulClips = clips.clips.filter(
    (clip) => clip.status === "success"
  )

  if (successfulClips.length) {
    recordSelectedUsage(
      successfulClips,
      options.episodeId || "unknown-episode",
      { historyPath }
    )
  }

  return {
    context,
    candidateCount: candidates.length,
    selectedCandidateCount: selectedCandidates.length,
    matchedVideoCount: matchedVideos.filter((video) => video.matches.length).length,
    matchedVideos,
    historyPath,
    ...clips,
  }
}

module.exports = { buildSceneClips }

if (require.main === module) {
  const [inputFile, outputDir, historyPath, episodeId] = process.argv.slice(2)

  if (!inputFile) {
    throw new Error(
      "Usage: node video/nasa-scene-clip-engine.js <scene.json> [outputDir] [history.json] [episodeId]"
    )
  }

  const input = JSON.parse(fs.readFileSync(inputFile, "utf8"))

  buildSceneClips(input.candidates, input.context, {
    outputDir,
    historyPath,
    episodeId,
  })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
