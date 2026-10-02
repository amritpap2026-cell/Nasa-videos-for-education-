import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { topic } = await request.json()
  if (typeof topic !== "string" || !topic.trim()) return NextResponse.json({ error: "A topic is required." }, { status: 400 })
  const query = encodeURIComponent(topic.trim())
  const nasaResponse = await fetch(`https://images-api.nasa.gov/search?q=${query}&media_type=image,video&page_size=24`, { next: { revalidate: 3600 } })
  const nasaData = nasaResponse.ok ? await nasaResponse.json() : { collection: { items: [] } }
  const nasaItems = (nasaData.collection?.items || []).map((item: { data?: Array<{ title?: string; description?: string }>; links?: Array<{ href?: string; rel?: string }>; href?: string }) => ({ source: "NASA", title: item.data?.[0]?.title || topic, description: item.data?.[0]?.description || "NASA media", url: item.links?.find((link) => link.rel === "preview")?.href || item.links?.[0]?.href || item.href })).filter((item: { url?: string }) => item.url)
  if (nasaItems.length) return NextResponse.json({ source: "NASA", items: nasaItems })

  const pexelsKey = process.env.PEXELS_API_KEY
  if (!pexelsKey) return NextResponse.json({ source: "none", items: [], notice: "NASA found no matching media. Add PEXELS_API_KEY to enable fallback visuals." })
  const pexelsResponse = await fetch(`https://api.pexels.com/v1/search?query=${query}&per_page=24`, { headers: { Authorization: pexelsKey }, next: { revalidate: 3600 } })
  if (!pexelsResponse.ok) return NextResponse.json({ source: "none", items: [], notice: "The visual fallback is not available." })
  const pexelsData = await pexelsResponse.json()
  return NextResponse.json({ source: "Pexels", items: (pexelsData.photos || []).map((photo: { id: number; alt?: string; url?: string; src?: { large2x?: string; large?: string } }) => ({ source: "Pexels", title: photo.alt || topic, url: photo.src?.large2x || photo.src?.large, pageUrl: photo.url })) })
}
