import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
// Cap the function close to (but under) the platform/CDN gateway timeout so we
// can return our own clean JSON error instead of an opaque 504 from CloudFront.
export const maxDuration = 30

/** Reject uploads larger than this before forwarding (DoS / cost guard). */
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Abort the upstream call before the CDN gateway (CloudFront on Amplify, ~30s,
 * non-configurable) gives up, so the client gets `{"error":"timeout"}` instead
 * of an opaque gateway 504.
 */
const UPSTREAM_TIMEOUT_MS = 27_000

/**
 * Language → backend path mapping.
 * Teekiai ASR v2 uses a single base URL with per-language routes:
 *   POST {ASR_API_URL}/transcribe/wo   — Wolof
 *   POST {ASR_API_URL}/transcribe/twi  — Twi
 */
const ASR_PATH_BY_LANG: Record<string, string> = {
  WO: "/transcribe/wo",
  TW: "/transcribe/twi",
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  return xff?.split(",")[0]?.trim() || "unknown"
}

/** Block other websites from driving our proxy from a browser. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin")
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.get("host")
  } catch {
    return false
  }
}

const ALLOWED_TARGET_LANGS = new Set(["FR", "EN"])

/** Pull the transcript out of an unknown JSON shape without trusting any single key. */
function extractText(data: unknown): string {
  if (typeof data === "string") return data
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>
    for (const key of ["text", "transcription", "transcript", "result"]) {
      if (typeof obj[key] === "string") return obj[key] as string
    }
  }
  return ""
}

/** Pull the translation out of an unknown JSON shape. */
function extractTranslation(data: unknown): string {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>
    for (const key of ["translation", "translated_text", "translated"]) {
      if (typeof obj[key] === "string") return obj[key] as string
    }
  }
  return ""
}

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403)
  if (!checkRateLimit(clientIp(req))) return json({ error: "rate_limited" }, 429)

  let file: FormDataEntryValue | null
  let lang: string
  let targetLang: string | null
  try {
    const form = await req.formData()
    file = form.get("file")
    lang = (form.get("lang") as string | null)?.toUpperCase() ?? "WO"
    targetLang = (form.get("target_lang") as string | null)?.toUpperCase() || null
  } catch {
    return json({ error: "invalid_request" }, 400)
  }

  // Validate language against the allow-list before using it — no SSRF pivot possible
  // since the path is looked up from a static map, never interpolated from user input.
  const path = ASR_PATH_BY_LANG[lang]
  if (!path) return json({ error: "unsupported_language" }, 400)

  if (targetLang && !ALLOWED_TARGET_LANGS.has(targetLang)) {
    return json({ error: "unsupported_target_language" }, 400)
  }

  // Destination is fixed server-side config — never client-controlled.
  const base = process.env.ASR_API_URL
  if (!base || !base.startsWith("https://")) return json({ error: "unavailable" }, 503)

  if (!(file instanceof Blob) || file.size === 0) return json({ error: "no_file" }, 400)
  if (file.size > MAX_BYTES) return json({ error: "too_large" }, 413)
  if (file.type && !file.type.startsWith("audio/")) return json({ error: "unsupported_type" }, 415)

  const upstream = new FormData()
  upstream.append("file", file, file instanceof File ? file.name : "audio.wav")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  const startedAt = Date.now()
  const targetParam = targetLang ? `?target_lang=${targetLang.toLowerCase()}` : ""
  try {
    const res = await fetch(`${base}${path}${targetParam}`, {
      method: "POST",
      body: upstream,
      signal: controller.signal,
    })
    console.log(`asr[${lang}] ${res.status} in ${Date.now() - startedAt}ms (${file.size}B)`)
    if (!res.ok) return json({ error: "upstream_error" }, 502)

    const data = await res.json().catch(() => null)
    const text = extractText(data)
    const translation = extractTranslation(data)
    return json({ text, ...(translation ? { translation } : {}) }, 200)
  } catch (err) {
    const elapsed = Date.now() - startedAt
    const reason = err instanceof Error ? err.name : "unknown"
    console.error(`asr[${lang}] failed after ${elapsed}ms: ${reason}`)
    return json({ error: "timeout" }, 504)
  } finally {
    clearTimeout(timeout)
  }
}
