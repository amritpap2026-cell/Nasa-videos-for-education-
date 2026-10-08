import { NextResponse } from "next/server"
import { cookieOptions, decryptSession, exchangeCode, encryptSession, youtubeCookieNames } from "@/lib/youtube-auth"

export const dynamic = "force-dynamic"

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || ""
  const escaped = name.replace(/[.*+?^$\\{}()|[\]\\]/g, "\\$&")
  const match = cookie.match(new RegExp("(?:^|; )" + escaped + "=([^;]+)"))
  return match?.[1] || ""
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const expectedState = readCookie(request, youtubeCookieNames.STATE_COOKIE)
  if (!code) return NextResponse.redirect(new URL("/?youtube=error&message=missing_code", request.url))
  if (!state || !expectedState || state !== expectedState) return NextResponse.redirect(new URL("/?youtube=error&message=invalid_state", request.url))
  try {
    const token = await exchangeCode(code)
    const previous = decryptSession<{ accessToken: string; refreshToken?: string; expiresAt: number }>(readCookie(request, youtubeCookieNames.TOKEN_COOKIE))
    const session = { accessToken: token.access_token, refreshToken: token.refresh_token || previous?.refreshToken, expiresAt: Date.now() + token.expires_in * 1000 }
    const response = NextResponse.redirect(new URL("/?youtube=connected", request.url))
    response.cookies.set(youtubeCookieNames.TOKEN_COOKIE, encryptSession(session), cookieOptions())
    response.cookies.set(youtubeCookieNames.STATE_COOKIE, "", cookieOptions(0))
    return response
  } catch (error) {
    return NextResponse.redirect(new URL("/?youtube=error&message=" + encodeURIComponent(error instanceof Error ? error.message : "oauth_failed"), request.url))
  }
}
