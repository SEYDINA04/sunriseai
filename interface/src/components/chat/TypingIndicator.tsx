"use client"

import { useTranslation } from "@/lib/i18n"

/**
 * The brand's four sound-bars, breathing like an equalizer Bambi "thinks"
 * in sound, not in the generic three pulsing dots every other chat app uses.
 */
export function TypingIndicator() {
  const { t } = useTranslation()
  return (
    <div className="flex h-4 items-center gap-[3px]" role="status" aria-label={t("generating")}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="animate-equalize w-[3px] rounded-full bg-blue-soft"
          style={{
            height: "100%",
            transformOrigin: "center",
            animationDelay: `${i * 0.15}s`,
            animationDuration: `${1 + (i % 2) * 0.25}s`,
          }}
        />
      ))}
    </div>
  )
}
