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

/**
 * Decode any browser-supported audio Blob (webm/opus, mp3, m4a, wav…) and
 * re-encode it as 16 kHz mono 16-bit WAV — the format the Wolof ASR model
 * expects. Doing this client-side guarantees compatibility regardless of which
 * codecs the inference server has available.
 */
export async function audioBlobToWav16k(blob: Blob): Promise<Blob> {
  const TARGET_RATE = 16000
  const bytes = await blob.arrayBuffer()

  const Ctx = resolveAudioContext()
  const decodeCtx = new Ctx()
  let decoded: AudioBuffer
  try {
    decoded = await decodeCtx.decodeAudioData(bytes)
  } finally {
    void decodeCtx.close()
  }

  const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE))
  // 1 output channel downmixes stereo to mono; the target sample rate resamples.
  const offline = new OfflineAudioContext(1, frames, TARGET_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()

  const wav = encodeWav(rendered.getChannelData(0), TARGET_RATE)
  return new Blob([wav as BlobPart], { type: "audio/wav" })
}
