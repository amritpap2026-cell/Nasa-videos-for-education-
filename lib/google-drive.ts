import { getSessionFromRequest } from "./youtube-auth"

export type DriveFile = {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
  thumbnailLink?: string
  size?: string
  modifiedTime?: string
  parents?: string[]
}

export async function driveRequest(request: Request, path: string, init: RequestInit = {}) {
  const session = await getSessionFromRequest(request)
  if (!session?.accessToken) {
    return { response: null, error: "Google login required. Connect Google from the website and approve Drive access." }
  }
  const response = await fetch("https://www.googleapis.com/drive/v3" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + session.accessToken,
      ...(init.headers || {}),
    },
    cache: "no-store",
  })
  return { response, error: null }
}

export async function findOrCreateStudioFolder(request: Request) {
  const query = new URLSearchParams({
    q: "name = 'NASA Videos for Education' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: "files(id,name)",
    pageSize: "10",
  })
  const found = await driveRequest(request, "/files?" + query.toString())
  if (!found.response) throw new Error(found.error || "Google login required")
  const foundData = await found.response.json()
  if (!found.response.ok) throw new Error(foundData.error?.message || "Could not find the Drive folder")
  if (foundData.files?.[0]?.id) return foundData.files[0].id as string

  const created = await driveRequest(request, "/files?fields=id,name", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "NASA Videos for Education", mimeType: "application/vnd.google-apps.folder" }),
  })
  if (!created.response) throw new Error(created.error || "Google login required")
  const createdData = await created.response.json()
  if (!created.response.ok) throw new Error(createdData.error?.message || "Could not create the Drive folder")
  return createdData.id as string
}
