import crypto from "crypto"

const TOKEN_COOKIE = "cosmos-youtube-session"
const STATE_COOKIE = "cosmos-youtube-oauth-state"

function secretKey() {
  const secret = process.env.YOUTUBE_SESSION_SECRET
  if (!secret) throw new Error("YOUTUBE_SESSION_SECRET is not configured")
  return crypto.createHash("sha256").update(secret).digest()
}

export function oauthConfig() {
  const clientId = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || ((process.env.APP_URL || "http://localhost:3000") + "/api/youtube/callback")
  if (!clientId || !clientSecret) throw new Error("YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET are not configured")
  return { clientId, clientSecret, redirectUri }
}

export function createState() { return crypto.randomBytes(32).toString("hex") }

export function encryptSession(value: unknown) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".")
}

export function decryptSession<T>(value?: string | null): T | null {
  if (!value) return null
  try {
    const parts = value.split(".")
    if (parts.length !== 3) return null
    const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(parts[0], "base64url"))
    decipher.setAuthTag(Buffer.from(parts[1], "base64url"))
    const plain = Buffer.concat([decipher.update(Buffer.from(parts[2], "base64url")), decipher.final()])
    return JSON.parse(plain.toString("utf8")) as T
  } catch { return null }
}

export const youtubeCookieNames = { TOKEN_COOKIE, STATE_COOKIE }

export function cookieOptions(maxAge = 60 * 60 * 24 * 30) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge }
}

export async function exchangeCode(code: string) {
  const { clientId, clientSecret, redirectUri } = oauthConfig()
  const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" })
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error_description || data.error || "Google OAuth token exchange failed")
  return data as { access_token: string; expires_in: number; refresh_token?: string; scope?: string; token_type: string }
}

export async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = oauthConfig()
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" })
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error_description || data.error || "Google token refresh failed")
  return data as { access_token: string; expires_in: number; token_type: string }
}

export async function getSessionFromRequest(request: Request) {
  const cookie = request.headers.get("cookie") || ""
  const match = cookie.match(/(?:^|; )cosmos-youtube-session=([^;]+)/)
  const session = decryptSession<{ accessToken: string; refreshToken?: string; expiresAt: number }>(match?.[1])
  if (!session) return null
  if (Date.now() < session.expiresAt - 60000) return session
  if (!session.refreshToken) return session
  try {
    const refreshed = await refreshAccessToken(session.refreshToken)
    return { ...session, accessToken: refreshed.access_token, expiresAt: Date.now() + refreshed.expires_in * 1000 }
  } catch { return null }
}
