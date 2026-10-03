import { NextResponse } from "next/server"

export const maxDuration = 300

const preferredModels = [
  "gemini-3.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
]

const requestTimeoutMs = 90_000
const voiceoverTimeoutMs = 55_000
const packageContinuationTimeoutMs = 35_000
const maxPackageContinuations = 5
const protocolPromptUrls: Record<string, string> = {
  youtube: "https://raw.githubusercontent.com/amritpap2026-cell/Nasa-videos-for-education-/nasa-asset-engine/universal_youtube_master_prompt.txt",
  lesson: "https://raw.githubusercontent.com/amritpap2026-cell/Nasa-videos-for-education-/nasa-asset-engine/universal_classroom_lesson_master_prompt.txt",
  shorts: "https://raw.githubusercontent.com/amritpap2026-cell/Nasa-videos-for-education-/nasa-asset-engine/universal_shorts_master_prompt.txt",
}

function requiredPackageSections(packageType: string) {
  if (packageType === "lesson") return [...Array.from({ length: 18 }, (_, index) => index + 1), 25]
  if (packageType === "shorts") return [...Array.from({ length: 15 }, (_, index) => index + 1), 25]
  return Array.from({ length: 25 }, (_, index) => index + 1)
}

function getGeneratedSectionNumbers(text: string) {
  const numbers = new Set<number>()
  const regex = /(?:^|\n)\s*(?:PART|SECTION|STEP|भाग)\s*(\d+)\b/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) numbers.add(Number(match[1]))
  return numbers
}

function getMissingSections(text: string, packageType: string) {
  const required = requiredPackageSections(packageType)
  const found = getGeneratedSectionNumbers(text)
  return required.filter((n) => !found.has(n))
}

function getSectionBlocks(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const matches = [...normalized.matchAll(/(?:^|\n)\s*(?:PART|SECTION|STEP|भाग)\s*(\d+)\b[^\n]*\n([\s\S]*?)(?=\n\s*(?:PART|SECTION|STEP|भाग)\s*\d+\b|$)/gi)]
  return matches.map((match) => ({ number: Number(match[1]), body: match[2].trim() }))
}

function getWordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

function getCandidateText(candidate: any) {
  return candidate?.content?.parts
    ?.map((part: { text?: string }) => part?.text || "")
    .join("")
    .trim() || ""
}

function getFinishReason(candidate: any) {
  return typeof candidate?.finishReason === "string" ? candidate.finishReason : ""
}

function getMainScript(text: string, packageType: string) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  if (packageType === "youtube") {
    const match = normalized.match(/PART\s*11\b[^\n]*<<<STORYTELLING_SCRIPT_START>>>\s*([\s\S]*?)\s*<<<STORYTELLING_SCRIPT_END>>>/i)
    return match?.[1]?.trim() || ""
  }
  const section = getSectionBlocks(normalized).find((item) => item.number === (packageType === "lesson" ? 11 : 5))
  return section?.body || ""
}

function getScriptMinimumWords(packageType: string, durationValue: number) {
  if (packageType === "youtube") return Math.max(300, Math.round(durationValue * 125 * 0.85))
  if (packageType === "lesson") return Math.max(250, Math.round(durationValue * 110 * 0.85))
  return Math.max(25, Math.round((durationValue / 60) * 140 * 0.9))
}

function getTimelineEndSeconds(text: string, packageType: string) {
  const blocks = getSectionBlocks(text)
  const targetSection = blocks.find((item) => item.number === (packageType === "youtube" ? 12 : packageType === "shorts" ? 6 : 12))
  if (!targetSection) return 0
  const matches = [...targetSection.body.matchAll(/(?:^|\n)\s*(?:\d{1,2}:)?\d{2}:\d{2}\b|(?:^|\n)\s*\d{1,3}:\d{2}\b/g)]
  let maxSeconds = 0
  for (const match of matches) {
    const value = match[0].trim().replace(/^.*?([0-9]{1,2}:?[0-9]{2}:?[0-9]{2})$/, "$1")
    const parts = value.split(":").map(Number)
    const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]
    if (Number.isFinite(seconds)) maxSeconds = Math.max(maxSeconds, seconds)
  }
  return maxSeconds
}

