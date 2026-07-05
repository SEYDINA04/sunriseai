"use client"

import { useState } from "react"
import { Card } from "@/components/shared/Card"
import { languages } from "@/data/languages"
import { Languages, ArrowLeftRight, Copy, Check } from "lucide-react"
import { Button } from "@/components/shared/Button"

interface LangOption {
  code: string
  name: string
  flag: string
}

const targetLanguages: LangOption[] = [
  { code: "FR", name: "Français", flag: "🇫🇷" },
  { code: "EN", name: "English", flag: "🇬🇧" },
  ...languages,
]

const mockTranslations: Record<string, string> = {
  "WO-FR": "Bonjour, comment allez-vous ? Je suis ici en train d'étudier avec le livre.",
  "WO-EN": "Hello, how are you? I am here studying with the book.",
  "TW-FR": "Bonjour, comment allez-vous ? S'il vous plaît, je suis venu à la maison.",
  "TW-EN": "Hello, how are you? Please, I have come home.",
  "FO-FR": "Bonjour, ça va ? Je suis là. J'apprends le français en classe.",
  "FO-EN": "Hello, how are you? I am here. I am learning French in class.",
  "FR-WO": "Naka nga def? Mangi fi jàng ak mbind mi.",
  "EN-WO": "Naka nga def? Mangi fi jàng ak mbind mi.",
}

const sourceTexts: Record<string, string> = {
  WO: "Naka nga def? Mangi fi jàng ak mbind mi. Waaw, dégg naa làkk wi baax na.",
  TW: "Mekyea? Merɛkye, m'akɔma fie. Yɛ gye wo asɛm yi ho.",
  FO: "Ayɔɔ, ɖo wɛ? Un jɛ ɖo fi e. Un kplɔn flanségbé ɖo xɔ́ mɛ.",
}

export default function TranslatePage() {
  const [sourceLang, setSourceLang] = useState<LangOption>(languages[0])
  const [targetLang, setTargetLang] = useState<LangOption>(targetLanguages[0])
  const [sourceText, setSourceText] = useState(sourceTexts[languages[0].code])
  const [translated, setTranslated] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleTranslate = async () => {
    if (!sourceText.trim()) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1000))

    const key = `${sourceLang.code}-${targetLang.code}`
    const reverseKey = `${targetLang.code}-${sourceLang.code}`
    const result =
      mockTranslations[key] ||
      mockTranslations[reverseKey] ||
      `[Traduction simulée] ${sourceLang.code} → ${targetLang.code}`
    setTranslated(result)
    setLoading(false)
  }

  const handleSwap = () => {
    const temp = sourceLang
    setSourceLang(targetLang)
    setTargetLang(temp)
    setSourceText(translated || "")
    setTranslated(sourceText)
  }

  const handleCopy = () => {
    if (!translated) return
    navigator.clipboard.writeText(translated)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isLocalLang = (code: string) =>
    languages.some((l) => l.code === code)

  return (
    <div className="px-6 pt-32 pb-20">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-3">
          <span className="inline-grid h-10 w-10 place-items-center rounded-xl border border-blue-bright/30 bg-blue-bright/10 text-blue-bright">
            <Languages className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Traduction
            </h1>
            <p className="text-sm text-text-muted">
              Traduire entre langues locales et internationales
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr,auto,1fr]">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <span className="text-xl">
                {
                  targetLanguages.find((l) => l.code === sourceLang.code)
                    ?.flag
                }
              </span>
              <select
                value={sourceLang.code}
                onChange={(e) => {
                  const lang = [...targetLanguages].find(
                    (l) => l.code === e.target.value
                  )
                  if (lang) {
                    setSourceLang(lang)
                    if (isLocalLang(lang.code))
                      setSourceText(sourceTexts[lang.code])
                    else setSourceText("")
                  }
                }}
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white backdrop-blur-xl focus:border-blue-bright/60 focus:outline-none"
              >
                {targetLanguages.map((l) => (
                  <option key={l.code} value={l.code} className="bg-obsidian-950">
                    {l.flag} {l.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              rows={5}
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white placeholder-text-muted/50 backdrop-blur-xl transition-colors focus:border-blue-bright/60 focus:outline-none"
            />
          </Card>

          <div className="flex items-center justify-center">
            <button
              onClick={handleSwap}
              className="rounded-full border border-white/10 bg-white/[0.03] p-3 text-text-muted transition-colors hover:text-white"
            >
              <ArrowLeftRight className="h-5 w-5" />
            </button>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">{targetLang.flag}</span>
                <select
                  value={targetLang.code}
                  onChange={(e) => {
                    const lang = targetLanguages.find(
                      (l) => l.code === e.target.value
                    )
                    if (lang) setTargetLang(lang)
                  }}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white backdrop-blur-xl focus:border-blue-bright/60 focus:outline-none"
                >
                  {targetLanguages.map((l) => (
                    <option key={l.code} value={l.code} className="bg-obsidian-950">
                      {l.flag} {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {translated ? (
              <div className="mt-4">
                <p className="text-sm leading-relaxed text-white/85">
                  {translated}
                </p>
                <button
                  onClick={handleCopy}
                  className="mt-3 rounded-full border border-white/10 bg-white/[0.03] p-2 text-text-muted transition-colors hover:text-white"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-text-muted/50">
                Traduction apparaîtra ici
              </p>
            )}
          </Card>
        </div>

        <div className="mt-8 flex justify-center">
          <Button onClick={handleTranslate} disabled={loading || !sourceText.trim()}>
            {loading ? "Traduction..." : "Traduire"}
          </Button>
        </div>
      </div>
    </div>
  )
}
