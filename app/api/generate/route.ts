import { NextResponse } from "next/server"

const preferredModels = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
]

const requestTimeoutMs = 25_000
const masterPromptUrl = "https://raw.githubusercontent.com/amritpap2026-cell/Nasa-videos-for-education-/main/universal_youtube_master_prompt.txt"

async function getAvailableModels(key: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      { signal: controller.signal, cache: "no-store" },
    )
    if (!response.ok) return preferredModels
    const data = await response.json()
    const available = Array.isArray(data?.models)
      ? data.models
          .filter(
            (model: { name?: string; supportedGenerationMethods?: string[] }) =>
              model.name?.startsWith("models/gemini-") &&
              model.supportedGenerationMethods?.includes("generateContent"),
          )
          .map((model: { name: string }) => model.name.replace("models/", ""))
      : []

    const preferred = preferredModels.filter((model) => available.includes(model))
    return [...preferred, ...available.filter((model: string) => !preferred.includes(model))]
  } catch {
    return preferredModels
  } finally {
    clearTimeout(timeout)
  }
}

function createFallbackTopics(topic: string, language: string) {
  const subject = topic.trim() || "NASA and space exploration"
  const languageLabel = language === "English" ? "" : ` (${language})`
  return [
    `What NASA just discovered about ${subject}`,
    `${subject}: the space mystery scientists still cannot explain`,
    `The hidden science behind ${subject}`,
    `Could ${subject} change life on Earth?`,
    `NASA's most surprising facts about ${subject}`,
    `${subject} explained in 10 minutes for curious minds`,
    `The future of ${subject} and humanity's next giant leap`,
    `What students should know about ${subject}${languageLabel}`,
  ]
}

