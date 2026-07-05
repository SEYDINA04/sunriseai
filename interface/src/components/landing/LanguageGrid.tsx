"use client"

import { FlagChip } from "@/components/shared/FlagChip"
import { languages } from "@/data/languages"
import { Globe } from "lucide-react"
import { SectionBadge } from "@/components/shared/SectionBadge"
import { useRouter } from "next/navigation"

export function LanguageGrid() {
  const router = useRouter()

  return (
    <section id="languages" className="px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center text-center">
          <SectionBadge icon={<Globe />} label="Langues disponibles" />
          <h2 className="mt-5 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            Trois langues, zéro compromis
          </h2>
          <p className="mt-4 max-w-xl text-balance text-sm leading-relaxed text-text-muted">
            Sélectionnez une langue pour tester les modèles disponibles.
          </p>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-8">
          {languages.map((lang) => (
            <div
              key={lang.code}
              className="flex cursor-pointer flex-col items-center gap-3 transition-opacity hover:opacity-80"
              onClick={() => router.push(`/demo/asr?lang=${lang.code.toLowerCase()}`)}
            >
              <FlagChip code={lang.code} flag={lang.flag} size="lg" />
              <div className="text-center">
                <p className="text-sm font-medium text-white">{lang.name}</p>
                <p className="text-xs text-text-muted">{lang.country}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
