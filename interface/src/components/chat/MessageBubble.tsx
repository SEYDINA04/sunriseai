"use client"

import { useState } from "react"
import { Copy, Check, Download, ArrowRight, AlertCircle } from "lucide-react"
import type { Message } from "@/lib/types"
import { translationLanguages } from "@/lib/mockInference"
import { resolveAudioUrl } from "@/lib/audioStorage"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { TypingIndicator } from "./TypingIndicator"
import { LogoMark } from "./Logo"
import { Flag } from "./Flag"

const countryCodeFor = (code?: string) =>
  translationLanguages.find((l) => l.code === code)?.countryCode

/** Renders a circle flag for a language code, or nothing if unknown. */
function LangFlag({ code }: { code?: string }) {
  const cc = countryCodeFor(code)
  if (!cc) return null
  return <Flag countryCode={cc} className="h-3.5 w-3.5" />
}

function AssistantAvatar() {
  return <LogoMark className="mt-0.5 h-8 w-8 shrink-0" />
}

function IconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      {children}
    </button>
  )
}

function useCopy() {
  const [copied, setCopied] = useState(false)
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore (clipboard unavailable/denied)
    }
  }
  return { copied, copy }
}

export function MessageBubble({ message }: { message: Message }) {
  const { copied, copy } = useCopy()
  const { t } = useTranslation()
  const isUser = message.role === "user"
  const audioSrc = resolveAudioUrl({ url: message.audioUrl, key: message.audioKey })

  const nameFor = (code?: string) => (code ? t(`lang.${code}` as TranslationKey) : "")

  const downloadText = () => {
    if (!message.text) return
    const blob = new Blob([message.text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `bambi-${message.mode}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  /* ---------------------------- USER ---------------------------- */
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-3xl rounded-br-lg border border-white/10 bg-white/[0.06] px-4 py-3">
          {message.mode === "translation" && (
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-text-muted">
              <span className="inline-flex items-center gap-1">
                <LangFlag code={message.sourceLang} /> {nameFor(message.sourceLang)}
              </span>
              <ArrowRight className="h-3 w-3" />
              <span className="inline-flex items-center gap-1">
                <LangFlag code={message.targetLang} /> {nameFor(message.targetLang)}
              </span>
            </div>
          )}
          {message.mode === "tts" && (
            <div className="mb-1.5 inline-flex items-center gap-1 text-[11px] text-text-muted">
              <LangFlag code={message.lang} /> {t("bubble.synthesis")} {nameFor(message.lang)}
            </div>
          )}
          {audioSrc ? (
            <div className="flex flex-col gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                <LangFlag code={message.lang} /> {t("bubble.audio")} {nameFor(message.lang)}
              </span>
              <audio controls src={audioSrc} className="h-10 w-64 max-w-full" />
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-white">
              {message.text}
            </p>
          )}
        </div>
      </div>
    )
  }

  /* -------------------------- ASSISTANT ------------------------- */
  const streaming = message.status === "streaming"

  return (
    <div className="flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1 pt-0.5">
        {/* TTS assistant: audio output */}
        {message.mode === "tts" ? (
          audioSrc ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-text-muted">
                {t("bubble.audioGenerated")} {nameFor(message.lang)}
              </span>
              <audio controls src={audioSrc} className="h-11 w-full max-w-md" />
              <div className="flex items-center">
                <a
                  href={audioSrc}
                  download={`bambi-tts-${message.lang}.wav`}
                  className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-white/[0.06] hover:text-white"
                  aria-label={t("bubble.downloadAudio")}
                  title={t("bubble.downloadAudio")}
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
            </div>
          ) : (
            <div className="flex h-8 items-center gap-2 text-sm text-text-muted">
              <TypingIndicator />
              <span>{t("bubble.generatingAudio")}</span>
            </div>
          )
        ) : /* Text assistant: translation / transcript */
        message.status === "error" ? (
          <div className="flex items-start gap-2 text-[15px] leading-relaxed text-red-400">
            <AlertCircle className="mt-1 h-4 w-4 shrink-0" />
            <p>{message.text}</p>
          </div>
        ) : streaming && !message.text ? (
          <div className="flex h-8 items-center">
            <TypingIndicator />
          </div>
        ) : (
          <>
            <p
              className={`whitespace-pre-wrap text-[15px] leading-relaxed text-white/90 ${
                streaming ? "streaming-caret" : ""
              }`}
            >
              {message.text}
            </p>

            {/* ASR + translation result */}
            {!streaming && message.translatedText && (
              <div className="mt-3 border-t border-white/10 pt-3">
                <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] text-text-muted">
                  {t("bubble.translatedTo")}
                  {message.targetLang && (
                    <>
                      {" "}
                      → <LangFlag code={message.targetLang} /> {nameFor(message.targetLang)}
                    </>
                  )}
                </p>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/70">
                  {message.translatedText}
                </p>
              </div>
            )}

            {!streaming && message.text && (
              <div className="mt-2 flex items-center gap-0.5">
                <IconButton
                  label={copied ? t("copied") : t("copy")}
                  onClick={() => copy(message.text!)}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </IconButton>
                <IconButton label={t("download")} onClick={downloadText}>
                  <Download className="h-4 w-4" />
                </IconButton>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
