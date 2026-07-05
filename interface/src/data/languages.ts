export interface Language {
  code: string
  name: string
  country: string
  flag: string
}

export const languages: Language[] = [
  { code: "WO", name: "Wolof", country: "Sénégal", flag: "🇸🇳" },
  { code: "TW", name: "Twi", country: "Ghana", flag: "🇬🇭" },
  { code: "FO", name: "Fon", country: "Bénin", flag: "🇧🇯" },
]

export interface Model {
  id: string
  type: "ASR" | "TTS" | "Translation"
  language: string
  languageCode: string
  description: string
  status: "ready" | "beta" | "coming-soon"
}

export const models: Model[] = [
  { id: "asr-wo", type: "ASR", language: "Wolof", languageCode: "WO", description: "Reconnaissance vocale — parole en texte", status: "ready" },
  { id: "asr-tw", type: "ASR", language: "Twi", languageCode: "TW", description: "Reconnaissance vocale — parole en texte", status: "beta" },
  { id: "asr-fo", type: "ASR", language: "Fon", languageCode: "FO", description: "Reconnaissance vocale — parole en texte", status: "ready" },
  { id: "tts-wo", type: "TTS", language: "Wolof", languageCode: "WO", description: "Synthèse vocale — texte en parole", status: "ready" },
  { id: "tts-tw", type: "TTS", language: "Twi", languageCode: "TW", description: "Synthèse vocale — texte en parole", status: "coming-soon" },
  { id: "tts-fo", type: "TTS", language: "Fon", languageCode: "FO", description: "Synthèse vocale — texte en parole", status: "beta" },
  { id: "trans-wo", type: "Translation", language: "Wolof", languageCode: "WO", description: "Traduction Wolof ↔ Français / Anglais", status: "ready" },
  { id: "trans-tw", type: "Translation", language: "Twi", languageCode: "TW", description: "Traduction Twi ↔ Français / Anglais", status: "beta" },
  { id: "trans-fo", type: "Translation", language: "Fon", languageCode: "FO", description: "Traduction Fon ↔ Français / Anglais", status: "ready" },
]
