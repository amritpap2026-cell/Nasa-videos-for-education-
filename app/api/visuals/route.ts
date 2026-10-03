import { NextResponse } from "next/server"
import { matchNasaCaptions } from "../../../video/nasa-caption-matcher"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const topic = typeof body.topic === "string" ? body.topic.trim() : ""
  if (!topic) {
    return NextResponse.json({ error: "A topic is required." }, { status: 400 })
  }

  const script = typeof body.script === "string" ? body.script.slice(0, 12000) : ""
  const visualRequirement =
    typeof body.visualRequirement === "string" ? body.visualRequirement.trim() : topic

  const query = encodeURIComponent(topic)

  // Search NASA Image & Video Library for both images and videos
  const nasaResponses = await Promise.all(
    ["image", "video"].map((mediaType) =>
      fetch(`https://images-api.nasa.gov/search?q=${query}&media_type=${mediaType}&page_size=20`, {
        next: { revalidate: 3600 },
      })
    )
  )

  const nasaData = await Promise.all(
    nasaResponses.map((response) => (response.ok ? response.json() : { collection: { items: [] } }))
  )

  const nasaItems = nasaData.flatMap((data, index) => {
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

  // Prefer videos a bit higher by putting them first, then images
  nasaItems.sort((a: { mediaType?: string }, b: { mediaType?: string }) => {
    if (a.mediaType === "video" && b.mediaType !== "video") return -1
    if (a.mediaType !== "video" && b.mediaType === "video") return 1
    return 0
  })

  if (nasaItems.length) {
    const videoItems = nasaItems
      .filter((item) => item.mediaType === "video" && item.nasaId)
      .slice(0, 6)

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
      items: nasaItems.slice(0, 36),
      notice: `NASA · ${nasaItems.length} result${nasaItems.length === 1 ? "" : "s"} for “${topic}”`,
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
    `https://api.pexels.com/v1/search?query=${query}&per_page=24`,
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
