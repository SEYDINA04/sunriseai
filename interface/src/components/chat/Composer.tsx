"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Square, Plus, ArrowUp, ArrowLeftRight, X, Radio } from "lucide-react"
import type { ChatController } from "@/hooks/useChatController"
import { useAudioRecorder } from "@/hooks/useAudioRecorder"
import { useWebSocketASR } from "@/hooks/useWebSocketASR"
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

// ASR supports Wolof (WO) and Twi (TW)
const asrOptions = localOptions.filter((l) => l.code === "WO" || l.code === "TW")

// TTS only has a live backend for Twi right now
const ttsOptions = localOptions.filter((l) => l.code === "TW")

// Translation targets for ASR+translate feature
const ASR_TRANSLATE_TARGETS = [
  { code: "FR", name: "Français", countryCode: "fr" },
  { code: "EN", name: "English", countryCode: "gb" },
]

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
  const [liveMode, setLiveMode] = useState(false)

  const recorder = useAudioRecorder((blob) => setAudioBlob(blob))
  const preview = uploadPreview ?? recorder.previewUrl

  const wsasr = useWebSocketASR((finalTranscript) => {
    if (finalTranscript.trim()) {
      controller.sendTranscriptDirect(finalTranscript, controller.lang)
    }
  })

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [draft])

  // Reset captured audio when leaving ASR mode
  const prevModeRef = useRef(mode)
  useEffect(() => {
    const prev = prevModeRef.current
    if (prev === "asr" && mode !== "asr") {
      setAudioBlob(null)
      setUploadPreview(null)
      recorder.reset()
      setLiveMode(false)
    }
    prevModeRef.current = mode
  }, [mode, recorder.reset])

  // When entering TTS mode, default to Twi (the only live backend lang).
  useEffect(() => {
    if (mode === "tts" && controller.lang !== "TW") {
      controller.setLang("TW")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, controller.lang, controller.setLang])

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

  const handleLiveMic = () => {
    if (wsasr.status === "recording") {
      wsasr.stop()
    } else {
      void wsasr.start(controller.lang)
    }
  }

  const placeholder =
    mode === "translation"
      ? t("composer.placeholderTranslation")
      : mode === "tts"
        ? t("composer.placeholderTts")
        : t("composer.placeholderAsr")

  const liveRecording = wsasr.status === "recording" || wsasr.status === "connecting"

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
            ) : mode === "tts" ? (
              <LanguagePicker
                label={t("composer.lang")}
                value={controller.lang}
                options={ttsOptions}
                onChange={controller.setLang}
              />
            ) : (
              /* ASR mode: source lang + optional translate-to + live toggle */
              <div className="flex flex-wrap items-center gap-2">
                <LanguagePicker
                  label={t("composer.lang")}
                  value={controller.lang}
                  options={asrOptions}
                  onChange={controller.setLang}
                />

                {/* Translate-to selector */}
                <AsrTargetPicker
                  value={controller.asrTargetLang}
                  onChange={controller.setAsrTargetLang}
                  label={t("asr.translateTo")}
                  noneLabel={t("asr.noTranslation")}
                  targets={ASR_TRANSLATE_TARGETS}
                />

                {/* Live mode toggle */}
                <button
                  onClick={() => setLiveMode((v) => !v)}
                  aria-pressed={liveMode}
                  title={t("composer.live")}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    liveMode
                      ? "border-red-500/40 bg-red-500/10 text-red-400"
                      : "border-white/10 bg-white/[0.03] text-text-muted hover:border-white/25 hover:text-white"
                  }`}
                >
                  <Radio className="h-3 w-3" />
                  {t("composer.live")}
                </button>
              </div>
            )}
          </div>

          {/* Input row */}
          {mode === "asr" ? (
            <div className="px-1">
              {/* Audio preview (non-live mode) */}
              {!liveMode && preview && !recorder.recording && (
                <div className="mb-2 flex items-center gap-2">
                  <audio controls src={preview} className="h-9 min-w-0 flex-1" />
                  <button
                    onClick={discardAudio}
                    aria-label={t("composer.discardAudio")}
                    className="shrink-0 rounded-full p-1.5 text-text-muted hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Live transcript preview */}
              {liveMode && wsasr.transcript && (
                <div className="mb-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80">
                  {wsasr.transcript}
                </div>
              )}

              <div className="flex items-center gap-2">
                {/* Upload button — hidden in live mode */}
                {!liveMode && (
                  <>
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
                  </>
                )}

                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {liveMode ? (
                    liveRecording ? (
                      <span className="flex items-center gap-2.5 text-sm text-red-400">
                        <LogoWaveform className="h-5 w-7 shrink-0" />
                        {t("composer.liveActive")}
                      </span>
                    ) : (
                      <span className="truncate text-sm text-text-muted">
                        {wsasr.transcript ? t("composer.liveReady") : placeholder}
                      </span>
                    )
                  ) : recorder.recording ? (
                    <span className="flex items-center gap-2.5 text-sm text-white/90">
                      <LogoWaveform className="h-5 w-7 shrink-0" />
                      {t("composer.recording")}
                    </span>
                  ) : (
                    <span className="truncate text-sm text-text-muted">
                      {preview ? t("composer.audioReady") : placeholder}
                    </span>
                  )}
                </div>

                {/* Mic / Stop button */}
                <button
                  onClick={
                    liveMode
                      ? handleLiveMic
                      : recorder.recording
                        ? recorder.stop
                        : recorder.start
                  }
                  aria-label={
                    liveMode
                      ? liveRecording
                        ? t("composer.stop")
                        : t("composer.record")
                      : recorder.recording
                        ? t("composer.stop")
                        : t("composer.record")
                  }
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors ${
                    (liveMode && liveRecording) || recorder.recording
                      ? "bg-red-500/90 text-white"
                      : "text-text-muted hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {(liveMode && liveRecording) || recorder.recording ? (
                    <Square className="h-4 w-4" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </button>

                {/* Send button — only in regular (non-live) mode */}
                {!liveMode && (
                  <button
                    onClick={submitAudio}
                    disabled={!canSendAudio}
                    aria-label={t("composer.transcribe")}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-bright text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-text-muted"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </button>
                )}
              </div>
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

/** Small inline picker for ASR translation target — includes a "none" option. */
function AsrTargetPicker({
  value,
  onChange,
  label,
  noneLabel,
  targets,
}: {
  value: string | null
  onChange: (v: string | null) => void
  label: string
  noneLabel: string
  targets: { code: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  const currentLabel = value ? (targets.find((t) => t.code === value)?.name ?? value) : noneLabel

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          value
            ? "border-blue-soft/40 bg-blue-soft/10 text-blue-soft"
            : "border-white/10 bg-white/[0.03] text-text-muted hover:border-white/25 hover:text-white"
        }`}
      >
        <span>{label}:</span>
        <span>{currentLabel}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-44 overflow-hidden rounded-2xl border border-white/10 bg-obsidian-900/95 p-1.5 shadow-2xl backdrop-blur-xl">
          <button
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
            className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.06] ${
              !value ? "text-white" : "text-text-muted"
            }`}
          >
            {noneLabel}
          </button>
          {targets.map((tgt) => (
            <button
              key={tgt.code}
              onClick={() => {
                onChange(tgt.code)
                setOpen(false)
              }}
              className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.06] ${
                value === tgt.code ? "text-blue-soft" : "text-white/90"
              }`}
            >
              {tgt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
