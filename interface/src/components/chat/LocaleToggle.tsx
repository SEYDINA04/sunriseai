"use client"

import { useTranslation, LOCALES, localeNames, type Locale } from "@/lib/i18n"

/** Compact segmented control to switch the interface language. */
export function LocaleToggle() {
  const { locale, setLocale } = useTranslation()

  return (
    <div
      role="radiogroup"
      aria-label="Language"
      className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-0.5"
    >
      {LOCALES.map((code: Locale) => {
        const active = code === locale
        return (
          <button
            key={code}
            role="radio"
            aria-checked={active}
            onClick={() => setLocale(code)}
            title={localeNames[code]}
            className={`rounded-full px-2.5 py-1 text-xs font-medium uppercase transition-colors ${
              active
                ? "bg-white/[0.1] text-white"
                : "text-text-muted hover:text-white"
            }`}
          >
            {code}
          </button>
        )
      })}
    </div>
  )
}
