import { NextResponse } from "next/server"
import { createState, cookieOptions, oauthConfig, youtubeCookieNames } from "@/lib/youtube-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { clientId, redirectUri } = oauthConfig()
    const state = createState()
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl",
      state,
    })
    const response = NextResponse.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + params.toString())
    response.cookies.set(youtubeCookieNames.STATE_COOKIE, state, cookieOptions(600))
    return response
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "YouTube login is not configured" }, { status: 500 })
  }
}
