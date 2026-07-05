import { describe, it, expect } from "vitest"
import { bufferToBase64, encodeWav, chunkSamples, floatTo16BitPCM, resampleLinear } from "./audio"

describe("bufferToBase64", () => {
  it("matches btoa for a small buffer", () => {
    const bytes = new TextEncoder().encode("hello world")
    expect(bufferToBase64(bytes)).toBe(btoa("hello world"))
  })

  it("handles buffers larger than the 0x8000 chunk size", () => {
    const bytes = new Uint8Array(0x8000 * 2 + 7).fill(65)
    const decoded = atob(bufferToBase64(bytes))
    expect(decoded.length).toBe(bytes.length)
    expect(decoded[0]).toBe("A")
  })

  it("returns an empty string for an empty buffer", () => {
    expect(bufferToBase64(new Uint8Array(0))).toBe("")
  })
})

describe("encodeWav", () => {
  it("writes a valid 44-byte RIFF/WAVE header", () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1])
    const wav = encodeWav(samples, 16000)
    const text = new TextDecoder("ascii").decode(wav.subarray(0, 4))
    expect(text).toBe("RIFF")
    expect(new TextDecoder("ascii").decode(wav.subarray(8, 12))).toBe("WAVE")
    // header (44) + 2 bytes per sample
    expect(wav.length).toBe(44 + samples.length * 2)
  })

  it("encodes the correct sample rate in the header", () => {
    const wav = encodeWav(new Float32Array([0]), 16000)
    const view = new DataView(wav.buffer)
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint16(22, true)).toBe(1) // mono
  })

  it("clamps samples outside [-1, 1]", () => {
    const wav = encodeWav(new Float32Array([2, -2]), 16000)
    const view = new DataView(wav.buffer)
    expect(view.getInt16(44, true)).toBe(0x7fff)
    expect(view.getInt16(46, true)).toBe(-0x8000)
  })
})

describe("floatTo16BitPCM", () => {
  it("scales full-range samples without clipping", () => {
    const out = floatTo16BitPCM(new Float32Array([0, 1, -1, 0.5, -0.5]))
    expect(Array.from(out)).toEqual([0, 0x7fff, -0x8000, 16383, -16384])
  })

  it("clamps samples outside [-1, 1]", () => {
    const out = floatTo16BitPCM(new Float32Array([2, -2]))
    expect(out[0]).toBe(0x7fff)
    expect(out[1]).toBe(-0x8000)
  })
})

describe("resampleLinear", () => {
  it("returns the same array when rates match", () => {
    const input = new Float32Array([0.1, 0.2, 0.3])
    expect(resampleLinear(input, 16000, 16000)).toBe(input)
  })

  it("halves the length when downsampling by 2x", () => {
    const input = new Float32Array(1000).fill(0.5)
    const out = resampleLinear(input, 32000, 16000)
    expect(out.length).toBe(500)
  })

  it("doubles the length when upsampling by 2x", () => {
    const input = new Float32Array(500).fill(0.5)
    const out = resampleLinear(input, 16000, 32000)
    expect(out.length).toBe(1000)
  })

  it("interpolates between two known points", () => {
    // Source at 2 Hz -> target at 4 Hz: expect a sample inserted halfway.
    const input = new Float32Array([0, 1])
    const out = resampleLinear(input, 2, 4)
    expect(out.length).toBe(4)
    expect(out[0]).toBeCloseTo(0)
    expect(out[2]).toBeCloseTo(1)
  })
})

describe("chunkSamples", () => {
  const rate = 16000

  // Build a signal of `seconds` length with brief near-silent gaps every `gapEvery` sec.
  function signalWithGaps(seconds: number, gapEvery = 5): Float32Array {
    const data = new Float32Array(seconds * rate)
    for (let i = 0; i < data.length; i++) {
      const tSec = i / rate
      const inGap = Math.abs(tSec - Math.round(tSec / gapEvery) * gapEvery) < 0.05
      data[i] = inGap ? 0 : Math.sin(i * 0.05) * 0.8
    }
    return data
  }

  it("returns a single segment when audio is within the max length", () => {
    const samples = signalWithGaps(10)
    const out = chunkSamples(samples, { sampleRate: rate, targetSec: 25, maxSec: 35 })
    expect(out).toHaveLength(1)
    expect(out[0]).toBe(samples)
  })

  it("splits long audio into multiple segments", () => {
    const samples = signalWithGaps(90)
    const out = chunkSamples(samples, { sampleRate: rate, targetSec: 25, maxSec: 35 })
    expect(out.length).toBeGreaterThan(1)
  })

  it("never produces a segment longer than maxSec", () => {
    const samples = signalWithGaps(120)
    const maxSec = 35
    const out = chunkSamples(samples, { sampleRate: rate, targetSec: 25, maxSec })
    for (const seg of out) expect(seg.length).toBeLessThanOrEqual(maxSec * rate)
  })

  it("preserves every sample across the segments (no loss or overlap)", () => {
    const samples = signalWithGaps(70)
    const out = chunkSamples(samples, { sampleRate: rate, targetSec: 25, maxSec: 35 })
    expect(out.reduce((sum, s) => sum + s.length, 0)).toBe(samples.length)
  })

  it("always makes forward progress (no zero-length segments)", () => {
    const samples = signalWithGaps(200)
    const out = chunkSamples(samples, { sampleRate: rate, targetSec: 25, maxSec: 35 })
    for (const seg of out) expect(seg.length).toBeGreaterThan(0)
  })
})
