import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"

/** Reject uploads larger than this before forwarding (DoS / cost guard). */
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  return xff?.split(",")[0]?.trim() || "unknown"
}

/** Block other websites from driving our proxy from a browser. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin")
  if (!origin) return true // non-browser callers (and same-origin server calls) omit Origin
  try {
    return new URL(origin).host === req.headers.get("host")
  } catch {
    return false
  }
}

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

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403)
  if (!checkRateLimit(clientIp(req))) return json({ error: "rate_limited" }, 429)

  // Destination is fixed server-side config — never client-controlled (no SSRF pivot).
  const base = process.env.ASR_API_URL
  if (!base || !base.startsWith("https://")) return json({ error: "unavailable" }, 503)

  let file: FormDataEntryValue | null
  try {
    file = (await req.formData()).get("file")
  } catch {
    return json({ error: "invalid_request" }, 400)
  }

  if (!(file instanceof Blob) || file.size === 0) return json({ error: "no_file" }, 400)
  if (file.size > MAX_BYTES) return json({ error: "too_large" }, 413)
  if (file.type && !file.type.startsWith("audio/")) return json({ error: "unsupported_type" }, 415)

  const upstream = new FormData()
  upstream.append("file", file, file instanceof File ? file.name : "audio.wav")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)
  try {
    const res = await fetch(`${base}/transcribe`, {
      method: "POST",
      body: upstream,
      signal: controller.signal,
    })
    if (!res.ok) return json({ error: "upstream_error" }, 502)

    const data = await res.json().catch(() => null)
    return json({ text: extractText(data) }, 200)
  } catch {
    // Generic message only — never leak upstream URL / body / stack to the client.
    return json({ error: "timeout" }, 504)
  } finally {
    clearTimeout(timeout)
  }
}
