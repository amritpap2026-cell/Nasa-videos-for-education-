"use client"

import { useEffect, useState } from "react"
import { ArrowRight, Check, Film, Globe2, Image as ImageIcon, Lightbulb, Search, Sparkles, Video, Volume2, X } from "lucide-react"

type Result = { text: string; model: string; notice?: string }

type StudioTimelineItem = {
  sceneId: string
  finalStart: string
  finalEnd: string
  duration: number
  narrationRange: string
  visualType: string
  assetId: string
  visualStart: string
  visualEnd: string
  sourceStart: string
  sourceEnd: string
  motionGraphicStart: string
  motionGraphicEnd: string
  onScreenTextStart: string
  onScreenTextEnd: string
  planned: boolean
}

type StudioAsset = {
  id: string
  type: string
  url: string
  name: string
  createdAt: string
  selected?: boolean
  operation?: string
  sceneIds?: string[]
  finalStart?: string
  finalEnd?: string
  sourceStart?: string
  sourceEnd?: string
}

type StudioProject = {
  id: string
  createdAt: string
  updatedAt: string
  topic: string
  language: string
  gradeLevel: string
  length: string
  packageType: string
  status: "draft" | "generating" | "assets-ready" | "review" | "ready-to-publish" | "published"
  targetYouTubeChannelId: string
  targetYouTubeChannelTitle: string
  research: string
  script: string
  storyboard: string
  timeline: StudioTimelineItem[]
  voiceoverUrl: string
  voiceoverDurationSeconds: number
  timelineFinalizedAt: string
  youtube: {
    title: string
    description: string
    tags: string[]
    thumbnailUrl: string
    captionsUrl: string
    playlistId: string
  }
  assets: StudioAsset[]
  audit: string
}

type VisualItem = {
  source: string
  title: string
  url: string
  pageUrl?: string
  mediaType?: string
  description?: string
}

const voiceLanguages = [
  { label: "English", code: "en-US" },
  { label: "हिन्दी", code: "hi-IN" },
  { label: "नेपाली", code: "ne-NP" },
]

