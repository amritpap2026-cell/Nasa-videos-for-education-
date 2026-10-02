"use client"

import { useState } from "react"
import { ArrowRight, Globe2, Lightbulb, Play, Search, Sparkles, Volume2, X } from "lucide-react"

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
  const [speaking, setSpeaking] = useState(false)
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState("")

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
      setResult(data)
    } catch (error) { setStatus(error instanceof Error ? error.message : "Generation failed. Please try again.") } finally { setLoading(false) }
  }

  function speakScript() {
    if (!result?.text || typeof window === "undefined" || !("speechSynthesis" in window)) { setStatus("Voice playback is not supported in this browser."); return }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(result.text)
    utterance.lang = voiceLanguage
    utterance.rate = 0.9
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => { setSpeaking(false); setStatus("This browser could not start voice playback.") }
    window.speechSynthesis.speak(utterance)
  }

  function stopSpeaking() { window.speechSynthesis?.cancel(); setSpeaking(false) }

  function getStorytellingScript(packageText: string) {
    const match = packageText.match(/(?:STORYTELLING SCRIPT|STORY SCRIPT|कथात्मक स्क्रिप्ट|कथा स्क्रिप्ट|कथन स्क्रिप्ट)\s*:\s*([\s\S]*?)(?=\n\s*(?:TITLE|शीर्षक|DESCRIPTION|विवरण|TAGS|टैग|SEO|VIDEO OUTLINE|वीडियो रूपरेखा|CALL TO ACTION|आह्वान|$))/i)
    return (match?.[1] || packageText).trim()
  }

  async function generateVoiceover() {
    if (!result?.text) return
    const storytellingScript = getStorytellingScript(result.text)
    if (!storytellingScript) { setStatus("Add a storytelling script before generating voiceover."); return }
    setVoiceLoading(true); setStatus("")
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "voiceover", script: storytellingScript, voice: voiceLanguage === "hi-IN" ? "Kore" : voiceLanguage === "ne-NP" ? "Puck" : "Kore" }) })
      const data = await response.json()
      if (!response.ok || !data.audio) throw new Error(data.error || "Voiceover generation failed")
      const bytes = Uint8Array.from(atob(data.audio), (character) => character.charCodeAt(0))
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl(URL.createObjectURL(new Blob([bytes], { type: data.mimeType || "audio/wav" })))
      setStatus("Voiceover created. Play it or download the audio file.")
    } catch (error) { setStatus(error instanceof Error ? error.message : "Voiceover generation failed.") } finally { setVoiceLoading(false) }
  }

  function openCreator() { setOpen(true); setStatus(""); setResult(null); setAudioUrl("") }

  return <main className="shell">
    <nav className="nav"><div className="brand"><span className="mark"><Sparkles size={18} /></span> Cosmos Studio</div><button className="create" onClick={openCreator}>Create new videos <ArrowRight size={15} style={{ verticalAlign: "-2px" }} /></button></nav>
    <section className="hero"><div><div className="eyebrow">Space education for everyone</div><h1>Look up.<br /><span>Learn more.</span></h1><p>Make NASA and cosmos education easier to understand, in English, Hindi, and Nepali. Discover a universe of ideas and help build a better world.</p><div className="hero-actions"><button className="primary" onClick={openCreator}>Start creating <ArrowRight size={16} style={{ verticalAlign: "-3px" }} /></button><button className="secondary"><Play size={15} style={{ verticalAlign: "-3px" }} /> Explore the mission</button></div></div><div className="orbit" aria-label="Illustration of Earth in space"><div className="planet" /><i className="spark s1" /><i className="spark s2" /><i className="spark s3" /></div></section>
    <section className="features"><article className="feature"><Globe2 className="icon" /><h3>Made for every language</h3><p>Share accurate space stories in English, Hindi, or Nepali.</p></article><article className="feature"><Lightbulb className="icon" /><h3>Curiosity starts here</h3><p>Turn a question about the universe into a lesson people remember.</p></article><article className="feature"><Sparkles className="icon" /><h3>Ready for YouTube</h3><p>Get a title, description, tags, keywords, and outline in one package.</p></article></section>
    {open && <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}><section className="modal" style={{ maxWidth: 1120, width: "min(1120px, calc(100vw - 32px))" }} role="dialog" aria-modal="true" aria-labelledby="creator-title"><div className="modal-head"><div><h2 id="creator-title">Create a new space video</h2><p className="muted">Choose a language first. Every generated field follows that language.</p></div><button className="close" aria-label="Close creator" onClick={() => setOpen(false)}><X size={18} /></button></div>
      <div className="field"><label htmlFor="language">Output language</label><select id="language" value={language} onChange={(event) => setLanguage(event.target.value)}><option>English</option><option>Hindi</option><option>Nepali</option></select></div>
      <div className="field"><label htmlFor="topic">Topic</label><div className="topic-row"><input id="topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. How black holes bend time" maxLength={300} /><button className="search" type="button" onClick={brainstorm} disabled={ideasLoading || topic.trim().length < 2} aria-label="Search YouTube-style topics">{ideasLoading ? "Searching..." : <><Search size={16} /> <span>Search this topic</span></>}</button></div></div>
      <div className="field"><label htmlFor="grade-level">Student level</label><select id="grade-level" value={gradeLevel} onChange={(event) => setGradeLevel(event.target.value)}><option>Class 8–10</option><option>Class 11–12</option><option>Class 8–12</option></select><p className="field-hint">Simple explanations, examples, and questions for school learners.</p></div>
      <div className="field"><label htmlFor="length">Video length (minutes)</label><select id="length" value={length} onChange={(event) => setLength(event.target.value)}><option value="0-5">0–5</option><option value="0-10">0–10</option><option value="0-15">0–15</option><option value="0-30">0–30</option><option value="0-60">0–60</option></select></div>
      {ideas.length > 0 && <div className="ideas"><p className="field-label">Select a YouTube idea</p>{ideas.map((idea) => <button className="idea" key={idea} type="button" onClick={() => setTopic(idea)}>{idea}<ArrowRight size={14} /></button>)}</div>}
      <div className="field"><p className="field-label">Select this package</p><div className="package-options" role="group" aria-label="Select video package" style={{ display: "grid", gap: 8 }}><button type="button" className={packageType === "youtube" ? "package-option active" : "package-option"} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 10, border: "1px solid", borderColor: packageType === "youtube" ? "#16a34a" : "#d7e9e8", background: packageType === "youtube" ? "#eaf9f0" : "white" }} onClick={() => setPackageType("youtube")}>YouTube package<span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>Title, description, tags, SEO, script</span></button><button type="button" className={packageType === "lesson" ? "package-option active" : "package-option"} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 10, border: "1px solid", borderColor: packageType === "lesson" ? "#16a34a" : "#d7e9e8", background: packageType === "lesson" ? "#eaf9f0" : "white" }} onClick={() => setPackageType("lesson")}>Classroom lesson<span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>Simple teaching flow and review questions</span></button><button type="button" className={packageType === "shorts" ? "package-option active" : "package-option"} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 10, border: "1px solid", borderColor: packageType === "shorts" ? "#16a34a" : "#d7e9e8", background: packageType === "shorts" ? "#eaf9f0" : "white" }} onClick={() => setPackageType("shorts")}>Short video<span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>Fast hook and concise narration</span></button></div></div>
      <button className="generate" onClick={generate} disabled={loading || topic.trim().length < 3}>{loading ? "Generating your package..." : "Generate YouTube package"}</button>
      {status && <p className="status" role="status">{status}</p>}
      {result && <div className="result"><div className="result-meta"><span>Generated with {result.model}</span>{result.notice && <span>{result.notice}</span>}</div><label htmlFor="youtube-package">Editable YouTube package (landscape workspace)</label><textarea id="youtube-package" className="package-editor" style={{ minHeight: 420, width: "100%", resize: "vertical" }} value={result.text} onChange={(event) => setResult({ ...result, text: event.target.value })} rows={18} />
        <div className="voiceover"><div><p className="field-label">Generate voiceover</p><p className="field-hint">Only the storytelling script is sent to audio. Titles, tags, SEO, and headings are not read aloud.</p></div><div className="voice-buttons">{voiceLanguages.map((voice) => <button key={voice.code} type="button" className={voiceLanguage === voice.code ? "voice active" : "voice"} onClick={() => setVoiceLanguage(voice.code)}>{voice.label}</button>)}</div><div className="voice-actions"><button className="secondary voice-play" type="button" onClick={generateVoiceover} disabled={voiceLoading}><Volume2 size={16} /> {voiceLoading ? "Creating audio..." : "Generate voiceover audio"}</button><button className="secondary voice-play" type="button" onClick={speaking ? stopSpeaking : speakScript}><Play size={16} /> {speaking ? "Stop preview" : "Preview in browser"}</button>{audioUrl && <><audio controls src={audioUrl} aria-label="Generated voiceover audio" /><a className="secondary voice-play" href={audioUrl} download={`cosmos-voiceover-${voiceLanguage}.wav`}>Download voiceover</a></>}<span className="field-hint">Gemini creates a WAV audio file using the selected language voice.</span></div></div>
      </div>}
    </section></div>}
  </main>
}
