import { describe, it, expect, beforeEach, vi } from "vitest"
import { checkRateLimit } from "./rateLimit"

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it("allows hits up to the max within a window", () => {
    const key = `k-${Math.random()}`
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000)).toBe(true)
    }
  })

  it("blocks the hit that exceeds the max", () => {
    const key = `k-${Math.random()}`
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000)
    expect(checkRateLimit(key, 3, 60_000)).toBe(false)
  })

  it("resets the window after it expires", () => {
    vi.useFakeTimers()
    const key = `k-${Math.random()}`
    expect(checkRateLimit(key, 1, 1_000)).toBe(true)
    expect(checkRateLimit(key, 1, 1_000)).toBe(false)
    vi.advanceTimersByTime(1_001)
    expect(checkRateLimit(key, 1, 1_000)).toBe(true)
    vi.useRealTimers()
  })

  it("isolates counters per key", () => {
    const a = `a-${Math.random()}`
    const b = `b-${Math.random()}`
    expect(checkRateLimit(a, 1, 60_000)).toBe(true)
    expect(checkRateLimit(a, 1, 60_000)).toBe(false)
    expect(checkRateLimit(b, 1, 60_000)).toBe(true)
  })
})