export default function CosmosStudio() {
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState("")
  const [language, setLanguage] = useState("English")
  const [gradeLevel, setGradeLevel] = useState("General public")
  const [length, setLength] = useState("10")
  const [packageType, setPackageType] = useState("youtube")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const [ideas, setIdeas] = useState<string[]>([])
  const [ideasLoading, setIdeasLoading] = useState(false)
  const [voiceLanguage, setVoiceLanguage] = useState("en-US")
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState("")
  const [voiceoverUsed, setVoiceoverUsed] = useState(false)
  const [storyText, setStoryText] = useState("")
  const [packageDone, setPackageDone] = useState(false)
  const [generationMode, setGenerationMode] = useState<"master" | "scriptwriter">("master")
  const [assetOpen, setAssetOpen] = useState(false)
  const [assetType, setAssetType] = useState<"image" | "video" | "thumbnail" | "seo" | "motion">("image")
  const [assetLoading, setAssetLoading] = useState(false)
  const [assetText, setAssetText] = useState("")
  const [assetPrompt, setAssetPrompt] = useState("")
  const [assetOutput, setAssetOutput] = useState("")
  const [assetOperation, setAssetOperation] = useState("")
  const [assetSelected, setAssetSelected] = useState(false)
  const [assetCount, setAssetCount] = useState(1)
  const [assetOutputs, setAssetOutputs] = useState<Array<{ index: number; url: string; operation?: string; error?: string }>>([])
  const [youtubeStudioOpen, setYoutubeStudioOpen] = useState(false)
  const [youtubeAssets, setYoutubeAssets] = useState<Array<{ id: string; type: string; name: string; url: string; createdAt: string; sceneIds?: string[]; finalStart?: string; finalEnd?: string; sourceStart?: string; sourceEnd?: string }>>([])
  const [youtubeConnected, setYoutubeConnected] = useState(false)
  const [youtubeChannels, setYoutubeChannels] = useState<Array<{ id: string; title: string; thumbnail: string; description: string; uploadsPlaylistId: string }>>([])
  const [selectedYoutubeChannel, setSelectedYoutubeChannel] = useState("")
  const [youtubeLoading, setYoutubeLoading] = useState(false)
  const [youtubeMessage, setYoutubeMessage] = useState("")
  const [currentProject, setCurrentProject] = useState<StudioProject | null>(null)

  function createOrLoadProject(): StudioProject {
    const saved = localStorage.getItem("cosmos-current-project")
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as StudioProject
        if (parsed?.id) return parsed
      } catch {}
    }
    const now = new Date().toISOString()
    const project: StudioProject = {
      id: "project-" + Date.now().toString(36),
      createdAt: now,
      updatedAt: now,
      topic: topic.trim(),
      language,
      gradeLevel,
      length,
      packageType,
      status: "draft",
      targetYouTubeChannelId: "",
      targetYouTubeChannelTitle: "",
      research: "",
      script: "",
      storyboard: "",
      timeline: [],
      voiceoverUrl: "",
      voiceoverDurationSeconds: 0,
      timelineFinalizedAt: "",
      youtube: { title: "", description: "", tags: [], thumbnailUrl: "", captionsUrl: "", playlistId: "" },
      assets: [],
      audit: "",
    }
    localStorage.setItem("cosmos-current-project", JSON.stringify(project))
    return project
  }

  function parseTimeline(packageText: string): StudioTimelineItem[] {
    if (!packageText.trim()) return []
    const rows = packageText.split(/\r?\n/).filter((line) => line.includes("TIMELINE_ROW"))
    const parsed: StudioTimelineItem[] = []
    for (const line of rows) {
      const get = (key: string) => {
        const match = line.match(new RegExp(key + '=([^|]+)'))
        return match?.[1]?.trim().replace(/^"|"$/g, "") || ""
      }
      const start = get("final_start")
      const end = get("final_end")
      const duration = Number(get("duration")) || 0
      const sceneId = get("scene_id")
      if (!sceneId || !start || !end) continue
      parsed.push({
        sceneId,
        finalStart: start,
        finalEnd: end,
        duration,
        narrationRange: get("narration_range"),
        visualType: get("visual_type"),
        assetId: get("asset_id"),
        visualStart: get("visual_start") || start,
        visualEnd: get("visual_end") || end,
        sourceStart: get("source_start"),
        sourceEnd: get("source_end"),
        motionGraphicStart: get("motion_graphic_start"),
        motionGraphicEnd: get("motion_graphic_end"),
        onScreenTextStart: "",
        onScreenTextEnd: "",
        planned: true,
      })
    }
    return parsed
  }

  function findTimelineForPrompt(prompt: string): StudioTimelineItem[] {
    const timeline = currentProject?.timeline || parseTimeline(result?.text || "")
    if (!timeline.length) return []
    const ids = [...prompt.matchAll(/SCENE[_ -]?(\d{1,4})/gi)].map((m) => "SCENE_" + String(Number(m[1])).padStart(3, "0"))
    const matched = timeline.filter((item) => ids.includes(item.sceneId))
    return matched.length ? matched : timeline.slice(0, 1)
  }

  function timestampToSeconds(value: string) {
    const raw = String(value || "").trim()
    if (!raw) return 0
    const parts = raw.split(":").map(Number)
    if (parts.some((n) => !Number.isFinite(n))) return 0
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    return parts[0] || 0
  }

  function secondsToTimestamp(seconds: number) {
    const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
    const minutes = Math.floor(safe / 60)
    const secs = safe - minutes * 60
    return String(minutes).padStart(2, "0") + ":" + secs.toFixed(3).padStart(6, "0")
  }

  function finalizeTimelineToVoiceover(durationSeconds: number) {
    const base = currentProject || createOrLoadProject()
    const timeline = base.timeline || []
    if (!timeline.length || !durationSeconds || durationSeconds <= 0) return
    const plannedEnd = Math.max(...timeline.map((item) => timestampToSeconds(item.finalEnd)), 0)
    if (!plannedEnd) return

    // Preserve scene order and all scene-linked metadata, but make the actual
    // voiceover duration the authoritative clock for the final production.
    const scale = durationSeconds / plannedEnd
    const finalTimeline = timeline.map((item) => {
      const start = timestampToSeconds(item.finalStart) * scale
      const end = timestampToSeconds(item.finalEnd) * scale
      const visualStart = timestampToSeconds(item.visualStart || item.finalStart) * scale
      const visualEnd = timestampToSeconds(item.visualEnd || item.finalEnd) * scale
      const mgStart = item.motionGraphicStart ? timestampToSeconds(item.motionGraphicStart) * scale : 0
      const mgEnd = item.motionGraphicEnd ? timestampToSeconds(item.motionGraphicEnd) * scale : 0
      const textStart = item.onScreenTextStart ? timestampToSeconds(item.onScreenTextStart) * scale : 0
      const textEnd = item.onScreenTextEnd ? timestampToSeconds(item.onScreenTextEnd) * scale : 0
      return {
        ...item,
        finalStart: secondsToTimestamp(start),
        finalEnd: secondsToTimestamp(end),
        duration: Number((end - start).toFixed(3)),
        visualStart: secondsToTimestamp(visualStart),
        visualEnd: secondsToTimestamp(visualEnd),
        motionGraphicStart: item.motionGraphicStart ? secondsToTimestamp(mgStart) : "",
        motionGraphicEnd: item.motionGraphicEnd ? secondsToTimestamp(mgEnd) : "",
        onScreenTextStart: item.onScreenTextStart ? secondsToTimestamp(textStart) : "",
        onScreenTextEnd: item.onScreenTextEnd ? secondsToTimestamp(textEnd) : "",
        planned: false,
      }
    })

    // Retiming the final timeline also retimes final-video asset placement.
    // Source clip timestamps are intentionally preserved: they refer to the
    // original NASA/stock asset and are not part of the final-video clock.
    const finalByScene = new Map(finalTimeline.map((item) => [item.sceneId, item]))
    const finalAssets = (base.assets || []).map((asset) => {
      const sceneId = asset.sceneIds?.[0]
      const scene = sceneId ? finalByScene.get(sceneId) : undefined
      if (!scene) return asset
      return {
        ...asset,
        finalStart: scene.finalStart,
        finalEnd: scene.finalEnd,
      }
    })

    updateProject({
      timeline: finalTimeline,
      assets: finalAssets,
      voiceoverDurationSeconds: Number(durationSeconds.toFixed(3)),
      timelineFinalizedAt: new Date().toISOString(),
    })
  }

  function updateProject(patch: Partial<StudioProject>) {
    const base = currentProject || createOrLoadProject()
    const next = { ...base, ...patch, updatedAt: new Date().toISOString() }
    localStorage.setItem("cosmos-current-project", JSON.stringify(next))
    setCurrentProject(next)
    return next
  }

  function attachProjectAssets(items: StudioAsset[]) {
    const base = currentProject || createOrLoadProject()
    updateProject({ assets: [...(base.assets || []), ...items], status: "assets-ready" })
  }


  // Visuals (Step 3) — independent modal
  const [visualsOpen, setVisualsOpen] = useState(false)
  const [visualsTopic, setVisualsTopic] = useState("")
  const [visualsLoading, setVisualsLoading] = useState(false)
  const [visuals, setVisuals] = useState<VisualItem[]>([])
  const [visualNotice, setVisualNotice] = useState("")

  function loadYoutubeAssets() {
    try {
      const saved = JSON.parse(localStorage.getItem("cosmos-youtube-studio-assets") || "[]")
      setYoutubeAssets(Array.isArray(saved) ? saved : [])
    } catch { setYoutubeAssets([]) }
  }

  function saveToYoutubeStudio(items: Array<{ index: number; url: string; type?: string }>) {
    const now = new Date().toISOString()
    const additions = items.filter((item) => item.url).map((item) => ({
      id: "asset-" + Date.now() + "-" + item.index + "-" + Math.random().toString(36).slice(2, 8),
      type: item.type || assetType,
      name: (topic.trim() || "Untitled") + " — " + (item.type || assetType) + " " + item.index,
      url: item.url, createdAt: now,
    }))
    try {
      const existing = JSON.parse(localStorage.getItem("cosmos-youtube-studio-assets") || "[]")
      const next = [...(Array.isArray(existing) ? existing : []), ...additions]
      attachProjectAssets(additions.map((item) => ({
        id: item.id,
        type: item.type,
        url: item.url,
        name: item.name,
        createdAt: item.createdAt,
        selected: false,
        sceneIds: item.sceneIds,
        finalStart: item.finalStart,
        finalEnd: item.finalEnd,
        sourceStart: item.sourceStart,
        sourceEnd: item.sourceEnd,
      })))
      localStorage.setItem("cosmos-youtube-studio-assets", JSON.stringify(next))
      setYoutubeAssets(next)
      setYoutubeStudioOpen(true)
      setStatus(additions.length + " asset(s) saved to YouTube Studio.")
    } catch { setStatus("Could not save assets to YouTube Studio in this browser.") }
  }

  async function loadYoutubeChannels() {
    setYoutubeLoading(true)
    setYoutubeMessage("")
    try {
      const response = await fetch("/api/youtube/channels", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) {
        setYoutubeConnected(false)
        setYoutubeChannels([])
        if (response.status !== 401) setYoutubeMessage(data.error || "Could not load YouTube channels.")
        return
      }
      setYoutubeConnected(true)
      setYoutubeChannels(Array.isArray(data.channels) ? data.channels : [])
      const saved = localStorage.getItem("cosmos-youtube-selected-channel") || ""
      const next = data.channels?.some((channel: any) => channel.id === saved) ? saved : (data.channels?.[0]?.id || "")
      setSelectedYoutubeChannel(next)
      if (next) localStorage.setItem("cosmos-youtube-selected-channel", next)
    } catch (error) {
      setYoutubeMessage(error instanceof Error ? error.message : "Could not connect to YouTube.")
    } finally {
      setYoutubeLoading(false)
    }
  }

  function connectYoutube() {
    window.location.href = "/api/youtube/login"
  }

  function chooseYoutubeChannel(channelId: string) {
    setSelectedYoutubeChannel(channelId)
    localStorage.setItem("cosmos-youtube-selected-channel", channelId)
    const channel = youtubeChannels.find((item) => item.id === channelId)
    updateProject({
      targetYouTubeChannelId: channelId,
      targetYouTubeChannelTitle: channel?.title || "",
    })
  }

  async function disconnectYoutube() {
    await fetch("/api/youtube/logout", { method: "POST" })
    setYoutubeConnected(false)
    setYoutubeChannels([])
    setSelectedYoutubeChannel("")
    localStorage.removeItem("cosmos-youtube-selected-channel")
    setYoutubeMessage("YouTube disconnected from this browser.")
  }

  function openYoutubeStudio() {
    loadYoutubeAssets()
    setYoutubeStudioOpen(true)
    void loadYoutubeChannels()
  }
  async function brainstorm() {
    setIdeasLoading(true)
    setStatus("")
    setIdeas([])
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, language, gradeLevel, length, packageType, mode: "brainstorm" }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Topic search failed")
      setIdeas(Array.isArray(data.topics) ? data.topics : [])
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Topic search failed. Please try again.")
    } finally {
      setIdeasLoading(false)
    }
  }

  async function generate(mode: "master" | "scriptwriter") {
    setLoading(true)
    setStatus("")
    setResult(null)
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, language, length, mode }),
      })
      const data = await response.json()
      if (!response.ok) {
        const rawError = data?.error
        const message =
          typeof rawError === "string"
            ? rawError
            : rawError?.message || rawError?.detail || rawError?.code
              ? [rawError.message, rawError.detail, rawError.code].filter(Boolean).join(" — ")
              : "Generation failed. Please try again."
        throw new Error(message)
      }
      setResult(data)
      setStoryText("")
      const generatedPackage = data?.text || ""
      updateProject({
        topic: topic.trim(),
        language,
        gradeLevel,
        length,
        packageType,
        script: generatedPackage,
        storyboard: generatedPackage,
        timeline: parseTimeline(generatedPackage),
        status: "review",
      })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generation failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function openExternalTts(url: string, name: string) {
    const story = storyText.trim()
    if (!story) {
      setStatus("Extract storytelling script into the second window first.")
      return
    }
    try {
      await navigator.clipboard.writeText(story)
      window.open(url, "_blank", "noopener,noreferrer")
      setStatus(`${name} opened. The storytelling script was copied; paste it into the voice tool.`)
    } catch {
      setStatus(`Open ${name}, then copy and paste only the storytelling script.`)
      window.open(url, "_blank", "noopener,noreferrer")
    }
  }

  function extractStorytellingScript(packageText: string) {
    if (!packageText.trim()) return ""
    const text = packageText.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

    const tagged = text.match(/<<<STORYTELLING_SCRIPT_START>>>\s*([\s\S]*?)\s*<<<STORYTELLING_SCRIPT_END>>>/)
    if (tagged?.[1]?.trim()) return tagged[1].replace(/^\n+/, "").replace(/\s+$/, "")

    const lines = text.split("\n")
    const headingTest = (line: string) => {
      const compact = line.trim()
      if (!compact || compact.length > 220) return false
      return (
        /\(STORYTELLING SCRIPT\)/i.test(compact) ||
        /\bSTORYTELLING SCRIPT\b/i.test(compact) ||
        /FULL WORD-FOR-WORD SCRIPT/i.test(compact) ||
        /पूर्ण शब्द-प्रति-शब्द कथा वाचन लिपि/.test(compact) ||
        /पूर्ण शब्द-दर-शब्द स्क्रिप्ट/.test(compact) ||
        /कथात्मक स्क्रिप्ट/.test(compact) ||
        /कहानी की स्क्रिप्ट/.test(compact) ||
        /(?:PART|STEP|भाग)\s*11\b/i.test(compact)
      )
    }
    const endTest = (line: string) => {
      const compact = line.trim()
      if (!compact || compact.length > 220) return false
      return (
        /(?:PART|STEP|भाग)\s*12\b/i.test(compact) ||
        /\bSTORYBOARD\b/i.test(compact) ||
        /VIDEO OUTLINE/i.test(compact) ||
        /वीडियो रूपरेखा/.test(compact) ||
        /भिडियो रूपरेखा/.test(compact)
      )
    }

    // Prefer the stable header; numeric Part/Step labels are only a legacy fallback.
    let start = lines.findIndex((line) => /FULL WORD-FOR-WORD SCRIPT \(STORYTELLING SCRIPT\)/i.test(line) && line.trim().length < 220)
    if (start < 0) start = lines.findIndex((line) => /\(STORYTELLING SCRIPT\)/i.test(line) && line.trim().length < 220)
    if (start < 0) start = lines.findIndex(headingTest)
    if (start < 0) return ""

    let end = lines.findIndex((line, index) => index > start && endTest(line))
    const body = (end > start ? lines.slice(start + 1, end) : lines.slice(start + 1)).join("\n")
    return body.replace(/^\n+/, "").replace(/\s+$/, "")
  }

  function extractStorytellingToStoryWindow() {
    const packageText = result?.text || ""
    const script = extractStorytellingScript(packageText)
    if (!script) {
      setStatus("Could not find FULL WORD-FOR-WORD SCRIPT (STORYTELLING SCRIPT) in the generated package.")
      return
    }
    setStoryText(script)
    setStatus("The complete storytelling script was extracted into the second window.")
  }

  async function generateVoiceover() {
    if (!storyText.trim()) {
      setStatus("Add storytelling content in the story window before generating voiceover.")
      return
    }
    const storytellingScript = storyText.trim()
    setVoiceLoading(true)
    setStatus("")
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "voiceover",
          language: voiceLanguage === "hi-IN" ? "Hindi" : voiceLanguage === "ne-NP" ? "Nepali" : "English",
          script: storytellingScript,
          voice: voiceLanguage === "hi-IN" ? "Kore" : voiceLanguage === "ne-NP" ? "Puck" : "Kore",
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.audio) throw new Error(data.error || "Voiceover generation failed")
      const bytes = Uint8Array.from(atob(data.audio), (character) => character.charCodeAt(0))
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      const generatedVoiceUrl = URL.createObjectURL(new Blob([bytes], { type: data.mimeType || "audio/wav" }))
      setAudioUrl(generatedVoiceUrl)
      updateProject({ voiceoverUrl: generatedVoiceUrl, status: "assets-ready" })
      setVoiceoverUsed(false)

      // The generated audio is the authoritative clock. Read its real duration
      // in-browser, then retime every scene/visual/overlay that already carries
      // the Master Prompt timeline. The existing voice generation engine remains
      // unchanged.
      const audio = new Audio(generatedVoiceUrl)
      audio.preload = "metadata"
      audio.onloadedmetadata = () => {
        const duration = Number(audio.duration)
        if (!Number.isFinite(duration) || duration <= 0) {
          setStatus("Voiceover created, but its duration could not be measured.")
          return
        }
        finalizeTimelineToVoiceover(duration)
        setStatus("Voiceover created. Final master timeline synchronized to " + duration.toFixed(3) + " seconds.")
      }
      audio.onerror = () => {
        setStatus("Voiceover created. The audio is ready, but timeline duration could not be measured automatically.")
      }
      audio.load()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Voiceover generation failed.")
    } finally {
      setVoiceLoading(false)
    }
  }

  async function searchVisuals(query?: string) {
    const q = (query ?? visualsTopic).trim()
    if (q.length < 2) {
      setVisualNotice("Enter a topic of at least 2 characters to search.")
      return
    }
    setVisualsLoading(true)
    setVisualNotice("")
    setVisuals([])
    try {
      const response = await fetch("/api/visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: q }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Visual search failed")
      setVisuals(data.items || [])
      setVisualNotice(
        data.notice ||
          (data.items?.length
            ? `${data.source} · ${data.items.length} result${data.items.length === 1 ? "" : "s"} for “${q}”`
            : `No media found for “${q}”. Try a shorter or more specific space term.`)
      )
    } catch (error) {
      setVisualNotice(error instanceof Error ? error.message : "Visual search failed.")
    } finally {
      setVisualsLoading(false)
    }
  }

  function openCreator() {
    setOpen(true)
    setStatus("")
    setVisualsOpen(false)
  }
  function openStoryPackage() {
    setOpen(true)
    setVisualsOpen(false)
  }
  function openVoiceover() {
    setOpen(true)
    setVisualsOpen(false)
  }
  function extractProductionHeader(packageText: string, type: "image" | "video" | "thumbnail" | "seo" | "motion") {
    const text = packageText.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const headers: Record<string, string[]> = {
      image: ["AI IMAGE GENERATION PROMPTS"],
      video: ["AI VIDEO GENERATION PROMPTS"],
      thumbnail: ["THUMBNAIL CONCEPTS"],
      motion: ["MOTION GRAPHICS + DATA VISUALIZATION"],
      seo: ["TITLE + SEO PACKAGE", "DESCRIPTION + CHAPTERS + PINNED COMMENT"],
    }
    const wanted = headers[type]
    const lines = text.split("\n")
    const norm = (s: string) => s.replace(/^\s*[#*\-\d.)]+\s*/, "").trim().toUpperCase()
    const indexes = lines.map((line, i) => ({ line, i })).filter(({ line }) =>
      wanted.some((h) => norm(line).includes(h))
    )
    if (!indexes.length) return ""
    const start = indexes[0].i
    const allHeaders = [
      "RESEARCH BRIEF","STORY ANGLE","VIDEO PROMISE + AUDIENCE","FORMAT + DURATION PLAN","STORY ARCHITECTURE",
      "THREE HOOKS + SELECTED HOOK","RETENTION MAP","COMPLETE SCRIPT PLAN","FACT-CHECK + SOURCE MAP","PRODUCTION MANIFEST",
      "FULL WORD-FOR-WORD SCRIPT (STORYTELLING SCRIPT)","COMPLETE TIMESTAMPED STORYBOARD / FINAL TIMELINE",
      "AI IMAGE GENERATION PROMPTS","AI VIDEO GENERATION PROMPTS","REAL / ARCHIVAL / STOCK FOOTAGE PLAN",
      "MOTION GRAPHICS + DATA VISUALIZATION","ON-SCREEN TEXT + SUBTITLES","VOICEOVER DIRECTION","MUSIC + SOUND DESIGN",
      "EDITING + COLOR BLUEPRINT","TITLE + SEO PACKAGE","DESCRIPTION + CHAPTERS + PINNED COMMENT",
      "YOUTUBE SHORTS REPURPOSING","FINAL PRODUCTION / PUBLISHING / QC PLAN","THUMBNAIL CONCEPTS","FINAL COMPLETION AUDIT"
    ]
    const end = lines.findIndex((line, i) => i > start && allHeaders.some((h) => norm(line).includes(h)))
    return lines.slice(start, end > start ? end : lines.length).join("\n").trim()
  }

  async function generateAsset(type: "image" | "video" | "thumbnail" | "seo" | "motion") {
    setAssetType(type)
    setAssetLoading(false)
    setAssetText("")
    setAssetOutput("")
    setAssetOperation("")
    setAssetSelected(false)

    const packageText = result?.text || ""
    const headerScript = extractProductionHeader(packageText, type)
    if (headerScript) {
      setAssetPrompt(headerScript)
      setAssetText("Pasted directly from the matching production header in the main script. Edit it if needed, then Generate.")
      return
    }

    setAssetPrompt("")
    setAssetText("The main script does not contain the required " + type.toUpperCase() + " header. Regenerate with Scriptwriter or Master Prompt first.")
  }

  function saveUrl(url: string, filename: string) {
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.rel = "noopener"
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function waitForVideo(operation: string, index: number) {
    for (let attempt = 0; attempt < 120; attempt++) {
      const response = await fetch("/api/assets?action=video-status&operation=" + encodeURIComponent(operation), { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not check video status")
      if (data.failed) throw new Error(data.error || "Video generation failed")
      if (data.done && data.videoUri) {
        const url = "/api/assets?action=video-download&operation=" + encodeURIComponent(operation)
        setAssetOutputs((current) => current.map((item) => item.index === index ? { ...item, url } : item))
        saveUrl(url, "cosmos-" + assetType + "-" + index + ".mp4")
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
    throw new Error("Video generation timed out while waiting for completion.")
  }

  async function generateRealAsset() {
    if (!assetPrompt.trim()) return
    setAssetLoading(true)
    setAssetOutput("")
    setAssetOperation("")
    setAssetOutputs([])
    setAssetSelected(false)
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          assetType,
          topic: topic.trim(),
          language,
          prompt: assetPrompt.trim(),
          count: assetCount,
          package: result?.text || "",
        timeline: currentProject?.timeline || parseTimeline(result?.text || ""),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Real generation failed")

      if (data.kind === "batch") {
        const initial = (data.items || []).map((item: any) => {
          if (item.error) return { index: item.index, url: "", error: item.error }
          if (item.kind === "image") {
            const url = "data:" + (item.mimeType || "image/jpeg") + ";base64," + item.data
            saveUrl(url, "cosmos-" + assetType + "-" + item.index + ".jpg")
            return { index: item.index, url }
          }
          return { index: item.index, url: "", operation: item.operation }
        })
        setAssetOutputs(initial)
        setAssetText(
          assetType === "video"
            ? "Video batch started. Each completed video will be checked automatically and saved to your device."
            : data.count + " different " + assetType + "s generated from the same fixed prompt and saved to your device."
        )
        if (assetType === "video") {
          await Promise.all(
            initial.filter((item: any) => item.operation).map((item: any) => waitForVideo(item.operation, item.index))
          )
          setAssetText("All completed videos have been automatically saved to your device.")
        }
      } else if (data.kind === "image") {
        const url = "data:" + (data.mimeType || "image/jpeg") + ";base64," + data.data
        setAssetOutput(url)
        saveUrl(url, "cosmos-" + assetType + "-1.jpg")
        setAssetText("Generated and automatically saved.")
      } else if (data.kind === "video") {
        setAssetOperation(data.operation || "")
        setAssetText("Video generation started. It will be checked automatically and saved when ready.")
        await waitForVideo(data.operation || "", 1)
        setAssetOutput("/api/assets?action=video-download&operation=" + encodeURIComponent(data.operation || ""))
        setAssetText("Video is ready and automatically saved to your device.")
      } else if (data.kind === "motion") {
        setAssetOutput("data:image/svg+xml;charset=utf-8," + encodeURIComponent(data.svg || ""))
      } else if (data.kind === "seo") {
        setAssetOutput(data.text || "")
      }
    } catch (error) {
      setAssetText(error instanceof Error ? error.message : "Real generation failed.")
    } finally {
      setAssetLoading(false)
    }
  }

  async function checkVideoStatus() {
    if (!assetOperation) return
    setAssetLoading(true)
    try {
      await waitForVideo(assetOperation, 1)
      const url = "/api/assets?action=video-download&operation=" + encodeURIComponent(assetOperation)
      setAssetOutput(url)
      setAssetText("Video is ready and automatically saved to your device.")
    } catch (error) {
      setAssetText(error instanceof Error ? error.message : "Could not check video status.")
    } finally {
      setAssetLoading(false)
    }
  }

  function selectAsset() {
    setAssetSelected(true)
    const items = assetOutputs.length
      ? assetOutputs.map((item) => ({ index: item.index, url: item.url, type: assetType }))
      : assetOutput ? [{ index: 1, url: assetOutput, type: assetType }] : []
    if (items.length) saveToYoutubeStudio(items)
    else setStatus("Generate an asset first, then click Select.")
  }

  function openAssets(type: "image" | "video" | "thumbnail" | "seo" | "motion") {
    setAssetType(type); setAssetOpen(true); setAssetSelected(false); setAssetOutput(""); setAssetOperation(""); setAssetOutputs([]); setAssetCount(type === "seo" || type === "motion" ? 1 : 10)
    if (topic.trim().length >= 3) void generateAsset(type)
  }

  function openVisuals() {
    setVisualsTopic(topic.trim() || visualsTopic)
    setOpen(false)
    setVisualsOpen(true)
    if ((topic.trim() || visualsTopic).length >= 2) {
      searchVisuals(topic.trim() || visualsTopic)
    }
  }

  const selectedChannel = youtubeChannels.find((channel) => channel.id === selectedYoutubeChannel)

  const youtubeStudioModal = youtubeStudioOpen ? (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: 900, width: "94vw" }}>
        <div className="modal-head">
          <div><span className="eyebrow">Saved production assets</span><h2>YouTube Studio</h2><p>Assets you explicitly selected are kept here for this production.</p></div>
          <button className="icon-button" type="button" onClick={() => setYoutubeStudioOpen(false)} aria-label="Close">×</button>
        </div>
        <div style={{ marginBottom: 18, border: "1px solid #d7e9e8", borderRadius: 14, padding: 16, background: "#f7fbfb" }}>
          {!youtubeConnected ? (
            <div>
              <h3 style={{ marginTop: 0 }}>Connect your YouTube account</h3>
              <p className="field-hint">Sign in with Google. The Studio will then show the YouTube channels available to that Google account.</p>
              <button className="primary" type="button" onClick={connectYoutube} disabled={youtubeLoading}>{youtubeLoading ? "Connecting..." : "Connect YouTube"}</button>
            </div>
          ) : youtubeChannels.length === 0 ? (
            <div>
              <h3 style={{ marginTop: 0 }}>No available channels</h3>
              <p className="field-hint">The connected Google account did not return a YouTube channel that this API connection can manage.</p>
              <button className="search" type="button" onClick={() => void loadYoutubeChannels()}>Refresh channels</button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="field-label">CURRENT YOUTUBE CHANNEL</div>
                  <strong>{selectedChannel?.title || "Choose a channel"}</strong>
                  <div className="field-hint">Publishing will target this channel only.</div>
                </div>
                <button className="search" type="button" onClick={disconnectYoutube}>Disconnect</button>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor="youtube-channel-select">Target channel</label>
                <select id="youtube-channel-select" value={selectedYoutubeChannel} onChange={(event) => chooseYoutubeChannel(event.target.value)}>
                  {youtubeChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.title}</option>)}
                </select>
              </div>
              {youtubeMessage && <p className="field-hint">{youtubeMessage}</p>}
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          {youtubeAssets.length === 0 ? <div style={{ gridColumn: "1/-1" }}><h3>No saved assets yet</h3><p>Generate an image, video or thumbnail, then click <strong>Select</strong>.</p></div> :
            youtubeAssets.map((item) => <article key={item.id} style={{ border: "1px solid #d7e9e8", borderRadius: 14, padding: 10, background: "#fff" }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 7 }}>{item.type.toUpperCase()}</div>
              {item.type === "video" ? <video controls src={item.url} style={{ width: "100%", borderRadius: 9 }} /> : <img src={item.url} alt={item.name} style={{ width: "100%", borderRadius: 9 }} />}
              <div style={{ marginTop: 8, fontWeight: 650 }}>{item.name}</div><div className="field-hint">{new Date(item.createdAt).toLocaleString()}</div>
            </article>)}
        </div>
      </div>
    </div>
  ) : null

  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand">
          <span className="mark">
            <Sparkles size={18} />
          </span>{" "}
          Cosmos Studio
        </div>
        <button className="create" onClick={openYoutubeStudio} style={{ marginRight: 8 }}>YouTube Studio</button>
        <button className="create" onClick={openCreator}>
          Create new videos <ArrowRight size={15} style={{ verticalAlign: "-2px" }} />
        </button>
      </nav>

      <section className="hero">
        <div>
          <div className="eyebrow">Universal YouTube studio</div>
          <h1>
            Turn any topic into a <span>YouTube story.</span>
          </h1>
          <p>
            Research a space topic, write a complete student-friendly story, create narration, find visuals, and
            prepare a YouTube package in one focused workspace.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={openCreator}>
              Create a video <ArrowRight size={16} style={{ verticalAlign: "-3px" }} />
            </button>
            <span className="hero-note">English · हिन्दी · नेपाली</span>
          </div>
        </div>
        <div className="orbit" aria-label="Illustration of Earth in space">
          <div className="planet" />
          <i className="spark s1" />
          <i className="spark s2" />
          <i className="spark s3" />
        </div>
      </section>

      <section className="features" aria-label="Creation workflow">
        <article className="feature">
          <span className="step-number">01</span>
          <Globe2 className="icon" />
          <h3>Story package</h3>
          <p>Open the complete YouTube package and edit the storytelling script.</p>
          <button className="workflow-button" type="button" onClick={openStoryPackage} disabled={!result}>
            <span className={packageDone ? "workflow-tick" : "workflow-pending"}>
              <Check size={14} /> {packageDone ? "Story ready" : "Waiting for story"}
            </span>
          </button>
        </article>
        <article className="feature">
          <span className="step-number">02</span>
          <Lightbulb className="icon" />
          <h3>Voiceover</h3>
          <p>Open the story, listen to the generated audio, use it, or download it.</p>
          <button className="workflow-button" type="button" onClick={openVoiceover} disabled={!storyText}>
            <span className={voiceoverUsed ? "workflow-tick" : "workflow-pending"}>
              <Volume2 size={14} /> {voiceoverUsed ? "Voiceover selected" : "Open voiceover"}
            </span>
          </button>
        </article>
        <article className="feature">
          <span className="step-number">03</span>
          <Sparkles className="icon" />
          <h3>Visuals</h3>
          <p>Search relevant real/archival/stock visuals, with NASA available as a specialist source.</p>
          <button className="workflow-button" type="button" onClick={openVisuals}>
            <span className="workflow-pending">
              <Film size={14} /> Open visuals
            </span>
          </button>
        </article>
      </section>

      {/* ========== STEP 1 / 2 CREATOR MODAL ========== */}
      {open && (
        <div
          className="overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <section
            className="modal"
            style={{ maxWidth: 1120, width: "min(1120px, calc(100vw - 32px))" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="creator-title"
          >
            <div className="modal-head">
              <div>
                <div className="modal-kicker">Step 1 of 3</div>
                <h2 id="creator-title">Create your YouTube video</h2>
                <p className="muted">Set the topic, audience and runtime. You can edit the generated package before creating audio.</p>
              </div>
              <button className="close" aria-label="Close creator" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="field">
              <label htmlFor="language">Output language</label>
              <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option>English</option>
                <option>Hindi</option>
                <option>Nepali</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="topic">Topic</label>
              <div className="topic-row">
                <input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. How black holes bend time"
                  maxLength={300}
                />
                <button
                  className="search"
                  type="button"
                  onClick={brainstorm}
                  disabled={ideasLoading || topic.trim().length < 2}
                  aria-label="Search YouTube-style topics"
                >
                  {ideasLoading ? (
                    "Searching..."
                  ) : (
                    <>
                      <Search size={16} /> <span>Search this topic</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="grade-level">Audience</label>
              <select id="grade-level" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
                <option>General public</option>
                <option>Class 11–12</option>
                <option>Class 8–12</option>
              </select>
              <p className="field-hint">General public is the default audience.</p>
            </div>

            <div className="field">
              <label htmlFor="length">Video length (minutes)</label>
              <select id="length" value={length} onChange={(e) => setLength(e.target.value)}>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="30">30</option>
                <option value="60">60</option>
                <option value="90">90</option>
                <option value="120">120</option>
              </select>
            </div>

            {ideas.length > 0 && (
              <div className="ideas">
                <p className="field-label">Select a YouTube idea</p>
                {ideas.map((idea) => (
                  <button className="idea" key={idea} type="button" onClick={() => setTopic(idea)}>
                    {idea}
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
            )}

            <div className="field">
              <p className="field-label">Generation method</p>
              <p className="field-hint">Both modes use the same live research. Master Prompt follows the existing production protocol; Scriptwriter is free-form.</p>
              <div style={{ display: "grid", gap: 10 }}>
                <button type="button" onClick={() => setGenerationMode("master")} style={{ textAlign: "left", padding: 14, borderRadius: 10, border: "2px solid #16a34a", background: generationMode === "master" ? "#eaf9f0" : "white" }}>
                  <strong>Generate with master prompt</strong>
                  <span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>Research + master protocol + complete audited package</span>
                </button>
                <button type="button" onClick={() => setGenerationMode("scriptwriter")} style={{ textAlign: "left", padding: 14, borderRadius: 10, border: "2px solid #2563eb", background: generationMode === "scriptwriter" ? "#eff6ff" : "white" }}>
                  <strong>Generate via scriptwriter</strong>
                  <span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>Research + creative documentary writing for any topic and runtime</span>
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button className="generate" onClick={() => generate("master")} disabled={loading || topic.trim().length < 3}>
                {loading && generationMode === "master" ? "Generating..." : "Generate with master prompt"}
              </button>
              <button className="generate" onClick={() => generate("scriptwriter")} disabled={loading || topic.trim().length < 3}>
                {loading && generationMode === "scriptwriter" ? "Generating..." : "Generate via scriptwriter"}
              </button>
            </div>

            {status && (
              <p className="status" role="status">
                {status}
              </p>
            )}

            {result && (
              <div className="result">
                <div className="result-meta">
                  <span>Generated with {result.model}</span>
                  {result.notice && <span>{result.notice}</span>}
                </div>
                <label htmlFor="youtube-package">Editable YouTube package (landscape workspace)</label>
                <textarea
                  id="youtube-package"
                  className="package-editor"
                  style={{ minHeight: 420, width: "100%", resize: "vertical" }}
                  value={result.text}
                  onChange={(e) => {
                    const text = e.target.value
                    setResult({ ...result, text })
                  }}
                  rows={18}
                />

                <div
                  className="story-window"
                  style={{ marginTop: 18, padding: 18, border: "2px solid #b7ded1", borderRadius: 14, background: "#f4fbf7" }}
                >
                  <label htmlFor="story-window">
                    <strong>Full word-for-word storytelling script</strong>
                  </label>
                  <p className="field-hint">
                    This window stays blank until you press Extract Part 11. That copies only Part 11
                    (STORYTELLING SCRIPT) from the first window — the narration above Part 12 — identically.
                    Voiceover uses only this window.
                  </p>
                  <button
                    className="secondary voice-play"
                    type="button"
                    onClick={extractStorytellingToStoryWindow}
                    style={{ marginTop: 10 }}
                  >
                    Extract Part 11
                  </button>
                  <textarea
                    id="story-window"
                    className="package-editor"
                    style={{ minHeight: 360, width: "100%", resize: "vertical", marginTop: 10 }}
                    value={storyText}
                    onChange={(e) => setStoryText(e.target.value)}
                    placeholder="Blank until you extract the storytelling script from the YouTube package above."
                    aria-describedby="story-window-help"
                  />
                  <span id="story-window-help" className="sr-only">
                    Only this storytelling window is sent to voiceover generation.
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                  <button
                    className="secondary voice-play"
                    type="button"
                    onClick={() => {
                      setPackageDone(true)
                      setOpen(false)
                    }}
                  >
                    <Check size={16} /> Done
                  </button>
                  <button
                    className="secondary voice-play"
                    type="button"
                    onClick={() => {
                      setVisualsTopic(topic)
                      setOpen(false)
                      setVisualsOpen(true)
                      searchVisuals(topic)
                    }}
                  >
                    <Film size={16} /> Visuals
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 14 }}>
                  <button className="secondary voice-play" type="button" onClick={() => openAssets("image")}><ImageIcon size={15} /> AI image</button>
                  <button className="secondary voice-play" type="button" onClick={() => openAssets("video")}><Video size={15} /> AI video</button>
                  <button className="secondary voice-play" type="button" onClick={() => openAssets("thumbnail")}><ImageIcon size={15} /> Thumbnail</button>
                  <button className="secondary voice-play" type="button" onClick={() => openAssets("seo")}><Search size={15} /> SEO + tags</button>
                  <button className="secondary voice-play" type="button" onClick={() => openAssets("motion")}><Film size={15} /> Motion graphics</button>
                </div>
                <div className="voiceover">
                  <div>
                    <p className="field-label">Generate voiceover</p>
                    <p className="field-hint">
                      Only the storytelling script is sent to audio. Titles, tags, SEO, and headings are not read aloud.
                    </p>
                  </div>
                  <div className="voice-buttons">
                    {voiceLanguages.map((voice) => (
                      <button
                        key={voice.code}
                        type="button"
                        className={voiceLanguage === voice.code ? "voice active" : "voice"}
                        onClick={() => setVoiceLanguage(voice.code)}
                      >
                        {voice.label}
                      </button>
                    ))}
                  </div>
                  <div className="voice-actions">
                    <button className="secondary voice-play" type="button" onClick={generateVoiceover} disabled={voiceLoading}>
                      <Volume2 size={16} /> {voiceLoading ? "Creating audio..." : "Generate voiceover audio"}
                    </button>
                    {audioUrl && (
                      <div className="generated-audio" style={{ display: "grid", gap: 10, width: "100%" }}>
                        <strong>Voiceover ready</strong>
                        <label htmlFor="generated-voiceover">Listen to voiceover</label>
                        <audio
                          id="generated-voiceover"
                          controls
                          preload="metadata"
                          src={audioUrl}
                          aria-label="Generated voiceover audio"
                          style={{ width: "100%" }}
                        />
                        <div className="voice-actions">
                          <button
                            className="secondary voice-play"
                            type="button"
                            onClick={() => {
                              setVoiceoverUsed(true)
                              setStatus("This voiceover is selected for your video.")
                            }}
                          >
                            {voiceoverUsed ? "Voiceover selected" : "Use this voiceover"}
                          </button>
                          <a className="secondary voice-play" href={audioUrl} download={`cosmos-voiceover-${voiceLanguage}.wav`}>
                            Download voiceover
                          </a>
                        </div>
                      </div>
                    )}
                    <span className="field-hint">Generate the cinematic audio, listen here, then use or download the voiceover.</span>
                  </div>
                  <div className="external-tts" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #d7e9e8" }}>
                    <p className="field-label">Free external TTS options</p>
                    <p className="field-hint">
                      These services are separate websites. We copy only your storytelling script, open the tool, and
                      you download the audio there.
                    </p>
                    <div className="voice-actions">
                      <button
                        className="secondary voice-play"
                        type="button"
                        onClick={() => openExternalTts("https://huggingface.co/spaces/hexgrad/Kokoro-TTS", "Kokoro TTS")}
                      >
                        Open Kokoro TTS
                      </button>
                      <button
                        className="secondary voice-play"
                        type="button"
                        onClick={() => openExternalTts("https://huggingface.co/spaces/SWivid/F5-TTS", "F5-TTS")}
                      >
                        Open F5-TTS
                      </button>
                      <button
                        className="secondary voice-play"
                        type="button"
                        onClick={() => openExternalTts("https://ttsmp3.com/", "TTSMP3")}
                      >
                        Open free TTS
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {assetOpen && (
        <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAssetOpen(false) }}>
          <section className="modal" style={{ maxWidth: 1000, width: "min(1000px, calc(100vw - 32px))" }} role="dialog" aria-modal="true">
            <div className="modal-head">
              <div>
                <div className="modal-kicker">Individual AI production workspace</div>
                <h2>{assetType === "image" ? "AI IMAGE" : assetType === "video" ? "AI VIDEO" : assetType === "thumbnail" ? "THUMBNAIL" : assetType === "seo" ? "SEO + TAGS" : "MOTION GRAPHICS"}</h2>
                <p className="muted">The production package is the source of truth. Edit the generated prompt, then generate the real asset.</p>
              </div>
              <button className="close" aria-label="Close" onClick={() => setAssetOpen(false)}><X size={18} /></button>
            </div>

            <div className="field">
              <label htmlFor="asset-script"><strong>Generated script / prompt</strong></label>
              <textarea
                id="asset-script"
                className="package-editor"
                style={{ minHeight: 260, width: "100%", marginTop: 10, resize: "vertical" }}
                value={assetPrompt}
                onChange={(e) => setAssetPrompt(e.target.value)}
                placeholder="The AI production prompt will appear here."
              />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(assetType === "image" || assetType === "video" || assetType === "thumbnail") && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label htmlFor="asset-count"><strong>Number</strong></label>
                  <select
                    id="asset-count"
                    value={assetCount}
                    onChange={(e) => setAssetCount(Math.max(1, Math.min(10, Number(e.target.value))))}
                    disabled={assetLoading}
                    aria-label={"Number of " + assetType + "s to generate"}
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              )}
              <button className="generate" type="button" onClick={generateRealAsset} disabled={assetLoading || !assetPrompt.trim()}>
                {assetLoading ? "Generating..." : "Generate"}
              </button>
              {assetType === "video" && assetOperation && (
                <button className="secondary voice-play" type="button" onClick={checkVideoStatus} disabled={assetLoading}>
                  Check video status
                </button>
              )}
              <button className="secondary voice-play" type="button" onClick={selectAsset} disabled={!assetOutput}>
                <Check size={16} /> {assetSelected ? "Selected" : "Select"}
              </button>
            </div>

            {assetText && <p className="status" role="status" style={{ marginTop: 12 }}>{assetText}</p>}

            {assetOutputs.length > 0 && assetType !== "seo" && assetType !== "motion" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 16 }}>
                {assetOutputs.map((item) => (
                  <div key={item.index} style={{ border: "1px solid #d7e9e8", borderRadius: 12, padding: 8, background: "#fff" }}>
                    <strong style={{ display: "block", marginBottom: 6 }}>Variation {item.index}</strong>
                    {item.error ? (
                      <p className="field-hint">{item.error}</p>
                    ) : item.url ? (
                      assetType === "video" ? (
                        <video controls src={item.url} style={{ width: "100%", borderRadius: 8, display: "block" }} />
                      ) : (
                        <img src={item.url} alt={"Generated " + assetType + " variation " + item.index} style={{ width: "100%", borderRadius: 8, display: "block" }} />
                      )
                    ) : (
                      <p className="field-hint">Generating…</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {assetOutput && assetType !== "seo" && assetType !== "motion" && assetOutputs.length === 0 && (
              <div style={{ marginTop: 16 }}>
                {assetType === "video" ? (
                  <video controls src={assetOutput} style={{ width: "100%", borderRadius: 12, display: "block" }} />
                ) : (
                  <img src={assetOutput} alt="Generated AI asset" style={{ width: "100%", borderRadius: 12, display: "block" }} />
                )}
              </div>
            )}

            {assetOutput && assetType === "seo" && (
              <textarea className="package-editor" style={{ minHeight: 420, width: "100%", marginTop: 14 }} value={assetOutput} readOnly />
            )}

            {assetOutput && assetType === "motion" && (
              <div style={{ marginTop: 14, border: "1px solid #d7e9e8", borderRadius: 12, overflow: "hidden", background: "#111" }}>
                <iframe title="Generated motion graphics" src={assetOutput} style={{ width: "100%", aspectRatio: "16/9", border: 0 }} />
              </div>
            )}
          </section>
        </div>
      )}

      {/* ========== STEP 3 VISUALS MODAL (independent) ========== */}
      {visualsOpen && (
        <div
          className="overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setVisualsOpen(false)
          }}
        >
          <section
            className="modal"
            style={{ maxWidth: 960, width: "min(960px, calc(100vw - 32px))" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="visuals-title"
          >
            <div className="modal-head">
              <div>
                <div className="modal-kicker">Step 3 of 3 · Visuals</div>
                <h2 id="visuals-title">Find real & stock footage</h2>
                <p className="muted">
                  Search the NASA Image and Video Library when relevant; use Pexels as a stock fallback when configured.
                </p>
              </div>
              <button className="close" aria-label="Close visuals" onClick={() => setVisualsOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Topic box + search bar */}
            <div className="field">
              <label htmlFor="visuals-topic">Topic or keywords</label>
              <div className="topic-row">
                <input
                  id="visuals-topic"
                  value={visualsTopic}
                  onChange={(e) => setVisualsTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") searchVisuals()
                  }}
                  placeholder="e.g. black hole, Mars rover, ISS spacewalk, nebula"
                  maxLength={200}
                  autoFocus
                />
                <button
                  className="search"
                  type="button"
                  onClick={() => searchVisuals()}
                  disabled={visualsLoading || visualsTopic.trim().length < 2}
                  aria-label="Search NASA and Pexels"
                >
                  {visualsLoading ? (
                    "Searching..."
                  ) : (
                    <>
                      <Search size={16} /> <span>Search videos & images</span>
                    </>
                  )}
                </button>
              </div>
              <p className="field-hint">
                Tip: use short space terms ("black hole", "Apollo 11", "Hubble") for better NASA matches.
              </p>
            </div>

            {visualsLoading && (
              <p className="status" role="status">
                Searching NASA Image & Video Library…
              </p>
            )}

            {!visualsLoading && visualNotice && (
              <p className="status" role="status">
                {visualNotice}
              </p>
            )}

            {!visualsLoading && visuals.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: 14,
                  marginTop: 12,
                }}
              >
                {visuals.map((visual) => (
                  <a
                    key={visual.url + (visual.pageUrl || "")}
                    href={visual.pageUrl || visual.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "inherit",
                      textDecoration: "none",
                      border: "1px solid #d7e9e8",
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "#fff",
                    }}
                  >
                    <div style={{ position: "relative" }}>
                      <img
                        src={visual.url}
                        alt={visual.title}
                        style={{
                          width: "100%",
                          aspectRatio: "16 / 9",
                          objectFit: "cover",
                          display: "block",
                          background: "#0c4a6e",
                        }}
                        loading="lazy"
                      />
                      {visual.mediaType === "video" && (
                        <span
                          style={{
                            position: "absolute",
                            top: 8,
                            left: 8,
                            background: "#0ea5e9",
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 6,
                          }}
                        >
                          VIDEO
                        </span>
                      )}
                      {visual.source === "Pexels" && (
                        <span
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            background: "#16a34a",
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 6,
                          }}
                        >
                          Pexels
                        </span>
                      )}
                    </div>
                    <div style={{ padding: "10px 12px" }}>
                      <small style={{ display: "block", fontWeight: 600, lineHeight: 1.35 }}>
                        {visual.source}: {visual.title}
                      </small>
                    </div>
                  </a>
                ))}
              </div>
            )}

            {!visualsLoading && !visuals.length && visualsTopic.trim().length >= 2 && visualNotice && (
              <p className="field-hint" style={{ marginTop: 16 }}>
                No results yet. Try a different keyword, or make sure <code>PEXELS_API_KEY</code> is set in your Vercel
                environment for the fallback.
              </p>
            )}
          </section>
        </div>
      )}
      {youtubeStudioModal}
    </main>
  )
}
