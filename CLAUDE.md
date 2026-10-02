# Project: NASA Educational YouTube Pipeline

## What this is
A website (built in Google AI Studio) that automates creating educational
space-science YouTube videos for students, using real NASA footage.
Languages: English, Hindi, Nepali.

## Pipeline
1. Generate a video script (LLM), or use the creator's own script
2. Break the script into scenes / B-roll cues
3. For each scene, call REAL NASA APIs (never LLM-generated links):
   - images-api.nasa.gov/search (images + video library)
   - svs.gsfc.nasa.gov/api/search (scientific visualizations)
4. Stitch multiple real clips per scene into one long-form video (8-15 min).
   NASA rarely publishes single continuous clips that long, so each long
   video is typically 15-25 short clips edited together under narration.
5. Voiceover: Edge TTS, or the creator's own recorded audio
   (option to remove original video sound or keep it)
6. Publish to YouTube via the YouTube Data API from the website

## Critical constraint
NEVER let the LLM generate NASA download URLs, NASA IDs, SVS IDs, or file
names. It hallucinates plausible-looking but fake links (these return
"Access Denied" or 404). Only use links returned by a real API call to
images-api.nasa.gov or svs.gsfc.nasa.gov/api.

## Existing code
- `nasa-footage-api.js`: searchNasaImageLibrary(), searchSVS(), and
  fetchFootageForScript(bRollCues) which returns real candidate clips per scene.
  The SVS API response shape may change, so log one raw response on first
  run to confirm field names.

## Channels
4 channels total:
- English, Hindi, Nepali: long-form explainers
- A Shorts channel repurposing clips across all three languages

Solo creator. Workflow: one script per topic, translated into 3 narrations
over the same visuals to save editing time.

## Usage and attribution rules
- NASA media is generally free to use for educational purposes, but:
  - Do not use the NASA logo or imply NASA endorsement
  - Some items contain third-party music or footage; check each item's credit
  - NASA+ streaming content (e.g. documentaries) is not downloadable for reuse
- Always keep a credit log per clip: title, source URL, credit line, date
- Add credits to each video description, e.g. "Credit: NASA's Scientific
  Visualization Studio"
- Add narration and original commentary so videos qualify as original,
  educational content on YouTube
