import { NextResponse } from "next/server"
import { driveRequest, findOrCreateStudioFolder } from "../../../../lib/google-drive"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  try {
    const rootId = await findOrCreateStudioFolder(request)
    const parentId = searchParams.get("folderId") || rootId
    const q = new URLSearchParams({
      q: "'" + parentId.replace(/'/g, "\\'") + "' in parents and trashed = false",
      pageSize: "100",
      orderBy: "folder,name",
      fields: "files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,parents),nextPageToken",
    })
    const result = await driveRequest(request, "/files?" + q.toString())
    if (!result.response) return NextResponse.json({ error: result.error }, { status: 401 })
    const data = await result.response.json()
    if (!result.response.ok) return NextResponse.json({ error: data.error?.message || "Drive listing failed" }, { status: result.response.status })
    return NextResponse.json({ folderId: rootId, files: data.files || [], nextPageToken: data.nextPageToken || null })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Drive request failed"
    return NextResponse.json({ error: message }, { status: /login|required|access/i.test(message) ? 401 : 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 180) : ""
    if (!name) return NextResponse.json({ error: "A folder name is required" }, { status: 400 })
    const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : await findOrCreateStudioFolder(request)
    const result = await driveRequest(request, "/files?fields=id,name,mimeType,parents,webViewLink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
    })
    if (!result.response) return NextResponse.json({ error: result.error }, { status: 401 })
    const data = await result.response.json()
    if (!result.response.ok) return NextResponse.json({ error: data.error?.message || "Could not create folder" }, { status: result.response.status })
    return NextResponse.json({ file: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google Drive request failed" }, { status: 500 })
  }
}
