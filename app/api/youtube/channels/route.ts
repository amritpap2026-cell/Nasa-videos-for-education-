import { NextResponse } from "next/server"
import { getSessionFromRequest } from "../../../lib/youtube-auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return NextResponse.json({ connected: false, channels: [] }, { status: 401 })
    const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true&maxResults=50", {
      headers: { Authorization: "Bearer " + session.accessToken },
      cache: "no-store",
    })
    const data = await response.json()
    if (!response.ok) return NextResponse.json({ connected: false, error: data?.error?.message || "Could not load YouTube channels" }, { status: response.status })
    const channels = (data.items || []).map((channel: any) => ({
      id: channel.id,
      title: channel.snippet?.title || "Untitled channel",
      description: channel.snippet?.description || "",
      thumbnail: channel.snippet?.thumbnails?.default?.url || "",
      uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || "",
    }))
    return NextResponse.json({ connected: true, channels })
  } catch (error) {
    return NextResponse.json({ connected: false, error: error instanceof Error ? error.message : "Could not load YouTube channels" }, { status: 500 })
  }
}
