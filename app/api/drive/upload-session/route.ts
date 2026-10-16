import { NextResponse } from "next/server"
import { driveRequest, findOrCreateStudioFolder } from "../../../../lib/google-drive"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 180) : ""
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.slice(0, 120) : "application/octet-stream"
    const size = Number(body.size)
    if (!name) return NextResponse.json({ error: "A file name is required" }, { status: 400 })
    if (!Number.isSafeInteger(size) || size < 0) return NextResponse.json({ error: "A valid file size is required" }, { status: 400 })

    const parentId = typeof body.parentId === "string" && body.parentId ? body.parentId : await findOrCreateStudioFolder(request)
    const metadata = { name, mimeType, parents: [parentId] }
    const result = await driveRequest(
      request,
      "/files?uploadType=resumable&fields=id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,parents",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mimeType,
          "X-Upload-Content-Length": String(size),
        },
        body: JSON.stringify(metadata),
      },
    )
    if (!result.response) return NextResponse.json({ error: result.error }, { status: 401 })
    if (!result.response.ok) {
      const data = await result.response.json().catch(() => ({}))
      return NextResponse.json({ error: data.error?.message || "Could not start Drive upload" }, { status: result.response.status })
    }
    const uploadUrl = result.response.headers.get("location")
    if (!uploadUrl) return NextResponse.json({ error: "Google Drive did not return an upload session" }, { status: 502 })
    return NextResponse.json({ uploadUrl })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start Drive upload" }, { status: 500 })
  }
}
