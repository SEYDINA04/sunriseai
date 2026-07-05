import { audioBlobToWav16k } from "./audio"

/**
 * Transcribe a captured/uploaded audio Blob via the server-side proxy.
 *
 * The blob is normalised to 16 kHz mono WAV in the browser, then posted to our
 * own `/api/asr/transcribe` route (which forwards it to the Wolof ASR service).
 * Throws on any non-OK response so callers can surface an error state.
 */
export async function transcribeAudio(blob: Blob, signal?: AbortSignal): Promise<string> {
  const wav = await audioBlobToWav16k(blob)

  const form = new FormData()
  form.append("file", wav, "audio.wav")

  const res = await fetch("/api/asr/transcribe", { method: "POST", body: form, signal })
  if (!res.ok) throw new Error(`asr_failed_${res.status}`)

  const data = (await res.json()) as { text?: string }
  return data.text ?? ""
}
