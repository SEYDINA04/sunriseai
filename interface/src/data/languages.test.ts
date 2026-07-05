import { describe, it, expect } from "vitest"
import { languages, models } from "./languages"

describe("languages catalog", () => {
  it("exposes at least one language", () => {
    expect(languages.length).toBeGreaterThan(0)
  })

  it("uses unique uppercase language codes", () => {
    const codes = languages.map((l) => l.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of codes) expect(code).toBe(code.toUpperCase())
  })

  it("uses lowercase ISO 3166-1 alpha-2 country codes", () => {
    for (const l of languages) {
      expect(l.countryCode).toMatch(/^[a-z]{2}$/)
    }
  })

  it("provides a non-empty greeting per language", () => {
    for (const l of languages) expect(l.greeting.trim().length).toBeGreaterThan(0)
  })
})

describe("models catalog", () => {
  it("uses unique model ids", () => {
    const ids = models.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("references languages that exist in the catalog", () => {
    const known = new Set(languages.map((l) => l.code))
    for (const m of models) expect(known.has(m.languageCode)).toBe(true)
  })

  it("only uses known model types and statuses", () => {
    const types = new Set(["ASR", "TTS", "Translation"])
    const statuses = new Set(["ready", "beta", "coming-soon"])
    for (const m of models) {
      expect(types.has(m.type)).toBe(true)
      expect(statuses.has(m.status)).toBe(true)
    }
  })
})
