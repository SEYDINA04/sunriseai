export interface Language {
  code: string
  name: string
  country: string
  /** ISO 3166-1 alpha-2 country code used to render a circle flag icon. */
  countryCode: string
  /** Native-language greeting shown on the empty state. */
  greeting: string
}

export const languages: Language[] = [
  { code: "WO", name: "Wolof", country: "Sénégal", countryCode: "sn", greeting: "Dalal ak jàmm" },
  { code: "TW", name: "Twi", country: "Ghana", countryCode: "gh", greeting: "Akwaaba" },
  { code: "FO", name: "Fon", country: "Bénin", countryCode: "bj", greeting: "Kúabɔ̀" },
]

export interface Model {
  id: string
  type: "ASR" | "TTS" | "Translation"
  language: string
  languageCode: string
  description: string
  status: "ready" | "beta" | "coming-soon"
}

// Availability catalog. Only the Wolof ASR model has a live backend today;
// every other model is still mocked / not yet deployed, so it's marked
// "coming-soon" and is disabled in the UI (see ModeSelector).
export const models: Model[] = [
  { id: "asr-wo", type: "ASR", language: "Wolof", languageCode: "WO", description: "Reconnaissance vocale parole en texte", status: "ready" },
  { id: "asr-tw", type: "ASR", language: "Twi", languageCode: "TW", description: "Reconnaissance vocale parole en texte", status: "coming-soon" },
  { id: "asr-fo", type: "ASR", language: "Fon", languageCode: "FO", description: "Reconnaissance vocale parole en texte", status: "coming-soon" },
  { id: "tts-wo", type: "TTS", language: "Wolof", languageCode: "WO", description: "Synthèse vocale texte en parole", status: "coming-soon" },
  { id: "tts-tw", type: "TTS", language: "Twi", languageCode: "TW", description: "Synthèse vocale texte en parole", status: "coming-soon" },
  { id: "tts-fo", type: "TTS", language: "Fon", languageCode: "FO", description: "Synthèse vocale texte en parole", status: "coming-soon" },
  { id: "trans-wo", type: "Translation", language: "Wolof", languageCode: "WO", description: "Traduction Wolof ↔ Français / Anglais", status: "coming-soon" },
  { id: "trans-tw", type: "Translation", language: "Twi", languageCode: "TW", description: "Traduction Twi ↔ Français / Anglais", status: "coming-soon" },
  { id: "trans-fo", type: "Translation", language: "Fon", languageCode: "FO", description: "Traduction Fon ↔ Français / Anglais", status: "coming-soon" },
]
