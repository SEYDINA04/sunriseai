/**
 * Best-effort in-memory fixed-window rate limiter.
 *
 * SECURITY NOTE: state lives in a single process. On serverless / multi-instance
 * hosting (e.g. AWS Amplify) the limit is NOT shared across instances, so this is
 * a coarse abuse deterrent — not a hard guarantee. For strict limits, move this to
 * a shared store (Redis) or enforce it at a WAF / API gateway.
 */

const WINDOW_MS = 60_000
const MAX_HITS = 20
const MAX_KEYS = 10_000

const hits = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, max = MAX_HITS, windowMs = WINDOW_MS): boolean {
  const now = Date.now()
  const entry = hits.get(key)

  if (!entry || now > entry.resetAt) {
    // Cheap unbounded-growth guard: drop everything if the map gets too large.
    if (hits.size > MAX_KEYS) hits.clear()
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= max) return false
  entry.count++
  return true
}
