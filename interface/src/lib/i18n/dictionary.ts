export type Locale = "en" | "fr"

export const LOCALES: Locale[] = ["en", "fr"]
export const DEFAULT_LOCALE: Locale = "en"

export const localeNames: Record<Locale, string> = {
  en: "English",
  fr: "Français",
}

/**
 * Flat translation dictionary. Keys use dotted namespaces for readability.
 * Interpolation uses `{var}` placeholders resolved by the `t()` helper.
 *
 * NOTE: Mock inference OUTPUT (transcripts/translations) is data, not chrome,
 * and intentionally lives in `lib/mockInference.ts` not here.
 */
const en = {
  // Generic actions
  newChat: "New chat",
  recent: "Recent",
  noConversations: "No conversations yet.",
  untitled: "Untitled",
  confirm: "Confirm",
  cancel: "Cancel",
  rename: "Rename",
  delete: "Delete",
  copy: "Copy",
  copied: "Copied",
  download: "Download",
  generating: "Generating",

  // Sidebar / header navigation
  openMenu: "Open menu",
  closeMenu: "Close menu",
  collapseMenu: "Collapse menu",
  expandMenu: "Expand menu",

  // Empty state
  greeting: "Hello",
  "empty.translation": "Enter text to translate between local and international languages.",
  "empty.tts": "Enter text to generate audio in a local language.",
  "empty.asr": "Record or upload audio to transcribe it to text.",
  "empty.asrHintBefore": "Use the mic or",
  "empty.asrHintAfter": "upload an audio file below.",

  // Mode selector
  "mode.translation": "Translation",
  "mode.translationSub": "Translate text",
  "mode.asr": "Speech recognition",
  "mode.asrSub": "Audio to text",
  "mode.tts": "Speech synthesis",
  "mode.ttsSub": "Text to audio",

  // Composer
  "composer.placeholderTranslation": "Enter text to translate…",
  "composer.placeholderTts": "Enter text to synthesize…",
  "composer.placeholderAsr": "Record or upload audio…",
  "composer.sourceLang": "Source language",
  "composer.targetLang": "Target language",
  "composer.lang": "Language",
  "composer.swap": "Swap languages",
  "composer.importAudio": "Upload audio",
  "composer.recording": "Recording…",
  "composer.discardAudio": "Remove audio",
  "composer.record": "Record",
  "composer.stop": "Stop",
  "composer.transcribe": "Transcribe",
  "composer.send": "Send",
  "composer.disclaimer": "Wolof speech recognition demo. Transcriptions may contain errors.",

  // Message bubble
  "bubble.synthesis": "Synthesis",
  "bubble.audio": "Audio",
  "bubble.audioGenerated": "Generated audio",
  "bubble.downloadAudio": "Download audio",
  "bubble.generatingAudio": "Generating audio…",

  // Chat controller (stored conversation titles)
  transcriptionTitle: "{lang} transcription",

  // Audio recorder
  "error.microphone": "Microphone access denied.",
  "error.transcription": "Transcription failed. Please try again.",

  // Language display names
  "lang.WO": "Wolof",
  "lang.TW": "Twi",
  "lang.FO": "Fon",
  "lang.FR": "French",
  "lang.EN": "English",

  // Country names
  "country.WO": "Senegal",
  "country.TW": "Ghana",
  "country.FO": "Benin",
} as const

export type TranslationKey = keyof typeof en

const fr: Record<TranslationKey, string> = {
  // Generic actions
  newChat: "Nouvelle discussion",
  recent: "Récent",
  noConversations: "Aucune discussion pour l'instant.",
  untitled: "Sans titre",
  confirm: "Valider",
  cancel: "Annuler",
  rename: "Renommer",
  delete: "Supprimer",
  copy: "Copier",
  copied: "Copié",
  download: "Télécharger",
  generating: "Génération en cours",

  // Sidebar / header navigation
  openMenu: "Ouvrir le menu",
  closeMenu: "Fermer le menu",
  collapseMenu: "Réduire le menu",
  expandMenu: "Développer le menu",

  // Empty state
  greeting: "Bonjour",
  "empty.translation":
    "Saisissez du texte à traduire entre langues locales et internationales.",
  "empty.tts": "Saisissez du texte pour générer de l'audio dans une langue locale.",
  "empty.asr": "Enregistrez ou importez un audio pour le transcrire en texte.",
  "empty.asrHintBefore": "Utilisez le micro ou",
  "empty.asrHintAfter": "importez un fichier audio ci-dessous.",

  // Mode selector
  "mode.translation": "Traduction",
  "mode.translationSub": "Traduire du texte",
  "mode.asr": "Reconnaissance vocale",
  "mode.asrSub": "Audio vers texte",
  "mode.tts": "Synthèse vocale",
  "mode.ttsSub": "Texte vers audio",

  // Composer
  "composer.placeholderTranslation": "Saisissez le texte à traduire…",
  "composer.placeholderTts": "Saisissez le texte à synthétiser…",
  "composer.placeholderAsr": "Enregistrez ou importez un audio…",
  "composer.sourceLang": "Langue source",
  "composer.targetLang": "Langue cible",
  "composer.lang": "Langue",
  "composer.swap": "Inverser les langues",
  "composer.importAudio": "Importer un audio",
  "composer.recording": "Enregistrement…",
  "composer.discardAudio": "Supprimer l'audio",
  "composer.record": "Enregistrer",
  "composer.stop": "Arrêter",
  "composer.transcribe": "Transcrire",
  "composer.send": "Envoyer",
  "composer.disclaimer":
    "Démo de reconnaissance vocale wolof. Les transcriptions peuvent contenir des erreurs.",

  // Message bubble
  "bubble.synthesis": "Synthèse",
  "bubble.audio": "Audio",
  "bubble.audioGenerated": "Audio généré",
  "bubble.downloadAudio": "Télécharger l'audio",
  "bubble.generatingAudio": "Génération de l'audio…",

  // Chat controller (stored conversation titles)
  transcriptionTitle: "Transcription {lang}",

  // Audio recorder
  "error.microphone": "Accès au microphone refusé.",
  "error.transcription": "Échec de la transcription. Veuillez réessayer.",

  // Language display names
  "lang.WO": "Wolof",
  "lang.TW": "Twi",
  "lang.FO": "Fon",
  "lang.FR": "Français",
  "lang.EN": "Anglais",

  // Country names
  "country.WO": "Sénégal",
  "country.TW": "Ghana",
  "country.FO": "Bénin",
}

export const dictionary: Record<Locale, Record<TranslationKey, string>> = { en, fr }

/** Resolve a key for a locale and interpolate `{var}` placeholders. */
export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const template = dictionary[locale]?.[key] ?? dictionary[DEFAULT_LOCALE][key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`
  )
}
