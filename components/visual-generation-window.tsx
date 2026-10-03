"use client"

import { useMemo, useState } from "react"
import { Film, Image as ImageIcon, Sparkles, X } from "lucide-react"

type VisualGenerationWindowProps = {
  open: boolean
  topic: string
  packageText: string
  storyText: string
  onClose: () => void
}

function extractStoryboard(packageText: string) {
  const text = packageText.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const match = text.match(/(?:PART|STEP|भाग)\s*12\b([\s\S]*)$/i)
  return match?.[1]?.trim() || ""
}

export default function VisualGenerationWindow({
  open,
  topic,
  packageText,
  storyText,
  onClose,
}: VisualGenerationWindowProps) {
  const [mode, setMode] = useState<"image" | "video">("video")
  const [prompt, setPrompt] = useState("")
  const [scene, setScene] = useState("")

  const defaultPrompt = useMemo(() => {
    const storyboard = extractStoryboard(packageText)
    const source = storyboard || storyText || topic
    return [
      "Create a scientifically accurate, cinematic educational visual for a NASA space-science YouTube lesson.",
      "Topic: " + (topic || "space science"),
      scene ? "Scene: " + scene : "",
      "Use this storyboard/script context as the source of truth:",
      source,
      "Visual requirements: 16:9 landscape, clear subject, realistic scientific details, no narration, no subtitles, no logos, no invented NASA endorsement.",
      mode === "video"
        ? "For video: natural cinematic motion, coherent camera movement, and a clean 5–10 second shot suitable for editing."
        : "For image: a detailed cinematic educational frame suitable for a video edit.",
    ]
      .filter(Boolean)
      .join("\n\n")
  }, [packageText, storyText, topic, scene, mode])

  const effectivePrompt = prompt.trim() || defaultPrompt

  if (!open) return null

  return (
    <div
      className="overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="modal"
        style={{ maxWidth: 1000, width: "min(1000px, calc(100vw - 32px))" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="visual-generation-title"
      >
        <div className="modal-head">
          <div>
            <div className="modal-kicker">AI visual generation</div>
            <h2 id="visual-generation-title">Generate an image or video for the script</h2>
            <p className="muted">
              The default prompt is built from the same Gemini YouTube package and storyboard already in this project.
            </p>
          </div>
          <button className="close" aria-label="Close AI visual generation" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className={mode === "image" ? "voice active" : "voice"}
              onClick={() => setMode("image")}
            >
              <ImageIcon size={15} /> AI Image
            </button>
            <button
              type="button"
              className={mode === "video" ? "voice active" : "voice"}
              onClick={() => setMode("video")}
            >
              <Film size={15} /> AI Video
            </button>
          </div>

          <div className="field">
            <label htmlFor="ai-visual-scene">Scene / timestamp (optional)</label>
            <input
              id="ai-visual-scene"
              value={scene}
              onChange={(event) => setScene(event.target.value)}
              placeholder="e.g. 00:24–00:31 — explain why gravity is so strong"
            />
          </div>

          <div className="field">
            <label htmlFor="ai-visual-prompt">Generation prompt</label>
            <textarea
              id="ai-visual-prompt"
              className="package-editor"
              style={{ minHeight: 300, width: "100%", resize: "vertical" }}
              value={prompt || defaultPrompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <p className="field-hint">
              Edit this prompt freely. It is separate from the narration, so changing the visual prompt will not change
              the YouTube package or voiceover.
            </p>
          </div>

          <div
            style={{
              padding: 14,
              border: "1px solid #d7e9e8",
              borderRadius: 12,
              background: "#f8fcfb",
            }}
          >
            <strong>Pipeline</strong>
            <p className="field-hint" style={{ marginBottom: 0 }}>
              Script 12 → visual prompt → AI image/video → scene asset → Clip Manifest → FFmpeg → final video.
            </p>
          </div>

          <button
            className="generate"
            type="button"
            onClick={() => {
              window.alert(
                "The generation window is ready. The next integration will connect this prompt to the selected image/video provider and save the result into the scene asset pipeline.",
              )
            }}
          >
            <Sparkles size={16} /> Generate {mode === "video" ? "video" : "image"}
          </button>
        </div>
      </section>
    </div>
  )
}
