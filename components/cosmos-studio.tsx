"use client"
import { useState } from "react"
import { ArrowRight, Globe2, Lightbulb, Play, Search, Sparkles, X } from "lucide-react"

type Result = { text: string; model: string }
export default function CosmosStudio() {
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState("")
  const [language, setLanguage] = useState("English")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const [ideas, setIdeas] = useState<string[]>([])
  const [ideasLoading, setIdeasLoading] = useState(false)
  async function brainstorm() {
    setIdeasLoading(true); setStatus(""); setIdeas([])
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, language, mode: "brainstorm" }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Topic search failed")
      setIdeas(Array.isArray(data.topics) ? data.topics : [])
    } catch (error) { setStatus(error instanceof Error ? error.message : "Topic search failed. Please try again.") } finally { setIdeasLoading(false) }
  }
  async function generate() {
    setLoading(true); setStatus(""); setResult(null)
    try { const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, language }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Generation failed"); setResult(data) } catch (error) { setStatus(error instanceof Error ? error.message : "Generation failed. Please try again.") } finally { setLoading(false) }
  }
  function openCreator() { setOpen(true); setStatus(""); setResult(null) }
  return <main className="shell">
    <nav className="nav"><div className="brand"><span className="mark"><Sparkles size={18} /></span> Cosmos Studio</div><button className="create" onClick={openCreator}>Create new videos <ArrowRight size={15} style={{ verticalAlign: "-2px" }} /></button></nav>
    <section className="hero"><div><div className="eyebrow">Space education for everyone</div><h1>Look up.<br /><span>Learn more.</span></h1><p>Make NASA and cosmos education easier to understand, in English, Hindi, and Nepali. Discover a universe of ideas and help build a better world.</p><div className="hero-actions"><button className="primary" onClick={openCreator}>Start creating <ArrowRight size={16} style={{ verticalAlign: "-3px" }} /></button><button className="secondary"><Play size={15} style={{ verticalAlign: "-3px" }} /> Explore the mission</button></div></div><div className="orbit" aria-label="Illustration of Earth in space"><div className="planet" /><i className="spark s1" /><i className="spark s2" /><i className="spark s3" /></div></section>
    <section className="features"><article className="feature"><Globe2 className="icon" /><h3>Made for every language</h3><p>Share accurate space stories in English, Hindi, or Nepali.</p></article><article className="feature"><Lightbulb className="icon" /><h3>Curiosity starts here</h3><p>Turn a question about the universe into a lesson people remember.</p></article><article className="feature"><Sparkles className="icon" /><h3>Ready for YouTube</h3><p>Get a title, description, tags, keywords, and outline in one package.</p></article></section>
    {open && <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="creator-title"><div className="modal-head"><div><h2 id="creator-title">Create a new space video</h2><p className="muted">Give a topic and Gemini will shape the educational package.</p></div><button className="close" aria-label="Close creator" onClick={() => setOpen(false)}><X size={18} /></button></div><div className="field"><label htmlFor="language">Language</label><select id="language" value={language} onChange={(event) => setLanguage(event.target.value)}><option>English</option><option>Hindi</option><option>Nepali</option></select></div><div className="field"><label htmlFor="topic">Topic</label><div className="topic-row"><input id="topic" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. How black holes bend time" maxLength={300} /><button className="search" type="button" onClick={brainstorm} disabled={ideasLoading || topic.trim().length < 2} aria-label="Search YouTube-style topics">{ideasLoading ? "Searching..." : <><Search size={16} /> <span>Search this topic</span></>}</button></div></div>{ideas.length > 0 && <div className="ideas" aria-label="Brainstormed video topics"><div className="ideas-head"><strong>YouTube-inspired ideas</strong><span>{ideas.length} ideas</span></div>{ideas.map((idea) => <button className={`idea ${topic === idea ? "selected" : ""}`} key={idea} type="button" onClick={() => setTopic(idea)}>{idea}</button>)}</div>}<button className="generate" disabled={loading || topic.trim().length < 3} onClick={generate}>{loading ? "Creating with Gemini..." : "Generate YouTube package"}</button>{status && <p className="status" role="alert">{status}</p>}{result && <div className="result"><strong>Generated with {result.model}</strong>{"\n\n"}{result.text}</div>}</section></div>}
  </main>
}
