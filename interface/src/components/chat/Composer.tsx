"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Square, Plus, ArrowUp, ArrowLeftRight, X } from "lucide-react"
import type { ChatController } from "@/hooks/useChatController"
import { useAudioRecorder } from "@/hooks/useAudioRecorder"
import { languages } from "@/data/languages"
import { translationLanguages } from "@/lib/mockInference"
import { useTranslation } from "@/lib/i18n"
import { LanguagePicker } from "./LanguagePicker"
import { ModeSelector } from "./ModeSelector"
import { LogoWaveform } from "./LogoWaveform"

const localOptions = languages.map((l) => ({
  code: l.code,
  name: l.name,
  countryCode: l.countryCode,
}))

// ASR currently supports Wolof only — restrict the picker so users can't pick a
// language the model can't transcribe (the controller also forces WO on entry).
const asrOptions = localOptions.filter((l) => l.code === "WO")

export function Composer({
  controller,
  draft,
  setDraft,
}: {
  controller: ChatController
  draft: string
  setDraft: (t: string) => void
}) {
  const { mode, isStreaming } = controller
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const recorder = useAudioRecorder((blob) => setAudioBlob(blob))
  const preview = uploadPreview ?? recorder.previewUrl

  // Auto-grow textarea.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [draft])

  // Reset captured audio when leaving ASR mode (adjust state during render
  // based on the previous value preferred over an effect).
  const [prevMode, setPrevMode] = useState(mode)
  if (mode !== prevMode) {
    setPrevMode(mode)
    if (mode !== "asr") {
      setAudioBlob(null)
      setUploadPreview(null)
    }
  }

  const isText = mode === "translation" || mode === "tts"
  const canSendText = isText && draft.trim().length > 0 && !isStreaming
  const canSendAudio = mode === "asr" && !!audioBlob && !isStreaming

  const submitText = () => {
    if (!canSendText) return
    controller.sendText(draft)
    setDraft("")
  }
  const submitAudio = () => {
    if (!canSendAudio) return
    controller.sendAudio(audioBlob!)
    setAudioBlob(null)
    setUploadPreview(null)
    recorder.reset()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && isText) {
      e.preventDefault()
      submitText()
    }
  }

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAudioBlob(file)
    setUploadPreview(URL.createObjectURL(file))
    e.target.value = ""
  }

  const discardAudio = () => {
    setAudioBlob(null)
    setUploadPreview(null)
    recorder.reset()
  }

  const placeholder =
    mode === "translation"
      ? t("composer.placeholderTranslation")
      : mode === "tts"
        ? t("composer.placeholderTts")
        : t("composer.placeholderAsr")

  return (
    <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-2.5 backdrop-blur-xl shadow-2xl">
          {/* Mode + language controls */}
          <div className="flex flex-wrap items-center gap-2 px-1.5 pb-2">
            <ModeSelector
              value={controller.mode}
              onChange={controller.setMode}
              openDirection="up"
            />
            <span className="hidden h-4 w-px bg-white/10 sm:block" aria-hidden />
            {mode === "translation" ? (
              <div className="flex items-center gap-2">
                <LanguagePicker
                  label={t("composer.sourceLang")}
                  value={controller.sourceLang}
                  options={translationLanguages}
                  onChange={controller.setSourceLang}
                />
                <button
                  onClick={controller.swapLangs}
                  aria-label={t("composer.swap")}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] p-1.5 text-text-muted transition-colors hover:text-white"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </button>
                <LanguagePicker
                  label={t("composer.targetLang")}
                  value={controller.targetLang}
                  options={translationLanguages}
                  onChange={controller.setTargetLang}
                />
              </div>
            ) : (
              <LanguagePicker
                label={t("composer.lang")}
                value={controller.lang}
                options={mode === "asr" ? asrOptions : localOptions}
                onChange={controller.setLang}
              />
            )}
          </div>

          {/* Input row */}
          {mode === "asr" ? (
            <div className="flex items-center gap-2 px-1">
              <button
                onClick={() => fileRef.current?.click()}
                aria-label={t("composer.importAudio")}
                title={t("composer.importAudio")}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Plus className="h-5 w-5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={onUpload}
              />

              <div className="flex flex-1 items-center gap-3">
                {recorder.recording ? (
                  <span className="flex items-center gap-2.5 text-sm text-white/90">
                    <LogoWaveform className="h-5 w-7 shrink-0" />
                    {t("composer.recording")}
                  </span>
                ) : preview ? (
                  <div className="flex flex-1 items-center gap-2">
                    <audio controls src={preview} className="h-9 flex-1" />
                    <button
                      onClick={discardAudio}
                      aria-label={t("composer.discardAudio")}
                      className="rounded-full p-1.5 text-text-muted hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-text-muted">{placeholder}</span>
                )}
              </div>

              <button
                onClick={recorder.recording ? recorder.stop : recorder.start}
                aria-label={recorder.recording ? t("composer.stop") : t("composer.record")}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors ${
                  recorder.recording
                    ? "bg-red-500/90 text-white"
                    : "text-text-muted hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {recorder.recording ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>

              <button
                onClick={submitAudio}
                disabled={!canSendAudio}
                aria-label={t("composer.transcribe")}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-bright text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-text-muted"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2 px-1">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={placeholder}
                className="scroll-thin max-h-[200px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] text-white placeholder-text-muted/60 focus:outline-none"
              />
              <button
                onClick={submitText}
                disabled={!canSendText}
                aria-label={t("composer.send")}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-bright text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-text-muted"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-text-muted/70">
          {t("composer.disclaimer")}
        </p>
      </div>
    </div>
  )
}
