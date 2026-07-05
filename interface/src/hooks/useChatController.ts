"use client"

import { useCallback, useState } from "react"
import { useConversations } from "@/components/chat/ConversationProvider"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { uid } from "@/lib/storage"
import type { Message, Mode } from "@/lib/types"
import { translate, synthesize, streamText } from "@/lib/mockInference"
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
  isStreaming: boolean
  sendText: (text: string) => Promise<void>
  sendAudio: (blob: Blob) => Promise<void>
}

export function useChatController(): ChatController {
  const conv = useConversations()
  const { t } = useTranslation()
  // Default to ASR — the only mode with a live backend (Translation/TTS are
  // currently disabled in the ModeSelector). Change back to "translation" when
  // those modes are re-enabled.
  const [mode, setModeState] = useState<Mode>("asr")
  const [lang, setLang] = useState("WO")
  const [sourceLang, setSourceLang] = useState("WO")
  const [targetLang, setTargetLang] = useState("FR")
  const [isStreaming, setIsStreaming] = useState(false)

  // Entering ASR forces Wolof — the only language the ASR model currently supports.
  const setMode = useCallback((m: Mode) => {
    setModeState(m)
    if (m === "asr") setLang("WO")
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
    [conv]
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
          conv.updateMessage(conversationId, assistantId, { text: partial })
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
        const audioUrl = await synthesize(trimmed, lang)
        conv.updateMessage(conversationId, assistantId, {
          audioUrl,
          status: "done",
        })
      }

      setIsStreaming(false)
    },
    [conv, mode, sourceLang, targetLang, lang, isStreaming, addAssistantPlaceholder]
  )

  const sendAudio = useCallback(
    async (blob: Blob) => {
      if (isStreaming) return
      setIsStreaming(true)

      const conversationId = conv.ensureConversation(
        t("transcriptionTitle", { lang: t(`lang.${lang}` as TranslationKey) })
      )
      const stored = await persistAudio(blob)

      conv.addMessage(conversationId, {
        id: uid(),
        role: "user",
        mode: "asr",
        audioUrl: stored.url,
        audioKey: stored.key,
        lang,
        status: "done",
        createdAt: Date.now(),
      })
      const assistantId = addAssistantPlaceholder(conversationId, {
        mode: "asr",
        text: "",
        lang,
      })

      try {
        const result = await transcribeAudio(blob)
        await streamText(result, (partial) =>
          conv.updateMessage(conversationId, assistantId, { text: partial })
        )
        conv.updateMessage(conversationId, assistantId, { status: "done" })
      } catch {
        conv.updateMessage(conversationId, assistantId, {
          text: t("error.transcription"),
          status: "error",
        })
      } finally {
        setIsStreaming(false)
      }
    },
    [conv, lang, isStreaming, addAssistantPlaceholder, t]
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
    isStreaming,
    sendText,
    sendAudio,
  }
}
