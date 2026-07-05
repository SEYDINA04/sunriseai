/**
 * Audio persistence seam.
 *
 * Today: stores a size-capped base64 data URL so recorded/uploaded audio can be
 * previewed and survives in localStorage history.
 *
 * Later (deferred): the body of `persistAudio` will upload to S3 via a short-lived
 * presigned PUT and return an opaque object `key`; `resolveAudioUrl` will mint a
 * short-lived presigned GET for playback. Callers (controller, MessageBubble) go
 * through this module so that swap requires no changes on their side.
 */

/** Keep data URLs under the localStorage-friendly cap; larger audio isn't persisted. */
const MAX_DATA_URL_BYTES = 1_500_000

export interface StoredAudio {
  /** Directly-playable source: a data URL today, a presigned GET URL once on S3. */
  url?: string
  /** Opaque storage key — reserved for the S3 implementation, unused today. */
  key?: string
}

function blobToDataUrl(blob: Blob, maxBytes = MAX_DATA_URL_BYTES): Promise<string | null> {
  if (blob.size > maxBytes) return Promise.resolve(null)
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
}

/** Persist a captured/uploaded audio blob and return a storage descriptor. */
export async function persistAudio(blob: Blob): Promise<StoredAudio> {
  const url = await blobToDataUrl(blob)
  return { url: url ?? undefined }
}

/** Resolve a stored descriptor (from a Message) to a playable URL, if any. */
export function resolveAudioUrl(audio: StoredAudio | undefined): string | undefined {
  if (!audio) return undefined
  // Future: if (audio.key) return a presigned GET URL for that object.
  return audio.url
}
