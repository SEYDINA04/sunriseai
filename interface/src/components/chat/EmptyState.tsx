"use client"

import { Mic, Upload, ArrowUpRight } from "lucide-react"
import type { Mode } from "@/lib/types"
import { sampleTexts } from "@/lib/mockInference"
import { languages } from "@/data/languages"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { Flag } from "./Flag"

const subtitleKeys: Record<Mode, TranslationKey> = {
  translation: "empty.translation",
  tts: "empty.tts",
  asr: "empty.asr",
}

// Signature element: the logo's sound-bars as a living equalizer, tipped from
// brand azure into warm gold. It says "voice" before a single word is read.
const WAVE = [0.4, 0.68, 1, 0.55, 0.85, 0.45, 0.95, 0.6, 0.34]

function Waveform() {
  return (
    <div
      className="mx-auto mb-6 flex h-10 items-center justify-center gap-[5px] sm:mb-8 sm:h-12"
      aria-hidden
    >
      {WAVE.map((h, i) => (
        <span
          key={i}
          className="animate-equalize w-[5px] rounded-full"
          style={{
            height: `${h * 100}%`,
            transformOrigin: "center",
            animationDelay: `${i * 0.11}s`,
            animationDuration: `${1.3 + (i % 3) * 0.22}s`,
            background:
              "linear-gradient(180deg, var(--color-blue-soft), var(--color-gold))",
          }}
        />
      ))}
    </div>
  )
}

export function EmptyState({
  mode,
  lang,
  sourceLang,
  targetLang,
  onSuggestion,
}: {
  mode: Mode
  lang: string
  sourceLang: string
  targetLang: string
  onSuggestion: (text: string, langCode: string) => void
}) {
  const { t } = useTranslation()

  // Greet in the selected African language; fall back to the UI locale when
  // the active translation pair has no local language (e.g. FR ↔ EN).
  const greetingFor = (code: string) =>
    languages.find((l) => l.code === code)?.greeting
  const greeting =
    (mode === "translation"
      ? greetingFor(sourceLang) ?? greetingFor(targetLang)
      : greetingFor(lang)) ?? t("greeting")

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="flex min-h-full items-center justify-center px-4 py-8 sm:py-10">
        <div className="w-full max-w-2xl text-center">
          <Waveform />
          <h1 className="text-greeting-gradient font-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            {greeting}
          </h1>
          <p className="mt-3 text-base text-text-muted sm:text-lg">{t(subtitleKeys[mode])}</p>

          <div className="mt-8 sm:mt-10">
            {mode === "asr" ? (
              <div className="mx-auto flex max-w-md items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-text-muted">
                <Mic className="h-5 w-5 shrink-0 text-blue-soft" />
                <span>
                  {t("empty.asrHintBefore")}
                  <Upload className="mx-1 inline h-4 w-4 align-text-bottom" />
                  {t("empty.asrHintAfter")}
                </span>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {languages.map((lang) => {
                  const sample = sampleTexts[lang.code]
                  return (
                    <button
                      key={lang.code}
                      onClick={() => onSuggestion(sample, lang.code)}
                      className="group flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-blue-soft/40 hover:bg-white/[0.05]"
                    >
                      <span className="inline-flex items-center gap-2 text-sm text-white/90">
                        <Flag countryCode={lang.countryCode} className="h-4 w-4" />
                        {t(`lang.${lang.code}` as TranslationKey)}
                      </span>
                      <span className="line-clamp-2 text-xs text-text-muted">{sample}</span>
                      <ArrowUpRight className="mt-auto h-4 w-4 self-end text-text-muted transition-colors group-hover:text-gold" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