async function createFallbackPackage(topic: string, language: string, gradeLevel: string, length: string) {
  const safeTopic = topic.trim() || "NASA and space exploration"
  let styleGuide = ""
  try {
    const response = await fetch(masterPromptUrl, { signal: AbortSignal.timeout(8_000), cache: "no-store" })
    if (response.ok) styleGuide = await response.text()
  } catch {
    // Keep the local package available when GitHub is unreachable.
  }

  const guideSections = [...styleGuide.matchAll(/^#{1,3}\\s+(.+)$/gm)].map((match) => match[1].trim()).filter(Boolean).slice(0, 12)
  const sectionNote = guideSections.length ? guideSections.join(" | ") : "hook, educational clarity, SEO metadata, responsible NASA context, and duration-matched outline"
  if (language === "Hindi") {
    return `शीर्षक: ${safeTopic} | NASA की कहानी जो आपको जाननी चाहिए

विवरण: ${safeTopic} को सरल और सटीक अंतरिक्ष शिक्षा के माध्यम से समझिए। इस वीडियो में विज्ञान, प्रमाण, मिशन का संदर्भ और पृथ्वी के भविष्य के लिए इसका महत्व बताया गया है। यह Cosmos का स्वतंत्र शैक्षिक वीडियो है और NASA से संबद्ध या समर्थित नहीं है।

टैग: NASA, ${safeTopic}, अंतरिक्ष अन्वेषण, खगोल विज्ञान, ब्रह्मांड, विज्ञान शिक्षा, STEM

SEO कीवर्ड: ${safeTopic}, NASA शिक्षा, अंतरिक्ष विज्ञान, खगोल विज्ञान समझाया गया, ब्रह्मांड तथ्य

वीडियो की अवधि: ${length} मिनट
कक्षा: ${gradeLevel}. कठिन शब्दों की सरल परिभाषा, रोज़मर्रा के उदाहरण और 3 छोटे पुनरावृत्ति प्रश्न शामिल करें।

कहानी की स्क्रिप्ट:
कल्पना कीजिए कि हम ${safeTopic} को एक सरल सवाल से समझने की यात्रा शुरू करते हैं। यह विषय क्यों महत्वपूर्ण है, वैज्ञानिक इसे कैसे पढ़ते हैं, और प्रमाण हमें क्या बताते हैं—इन बातों को धीरे-धीरे समझें। कारण, प्रक्रिया और परिणाम को कक्षा ${gradeLevel} के विद्यार्थियों के लिए सरल उदाहरणों से जोड़ें। NASA के मिशनों और अवलोकनों ने हमारी समझ कैसे बदली, इसका पृथ्वी और भविष्य के अन्वेषण से क्या संबंध है, और विद्यार्थी इससे क्या सीख सकते हैं—सब कुछ स्पष्ट रूप से समझाएं। अंत में मुख्य सीख दोहराएं और एक जिज्ञासु प्रश्न छोड़ें। इस कहानी को ${length} मिनट के पूरे वीडियो के लिए विस्तार दें।

वीडियो रूपरेखा:
00:00 शुरुआत: हमें ${safeTopic} की परवाह क्यों करनी चाहिए?
01:00 मुख्य प्रश्न और आवश्यक संदर्भ
03:00 विज्ञान, प्रमाण और NASA ने क्या सीखा
06:00 पृथ्वी और भविष्य के अन्वेषण के लिए इसका अर्थ
08:00 मुख्य बातें और सीखते रहने का निमंत्रण

आह्वान: सटीक और प्रेरक NASA अंतरिक्ष शिक्षा के लिए सदस्यता लें और इसे विद्यार्थियों के साथ साझा करें।
मास्टर प्रॉम्प्ट शैली: ${sectionNote}`
  }
  if (language === "Nepali") {
    return `शीर्षक: ${safeTopic} | NASA को कथा जुन तपाईंले जान्नुपर्छ

विवरण: ${safeTopic} लाई सरल र सही अन्तरिक्ष शिक्षामार्फत बुझ्नुहोस्। यस भिडियोमा विज्ञान, प्रमाण, मिसनको सन्दर्भ र पृथ्वीको भविष्यका लागि यसको महत्व बताइएको छ। यो Cosmos को स्वतन्त्र शैक्षिक भिडियो हो र NASA सँग सम्बन्धित वा समर्थित छैन।

ट्याग: NASA, ${safeTopic}, अन्तरिक्ष अन्वेषण, खगोल विज्ञान, ब्रह्माण्ड, विज्ञान शिक्षा, STEM

SEO कीवर्ड: ${safeTopic}, NASA शिक्षा, अन्तरिक्ष विज्ञान, खगोल विज्ञान व्याख्या, ब्रह्माण्डका तथ्य

भिडियो अवधि: ${length} मिनेट
कक्षा: ${gradeLevel}। कठिन शब्दको सरल परिभाषा, दैनिक जीवनका उदाहरण र 3 वटा छोटा पुनरावृत्ति प्रश्न समावेश गर्नुहोस्।

कथात्मक स्क्रिप्ट:
कल्पना गर्नुहोस्, हामी ${safeTopic} बारे एउटा प्रश्नबाट यात्रा सुरु गर्छौं। यो विषय किन महत्वपूर्ण छ, वैज्ञानिकहरूले यसलाई कसरी अध्ययन गर्छन्, र प्रमाणहरूले हामीलाई के बताउँछन् भन्ने कुरा बिस्तारै बुझौं। कारण, प्रक्रिया र परिणामलाई कक्षा ${gradeLevel} का विद्यार्थीले बुझ्ने सरल उदाहरणसँग जोड्नुहोस्। NASA का मिसन र अवलोकनले हाम्रो ज्ञान कसरी बढाए, यसले पृथ्वी र भविष्यको अन्वेषणमा कस्तो अर्थ राख्छ, र यसबाट विद्यार्थीले के सिक्न सक्छन् भन्ने कुरा स्पष्ट रूपमा व्याख्या गर्नुहोस्। अन्त्यमा सिकेका मुख्य कुरा दोहोर्याउँदै अर्को जिज्ञासु प्रश्न छोड्नुहोस्। यो कथा ${length} मिनेटको पूर्ण भिडियोका लागि विस्तार गर्नुहोस्।

भिडियो रूपरेखा:
00:00 सुरुवात: हामीले ${safeTopic} बारे किन जान्नुपर्छ?
01:00 मुख्य प्रश्न र आवश्यक सन्दर्भ
03:00 विज्ञान, प्रमाण र NASA ले सिकेका कुरा
06:00 पृथ्वी र भविष्यको अन्वेषणका लागि यसको अर्थ
08:00 मुख्य कुरा र निरन्तर सिकाइको निमन्त्रणा

आह्वान: सही र प्रेरणादायी NASA अन्तरिक्ष शिक्षाका लागि सदस्यता लिनुहोस् र विद्यार्थीहरूसँग साझा गर्नुहोस्।
मास्टर प्रॉम्प्ट शैली: ${sectionNote}`
  }
  return `TITLE: ${safeTopic} | The NASA Story You Need to Know

DESCRIPTION: Discover ${safeTopic} through clear, accurate space education. This episode explains the science, evidence, mission context, and why this topic matters for our shared future. This independent educational video is not affiliated with or endorsed by NASA.

TAGS: NASA, ${safeTopic}, space exploration, astronomy, cosmos, science education, universe, STEM

SEO KEYWORDS: ${safeTopic}, NASA education, space science, astronomy explained, universe facts, STEM learning

VIDEO LENGTH: ${length} minutes
STUDENT LEVEL: ${gradeLevel}. Define difficult words, use familiar examples, and include 3 short review questions.

STORYTELLING SCRIPT:
Imagine beginning with a simple question: why does ${safeTopic} matter to us? Follow the journey of how scientists observe it, what evidence reveals, and how each discovery changes our understanding. Explain the cause, the process, and the result in a clear story for students. Connect the science to Earth and end with one hopeful question for the learner.

VIDEO OUTLINE:
00:00 Hook: Why should we care about ${safeTopic}?
01:00 The big question and essential context
03:00 Science, evidence, and what NASA has learned
06:00 What this means for Earth and future exploration
08:00 Key takeaways and invitation to keep learning

CALL TO ACTION: Subscribe for accurate, inspiring NASA space education and share this episode with a curious learner.
MASTER PROMPT STYLE: ${sectionNote}`
}

export async function POST(request: Request) {
  try {
    const requestBody = await request.json()
    const { topic, language = "English", gradeLevel = "Class 8–12", length = "0-10", mode = "package" } = requestBody
    if (mode !== "voiceover" && (typeof topic !== "string" || topic.length > 300)) return NextResponse.json({ error: "Please enter a topic no longer than 300 characters." }, { status: 400 })
    const normalizedLanguage = ["English", "Hindi", "Nepali"].includes(language) ? language : "English"
    const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim()

    if (mode === "voiceover") {
      if (!key) return NextResponse.json({ error: "GEMINI_API_KEY is not configured for voiceover." }, { status: 503 })
      const script = typeof requestBody?.script === "string"
        ? requestBody.script.replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ").replace(/\b(?:pause|पॉज़|विराम)\s*\d*\s*(?:seconds?|सेकंड)?\b/gi, " ").replace(/\s*[—–-]\s*/g, " ").replace(/[<>*_#`]/g, " ").replace(/\s+/g, " ").trim()
        : ""
      const voice = typeof requestBody?.voice === "string" ? requestBody.voice : "Kore"
      const voiceLanguage = ["English", "Hindi", "Nepali"].includes(language) ? language : "English"
      if (!script) return NextResponse.json({ error: "Add a storytelling script before generating voiceover." }, { status: 400 })
      const voicePrompt = `Read only the storytelling narration below, not any title, label, heading, metadata, timestamps, or production note. Perform it as a fluent, warm, cinematic educational voiceover for Class 8–12 students in ${voiceLanguage}. Preserve the exact meaning and language. Use natural pauses, emotional emphasis, and clear pronunciation. Do not add an introduction or outro.\n\nSTORYTELLING NARRATION:\n${script}`
      const models = await getAvailableModels(key)
      const voiceModels = ["gemini-2.5-flash-preview-tts", "gemini-2.5-flash-tts", ...models.filter((model: string) => model.includes("tts"))]
      for (const model of [...new Set(voiceModels)]) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: voicePrompt }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
            signal: controller.signal,
          })
          if (!response.ok) continue
          const data = await response.json()
          const audio = data?.candidates?.[0]?.content?.parts?.find((part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData?.data)?.inlineData
          if (audio?.data) return NextResponse.json({ audio: audio.data, mimeType: audio.mimeType || "audio/wav", model })
        } catch {
          // Try the next available Gemini TTS model.
        } finally {
          clearTimeout(timeout)
        }
      }
      return NextResponse.json({ error: "Gemini voiceover models are unavailable. Check that your Gemini API key has access to a TTS model." }, { status: 503 })
    }

    if (mode === "brainstorm") {
      if (topic.trim().length < 2) return NextResponse.json({ error: "Enter a few words so we can brainstorm around them." }, { status: 400 })
      if (!key) return NextResponse.json({ topics: createFallbackTopics(topic, normalizedLanguage), model: "free brainstorm fallback" })
      const brainstormPrompt = `You are a brilliant YouTube trend researcher and producer for a NASA space education channel. Based on the seed ${topic.trim()}, brainstorm 8 catchy, intelligent, curiosity-driven video topic titles by analyzing common competitor-style hooks, questions, comparisons, mysteries, and explainers that perform well in educational YouTube search. This is a search-style brainstorm, not live YouTube results; do not claim you searched live YouTube data. Make every title accurate, educational, emotionally compelling, distinct, and suitable for ${normalizedLanguage}. Return only a numbered list of 8 titles, one per line, with no introduction.`
      const models = await getAvailableModels(key)
      for (const model of models) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: brainstormPrompt }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 700 } }), signal: controller.signal })
          if (!response.ok) continue
          const data = await response.json()
          const generated = data?.candidates?.[0]?.content?.parts?.[0]?.text
          const topics = typeof generated === "string" ? generated.split("\n").map((line: string) => line.replace(/^\s*\d+[.)-]\s*/, "").trim()).filter((line: string) => line.length >= 8 && line.length <= 180).slice(0, 10) : []
          if (topics.length >= 5) return NextResponse.json({ topics, model })
        } catch {
          // Continue through free Gemini models before using the local brainstorm.
        } finally {
          clearTimeout(timeout)
        }
      }
      return NextResponse.json({ topics: createFallbackTopics(topic, normalizedLanguage), model: "free brainstorm fallback" })
    }

    if (topic.trim().length < 3) return NextResponse.json({ error: "Please enter a topic with at least 3 characters." }, { status: 400 })
    const selectedLength = ["0-5", "0-10", "0-15", "0-30", "0-60"].includes(length) ? length : "0-10"
    if (!key) return NextResponse.json({ text: await createFallbackPackage(topic, normalizedLanguage, gradeLevel, selectedLength), model: "local master-prompt fallback" })
    let masterPrompt = ""
    try {
      const promptResponse = await fetch(masterPromptUrl, { signal: AbortSignal.timeout(8_000), next: { revalidate: 3600 } })
      if (promptResponse.ok) masterPrompt = await promptResponse.text()
    } catch {
      // The concise prompt below remains available when GitHub is unreachable.
    }
    const languageInstruction = normalizedLanguage === "Hindi"
      ? "Write every user-facing field entirely in Hindi using Devanagari script, including the title, description, tags, SEO keywords, outline, narration, captions, calls to action, and any extra sections. Keep proper nouns such as NASA, spacecraft, and mission names in their recognized form when appropriate, but do not switch the surrounding text to English."
      : normalizedLanguage === "Nepali"
        ? "Write every user-facing field entirely in Nepali using Devanagari script, including the title, description, tags, SEO keywords, outline, narration, captions, calls to action, and any extra sections. Keep proper nouns such as NASA, spacecraft, and mission names in their recognized form when appropriate, but do not switch the surrounding text to English."
        : "Write every user-facing field entirely in English, including the title, description, tags, SEO keywords, outline, narration, captions, calls to action, and any extra sections."
    const maxMinutes = Number(selectedLength.split("-")[1]) || 10
    const targetWords = Math.max(450, Math.round(maxMinutes * 125))
    const maxOutputTokens = Math.min(14000, Math.max(2200, Math.round(targetWords * 1.65) + 1400))
    const prompt = `You are generating a complete YouTube production package.\n\nAUTHORITATIVE STYLE GUIDE (style and required sections only):\n${masterPrompt || "Use a clear, accurate, curiosity-driven NASA space education style with a strong hook, student-friendly explanations, search-friendly metadata, and a practical timestamped structure."}\n\nFollow the style guide for structure, quality, tone, and metadata strategy. However, the selected language below is a hard requirement and overrides any language instruction or English-only example inside the style guide. Never translate only the description: translate every generated field.\n\nTOPIC: ${topic.trim()}\nSELECTED OUTPUT LANGUAGE: ${normalizedLanguage}\nDESIRED VIDEO LENGTH: ${selectedLength} minutes\nSTUDENT LEVEL: ${gradeLevel}\n\nMake this appropriate for the selected school level: define difficult words, use age-appropriate examples, explain one idea at a time, and finish with 3 short review questions.\n\nHARD LANGUAGE REQUIREMENT: ${languageInstruction}\n\nDURATION REQUIREMENT: The STORYTELLING SCRIPT is a complete narration for the full requested video length, not a short summary. Write approximately ${targetWords} words (about 125 spoken words per minute) and organize it as a flowing cinematic educational story. For a range such as 0-10, write for up to 10 minutes. Cover the opening mystery, why the topic matters, the historical or scientific context, how it works or happened step by step, the evidence and NASA missions or observations, common misconceptions, its connection to Earth and student curriculum, and a memorable conclusion. Use transitions and vivid but scientifically accurate imagery. Do not stop after the hook or outline.\n\nBefore finishing, check every section and remove English sentences, labels, headings, and explanatory notes when Hindi or Nepali is selected. Return a production-ready package containing every section required by the style guide, including title, description, tags, SEO keywords, a standalone Part 11 section with exactly one of these language-appropriate labels: "पूर्ण शब्द-प्रति-शब्द कथा वाचन लिपि (STORYTELLING SCRIPT)" for Nepali, "FULL WORD-FOR-WORD SCRIPT (STORYTELLING SCRIPT)" for English, or "पूर्ण शब्द-दर-शब्द स्क्रिप्ट (STORYTELLING SCRIPT)" for Hindi, followed by the complete word-for-word story, and a timestamped video outline whose timing fits the selected duration. The STORYTELLING SCRIPT must be the only narration source: do not put titles, tags, SEO labels, timestamps, calls to action, chapter headings, sound effects, stage directions, or production notes inside it. The client will send only this section to voiceover. Keep facts scientifically responsible, accessible to learners, inspiring, and do not claim NASA endorsement. Return only the finished package.`
    const models = await getAvailableModels(key)

    for (const model of models) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens },
            }),
            signal: controller.signal,
          },
        )
        if (!response.ok) continue
        const data = await response.json()
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (typeof text === "string" && text.trim()) return NextResponse.json({ text, model })
      } catch {
        // Try the next free model when a model is unavailable or times out.
      } finally {
        clearTimeout(timeout)
      }
    }

    return NextResponse.json({
      text: await createFallbackPackage(topic, normalizedLanguage, gradeLevel, selectedLength),
      model: "fallback",
      notice: "Gemini models were unavailable. This package was created locally.",
    })
  } catch {
    return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 })
  }
}
