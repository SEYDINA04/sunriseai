/**
 * Audio encoding helpers shared by the mock TTS and the real ASR pipeline.
 *
 * All functions are browser-only (they rely on Web Audio / DOM APIs) and must
 * not be imported from server code (route handlers, etc.).
 */

/** Convert a byte array to base64, chunked to avoid argument-count limits. */
export function bufferToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Encode mono Float32 PCM samples as a 16-bit little-endian WAV byte array. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytesPerSample = 2
  const blockAlign = bytesPerSample
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 8 * bytesPerSample, true)
  writeString(36, "data")
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += bytesPerSample
  }
  return new Uint8Array(buffer)
}

type AudioCtor = typeof AudioContext

function resolveAudioContext(): AudioCtor {
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }
  const Ctx = w.AudioContext ?? w.webkitAudioContext
  if (!Ctx) throw new Error("web_audio_unsupported")
  return Ctx
}

/** The sample rate the Wolof ASR model expects (16 kHz mono). */
export const ASR_SAMPLE_RATE = 16000

/**
 * Decode any browser-supported audio Blob (webm/opus, mp3, m4a, wav…) into a
 * mono Float32 PCM buffer resampled to {@link ASR_SAMPLE_RATE}. Doing this
 * client-side guarantees compatibility regardless of which codecs the inference
 * server has available.
 */
export async function decodeToMono16k(blob: Blob): Promise<Float32Array> {
  const bytes = await blob.arrayBuffer()

  const Ctx = resolveAudioContext()
  const decodeCtx = new Ctx()
  let decoded: AudioBuffer
  try {
    decoded = await decodeCtx.decodeAudioData(bytes)
  } finally {
    void decodeCtx.close()
  }

  const frames = Math.max(1, Math.ceil((decoded.length * ASR_SAMPLE_RATE) / decoded.sampleRate))
  // 1 output channel downmixes stereo to mono; the target sample rate resamples.
  const offline = new OfflineAudioContext(1, frames, ASR_SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}

/**
 * Re-encode an audio Blob as a single 16 kHz mono 16-bit WAV — the format the
 * Wolof ASR model expects.
 */
export async function audioBlobToWav16k(blob: Blob): Promise<Blob> {
  const samples = await decodeToMono16k(blob)
  return samplesToWavBlob(samples, ASR_SAMPLE_RATE)
}

/** Wrap mono PCM samples in a WAV container Blob. */
export function samplesToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  return new Blob([encodeWav(samples, sampleRate) as BlobPart], { type: "audio/wav" })
}

export interface ChunkOptions {
  sampleRate?: number
  /** Preferred segment length in seconds. */
  targetSec?: number
  /** Hard cap on segment length in seconds. */
  maxSec?: number
  /** How far (seconds) around each target boundary to hunt for a quiet cut. */
  searchSec?: number
}

/**
 * Split mono PCM into segments no longer than `maxSec`, cutting at the quietest
 * point near each target boundary so we avoid slicing through a spoken word.
 *
 * This is the workaround for AWS Amplify's ~30s CloudFront origin-response
 * timeout: a >1 min recording can't be transcribed synchronously in one request,
 * so we send several short segments that each complete well under the limit and
 * stitch the transcripts back together.
 */
export function chunkSamples(samples: Float32Array, opts: ChunkOptions = {}): Float32Array[] {
  const rate = opts.sampleRate ?? ASR_SAMPLE_RATE
  const target = Math.round((opts.targetSec ?? 25) * rate)
  const max = Math.round((opts.maxSec ?? 35) * rate)
  const search = Math.round((opts.searchSec ?? 4) * rate)

  if (
    !Number.isFinite(rate) ||
    !Number.isFinite(target) ||
    !Number.isFinite(max) ||
    !Number.isFinite(search) ||
    rate <= 0 ||
    target <= 0 ||
    max <= 0 ||
    search < 0
  ) {
    throw new Error("invalid_chunk_options")
  }
  if (samples.length <= max) return [samples]

  const segments: Float32Array[] = []
  let pos = 0
  while (samples.length - pos > max) {
    const targetEnd = pos + target
    // Keep the cut within [pos + minimum progress, pos + max] and inside the buffer.
    const lo = Math.max(pos + target - search, pos + Math.round(target / 2))
    const hi = Math.min(pos + target + search, pos + max, samples.length)
    const cut = quietestCut(samples, lo, hi, targetEnd, rate)
    segments.push(samples.subarray(pos, cut))
    pos = cut
  }
  segments.push(samples.subarray(pos))
  return segments
}

/**
 * Find the sample index in [lo, hi) with the lowest short-term energy, biased
 * toward `preferred` so we cut as close to the target boundary as the audio
 * allows. Returns `preferred` (clamped) when no clear quiet point stands out.
 */
function quietestCut(
  samples: Float32Array,
  lo: number,
  hi: number,
  preferred: number,
  rate: number,
): number {
  if (hi - lo < 2) return Math.min(Math.max(preferred, lo + 1), hi)
  const frame = Math.max(1, Math.round(0.02 * rate)) // 20 ms window
  const hop = Math.max(1, Math.round(0.01 * rate)) // 10 ms hop
  let best = preferred
  let bestScore = Infinity
  for (let i = lo; i + frame <= hi; i += hop) {
    let energy = 0
    for (let j = i; j < i + frame; j++) energy += samples[j] * samples[j]
    // Tie-break toward the target boundary so segments stay near `targetSec`.
    const score = energy + (Math.abs(i + frame / 2 - preferred) / rate) * 1e-4
    if (score < bestScore) {
      bestScore = score
      best = i + Math.floor(frame / 2)
    }
  }
  return Math.min(Math.max(best, lo + 1), hi)
}
