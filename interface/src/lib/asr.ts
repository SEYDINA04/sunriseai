import { ASR_SAMPLE_RATE, chunkSamples, decodeToMono16k, samplesToWavBlob } from "./audio"

/** Optional callback to surface progress while multi-segment audio is transcribed. */
export type TranscribeProgress = (done: number, total: number) => void

export interface TranscribeResult {
  text: string
  /** Present only when a target_lang was requested and the backend returned a translation. */
  translation?: string
}

/** Post a single WAV segment to the server-side proxy and return its transcript. */
async function transcribeChunk(
  wav: Blob,
  lang: string,
  targetLang?: string,
  signal?: AbortSignal,
): Promise<TranscribeResult> {
  const form = new FormData()
  form.append("file", wav, "audio.wav")
  form.append("lang", lang)
  if (targetLang) form.append("target_lang", targetLang)

  const res = await fetch("/api/asr/transcribe", { method: "POST", body: form, signal })
  if (!res.ok) throw new Error(`asr_failed_${res.status}`)

  const data = (await res.json()) as { text?: string; translation?: string }
  return { text: data.text ?? "", translation: data.translation }
}

/**
 * Transcribe a captured/uploaded audio Blob via the server-side proxy.
 *
 * The blob is normalised to 16 kHz mono in the browser and split into segments
 * short enough that each request finishes under AWS Amplify's ~30s CloudFront
 * origin-response timeout. Segments are transcribed sequentially and their
 * transcripts joined, so recordings longer than ~1 minute no longer 504.
 *
 * @param blob       - Raw audio recorded or uploaded by the user.
 * @param lang       - ISO language code sent to the route handler ("WO" | "TW").
 * @param targetLang - Optional translation target ("FR" | "EN"). When set, the
 *                     backend also returns a `translation` field.
 *
 * Throws on any non-OK response (or abort) so callers can surface an error state.
 */
export async function transcribeAudio(
  blob: Blob,
  lang: string,
  targetLang?: string,
  signal?: AbortSignal,
  onProgress?: TranscribeProgress,
): Promise<TranscribeResult> {
  const samples = await decodeToMono16k(blob)
  const segments = chunkSamples(samples, { sampleRate: ASR_SAMPLE_RATE })

  const parts: string[] = []
  const translations: string[] = []
  for (let i = 0; i < segments.length; i++) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError")
    const wav = samplesToWavBlob(segments[i], ASR_SAMPLE_RATE)
    const result = await transcribeChunk(wav, lang, targetLang, signal)
    parts.push(result.text)
    if (result.translation) translations.push(result.translation)
    onProgress?.(i + 1, segments.length)
  }

  const text = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ")
  const translation =
    translations.length > 0
      ? translations
          .map((p) => p.trim())
          .filter(Boolean)
          .join(" ")
      : undefined

  return { text, translation }
}
