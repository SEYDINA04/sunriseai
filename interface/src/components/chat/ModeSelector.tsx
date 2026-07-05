"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, ChevronDown, Check } from "lucide-react"
import type { Mode } from "@/lib/types"
import { useTranslation, type TranslationKey } from "@/lib/i18n"

const MODES: {
  value: Mode
  labelKey: TranslationKey
  subKey: TranslationKey
  icon: typeof Mic
}[] = [
  // Only Wolof speech-to-text (ASR) has a live backend today. Translation and
  // TTS are still mocked, so they're disabled until their models are available.
  // To re-enable: uncomment the line(s) below and re-add the matching
  // lucide-react icons (Languages / Volume2) to the import above.
  // { value: "translation", labelKey: "mode.translation", subKey: "mode.translationSub", icon: Languages },
  { value: "asr", labelKey: "mode.asr", subKey: "mode.asrSub", icon: Mic },
  // { value: "tts", labelKey: "mode.tts", subKey: "mode.ttsSub", icon: Volume2 },
]

export function ModeSelector({
  value,
  onChange,
  openDirection = "down",
}: {
  value: Mode
  onChange: (m: Mode) => void
  openDirection?: "up" | "down"
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = MODES.find((m) => m.value === value) ?? MODES[0]
  const Icon = current.icon

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/90 transition-colors hover:border-white/25"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon className="h-4 w-4 text-blue-soft" />
        <span className="font-medium">{t(current.labelKey)}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute left-0 z-30 w-64 overflow-hidden rounded-2xl border border-white/10 bg-obsidian-900/95 p-1.5 shadow-2xl backdrop-blur-xl ${
            openDirection === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {MODES.map((m) => {
            const MIcon = m.icon
            const active = m.value === value
            return (
              <button
                key={m.value}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(m.value)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
              >
                <span className="inline-grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-blue-soft">
                  <MIcon className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-white">{t(m.labelKey)}</span>
                  <span className="block text-xs text-text-muted">{t(m.subKey)}</span>
                </span>
                {active && <Check className="h-4 w-4 text-blue-soft" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
