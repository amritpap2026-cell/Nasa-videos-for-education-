"use client"

import { useState } from "react"
import { ArrowRight, Check, Film, Globe2, Lightbulb, Play, Search, Sparkles, Volume2, X } from "lucide-react"

type Result = { text: string; model: string; notice?: string }

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
  const [visualsOpen, setVisualsOpen] = useState(false)
  const [visualsLoading, setVisualsLoading] = useState(false)
  const [visuals, setVisuals] = useState<Array<{ source: string; title: string; url: string; pageUrl?: string }>>([])
  const [visualNotice, setVisualNotice] = useState("")

  async function brainstorm() {
    setIdeasLoading(true); setStatus(""); setIdeas([])
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, language, gradeLevel, length, packageType, mode: "brainstorm" }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Topic search failed")
      setIdeas(Array.isArray(data.topics) ? data.topics : [])
    } catch (error) { setStatus(error instanceof Error ? error.message : "Topic search failed. Please try again.") } finally { setIdeasLoading(false) }
  }

  async function generate() {
    setLoading(true); setStatus(""); setResult(null)
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, language, gradeLevel, length, packageType }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Generation failed")
      const storyOnly = getStorytellingScript(data.text || "")
      setResult(data)
      setStoryText(storyOnly)
      if (!storyOnly) setStatus("Part 11 storytelling script was not found. The second window will remain empty until Part 11 is generated.")
    } catch (error) { setStatus(error instanceof Error ? error.message : "Generation failed. Please try again.") } finally { setLoading(false) }
  }

  async function openExternalTts(url: string, name: string) {
    const story = result?.text ? getStorytellingScript(result.text) : ""
    if (!story) { setStatus("Generate a package with a storytelling script first."); return }
    try {
      await navigator.clipboard.writeText(story)
      window.open(url, "_blank", "noopener,noreferrer")
      setStatus(`${name} opened. The storytelling script was copied; paste it into the voice tool.`)
    } catch {
      setStatus(`Open ${name}, then copy and paste only the storytelling script.`)
      window.open(url, "_blank", "noopener,noreferrer")
    }
  }

  function cleanVoiceText(text: string) {
    return text.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ").replace(/\{[^}]*\}/g, " ").replace(/\b(?:pause|पॉज़|विराम)\s*\d*\s*(?:seconds?|सेकंड)?\b/gi, " ").replace(/\s*[—–-]\s*/g, " ").replace(/[<>*_#`]/g, " ").replace(/\s+/g, " ").trim()
  }

  function getStorytellingScript(packageText: string) {
    // Only this explicit Part 11 block can enter the second window.
    const lines = packageText.replace(/\r/g, "").split("\n")
    const start = lines.findIndex((line) => /PART\s*11|भाग\s*11/i.test(line))
    if (start === -1) return ""
    const content: string[] = []
    for (const line of lines.slice(start + 1)) {
      if (/^\s*(?:PART|भाग)\s*\d+(?:\s|[-—:：.)]|$)/i.test(line)) break
      if (/^\s*(?:QUESTIONS|प्रश्न|CALL TO ACTION|आह्वान|TITLE|शीर्षक|DESCRIPTION|विवरण|TAGS|टैग|SEO|VIDEO OUTLINE|वीडियो रूपरेखा|MASTER PROMPT)\b/i.test(line)) break
      content.push(line)
    }
    return cleanVoiceText(content.join("\n").replace(/^(?:पूर्ण शब्द-प्रति-शब्द कथा वाचन लिपि|पूर्ण शब्द-दर-शब्द स्क्रिप्ट|FULL WORD-FOR-WORD SCRIPT|STORYTELLING SCRIPT)\s*[:：]?\s*/i, ""))
  }

  async function generateVoiceover() {
  if (!storyText.trim()) { setStatus("Add storytelling content in the story window before generating voiceover."); return }
  const storytellingScript = storyText.trim()
    setVoiceLoading(true); setStatus("")
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "voiceover", language: voiceLanguage === "hi-IN" ? "Hindi" : voiceLanguage === "ne-NP" ? "Nepali" : "English", script: storytellingScript, voice: voiceLanguage === "hi-IN" ? "Kore" : voiceLanguage === "ne-NP" ? "Puck" : "Kore" }) })
      const data = await response.json()
      if (!response.ok || !data.audio) throw new Error(data.error || "Voiceover generation failed")
      const bytes = Uint8Array.from(atob(data.audio), (character) => character.charCodeAt(0))
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl(URL.createObjectURL(new Blob([bytes], { type: data.mimeType || "audio/wav" })))
      setVoiceoverUsed(false)
      setStatus("Voiceover created. Listen below, then choose Use this voiceover.")
    } catch (error) { setStatus(error instanceof Error ? error.message : "Voiceover generation failed.") } finally { setVoiceLoading(false) }
  }

  async function searchVisuals() {
    setVisualsLoading(true); setVisualNotice("")
    try {
      const response = await fetch("/api/visuals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Visual search failed")
      setVisuals(data.items || []); setVisualNotice(data.notice || `${data.source} visuals found.`)
    } catch (error) { setVisualNotice(error instanceof Error ? error.message : "Visual search failed.") } finally { setVisualsLoading(false) }
  }

  function openCreator() { setOpen(true); setStatus(""); setVisualsOpen(false) }
  function openStoryPackage() { setOpen(true); setVisualsOpen(false) }
  function openVoiceover() { setOpen(true); setVisualsOpen(false) }
  function openVisuals() { setOpen(false); setVisualsOpen(true); searchVisuals() }
  function extractStorytellingScript() {
    const extracted = getStorytellingScript(result?.text || "")
    setStoryText(extracted)
    setStatus(extracted ? "Part 11 storytelling script pasted into the second window." : "Part 11 storytelling script was not found in the first window.")
  }

  return <main className="shell">
    <nav className="nav"><div className="brand"><span className="mark"><Sparkles size={18} /></span> Cosmos Studio</div><button className="create" onClick={openCreator}>Create new videos <ArrowRight size={15} style={{ verticalAlign: "-2px" }} /></button></nav>
    <section className="hero"><div><div className="eyebrow">NASA learning studio</div><h1>Turn curiosity into a <span>video lesson.</span></h1><p>Research a space topic, write a complete student-friendly story, create narration, find visuals, and prepare a YouTube package in one focused workspace.</p><div className="hero-actions"><button className="primary" onClick={openCreator}>Create a video <ArrowRight size={16} style={{ verticalAlign: "-3px" }} /></button><span className="hero-note">English · हिन्दी · नेपाली</span></div></div><div className="orbit" aria-label="Illustration of Earth in space"><div className="planet" /><i className="spark s1" /><i className="spark s2" /><i className="spark s3" /></div></section>
    <section className="features" aria-label="Creation workflow"><article className="feature"><span className="step-number">01</span><Globe2 className="icon" /><h3>Story package</h3><p>Open the complete YouTube package and edit the storytelling script.</p><button className="workflow-button" type="button" onClick={openStoryPackage} disabled={!result}><span className={packageDone ? "workflow-tick" : "workflow-pending"}><Check size={14} /> {packageDone ? "Story ready" : "Waiting for story"}</span></button></article><article className="feature"><span className="step-number">02</span><Lightbulb className="icon" /><h3>Voiceover</h3><p>Open the story, listen to the generated audio, use it, or download it.</p><button className="workflow-button" type="button" onClick={openVoiceover} disabled={!storyText}><span className={voiceoverUsed ? "workflow-tick" : "workflow-pending"}><Volume2 size={14} /> {voiceoverUsed ? "Voiceover selected" : "Open voiceover"}</span></button></article><article className="feature"><span className="step-number">03</span><Sparkles className="icon" /><h3>Visuals</h3><p>Search NASA footage first, then use Pexels when NASA has no match.</p><button className="workflow-button" type="button" onClick={openVisuals} disabled={!topic.trim()}><span className="workflow-pending"><Film size={14} /> Open visuals</span></button></article></section>
    {open && <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}><section className="modal" style={{ maxWidth: 1120, width: "min(1120px, calc(100vw - 32px))" }} role="dialog" aria-modal="true" aria-labelledby="creator-title"><div className="modal-head"><div><div className="modal-kicker">Step 1 of 3</div><h2 id="creator-title">Create your lesson</h2><p className="muted">Set the basics first. You can edit the generated story before creating audio.</p></div><button className="close" aria-label="Close creator" onClick={() => setOpen(false)}><X size={18} /></button></div>
      <div className="field"><label htmlFor="language">Output language</label><select id="language" value={language} onChange={(event) => setLanguage(event.target.value)}><option>English</option><option>Hindi</option><option>Nepali</option></select></div>
      <div className="field"><label htmlFor="topic">Topic</label><div className="topic-row"><input id="topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. How black holes bend time" maxLength={300} /><button className="search" type="button" onClick={brainstorm} disabled={ideasLoading || topic.trim().length < 2} aria-label="Search YouTube-style topics">{ideasLoading ? "Searching..." : <><Search size={16} /> <span>Search this topic</span></>}</button></div></div>
      <div className="field"><label htmlFor="grade-level">Student level</label><select id="grade-level" value={gradeLevel} onChange={(event) => setGradeLevel(event.target.value)}><option>Class 8–10</option><option>Class 11–12</option><option>Class 8–12</option></select><p className="field-hint">Simple explanations, examples, and questions for school learners.</p></div>
      <div className="field"><label htmlFor="length">Video length (minutes)</label><select id="length" value={length} onChange={(event) => setLength(event.target.value)}><option value="0-5">0–5</option><option value="0-10">0–10</option><option value="0-15">0–15</option><option value="0-30">0–30</option><option value="0-60">0–60</option></select></div>
      {ideas.length > 0 && <div className="ideas"><p className="field-label">Select a YouTube idea</p>{ideas.map((idea) => <button className="idea" key={idea} type="button" onClick={() => setTopic(idea)}>{idea}<ArrowRight size={14} /></button>)}</div>}
      <div className="field"><p className="field-label">Select this package</p><div className="package-options" role="group" aria-label="Select video package" style={{ display: "grid", gap: 8 }}><button type="button" className={packageType === "youtube" ? "package-option active" : "package-option"} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 10, border: "1px solid", borderColor: packageType === "youtube" ? "#16a34a" : "#d7e9e8", background: packageType === "youtube" ? "#eaf9f0" : "white" }} onClick={() => setPackageType("youtube")}>YouTube package<span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>Title, description, tags, SEO, script</span></button><button type="button" className={packageType === "lesson" ? "package-option active" : "package-option"} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 10, border: "1px solid", borderColor: packageType === "lesson" ? "#16a34a" : "#d7e9e8", background: packageType === "lesson" ? "#eaf9f0" : "white" }} onClick={() => setPackageType("lesson")}>Classroom lesson<span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>Simple teaching flow and review questions</span></button><button type="button" className={packageType === "shorts" ? "package-option active" : "package-option"} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 10, border: "1px solid", borderColor: packageType === "shorts" ? "#16a34a" : "#d7e9e8", background: packageType === "shorts" ? "#eaf9f0" : "white" }} onClick={() => setPackageType("shorts")}>Short video<span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>Fast hook and concise narration</span></button></div></div>
      <button className="generate" onClick={generate} disabled={loading || topic.trim().length < 3}>{loading ? "Generating your package..." : "Generate YouTube package"}</button>
      {status && <p className="status" role="status">{status}</p>}
      {result && <div className="result"><div className="result-meta"><span>Generated with {result.model}</span>{result.notice && <span>{result.notice}</span>}</div><label htmlFor="youtube-package">Editable YouTube package (landscape workspace)</label><textarea id="youtube-package" className="package-editor" style={{ minHeight: 420, width: "100%", resize: "vertical" }} value={result.text} onChange={(event) => { const text = event.target.value; setResult({ ...result, text }); setStoryText("") }} rows={18} />
        <div className="extract-story-row"><button className="extract-story" type="button" onClick={extractStorytellingScript}><ArrowRight size={16} /> Extract Part 11 storytelling script</button><span>Only Part 11 will be copied below.</span></div>
        <div className="story-window" style={{ marginTop: 18, padding: 18, border: "2px solid #b7ded1", borderRadius: 14, background: "#f4fbf7" }}><label htmlFor="story-window"><strong>Storytelling script only</strong></label><p className="field-hint">Only the full word-for-word story from Part 11 is copied here by default. Student questions and every other YouTube section stay in the upper window. Edit this story freely; voiceover uses only this window.</p><textarea id="story-window" className="package-editor" style={{ minHeight: 360, width: "100%", resize: "vertical", marginTop: 10 }} value={storyText} onChange={(event) => setStoryText(event.target.value)} aria-describedby="story-window-help" /><span id="story-window-help" className="sr-only">Only this storytelling window is sent to voiceover generation.</span></div><div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}><button className="secondary voice-play" type="button" onClick={() => { setPackageDone(true); setOpen(false) }}><Check size={16} /> Done</button><button className="secondary voice-play" type="button" onClick={() => { setVisualsOpen(true); searchVisuals() }}><Film size={16} /> Visuals</button></div>
        <div className="voiceover"><div><p className="field-label">Generate voiceover</p><p className="field-hint">Only the storytelling script is sent to audio. Titles, tags, SEO, and headings are not read aloud.</p></div><div className="voice-buttons">{voiceLanguages.map((voice) => <button key={voice.code} type="button" className={voiceLanguage === voice.code ? "voice active" : "voice"} onClick={() => setVoiceLanguage(voice.code)}>{voice.label}</button>)}</div><div className="voice-actions"><button className="secondary voice-play" type="button" onClick={generateVoiceover} disabled={voiceLoading}><Volume2 size={16} /> {voiceLoading ? "Creating audio..." : "Generate voiceover audio"}</button>{audioUrl && <div className="generated-audio" style={{ display: "grid", gap: 10, width: "100%" }}><strong>Voiceover ready</strong><label htmlFor="generated-voiceover">Listen to voiceover</label><audio id="generated-voiceover" controls preload="metadata" src={audioUrl} aria-label="Generated voiceover audio" style={{ width: "100%" }} /><div className="voice-actions"><button className="secondary voice-play" type="button" onClick={() => { setVoiceoverUsed(true); setStatus("This voiceover is selected for your video.") }}>{voiceoverUsed ? "Voiceover selected" : "Use this voiceover"}</button><a className="secondary voice-play" href={audioUrl} download={`cosmos-voiceover-${voiceLanguage}.wav`}>Download voiceover</a></div></div>}<span className="field-hint">Generate the cinematic audio, listen here, then use or download the voiceover.</span></div><div className="external-tts" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #d7e9e8" }}><p className="field-label">Free external TTS options</p><p className="field-hint">These services are separate websites. We copy only your storytelling script, open the tool, and you download the audio there.</p><div className="voice-actions"><button className="secondary voice-play" type="button" onClick={() => openExternalTts("https://huggingface.co/spaces/hexgrad/Kokoro-TTS", "Kokoro TTS")}>Open Kokoro TTS</button><button className="secondary voice-play" type="button" onClick={() => openExternalTts("https://huggingface.co/spaces/SWivid/F5-TTS", "F5-TTS")}>Open F5-TTS</button><button className="secondary voice-play" type="button" onClick={() => openExternalTts("https://ttsmp3.com/", "TTSMP3")}>Open free TTS</button></div></div></div>
      </div>}
      {visualsOpen && <div className="visuals-window" style={{ marginTop: 18, padding: 18, border: "2px solid #b7ded1", borderRadius: 14, background: "#f4fbf7" }}><div className="modal-head"><div><h3>Find visuals for {topic}</h3><p className="muted">Searching NASA media first, with Pexels as an optional fallback.</p></div><button className="close" aria-label="Close visuals" onClick={() => setVisualsOpen(false)}><X size={18} /></button></div>{visualsLoading ? <p className="status">Searching NASA library...</p> : <>{visualNotice && <p className="status">{visualNotice}</p>}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>{visuals.map((visual) => <a key={visual.url} href={visual.pageUrl || visual.url} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}><img src={visual.url} alt={visual.title} style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 10 }} /><small>{visual.source}: {visual.title}</small></a>)}</div></>}</div>}
    </section></div>}
  </main>
}
