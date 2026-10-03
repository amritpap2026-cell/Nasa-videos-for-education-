/**
 * NASA Visual Diversity + Reuse Tracker
 *
 * Keeps a lightweight JSON history of NASA assets used by episodes/scenes.
 * Selection prefers assets that have never been used, then assets used less
 * often and less recently.
 */

const fs = require("fs")
const path = require("path")

function loadHistory(historyPath) {
  if (!fs.existsSync(historyPath)) {
    return { version: 1, assets: {} }
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(historyPath, "utf8"))
    return {
      version: parsed.version || 1,
      assets: parsed.assets || {},
    }
  } catch {
    return { version: 1, assets: {} }
  }
}

function saveHistory(historyPath, history) {
  fs.mkdirSync(path.dirname(historyPath), { recursive: true })
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + "\n")
}

function scoreCandidate(candidate, history, now = Date.now()) {
  const record = history.assets[candidate.nasaId]

  if (!record) return 100

  const timesUsed = Number(record.timesUsed || 0)
  const lastUsed = record.lastUsed ? new Date(record.lastUsed).getTime() : 0
  const daysSinceUse = lastUsed
    ? Math.max(0, (now - lastUsed) / 86400000)
    : 9999

  // Never-used assets are handled above. For reused assets:
  // fewer uses and longer time since use receive higher scores.
  return 50 - timesUsed * 10 + Math.min(daysSinceUse, 30)
}

function rankDiverseCandidates(candidates, history, options = {}) {
  const limit = options.limit ?? candidates.length
  const now = options.now ?? Date.now()
  const selectedIds = new Set()
  const ranked = []

  for (const candidate of candidates) {
    if (!candidate?.nasaId || selectedIds.has(candidate.nasaId)) continue

    const reuseScore = scoreCandidate(candidate, history, now)
    const relevanceScore = Number(candidate.score || 0) * 10

    ranked.push({
      ...candidate,
      diversityScore: Number((reuseScore + relevanceScore).toFixed(4)),
      timesUsed: history.assets[candidate.nasaId]?.timesUsed || 0,
    })
  }

  ranked.sort((a, b) =>
    b.diversityScore - a.diversityScore ||
    a.timesUsed - b.timesUsed ||
    String(a.nasaId).localeCompare(String(b.nasaId))
  )

  return ranked.slice(0, limit)
}

function recordUsage(history, clips, episodeId = "unknown") {
  const usedAt = new Date().toISOString()

  for (const clip of clips) {
    if (!clip?.nasaId) continue

    const previous = history.assets[clip.nasaId] || {
      timesUsed: 0,
      firstUsed: usedAt,
      lastUsed: null,
      episodes: [],
      clips: [],
    }

    previous.timesUsed += 1
    previous.lastUsed = usedAt

    if (!previous.episodes.includes(episodeId)) {
      previous.episodes.push(episodeId)
    }

    previous.clips.push({
      episodeId,
      start: clip.start,
      end: clip.end,
      duration: clip.duration,
      usedAt,
    })

    // Keep history useful without growing forever.
    if (previous.clips.length > 100) {
      previous.clips = previous.clips.slice(-100)
    }
    if (previous.episodes.length > 50) {
      previous.episodes = previous.episodes.slice(-50)
    }

    history.assets[clip.nasaId] = previous
  }
}

function chooseDiverseCandidates(candidates, options = {}) {
  const historyPath =
    options.historyPath || path.join("tmp", "nasa-visual-history.json")
  const history = loadHistory(historyPath)

  const selected = rankDiverseCandidates(
    candidates,
    history,
    options
  )

  return {
    historyPath,
    selected,
    history,
  }
}

function recordSelectedUsage(clips, episodeId, options = {}) {
  const historyPath =
    options.historyPath || path.join("tmp", "nasa-visual-history.json")
  const history = loadHistory(historyPath)

  recordUsage(history, clips, episodeId)
  saveHistory(historyPath, history)

  return history
}

module.exports = {
  loadHistory,
  saveHistory,
  scoreCandidate,
  rankDiverseCandidates,
  recordUsage,
  chooseDiverseCandidates,
  recordSelectedUsage,
}

if (require.main === module) {
  const [candidatesFile, historyPath] = process.argv.slice(2)

  if (!candidatesFile) {
    throw new Error(
      "Usage: node video/nasa-visual-diversity.js <candidates.json> [history.json]"
    )
  }

  const candidates = JSON.parse(fs.readFileSync(candidatesFile, "utf8"))
  const result = chooseDiverseCandidates(candidates, { historyPath })

  console.log(JSON.stringify({
    historyPath: result.historyPath,
    selected: result.selected,
  }, null, 2))
}
