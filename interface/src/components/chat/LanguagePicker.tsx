"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, Check } from "lucide-react"
import type { LangOption } from "@/lib/mockInference"
import { useTranslation, type TranslationKey } from "@/lib/i18n"
import { Flag } from "./Flag"

export function LanguagePicker({
  value,
  options,
  onChange,
  label,
}: {
  value: string
  options: LangOption[]
  onChange: (code: string) => void
  label?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.code === value) ?? options[0]
  const nameFor = (code: string) => t(`lang.${code}` as TranslationKey)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/90 transition-colors hover:border-white/25"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        {current && <Flag countryCode={current.countryCode} className="h-4 w-4" />}
        <span className="font-medium">{current && nameFor(current.code)}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute bottom-full left-0 z-30 mb-2 max-h-64 w-48 overflow-y-auto rounded-2xl border border-white/10 bg-obsidian-900/95 p-1.5 shadow-2xl backdrop-blur-xl scroll-thin"
        >
          {options.map((o) => {
            const active = o.code === value
            return (
              <button
                key={o.code}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.code)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-white/90 transition-colors hover:bg-white/[0.06]"
              >
                <Flag countryCode={o.countryCode} className="h-5 w-5" />
                <span className="flex-1">{nameFor(o.code)}</span>
                {active && <Check className="h-4 w-4 text-blue-soft" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