function injectAuthoritativeScript(text: string, packageType: string, script: string) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const sectionNumber = packageType === "youtube" ? 11 : packageType === "lesson" ? 11 : 5
  const label = packageType === "youtube" ? "PART" : "SECTION"
  const headingRegex = new RegExp(`(?:^|\\n)\\s*${label}\\s*${sectionNumber}\\b[^\\n]*\\n[\\s\\S]*?(?=\\n\\s*(?:PART|SECTION|STEP|भाग)\\s*\\d+\\b|$)`, "i")
  const replacement = `\\n${label} ${sectionNumber}\\n${packageType === "youtube" ? "<<<STORYTELLING_SCRIPT_START>>>\\n" : ""}${script}${packageType === "youtube" ? "\\n<<<STORYTELLING_SCRIPT_END>>>" : ""}\\n`
  if (headingRegex.test(normalized)) return normalized.replace(headingRegex, replacement)
  return normalized + `\\n\\n${label} ${sectionNumber}\\n${script}`
}

function auditPackage(text: string, packageType: string, durationValue: number) {
  const required = requiredPackageSections(packageType)
  const blocks = getSectionBlocks(text)
  const numbers = blocks.map((block) => block.number)
  const missing = required.filter((number) => !numbers.includes(number))
  const duplicates = required.filter((number) => numbers.filter((value) => value === number).length > 1)
  const wrongOrder = required.some((number, index) => numbers[index] !== number)
  const emptySections = blocks
    .filter((block) => required.includes(block.number))
    .filter((block) => getWordCount(block.body) < 8)
    .map((block) => block.number)
  const script = getMainScript(text, packageType)
  const scriptWords = getWordCount(script)
  const minimumScriptWords = getScriptMinimumWords(packageType, durationValue)
  const scriptPass = scriptWords >= minimumScriptWords
  const timelineEndSeconds = getTimelineEndSeconds(text, packageType)
  const targetSeconds = packageType === "shorts" ? durationValue : durationValue * 60
  const timelinePass = packageType === "lesson"
    ? true
    : timelineEndSeconds >= Math.max(1, Math.round(targetSeconds * 0.95))
  const wrapperPass = packageType !== "youtube" || /<<<STORYTELLING_SCRIPT_START>>>[\s\S]*<<<STORYTELLING_SCRIPT_END>>>/i.test(text)
  return {
    passed: missing.length === 0 && duplicates.length === 0 && emptySections.length === 0 && !wrongOrder && scriptPass && timelinePass && wrapperPass,
    missing, duplicates, emptySections, wrongOrder, scriptWords, minimumScriptWords, timelineEndSeconds, targetSeconds, scriptPass, timelinePass, wrapperPass,
  }
}

function pcmBase64ToWavBase64(base64: string, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const pcm = Buffer.from(base64, "base64")
  const byteRate = sampleRate * channels * (bitsPerSample / 8)
  const blockAlign = channels * (bitsPerSample / 8)
  const header = Buffer.alloc(44)
  header.write("RIFF", 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write("WAVE", 8)
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write("data", 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm]).toString("base64")
}

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

