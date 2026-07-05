import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const maxDuration = 30

const UPSTREAM_TIMEOUT_MS = 27_000
const MAX_TEXT_LENGTH = 2000

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  return xff?.split(",")[0]?.trim() || "unknown"
}

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin")
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.get("host")
  } catch {
    return false
  }
}

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403)
  if (!checkRateLimit(clientIp(req))) return json({ error: "rate_limited" }, 429)

  let text: string
  try {
    const body = (await req.json()) as { text?: string }
    text = (body.text ?? "").trim()
  } catch {
    return json({ error: "invalid_request" }, 400)
  }

  if (!text) return json({ error: "no_text" }, 400)
  if (text.length > MAX_TEXT_LENGTH) return json({ error: "too_long" }, 413)

  const base = process.env.ASR_API_URL
  if (!base || !base.startsWith("https://")) return json({ error: "unavailable" }, 503)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  const startedAt = Date.now()

  try {
    const res = await fetch(`${base}/tts/twi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    })
    console.log(`tts[TW] ${res.status} in ${Date.now() - startedAt}ms`)
    if (!res.ok) return json({ error: "upstream_error" }, 502)

    const contentType = res.headers.get("content-type") ?? ""

    if (contentType.startsWith("audio/")) {
      // Backend returns raw audio bytes — buffer and encode as data URL
      const buf = await res.arrayBuffer()
      const base64 = Buffer.from(buf).toString("base64")
      const mime = contentType.split(";")[0].trim()
      return json({ audioUrl: `data:${mime};base64,${base64}` }, 200)
    }

    // Backend returns JSON with an audio field
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    const audio = data?.audio ?? data?.audio_data ?? data?.audio_base64
    if (typeof audio === "string") {
      return json({ audioUrl: `data:audio/wav;base64,${audio}` }, 200)
    }
    return json({ error: "no_audio" }, 502)
  } catch (err) {
    const elapsed = Date.now() - startedAt
    const reason = err instanceof Error ? err.name : "unknown"
    console.error(`tts[TW] failed after ${elapsed}ms: ${reason}`)
    return json({ error: "timeout" }, 504)
  } finally {
    clearTimeout(timeout)
  }
}
