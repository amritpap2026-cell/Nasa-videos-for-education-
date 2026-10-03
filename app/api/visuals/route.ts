import { NextResponse } from "next/server"
import { matchNasaCaptions } from "../../../video/nasa-caption-matcher"


async function searchSvsVideos(searchTerms: string[], topic: string) {
  const uniqueTerms = Array.from(new Set(searchTerms.map((term) => term.trim()).filter((term) => term.length >= 2))).slice(0, 3)
  const searchResponses = await Promise.all(
    uniqueTerms.map(async (term) => {
      try {
        const response = await fetch(
          `https://svs.gsfc.nasa.gov/api/search/?search=${encodeURIComponent(term)}&limit=8`,
          { headers: { Accept: "application/json" }, next: { revalidate: 3600 } },
        )
        if (!response.ok) return []
        const data = await response.json()
        return Array.isArray(data?.results) ? data.results : []
      } catch {
        return []
      }
    }),
  )

  const pages = Array.from(
    new Map(
      searchResponses.flat().map((item: { id?: number; url?: string; title?: string; description?: string }) => [
        item.id || item.url,
        item,
      ]),
    ).values(),
  ).slice(0, 8)

  const detailed = await Promise.all(
    pages.map(async (item: { id?: number; url?: string; title?: string; description?: string }) => {
      if (!item.id) return null
      try {
        const response = await fetch(`https://svs.gsfc.nasa.gov/api/${item.id}/`, {
          headers: { Accept: "application/json" },
          next: { revalidate: 3600 },
        })
        if (!response.ok) return null
        return await response.json()
      } catch {
        return null
      }
    }),
  )

  const collectMedia = (value: unknown, results: Array<{ url?: string; filename?: string; media_type?: string }> = []) => {
    if (!value) return results
    if (Array.isArray(value)) {
      for (const item of value) collectMedia(item, results)
      return results
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>
      if (typeof record.url === "string" && typeof record.media_type === "string") {
        results.push({
          url: record.url,
          filename: typeof record.filename === "string" ? record.filename : undefined,
          media_type: record.media_type,
        })
      }
      for (const child of Object.values(record)) collectMedia(child, results)
    }
    return results
  }

  return detailed
    .filter(Boolean)
    .map((page: any) => {
      const media = collectMedia(page)
      const video = page.main_video?.url
        ? page.main_video
        : media.find((item) => item.media_type === "Movie" && /\.mp4(?:$|[?#])/i.test(item.url || ""))
      const image = page.main_image?.url
        ? page.main_image
        : media.find((item) => item.media_type === "Image" && /\.(?:jpg|jpeg|png)(?:$|[?#])/i.test(item.url || ""))
      const caption = media.find((item) => item.media_type === "Captions" && /\.(?:srt|vtt)(?:$|[?#])/i.test(item.url || ""))
      if (!video?.url || !image?.url) return null
      return {
        source: "NASA",
        title: page.title || topic,
        description: page.description || "NASA Scientific Visualization Studio",
        nasaId: `SVS_${page.id}`,
        mediaType: "video",
        url: image.url,
        videoUrl: video.url,
        captionUrl: caption?.url || null,
        pageUrl: page.url || `https://svs.gsfc.nasa.gov/${page.id}/`,
        captionMatchCount: 0,
        captionMatches: [],
      }
    })
    .filter(Boolean)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const topic = typeof body.topic === "string" ? body.topic.trim() : ""
  if (!topic) {
    return NextResponse.json({ error: "A topic is required." }, { status: 400 })
  }

  const script = typeof body.script === "string" ? body.script.slice(0, 12000) : ""
  const visualRequirement =
    typeof body.visualRequirement === "string" ? body.visualRequirement.trim() : topic

  // NASA search works best with short space terms. A full question such as
  // "Why do black holes have such strong gravity?" can return zero results even
  // though "black hole" has many NASA assets. Search the original phrase first,
  // then progressively shorter subject queries and merge/dedupe the results.
  const stopWords = new Set([
    "why", "how", "what", "when", "where", "which", "who", "does", "do", "did",
    "is", "are", "was", "were", "can", "could", "would", "should", "have", "has",
    "had", "the", "a", "an", "such", "very", "really", "about", "explain", "explained",
    "explanation", "strong", "strongest", "for", "to", "of", "in", "on", "and", "or",
  ])
  const cleanedTopic = topic
    .replace(/[?!.,:;()\[\]{}"'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const subjectWords = cleanedTopic
    .split(" ")
    .map((word: string) => word.trim())
    .filter(Boolean)
    .filter((word: string) => !stopWords.has(word.toLowerCase()))
  const subjectQuery = subjectWords.slice(0, 5).join(" ")
  const queries = Array.from(
    new Set(
      [topic, subjectQuery, subjectWords.slice(0, 3).join(" "), subjectWords.slice(0, 2).join(" ")]
        .map((value) => value.trim())
        .filter((value) => value.length >= 2)
    )
  )

  const nasaResults = await Promise.all(
    queries.map(async (searchTerm) => {
      const encoded = encodeURIComponent(searchTerm)
      const responses = await Promise.all(
        ["image", "video"].map((mediaType) =>
          fetch(`https://images-api.nasa.gov/search?q=${encoded}&media_type=${mediaType}&page_size=20`, {
            next: { revalidate: 3600 },
          })
        )
      )
      const data = await Promise.all(
        responses.map((response) => (response.ok ? response.json() : { collection: { items: [] } }))
      )
      return { searchTerm, data }
    })
  )

  const nasaItems = nasaResults.flatMap(({ data }) =>
    data.flatMap((data, index) => {
      const mediaType = index === 0 ? "image" : "video"
      return (data.collection?.items || [])
        .map(
          (item: {
            data?: Array<{ title?: string; description?: string; nasa_id?: string; media_type?: string }>
            links?: Array<{ href?: string; rel?: string }>
            href?: string
          }) => {
            const meta = item.data?.[0] || {}
            const preview =
              item.links?.find((link) => link.rel === "preview")?.href ||
              item.links?.[0]?.href ||
              item.href
            return {
              source: "NASA",
              title: meta.title || topic,
              description: meta.description || "NASA media",
              nasaId: meta.nasa_id,
              mediaType: meta.media_type || mediaType,
              url: preview,
              pageUrl: meta.nasa_id ? `https://images.nasa.gov/details-${meta.nasa_id}` : undefined,
            }
          }
        )
        .filter((item: { url?: string }) => Boolean(item.url))
    })
  )

  const dedupedNasaItems = Array.from(
    new Map(
      nasaItems.map((item: { nasaId?: string; mediaType?: string; url?: string }, index: number) => [
        item.nasaId || `${item.mediaType}-${item.url || index}`,
        item,
      ])
    ).values()
  )

  // Prefer videos a bit higher by putting them first, then images
  nasaItems.sort((a: { mediaType?: string }, b: { mediaType?: string }) => {
    if (a.mediaType === "video" && b.mediaType !== "video") return -1
    if (a.mediaType !== "video" && b.mediaType === "video") return 1
    return 0
  })

  if (dedupedNasaItems.length) {
    let videoItems = nasaItems
      .filter((item) => item.mediaType === "video" && item.nasaId)
      .slice(0, 6)

    // NASA's main Image & Video API can occasionally return no video records
    // from a serverless runtime even when the same topic has NASA videos.
    // Use the public NASA Scientific Visualization Studio API as a video-first
    // fallback before ever falling back to Pexels.
    if (!videoItems.length) {
      const svsItems = await searchSvsVideos(
        [subjectQuery, subjectWords.slice(0, 3).join(" "), subjectWords.slice(0, 2).join(" ")],
        topic,
      )
      if (svsItems.length) {
        const merged = [...svsItems, ...nasaItems]
        nasaItems = Array.from(
          new Map(
            merged.map((item: { nasaId?: string; url?: string }, index: number) => [
              item.nasaId || item.url || index,
              item,
            ]),
          ).values(),
        )
        videoItems = svsItems.slice(0, 6)
      }
    }

    if (script && videoItems.length) {
      const enriched = await Promise.all(
        videoItems.map(async (item) => {
          try {
            const result = await matchNasaCaptions(
              item.nasaId,
              {
                title: item.title,
                description: item.description,
                script,
                visualRequirement,
              },
              { minimumScore: 0.08, limit: 2 }
            )

            return {
              ...item,
              captionUrl: result.captionUrl || null,
              captionMatchCount: result.matches.length,
              captionMatches: result.matches,
            }
          } catch (error) {
            return {
              ...item,
              captionUrl: null,
              captionMatchCount: 0,
              captionMatches: [],
              captionError: error instanceof Error ? error.message : "Caption matching failed",
            }
          }
        })
      )

      const byId = new Map(enriched.map((item) => [item.nasaId, item]))
      for (const item of nasaItems) {
        const match = item.nasaId ? byId.get(item.nasaId) : undefined
        if (match) Object.assign(item, match)
      }
    }

    return NextResponse.json({
      source: "NASA",
      items: Array.from(new Map(nasaItems.map((item: { nasaId?: string; url?: string }, index: number) => [item.nasaId || item.url || index, item])).values()).slice(0, 36),
      notice: `NASA · ${dedupedNasaItems.length} result${dedupedNasaItems.length === 1 ? "" : "s"} for “${topic}”`,
      sceneMatching: Boolean(script),
      extraction: "timestamped NASA clips are prepared by the separate FFmpeg worker",
    })
  }

  // Fallback to Pexels (images). Requires PEXELS_API_KEY in env.
  const pexelsKey = process.env.PEXELS_API_KEY
  if (!pexelsKey) {
    return NextResponse.json({
      source: "none",
      items: [],
      notice:
        "NASA found no matching media. Add PEXELS_API_KEY in your Vercel project settings to enable the stock fallback.",
    })
  }

  const pexelsResponse = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(visualRequirement)}&per_page=24`,
    {
      headers: { Authorization: pexelsKey },
      next: { revalidate: 3600 },
    }
  )

  if (!pexelsResponse.ok) {
    return NextResponse.json({
      source: "none",
      items: [],
      notice: "NASA had no match and the Pexels fallback is currently unavailable.",
    })
  }

  const pexelsData = await pexelsResponse.json()
  const pexelsItems = (pexelsData.photos || []).map(
    (photo: {
      id: number
      alt?: string
      url?: string
      src?: { large2x?: string; large?: string; medium?: string }
    }) => ({
      source: "Pexels",
      title: photo.alt || topic,
      mediaType: "image",
      url: photo.src?.large2x || photo.src?.large || photo.src?.medium,
      pageUrl: photo.url,
    })
  )

  return NextResponse.json({
    source: "Pexels",
    items: pexelsItems,
    notice: `Pexels fallback · ${pexelsItems.length} image${pexelsItems.length === 1 ? "" : "s"} for “${topic}” (NASA had no match)`,
  })
}
