export type Mode = "asr" | "tts" | "translation"

export type MessageRole = "user" | "assistant"

export type MessageStatus = "streaming" | "done" | "error"

export interface Message {
  id: string
  role: MessageRole
  mode: Mode
  /** User input text (tts/translation) or assistant output text (asr transcript / translation). */
  text?: string
  /** Playable audio source: base64 data URL (asr input / tts output) today, presigned GET URL later. */
  audioUrl?: string
  /** Opaque storage key for the audio object — reserved for the S3 seam, unused today. */
  audioKey?: string
  /** Single language code for asr / tts (e.g. "WO"). */
  lang?: string
  /** Translation source language code. */
  sourceLang?: string
  /** Translation target language code. */
  targetLang?: string
  /** ASR+translation: translated output when target_lang was requested. */
  translatedText?: string
  status: MessageStatus
  createdAt: number
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}
