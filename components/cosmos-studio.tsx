"use client"

import { useState } from "react"
import { ArrowRight, Check, Film, Globe2, Lightbulb, Search, Sparkles, Volume2, X } from "lucide-react"

type Result = { text: string; model: string; notice?: string }

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
  const [gradeLevel, setGradeLevel] = useState("Class 8–10")
  const [length, setLength] = useState("0-10")
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
  const [aiVisualOpen, setAiVisualOpen] = useState(false)
  const [aiVisualType, setAiVisualType] = useState<"image" | "video">("video")
  const [aiVisualPrompt, setAiVisualPrompt] = useState("")
  const [aiVisualScene, setAiVisualScene] = useState("")
  const [aiVisualGenerating, setAiVisualGenerating] = useState(false)
  const [aiVisualAsset, setAiVisualAsset] = useState<{ type: "image" | "video"; url: string; scene: string; prompt: string } | null>(null)
  const [selectedYoutubeVisual, setSelectedYoutubeVisual] = useState<{ type: "image" | "video"; url: string; scene: string; prompt: string } | null>(null)


  // Visuals (Step 3) — independent modal
  const [visualsOpen, setVisualsOpen] = useState(false)
  const [visualsTopic, setVisualsTopic] = useState("")
  const [visualsLoading, setVisualsLoading] = useState(false)
  const [visuals, setVisuals] = useState<VisualItem[]>([])
  const [visualNotice, setVisualNotice] = useState("")

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

  async function generate() {
    setLoading(true)
    setStatus("")
    setResult(null)
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, language, gradeLevel, length, packageType }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Generation failed")
      setResult(data)
      const generatedStory = extractPart11(data.text || "")
      setStoryText(generatedStory)
      if (generatedStory) {
        setStatus("Story package generated. Part 11 storytelling script is ready for voiceover.")
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generation failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function openExternalTts(url: string, name: string) {
    const story = storyText.trim()
    if (!story) {
      setStatus("Extract Part 11 into the second window first.")
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

  function extractPart11(packageText: string) {
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

    // Prefer the line that is specifically Part 11 of (STORYTELLING SCRIPT)
    let start = lines.findIndex((line) => /\(STORYTELLING SCRIPT\)/i.test(line) && line.trim().length < 220)
    if (start < 0) start = lines.findIndex(headingTest)
    if (start < 0) return ""

    let end = lines.findIndex((line, index) => index > start && endTest(line))
    const body = (end > start ? lines.slice(start + 1, end) : lines.slice(start + 1)).join("\n")
    return body.replace(/^\n+/, "").replace(/\s+$/, "")
  }

  function extractPart11ToStoryWindow() {
    const packageText = result?.text || ""
    const script = extractPart11(packageText)
    if (!script) {
      setStatus("Could not find Part 11 (STORYTELLING SCRIPT) in the first window. Look for a heading that contains (STORYTELLING SCRIPT), then Part 12 below it.")
      return
    }
    setStoryText(script)
    setStatus("Part 11 (STORYTELLING SCRIPT) copied identically into the second window.")
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
      setAudioUrl(URL.createObjectURL(new Blob([bytes], { type: data.mimeType || "audio/wav" })))
      setVoiceoverUsed(false)
      setStatus("Voiceover created. Listen below, then choose Use this voiceover.")
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
        body: JSON.stringify({
        topic: q,
        script: storyText,
        visualRequirement: q,
      }),
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
  function extractPart13(packageText: string) {
    const text = packageText.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const match = text.match(/(?:PART|STEP|भाग)\s*13[^\n]*\n([\s\S]*?)(?=\n(?:PART|STEP|भाग)\s*14\b)/i)
    return match?.[1]?.trim() || ""
  }

  function extractPart14(packageText: string) {
    const text = packageText.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const match = text.match(/(?:PART|STEP|भाग)\s*14[^\n]*\n([\s\S]*?)(?=\n(?:PART|STEP|भाग)\s*15\b|$)/i)
    return match?.[1]?.trim() || ""
  }

  function setAiVisualGenerationType(type: "image" | "video") {
    const packageText = result?.text || ""
    setAiVisualType(type)
    setAiVisualPrompt(type === "image" ? extractPart13(packageText) : extractPart14(packageText))
    setAiVisualAsset(null)
  }

  function openAiVisuals(type: "image" | "video" = "video") {
    setAiVisualGenerationType(type)
    setAiVisualScene("")
    setAiVisualOpen(true)
  }

  function extractPart25(packageText: string) {
    const text = packageText.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const match = text.match(/(?:PART|STEP|भाग)\s*25[^\n]*\n([\s\S]*?)(?=\n(?:PART|STEP|भाग)\s*26\b|$)/i)
    return match?.[1]?.trim() || ""
  }

  function generateThumbnail() {
    const concepts = extractPart25(result?.text || "")
    if (!concepts) {
      setStatus("Could not find Part 25 (THUMBNAIL CONCEPTS). Regenerate the YouTube package first.")
      return
    }
    setAiVisualType("image")
    setAiVisualPrompt(concepts)
    setAiVisualScene("YouTube thumbnail")
    setAiVisualAsset(null)
    setAiVisualOpen(true)
  }

  async function generateAiVisual() {
    if (!aiVisualPrompt.trim()) {
      setStatus("The selected AI generation script is empty. Regenerate the YouTube package first.")
      return
    }
    setAiVisualGenerating(true)
    setStatus("")
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: aiVisualScene.trim() === "YouTube thumbnail"
            ? "thumbnail"
            : aiVisualType === "image"
              ? "ai-image"
              : "ai-video",
          prompt: aiVisualPrompt.trim(),
          scene: aiVisualScene.trim(),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "AI visual generation failed")
      if (data.status === "processing") {
        let operation = data.operation
        for (let attempt = 0; attempt < 18; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 5000))
          const poll = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "ai-video-status", operation }),
          })
          const pollData = await poll.json()
          if (!poll.ok) throw new Error(pollData.error || "Video generation status check failed")
          if (pollData.status === "complete") {
            setAiVisualAsset({ type: "video", url: pollData.url, scene: aiVisualScene.trim(), prompt: aiVisualPrompt.trim() })
            setStatus("AI video generated. Click Use in YouTube Studio.")
            return
          }
          if (pollData.status === "failed") throw new Error(pollData.error || "AI video generation failed")
        }
        throw new Error("Video generation is still processing. Please try again shortly.")
      }
      setAiVisualAsset({ type: "image", url: data.url, scene: aiVisualScene.trim(), prompt: aiVisualPrompt.trim() })
      setStatus("AI image generated. Click Use in YouTube Studio.")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI visual generation failed.")
    } finally {
      setAiVisualGenerating(false)
    }
  }

  function useAiVisualInYoutubeStudio() {
    if (!aiVisualAsset) return
    setSelectedYoutubeVisual(aiVisualAsset)
    setStatus("Selected AI visual for YouTube Studio scene/timeline placement.")
  }

  function openVisuals() {
    setVisualsTopic(topic.trim() || visualsTopic)
    setOpen(false)
    setVisualsOpen(true)
    if ((topic.trim() || visualsTopic).length >= 2) {
      searchVisuals(topic.trim() || visualsTopic)
    }
  }

  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand">
          <span className="mark">
            <Sparkles size={18} />
          </span>{" "}
          Cosmos Studio
        </div>
        <button className="create" onClick={openCreator}>
          Create new videos <ArrowRight size={15} style={{ verticalAlign: "-2px" }} />
        </button>
      </nav>

      <section className="hero">
        <div>
          <div className="eyebrow">NASA learning studio</div>
          <h1>
            Turn curiosity into a <span>video lesson.</span>
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
          <p>Search NASA footage first, then use Pexels when NASA has no match.</p>
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
                <h2 id="creator-title">Create your lesson</h2>
                <p className="muted">Set the basics first. You can edit the generated story before creating audio.</p>
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
              <label htmlFor="grade-level">Student level</label>
              <select id="grade-level" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
                <option>Class 8–10</option>
                <option>Class 11–12</option>
                <option>Class 8–12</option>
              </select>
              <p className="field-hint">Simple explanations, examples, and questions for school learners.</p>
            </div>

            <div className="field">
              <label htmlFor="length">Video length (minutes)</label>
              <select id="length" value={length} onChange={(e) => setLength(e.target.value)}>
                <option value="0-5">0–5</option>
                <option value="0-10">0–10</option>
                <option value="0-15">0–15</option>
                <option value="0-30">0–30</option>
                <option value="0-60">0–60</option>
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
              <p className="field-label">Select this package</p>
              <div className="package-options" role="group" aria-label="Select video package" style={{ display: "grid", gap: 8 }}>
                <button
                  type="button"
                  className={packageType === "youtube" ? "package-option active" : "package-option"}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid",
                    borderColor: packageType === "youtube" ? "#16a34a" : "#d7e9e8",
                    background: packageType === "youtube" ? "#eaf9f0" : "white",
                  }}
                  onClick={() => setPackageType("youtube")}
                >
                  YouTube package
                  <span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>Title, description, tags, SEO, script</span>
                </button>
                <button
                  type="button"
                  className={packageType === "lesson" ? "package-option active" : "package-option"}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid",
                    borderColor: packageType === "lesson" ? "#16a34a" : "#d7e9e8",
                    background: packageType === "lesson" ? "#eaf9f0" : "white",
                  }}
                  onClick={() => setPackageType("lesson")}
                >
                  Classroom lesson
                  <span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>Simple teaching flow and review questions</span>
                </button>
                <button
                  type="button"
                  className={packageType === "shorts" ? "package-option active" : "package-option"}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid",
                    borderColor: packageType === "shorts" ? "#16a34a" : "#d7e9e8",
                    background: packageType === "shorts" ? "#eaf9f0" : "white",
                  }}
                  onClick={() => setPackageType("shorts")}
                >
                  Short video
                  <span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>Fast hook and concise narration</span>
                </button>
              </div>
            </div>

            <button className="generate" onClick={generate} disabled={loading || topic.trim().length < 3}>
              {loading ? "Generating your package..." : "Generate YouTube package"}
            </button>

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
                    <strong>Part 11 storytelling script</strong>
                  </label>
                  <p className="field-hint">
                    This window stays blank until you press Extract Part 11. That copies only Part 11
                    (STORYTELLING SCRIPT) from the first window — the narration above Part 12 — identically.
                    Voiceover uses only this window.
                  </p>
                  <button
                    className="secondary voice-play"
                    type="button"
                    onClick={extractPart11ToStoryWindow}
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
                    placeholder="Blank until you extract Part 11 from the YouTube package above."
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
                  <button
                    className="secondary voice-play"
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      openAiVisuals("video")
                    }}
                  >
                    <Sparkles size={16} /> AI image / video
                  </button>
                  <button className="secondary voice-play" type="button" onClick={generateThumbnail}>
                    <Sparkles size={16} /> Generate thumbnail
                  </button>
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

      {/* ========== AI IMAGE / VIDEO GENERATION WINDOW ========== */}
      {aiVisualOpen && (
        <div
          className="overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAiVisualOpen(false)
          }}
        >
          <section
            className="modal"
            style={{ maxWidth: 960, width: "min(960px, calc(100vw - 32px))" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-visual-title"
          >
            <div className="modal-head">
              <div>
                <div className="modal-kicker">AI Visual Studio</div>
                <h2 id="ai-visual-title">Generate an image or video</h2>
                <p className="muted">
                  The default prompt comes from the same Gemini YouTube package/story used by this video.
                  Edit it for the selected scene before sending it to your generation provider.
                </p>
              </div>
              <button className="close" aria-label="Close AI visual generator" onClick={() => setAiVisualOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="field">
              <p className="field-label">Generation type</p>
              <div className="voice-buttons">
                <button type="button" className={aiVisualType === "image" ? "voice active" : "voice"} onClick={() => setAiVisualGenerationType("image")}>
                  AI Image
                </button>
                <button type="button" className={aiVisualType === "video" ? "voice active" : "voice"} onClick={() => setAiVisualGenerationType("video")}>
                  AI Video
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="ai-visual-scene">Script 12 scene / timestamp</label>
              <input
                id="ai-visual-scene"
                value={aiVisualScene}
                onChange={(e) => setAiVisualScene(e.target.value)}
                placeholder="e.g. Scene 5 · 00:42–00:49"
                maxLength={120}
              />
                      <label htmlFor="ai-visual-prompt">Default Script {aiVisualType === "image" ? "13" : "14"} generation prompt</label>
              <textarea
                id="ai-visual-prompt"
                className="package-editor"
                style={{ minHeight: 300, width: "100%", resize: "vertical" }}
                value={aiVisualPrompt}
                onChange={(e) => setAiVisualPrompt(e.target.value)}
              />
              <p className="field-hint">
                Script 13 is the default AI image prompt. Script 14 is the default AI video prompt. Both come from the same YouTube package.
              </p>
            </div>

            <div className="voice-actions">
              <button className="secondary voice-play" type="button" onClick={generateAiVisual} disabled={aiVisualGenerating || !aiVisualPrompt.trim()}>
                {aiVisualGenerating ? "Generating..." : "Generate AI " + aiVisualType}
              </button>
              <button className="secondary voice-play" type="button" onClick={useAiVisualInYoutubeStudio} disabled={!aiVisualAsset}>
                Use in YouTube Studio
              </button>
              <button className="secondary voice-play" type="button" onClick={() => setAiVisualOpen(false)}>
                Done
              </button>
            </div>

            {aiVisualAsset && (
              <div style={{ marginTop: 16, border: "1px solid #d7e9e8", borderRadius: 12, padding: 12 }}>
                <strong>Generated {aiVisualAsset.type}</strong>
                {aiVisualAsset.type === "image" ? (
                  <img src={aiVisualAsset.url} alt="Generated AI visual" style={{ width: "100%", marginTop: 10, borderRadius: 8 }} />
                ) : (
                  <video src={aiVisualAsset.url} controls playsInline style={{ width: "100%", marginTop: 10, borderRadius: 8 }} />
                )}
              </div>
            )}

            {selectedYoutubeVisual && (
              <p className="status" role="status">✓ AI {selectedYoutubeVisual.type} selected for YouTube Studio.</p>
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
                <h2 id="visuals-title">Find NASA & stock footage</h2>
                <p className="muted">
                  Search the NASA Image and Video Library first. If nothing matches, Pexels is used as a fallback.
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
    </main>
  )
}
