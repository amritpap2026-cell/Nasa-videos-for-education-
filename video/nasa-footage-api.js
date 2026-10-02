/**
 * NASA Footage API Integration
 * Fetches real NASA image/video results and asset manifests.
 */

async function searchNasaImageLibrary(query, mediaType = "video", limit = 5) {
  const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=${mediaType}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`NASA Image Library search failed: ${res.status}`)
  const data = await res.json()
  const items = data.collection?.items || []
  return Promise.all(items.slice(0, limit).map(async (item) => {
    const metadata = item.data?.[0] || {}
    let files = []
    try {
      const assetRes = await fetch(`https://images-api.nasa.gov/asset/${encodeURIComponent(metadata.nasa_id)}`)
      if (assetRes.ok) {
        const assetData = await assetRes.json()
        files = (assetData.collection?.items || []).map((file) => file.href).filter(Boolean)
      }
    } catch {}
    return {
      nasaId: metadata.nasa_id,
      title: metadata.title,
      description: metadata.description || "",
      dateCreated: metadata.date_created || null,
      thumbnail: item.links?.[0]?.href || null,
      files,
      source: "images.nasa.gov",
    }
  }))
}

async function searchSVS(query, limit = 5) {
  const res = await fetch(`https://svs.gsfc.nasa.gov/api/search/?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`SVS search failed: ${res.status}`)
  const data = await res.json()
  return (data.results || []).slice(0, limit).map((item) => ({
    svsId: item.id,
    title: item.title,
    description: item.description || "",
    pageUrl: item.url,
    videoUrl: item.main_video?.url || null,
    imageUrl: item.main_image?.url || null,
    width: item.main_video?.width || item.main_image?.width,
    height: item.main_video?.height || item.main_image?.height,
    source: "svs.gsfc.nasa.gov",
  }))
}

async function fetchFootageForScript(bRollCues) {
  return Promise.all(bRollCues.map(async (cue) => {
    const [videos, images, svs] = await Promise.all([
      searchNasaImageLibrary(cue, "video", 3).catch(() => []),
      searchNasaImageLibrary(cue, "image", 3).catch(() => []),
      searchSVS(cue, 3).catch(() => []),
    ])
    return { cue, candidates: [...svs, ...videos, ...images] }
  }))
}

module.exports = { searchNasaImageLibrary, searchSVS, fetchFootageForScript }

if (require.main === module) {
  const cues = process.argv.slice(2)
  if (!cues.length) throw new Error("Usage: node video/nasa-footage-api.js <cue> [cue ...]")
  fetchFootageForScript(cues).then((results) => console.log(JSON.stringify(results, null, 2)))
}
            