async function createFallbackPackage(topic: string, language: string, gradeLevel: string, length: string, packageType = "youtube") {
  const safeTopic = topic.trim() || "NASA and space exploration"
  let styleGuide = ""
  try {
    const response = await fetch(protocolPromptUrls[packageType] || protocolPromptUrls.youtube, { signal: AbortSignal.timeout(8_000), cache: "no-store" })
    if (response.ok) styleGuide = await response.text()
  } catch {
    // Keep the local package available when GitHub is unreachable.
  }

  const guideSections = [...styleGuide.matchAll(/^#{1,3}\s+(.+)$/gm)].map((match) => match[1].trim()).filter(Boolean).slice(0, 12)
  const sectionNote = guideSections.length ? guideSections.join(" | ") : "hook, educational clarity, SEO metadata, responsible NASA context, and duration-matched outline"
  if (language === "Hindi") {
    return `शीर्षक: ${safeTopic} | NASA की कहानी जो आपको जाननी चाहिए

विवरण: ${safeTopic} को सरल और सटीक अंतरिक्ष शिक्षा के माध्यम से समझिए। इस वीडियो में विज्ञान, प्रमाण, मिशन का संदर्भ और पृथ्वी के भविष्य के लिए इसका महत्व बताया गया है। यह Cosmos का स्वतंत्र शैक्षिक वीडियो है और NASA से संबद्ध या समर्थित नहीं है।

टैग: NASA, ${safeTopic}, अंतरिक्ष अन्वेषण, खगोल विज्ञान, ब्रह्मांड, विज्ञान शिक्षा, STEM

SEO कीवर्ड: ${safeTopic}, NASA शिक्षा, अंतरिक्ष विज्ञान, खगोल विज्ञान समझाया गया, ब्रह्मांड तथ्य

वीडियो की अवधि: ${length} मिनट
कक्षा: ${gradeLevel}. कठिन शब्दों की सरल परिभाषा, रोज़मर्रा के उदाहरण और 3 छोटे पुनरावृत्ति प्रश्न शामिल करें।

PART 11 (STORYTELLING SCRIPT)
<<<STORYTELLING_SCRIPT_START>>>
कल्पना कीजिए कि हम ${safeTopic} को एक सरल सवाल से समझने की यात्रा शुरू करते हैं। यह विषय क्यों महत्वपूर्ण है, वैज्ञानिक इसे कैसे पढ़ते हैं, और प्रमाण हमें क्या बताते हैं—इन बातों को धीरे-धीरे समझें। कारण, प्रक्रिया और परिणाम को कक्षा ${gradeLevel} के विद्यार्थियों के लिए सरल उदाहरणों से जोड़ें। NASA के मिशनों और अवलोकनों ने हमारी समझ कैसे बदली, इसका पृथ्वी और भविष्य के अन्वेषण से क्या संबंध है, और विद्यार्थी इससे क्या सीख सकते हैं—सब कुछ स्पष्ट रूप से समझाएं। अंत में मुख्य सीख दोहराएं और एक जिज्ञासु प्रश्न छोड़ें। इस कहानी को ${length} मिनट के पूरे वीडियो के लिए विस्तार दें।
<<<STORYTELLING_SCRIPT_END>>>

PART 12
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

PART 11 (STORYTELLING SCRIPT)
<<<STORYTELLING_SCRIPT_START>>>
कल्पना गर्नुहोस्, हामी ${safeTopic} बारे एउटा प्रश्नबाट यात्रा सुरु गर्छौं। यो विषय किन महत्वपूर्ण छ, वैज्ञानिकहरूले यसलाई कसरी अध्ययन गर्छन्, र प्रमाणहरूले हामीलाई के बताउँछन् भन्ने कुरा बिस्तारै बुझौं। कारण, प्रक्रिया र परिणामलाई कक्षा ${gradeLevel} का विद्यार्थीले बुझ्ने सरल उदाहरणसँग जोड्नुहोस्। NASA का मिसन र अवलोकनले हाम्रो ज्ञान कसरी बढाए, यसले पृथ्वी र भविष्यको अन्वेषणमा कस्तो अर्थ राख्छ, र यसबाट विद्यार्थीले के सिक्न सक्छन् भन्ने कुरा स्पष्ट रूपमा व्याख्या गर्नुहोस्। अन्त्यमा सिकेका मुख्य कुरा दोहोर्याउँदै अर्को जिज्ञासु प्रश्न छोड्नुहोस्। यो कथा ${length} मिनेटको पूर्ण भिडियोका लागि विस्तार गर्नुहोस्।
<<<STORYTELLING_SCRIPT_END>>>

PART 12
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

PART 11 (STORYTELLING SCRIPT)
<<<STORYTELLING_SCRIPT_START>>>
Imagine beginning with a simple question: why does ${safeTopic} matter to us? Follow the journey of how scientists observe it, what evidence reveals, and how each discovery changes our understanding. Explain the cause, the process, and the result in a clear story for students. Connect the science to Earth and end with one hopeful question for the learner.
<<<STORYTELLING_SCRIPT_END>>>

PART 12
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
    const { topic, language = "English", gradeLevel = "Class 8–12", length = "0-10", mode = "package", packageType = "youtube" } = requestBody
    if (mode !== "voiceover" && mode !== "thumbnail" && (typeof topic !== "string" || topic.length > 300)) return NextResponse.json({ error: "Please enter a topic no longer than 300 characters." }, { status: 400 })
    const normalizedLanguage = ["English", "Hindi", "Nepali"].includes(language) ? language : "English"
    const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "").trim()

    if (mode === "thumbnail" || mode === "ai-image" || mode === "ai-video" || mode === "ai-video-status") {
      if (!key) return NextResponse.json({ error: "GEMINI_API_KEY is not configured for AI visual generation." }, { status: 503 })
      const { GoogleGenAI } = await import("@google/genai")
      const ai = new GoogleGenAI({ apiKey: key })

      if (mode === "thumbnail") {
        const prompt = typeof requestBody?.prompt === "string" ? requestBody.prompt.trim() : ""
        if (!prompt) return NextResponse.json({ error: "Thumbnail concepts are required." }, { status: 400 })
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-image",
          contents: `Create ONE polished thumbnail/cover using ALL of these Section 25 thumbnail concepts as creative guidance. Combine compatible ideas intelligently rather than making a collage. Preserve the strongest subject, composition, visual hook, text guidance, and negative constraints from the concepts. Make it 16:9, mobile-readable, visually striking, educational, and scientifically accurate.

SECTION 25 — THUMBNAIL / COVER CONCEPTS:
${prompt}`,
          config: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
          },
        })
        const part = response.candidates?.[0]?.content?.parts?.find((item: { inlineData?: { data?: string; mimeType?: string } }) => item.inlineData?.data)
        const data = part?.inlineData?.data
        if (!data) return NextResponse.json({ error: "Gemini returned no generated thumbnail." }, { status: 502 })
        return NextResponse.json({ status: "complete", type: "thumbnail", url: "data:" + (part?.inlineData?.mimeType || "image/png") + ";base64," + data })
      }

      if (mode === "ai-image") {
        const prompt = typeof requestBody?.prompt === "string" ? requestBody.prompt.trim() : ""
        if (!prompt) return NextResponse.json({ error: "An image generation prompt is required." }, { status: 400 })
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-image",
          contents: prompt,
          config: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
          },
        })
        const part = response.candidates?.[0]?.content?.parts?.find((item: { inlineData?: { data?: string; mimeType?: string } }) => item.inlineData?.data)
        const data = part?.inlineData?.data
        const mimeType = part?.inlineData?.mimeType || "image/png"
        if (!data) return NextResponse.json({ error: "Gemini returned no generated image." }, { status: 502 })
        return NextResponse.json({ status: "complete", type: "image", url: "data:" + mimeType + ";base64," + data })
      }

      if (mode === "ai-video-status") {
        const operationName = typeof requestBody?.operation === "string" ? requestBody.operation.trim() : ""
        if (!operationName) return NextResponse.json({ error: "A video operation is required." }, { status: 400 })
        const operation = await ai.operations.getVideosOperation({ operation: operationName })
        if (operation.error) return NextResponse.json({ status: "failed", error: operation.error.message || "Video generation failed." }, { status: 502 })
        if (!operation.done) return NextResponse.json({ status: "processing", operation: operation.name || operationName })
        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri
        if (!videoUri) return NextResponse.json({ status: "failed", error: "Gemini completed the operation without a video URI." }, { status: 502 })
        return NextResponse.json({ status: "complete", type: "video", url: videoUri, operation: operation.name || operationName })
      }

      const prompt = typeof requestBody?.prompt === "string" ? requestBody.prompt.trim() : ""
      if (!prompt) return NextResponse.json({ error: "A video generation prompt is required." }, { status: 400 })
      const operation = await ai.models.generateVideos({
        model: "veo-3.1-generate-preview",
        prompt,
        config: { aspectRatio: "16:9", durationSeconds: 8 },
      })
      if (!operation.name) return NextResponse.json({ error: "Gemini did not return a video operation." }, { status: 502 })
      return NextResponse.json({ status: "processing", type: "video", operation: operation.name })
    }

    if (mode === "voiceover") {
      if (!key) return NextResponse.json({ error: "GEMINI_API_KEY is not configured for voiceover." }, { status: 503 })
      const script = typeof requestBody?.script === "string"
        ? requestBody.script
            .replace(/<<<[^>]+>>>/g, " ")
            .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ")
            .replace(/\b(?:\d{1,2}:)?\d{1,2}:\d{2}\s*(?:-|–|—|to)\s*(?:\d{1,2}:)?\d{1,2}:\d{2}\b/gi, " ")
            .replace(/\b\d{1,3}\s*(?:-|–|—|to)\s*\d{1,3}\s*(?:seconds?|secs?|sec|सेकंड)\b/gi, " ")
            .replace(/\b(?:pause|पॉज़|विराम)\s*\d*\s*(?:seconds?|सेकंड)?\b/gi, " ")
            .replace(/\b\d{1,2}:\d{2}\b/g, " ")
            .replace(/\b\d+(?:\.\d+)?\s*(?:seconds?|secs?|sec|सेकंड)\b/gi, " ")
            .replace(/\s*[—–-]\s*/g, " ")
            .replace(/[,;:!?]+/g, " ")
            .replace(/[<>*_#`]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
        : ""
      const voice = typeof requestBody?.voice === "string" ? requestBody.voice : "Kore"
      const voiceLanguage = ["English", "Hindi", "Nepali"].includes(language) ? language : "English"
      if (!script) return NextResponse.json({ error: "Add a storytelling script before generating voiceover." }, { status: 400 })
      const voicePrompt = `Read ONLY the pure spoken words in the narration below. Do not speak timestamps, time ranges, scene numbers, section or part numbers, labels, headings, metadata, production notes, punctuation, commas, hyphens, dashes, brackets, or symbols. Time ranges such as 0-22 sec, 00:00-00:22, or 0:22 are timing instructions only and must remain silent. Punctuation is only written structure and must never be read aloud. Do not invent, paraphrase, add, or remove spoken words. Perform it as a fluent, warm, cinematic educational voiceover for Class 8–12 students in ${voiceLanguage}. Preserve the exact meaning and language. Use natural pauses and clear pronunciation. Do not add an introduction or outro.\n\nPURE SPOKEN NARRATION:\n${script}`
      const voiceModels = [
        "gemini-3.8-flash-tts",
        "gemini-3.8-flash-lite-tts",
        "gemini-3.1-flash-tts-preview",
        "gemini-2.5-flash-preview-tts",
        "gemini-2.5-pro-preview-tts",
      ]
      const voiceErrors: string[] = []
      for (const model of voiceModels) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), voiceoverTimeoutMs)
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: voicePrompt }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
                },
              },
            }),
            signal: controller.signal,
          })
          if (!response.ok) {
            const errorText = await response.text().catch(() => "")
            voiceErrors.push(model + ": HTTP " + response.status + (errorText ? " — " + errorText.slice(0, 240) : ""))
            continue
          }
          const data = await response.json()
          const audio = data?.candidates?.[0]?.content?.parts?.find((part: { inlineData?: { data?: string; mimeType?: string } }) => part.inlineData?.data)?.inlineData
          if (audio?.data) {
            const mimeType = typeof audio.mimeType === "string" ? audio.mimeType : ""
            const isPcm = mimeType.toLowerCase().includes("audio/l16") || mimeType.toLowerCase().includes("pcm")
            const wavAudio = isPcm ? pcmBase64ToWavBase64(audio.data, 24000, 1, 16) : audio.data
            return NextResponse.json({
              audio: wavAudio,
              mimeType: isPcm ? "audio/wav" : mimeType || "audio/wav",
              model,
            })
          }
        } catch (error) {
          voiceErrors.push(model + ": " + (error instanceof Error ? error.message : "request failed"))
        } finally {
          clearTimeout(timeout)
        }
      }
      return NextResponse.json({
        error: "Gemini voiceover generation failed. Check the Gemini API key, TTS access, and quota.",
        details: voiceErrors.slice(0, 3),
      }, { status: 503 })
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
    const requestedLength = typeof length === "string" ? Number(length.split("-").pop()) : NaN
    const maxAllowedLength = packageType === "shorts" ? 180 : 180
    const minimumLength = packageType === "shorts" ? 10 : 1
    const safeLengthValue = Number.isFinite(requestedLength) ? Math.min(maxAllowedLength, Math.max(minimumLength, Math.round(requestedLength))) : packageType === "shorts" ? 60 : 10
    const selectedLength = `0-${safeLengthValue}`
    const normalizedPackageType = ["youtube", "lesson", "shorts"].includes(packageType) ? packageType : "youtube"
    if (!key) {
      return NextResponse.json({
        error: "A Gemini API key is required to generate a complete production package. No incomplete fallback package is returned.",
      }, { status: 503 })
    }
    let masterPrompt = ""
    try {
      const promptResponse = await fetch(protocolPromptUrls[normalizedPackageType], { signal: AbortSignal.timeout(8_000), next: { revalidate: 3600 } })
      if (promptResponse.ok) masterPrompt = await promptResponse.text()
    } catch {}

    if (!masterPrompt.trim()) {
      return NextResponse.json({
        error: "The selected master prompt could not be loaded. No incomplete package was generated.",
      }, { status: 503 })
    }

    const languageInstruction = normalizedLanguage === "Hindi"
      ? "Write every user-facing field entirely in Hindi using Devanagari script. Keep recognized scientific proper nouns such as NASA and mission names where appropriate."
      : normalizedLanguage === "Nepali"
        ? "Write every user-facing field entirely in Nepali using Devanagari script. Keep recognized scientific proper nouns such as NASA and mission names where appropriate."
        : "Write every user-facing field entirely in English."

    const durationValue = Number(selectedLength.split("-")[1]) || 10
    const durationMinutes = normalizedPackageType === "shorts" ? durationValue / 60 : durationValue
    const targetWords = normalizedPackageType === "shorts"
      ? Math.max(35, Math.round(durationMinutes * 155))
      : Math.max(450, Math.round(durationMinutes * 125))
    const protocolLabel = normalizedPackageType === "youtube" ? "YouTube 25-part production package" : normalizedPackageType === "lesson" ? "Classroom lesson protocol" : "YouTube Shorts protocol"

    // Generate the narration independently first. This prevents a long production package
    // from consuming the output budget before the actual word-for-word script is complete.
    const scriptSectionNumber = normalizedPackageType === "youtube" ? 11 : normalizedPackageType === "lesson" ? 11 : 5
    const scriptMinimumWords = getScriptMinimumWords(normalizedPackageType, durationValue)
    const scriptTargetWords = Math.max(scriptMinimumWords, targetWords)
    let authoritativeScript = ""
    let scriptModel = ""

    const scriptPrompt = [
      "Generate ONLY the complete word-for-word narration/teacher script for this production.",
      "Do not generate a production package. Do not generate outlines. Do not summarize.",
      "The result will be inserted verbatim into the final production package.",
      "",
      "TOPIC: " + topic.trim(),
      "OUTPUT LANGUAGE: " + normalizedLanguage,
      "STUDENT LEVEL: " + gradeLevel,
      "REQUESTED LENGTH: " + selectedLength + " minutes",
      "TARGET SCRIPT LENGTH: at least " + scriptTargetWords + " words.",
      "SCRIPT FORMAT:",
      normalizedPackageType === "youtube"
        ? "This is the YouTube PART 11 storytelling narration."
        : normalizedPackageType === "lesson"
          ? "This is the Classroom SECTION 11 complete teacher script."
          : "This is the Shorts SECTION 5 complete word-for-word script.",
      "",
      languageInstruction,
      "",
      "SCRIPT REQUIREMENTS:",
      "- Write a complete natural word-for-word spoken script for the entire requested runtime.",
      "- Do not write an outline, bullet summary, production notes, or placeholder text.",
      "- Do not say that the script continues later.",
      "- Do not stop after the introduction.",
      "- Include the full beginning, middle, explanation/story, and ending.",
      "- Meet or exceed the target word count.",
      "- Output only the script text, with no heading or commentary.",
    ].join("\n")

    const scriptModels = await getAvailableModels(key)
    const maxScriptContinuations = 8

    for (const model of scriptModels) {
      let scriptDraft = ""
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: scriptPrompt }] }],
              generationConfig: {
                temperature: 0.65,
                maxOutputTokens: Math.min(60000, Math.max(12000, Math.round(scriptTargetWords * 2.4) + 4000)),
              },
            }),
            signal: AbortSignal.timeout(requestTimeoutMs),
          },
        )
        if (!response.ok) continue

        const data = await response.json()
        const candidate = data?.candidates?.[0]
        scriptDraft = getCandidateText(candidate)
        if (!scriptDraft) continue

        let scriptFinishReason = getFinishReason(candidate)
        for (let continuation = 0; continuation < maxScriptContinuations && (getWordCount(scriptDraft) < scriptTargetWords || scriptFinishReason === "MAX_TOKENS"); continuation += 1) {
          const continuationPrompt = [
            "CONTINUE THE SAME WORD-FOR-WORD SCRIPT. DO NOT RESTART IT.",
            "The previous generation stopped before the requested script length.",
            "Continue naturally from the exact end of the previous text until the complete requested runtime is covered.",
            "",
            "TOPIC: " + topic.trim(),
            "OUTPUT LANGUAGE: " + normalizedLanguage,
            "STUDENT LEVEL: " + gradeLevel,
            "REQUESTED LENGTH: " + selectedLength + " minutes",
            "TARGET SCRIPT LENGTH: at least " + scriptTargetWords + " words.",
            "CURRENT SCRIPT WORDS: " + getWordCount(scriptDraft),
            "",
            "OUTPUT ONLY THE NEW CONTINUATION TEXT.",
            "Do not repeat the previous ending.",
            "Do not add a heading, notes, outline, summary, or commentary.",
            "Continue the story/explanation and finish with a proper conclusion when the target runtime is reached.",
            "",
            "END OF CURRENT SCRIPT:",
            scriptDraft.slice(-24000),
          ].join("\n")

          const continuationResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: continuationPrompt }] }],
                generationConfig: {
                  temperature: 0.55,
                  maxOutputTokens: Math.min(30000, Math.max(8000, Math.round((scriptTargetWords - getWordCount(scriptDraft)) * 2.4) + 2500)),
                },
              }),
              signal: AbortSignal.timeout(requestTimeoutMs),
            },
          )
          if (!continuationResponse.ok) break
          const continuationData = await continuationResponse.json()
          const continuationCandidate = continuationData?.candidates?.[0]
          const continuationText = getCandidateText(continuationCandidate)
          if (!continuationText) break
          scriptDraft = (scriptDraft + "\n\n" + continuationText).trim()
          scriptFinishReason = getFinishReason(continuationCandidate)
        }

        if (getWordCount(scriptDraft) >= scriptTargetWords && scriptFinishReason !== "SAFETY" && scriptFinishReason !== "RECITATION") {
          authoritativeScript = scriptDraft
          scriptModel = model
          break
        }
      } catch {
        continue
      }
    }
    if (!authoritativeScript) {
      return NextResponse.json({
        error: "Gemini could not produce the complete word-for-word script at the requested length. No incomplete package was accepted.",
      }, { status: 503 })
    }
    const prompt = [
      "You are generating a " + protocolLabel + ".",
      "",
      "AUTHORITATIVE PROTOCOL:",
      masterPrompt || "Use the dedicated protocol structure and complete every numbered section.",
      "",
      "TOPIC: " + topic.trim(),
      "OUTPUT LANGUAGE: " + normalizedLanguage,
      "STUDENT LEVEL: " + gradeLevel,
      "REQUESTED LENGTH: " + selectedLength + " minutes",
      "TARGET NARRATION WORDS: approximately " + targetWords,
      "",
      "AUTHORITATIVE WORD-FOR-WORD SCRIPT:",
      authoritativeScript,
      "",
      "The script above is authoritative. Insert it verbatim into the protocol's main script section (YouTube PART 11, Classroom SECTION 11, Shorts SECTION 5). Do not shorten, summarize, rewrite, or replace it.",
      "",
      "LANGUAGE REQUIREMENT:", languageInstruction,
      "",
      "EXECUTION RULES:",
      "- Follow the selected protocol exactly.",
      "- Do not mix YouTube, classroom, and Shorts protocols.",
      "- For YouTube, output PART 1 through PART 25 exactly once, in numerical order.",
      "- For Classroom Lesson, output SECTION 1 through SECTION 18, then SECTION 25 exactly once. Do not output Sections 19–24.",
      "- For Shorts, output SECTION 1 through SECTION 15, then SECTION 25 exactly once. Do not output Sections 16–24.",
      "- Never stop early because the response is long.",
      "- Match all timestamps to the authoritative script above.",
      "- The authoritative script must appear in the main script section verbatim.",
      "- If a long package cannot fit in one response, the system will request continuation; then output only the missing sections requested.",
      "- Do not replace missing sections with a summary or duplicate an existing section.",
      "",
      "Return only the completed protocol output.",
    ].join("\n")

    const maxOutputTokens = Math.min(60000, Math.max(12000, Math.round(targetWords * 2.2) + 8000))
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
        const candidate = data?.candidates?.[0]
        const generatedText = getCandidateText(candidate)
        const finishReason = getFinishReason(candidate)
        if (generatedText && finishReason !== "SAFETY" && finishReason !== "RECITATION") {
          let completeText = generatedText
          let audit = auditPackage(completeText, normalizedPackageType, durationValue)
          // The script was generated independently; replace the package's script section
          // with that exact authoritative script before every audit.
          completeText = injectAuthoritativeScript(completeText, normalizedPackageType, authoritativeScript)
          audit = auditPackage(completeText, normalizedPackageType, durationValue)

          for (let continuation = 0; continuation < maxPackageContinuations && !audit.passed; continuation += 1) {
            const missing = audit.missing
            const scriptSection = normalizedPackageType === "shorts" ? 5 : 11
            const timelineSection = normalizedPackageType === "youtube" ? 12 : normalizedPackageType === "shorts" ? 6 : 11
            const needsScriptRepair = !audit.scriptPass || !audit.wrapperPass
            const needsTimelineRepair = !audit.timelinePass
            const continuationPrompt = [
              "PACKAGE REPAIR / CONTINUATION REQUIRED.",
              "Do not return an audit report. Return production content only.",
              "The package is not complete until the server audit passes.",
              "Protocol: " + normalizedPackageType,
              "Topic: " + topic.trim(),
              "Language: " + normalizedLanguage,
              "Requested length: " + selectedLength + " minutes",
              "Required sections: " + requiredPackageSections(normalizedPackageType).join(", "),
              "Missing sections: " + (missing.length ? missing.join(", ") : "none"),
              "Empty/too-short sections: " + (audit.emptySections.length ? audit.emptySections.join(", ") : "none"),
              "Current script section: " + scriptSection,
              "Script minimum words: " + audit.minimumScriptWords,
              "Current script words: " + audit.scriptWords,
              "Timeline target seconds: " + audit.targetSeconds,
              "Current timeline end seconds: " + audit.timelineEndSeconds,
              needsScriptRepair ? "SCRIPT REPAIR REQUIRED: output a complete replacement of the script section for the entire requested runtime. Do not summarize or shorten it." : "",
              needsTimelineRepair ? "TIMELINE REPAIR REQUIRED: output a complete replacement of the timeline section so it reaches the requested runtime and aligns with the full script." : "",
              missing.length || audit.emptySections.length
                ? "SECTION COMPLETION REQUIRED: generate every missing or too-short section with substantial production content, in numerical order, without repeating existing sections."
                : "",
              "",
              "Current script that must be preserved or replaced if repair is required:",
              getMainScript(completeText, normalizedPackageType).slice(0, 30000),
              "",
              "Existing package tail for continuity:",
              completeText.slice(-30000),
              "",
              "AUTHORITATIVE PROTOCOL:",
              masterPrompt || "Follow the selected protocol exactly.",
              "",
              "If repairing an existing script or timeline, output the complete replacement section with its required heading. Never append a second copy of that section.",
              "Do not output explanations, apologies, or summaries.",
            ].filter(Boolean).join("\n")

            const continuationResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: continuationPrompt }] }],
                  generationConfig: { temperature: 0.55, maxOutputTokens: Math.min(50000, Math.max(16000, maxOutputTokens)) },
                }),
                signal: AbortSignal.timeout(packageContinuationTimeoutMs),
              },
            )
            if (!continuationResponse.ok) break
            const continuationData = await continuationResponse.json()
            const continuationCandidate = continuationData?.candidates?.[0]
            const continuationText = getCandidateText(continuationCandidate)
            if (!continuationText || ["SAFETY", "RECITATION"].includes(getFinishReason(continuationCandidate))) break

            const replacementBlocks = getSectionBlocks(continuationText)
            const replacementNumbers = new Set<number>()
            for (const number of [scriptSection, timelineSection]) {
              const body = replacementBlocks.find((block) => block.number === number)?.body
              if (!body) continue
              replacementNumbers.add(number)
              const headingRegex = new RegExp(`(?:^|\\n)\\s*(?:PART|SECTION|STEP|भाग)\\s*${number}\\b[^\\n]*\\n[\\s\\S]*?(?=\\n\\s*(?:PART|SECTION|STEP|भाग)\\s*\\d+\\b|$)`, "i")
              if (headingRegex.test(completeText)) {
                completeText = completeText.replace(headingRegex, `\\n${normalizedPackageType === "youtube" ? "PART" : "SECTION"} ${number}\\n${body}\\n`)
              }
            }
            const existingNumbers = getGeneratedSectionNumbers(completeText)
            const newBlocks = replacementBlocks.filter((block) => !existingNumbers.has(block.number) && !replacementNumbers.has(block.number))
            if (newBlocks.length) {
              completeText += "\n\n" + newBlocks.map((block) => `${normalizedPackageType === "youtube" ? "PART" : "SECTION"} ${block.number}\n${block.body}`).join("\n\n")
            }
            audit = auditPackage(completeText, normalizedPackageType, durationValue)
          }

          completeText = injectAuthoritativeScript(completeText, normalizedPackageType, authoritativeScript)
          audit = auditPackage(completeText, normalizedPackageType, durationValue)
          if (audit.passed) {
            return NextResponse.json({
              text: completeText,
              script: authoritativeScript,
              model,
              scriptModel,
              audit,
            })
          }
          continue
        }
      } catch {
        // Try the next free model when a model is unavailable or times out.
      } finally {
        clearTimeout(timeout)
      }
    }

    return NextResponse.json({
      error: "No Gemini model produced a package that passed the full script and protocol audit. The app will not return an incomplete package.",
      audit: { passed: false, reason: "All configured Gemini models failed the completion audit." },
    }, { status: 503 })
  } catch {
    return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 })
  }
}
