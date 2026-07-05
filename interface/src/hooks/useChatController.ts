"use client"

import { useCallback, useState } from "react"
import { useConversations } from "@/components/chat/ConversationProvider"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { uid } from "@/lib/storage"
import type { Message, Mode } from "@/lib/types"
import { translate, synthesize, streamText } from "@/lib/mockInference"
import { synthesizeTwi } from "@/lib/tts"
import { transcribeAudio } from "@/lib/asr"
import { persistAudio } from "@/lib/audioStorage"

export interface ChatController {
  mode: Mode
  setMode: (m: Mode) => void
  lang: string
  setLang: (c: string) => void
  sourceLang: string
  setSourceLang: (c: string) => void
  targetLang: string
  setTargetLang: (c: string) => void
  swapLangs: () => void
  /** Optional translation target for ASR mode (null = no translation). */
  asrTargetLang: string | null
  setAsrTargetLang: (lang: string | null) => void
  isStreaming: boolean
  sendText: (text: string) => Promise<void>
  sendAudio: (blob: Blob) => Promise<void>
  /** Store a live transcript (from WebSocket) directly as a conversation turn. */
  sendTranscriptDirect: (text: string, lang: string, translatedText?: string) => void
}

export function useChatController(): ChatController {
  const conv = useConversations()
  const { t } = useTranslation()
  const [mode, setModeState] = useState<Mode>("asr")
  const [lang, setLang] = useState("WO")
  const [sourceLang, setSourceLang] = useState("WO")
  const [targetLang, setTargetLang] = useState("FR")
  const [asrTargetLang, setAsrTargetLang] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  // ASR supports WO and TW. TTS supports TW. No forced language reset on mode switch.
  const setMode = useCallback((m: Mode) => {
    setModeState(m)
  }, [])

  const swapLangs = useCallback(() => {
    setSourceLang(targetLang)
    setTargetLang(sourceLang)
  }, [sourceLang, targetLang])

  const addAssistantPlaceholder = useCallback(
    (conversationId: string, partial: Omit<Message, "id" | "role" | "status" | "createdAt">) => {
      const id = uid()
      conv.addMessage(conversationId, {
        id,
        role: "assistant",
        status: "streaming",
        createdAt: Date.now(),
        ...partial,
      })
      return id
    },
    [conv],
  )

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return
      setIsStreaming(true)

      const title = trimmed
      const conversationId = conv.ensureConversation(title)

      if (mode === "translation") {
        conv.addMessage(conversationId, {
          id: uid(),
          role: "user",
          mode: "translation",
          text: trimmed,
          sourceLang,
          targetLang,
          status: "done",
          createdAt: Date.now(),
        })
        const assistantId = addAssistantPlaceholder(conversationId, {
          mode: "translation",
          text: "",
          sourceLang,
          targetLang,
        })
        const result = await translate(sourceLang, targetLang, trimmed)
        await streamText(result, (partial) =>
          conv.updateMessage(conversationId, assistantId, { text: partial }),
        )
        conv.updateMessage(conversationId, assistantId, { status: "done" })
      } else if (mode === "tts") {
        conv.addMessage(conversationId, {
          id: uid(),
          role: "user",
          mode: "tts",
          text: trimmed,
          lang,
          status: "done",
          createdAt: Date.now(),
        })
        const assistantId = addAssistantPlaceholder(conversationId, {
          mode: "tts",
          lang,
        })
        try {
          // Twi has a real TTS backend; other languages fall back to mock.
          const audioUrl =
            lang === "TW" ? await synthesizeTwi(trimmed) : await synthesize(trimmed, lang)
          conv.updateMessage(conversationId, assistantId, { audioUrl, status: "done" })
        } catch {
          conv.updateMessage(conversationId, assistantId, {
            text: t("error.tts"),
            status: "error",
          })
        }
      }

      setIsStreaming(false)
    },
    [conv, mode, sourceLang, targetLang, lang, isStreaming, addAssistantPlaceholder, t],
  )

  const sendAudio = useCallback(
    async (blob: Blob) => {
      if (isStreaming) return
      setIsStreaming(true)

      const conversationId = conv.ensureConversation(
        t("transcriptionTitle", { lang: t(`lang.${lang}` as TranslationKey) }),
      )
      const stored = await persistAudio(blob)
      const audioUrl = stored.url

      conv.addMessage(conversationId, {
        id: uid(),
        role: "user",
        mode: "asr",
        audioUrl,
        audioKey: stored.key,
        text: audioUrl ? undefined : t("bubble.audio"),
        lang,
        status: "done",
        createdAt: Date.now(),
      })
      const assistantId = addAssistantPlaceholder(conversationId, {
        mode: "asr",
        text: "",
        lang,
        targetLang: asrTargetLang ?? undefined,
      })

      try {
        const result = await transcribeAudio(blob, lang, asrTargetLang ?? undefined)
        await streamText(result.text, (partial) =>
          conv.updateMessage(conversationId, assistantId, { text: partial }),
        )
        conv.updateMessage(conversationId, assistantId, {
          status: "done",
          ...(result.translation ? { translatedText: result.translation } : {}),
        })
      } catch {
        conv.updateMessage(conversationId, assistantId, {
          text: t("error.transcription"),
          status: "error",
        })
      } finally {
        setIsStreaming(false)
      }
    },
    [conv, lang, asrTargetLang, isStreaming, addAssistantPlaceholder, t],
  )

  const sendTranscriptDirect = useCallback(
    (text: string, transcribedLang: string, translatedText?: string) => {
      if (!text.trim()) return
      const conversationId = conv.ensureConversation(
        t("transcriptionTitle", { lang: t(`lang.${transcribedLang}` as TranslationKey) }),
      )
      conv.addMessage(conversationId, {
        id: uid(),
        role: "user",
        mode: "asr",
        lang: transcribedLang,
        text: t("composer.liveReady"),
        status: "done",
        createdAt: Date.now(),
      })
      conv.addMessage(conversationId, {
        id: uid(),
        role: "assistant",
        mode: "asr",
        text: text.trim(),
        lang: transcribedLang,
        targetLang: asrTargetLang ?? undefined,
        translatedText,
        status: "done",
        createdAt: Date.now(),
      })
    },
    [conv, t, asrTargetLang],
  )

  return {
    mode,
    setMode,
    lang,
    setLang,
    sourceLang,
    setSourceLang,
    targetLang,
    setTargetLang,
    swapLangs,
    asrTargetLang,
    setAsrTargetLang,
    isStreaming,
    sendText,
    sendAudio,
    sendTranscriptDirect,
  }
}
