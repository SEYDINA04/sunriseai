export interface LangOption {
  code: string
  name: string
  /** ISO 3166-1 alpha-2 country code used to render a circle flag icon. */
  countryCode: string
}

import { languages } from "@/data/languages"
import { encodeWav, bufferToBase64 } from "./audio"

/** Translation can target the local languages plus French & English. */
export const translationLanguages: LangOption[] = [
  { code: "FR", name: "Français", countryCode: "fr" },
  { code: "EN", name: "English", countryCode: "gb" },
  ...languages.map((l) => ({ code: l.code, name: l.name, countryCode: l.countryCode })),
]

const mockTranslations: Record<string, string> = {
  "WO-FR": "Bonjour, comment allez-vous ? Je suis ici en train d'étudier avec le livre.",
  "WO-EN": "Hello, how are you? I am here studying with the book.",
  "TW-FR": "Bonjour, comment allez-vous ? S'il vous plaît, je suis venu à la maison.",
  "TW-EN": "Hello, how are you? Please, I have come home.",
  "FO-FR": "Bonjour, ça va ? Je suis là. J'apprends le français en classe.",
  "FO-EN": "Hello, how are you? I am here. I am learning French in class.",
  "FR-WO": "Naka nga def? Mangi fi jàng ak mbind mi.",
  "EN-WO": "Naka nga def? Mangi fi jàng ak mbind mi.",
}

/** Sample source phrases per local language, reused for suggestion chips. */
export const sampleTexts: Record<string, string> = {
  WO: "Naka nga def? Mangi fi jàng ak mbind mi.",
  TW: "Mekyea? Merɛkye, m'akɔma fie.",
  FO: "Ayɔɔ, ɖo wɛ? Un jɛ ɖo fi e.",
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Mock translation between two language codes. */
export async function translate(
  sourceCode: string,
  targetCode: string,
  _text: string,
): Promise<string> {
  await delay(500)
  const key = `${sourceCode}-${targetCode}`
  const reverseKey = `${targetCode}-${sourceCode}`
  return (
    mockTranslations[key] ||
    mockTranslations[reverseKey] ||
    `[Traduction simulée] ${sourceCode} → ${targetCode}`
  )
}

/* ------------------------------------------------------------------ */
/* Mock TTS generate a valid, short WAV (gentle tone) as a data URL. */
/* ------------------------------------------------------------------ */

/** Mock text-to-speech: returns a base64 WAV data URL whose length scales with text. */
export async function synthesize(text: string, _langCode: string): Promise<string> {
  await delay(900)
  const sampleRate = 16000
  const seconds = Math.min(6, Math.max(1.2, text.trim().length * 0.06))
  const total = Math.floor(sampleRate * seconds)
  const samples = new Float32Array(total)
  // A soft, fading two-note hum so the player shows a real waveform/duration.
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate
    const freq = 180 + 40 * Math.sin(t * 1.5)
    const envelope = Math.min(1, t * 4) * Math.max(0, 1 - t / seconds)
    samples[i] = Math.sin(2 * Math.PI * freq * t) * 0.12 * envelope
  }
  const wav = encodeWav(samples, sampleRate)
  return `data:audio/wav;base64,${bufferToBase64(wav)}`
}

/* ------------------------------------------------------------------ */
/* Streaming helper reveal text progressively to mimic Gemini.      */
/* ------------------------------------------------------------------ */

/**
 * Calls `onChunk` with the growing text every few characters.
 * Returns once the full string has been emitted.
 */
export async function streamText(
  full: string,
  onChunk: (partial: string) => void,
  opts: { stepMs?: number; charsPerStep?: number } = {},
): Promise<void> {
  const stepMs = opts.stepMs ?? 28
  const step = opts.charsPerStep ?? 3
  let i = 0
  while (i < full.length) {
    i = Math.min(full.length, i + step)
    onChunk(full.slice(0, i))
    if (i < full.length) await delay(stepMs)
  }
}
