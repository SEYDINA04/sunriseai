/** Call the server-side TTS Twi proxy and return a playable audio data URL. */
export async function synthesizeTwi(text: string): Promise<string> {
  const res = await fetch("/api/tts/twi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`tts_failed_${res.status}`)
  const data = (await res.json()) as { audioUrl?: string }
  if (!data.audioUrl) throw new Error("tts_no_audio")
  return data.audioUrl
}
