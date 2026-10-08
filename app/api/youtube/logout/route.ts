import { NextResponse } from "next/server"
import { cookieOptions, youtubeCookieNames } from "../../../../lib/youtube-auth"

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(youtubeCookieNames.TOKEN_COOKIE, "", cookieOptions(0))
  return response
}
