"use client"

import { useState } from "react"
import { Card } from "@/components/shared/Card"
import { Button } from "@/components/shared/Button"
import { FlagChip } from "@/components/shared/FlagChip"
import { languages } from "@/data/languages"
import { Volume2, Download } from "lucide-react"

export default function TTSPage() {
  const [selectedLang, setSelectedLang] = useState(languages[0])
  const [text, setText] = useState("")
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    if (!text.trim()) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1200))

    // Mock: create a small silent audio blob
    const sampleRate = 8000
    const seconds = 2
    const buffer = new ArrayBuffer(sampleRate * seconds)
    const view = new DataView(buffer)
    for (let i = 0; i < buffer.byteLength; i++) {
      view.setUint8(i, 128)
    }
    const blob = new Blob([buffer], { type: "audio/wav" })
    setAudioUrl(URL.createObjectURL(blob))
    setLoading(false)
  }

  const placeholderTexts: Record<string, string> = {
    WO: "Naka nga def? Mangi fi jàng ak mbind mi.",
    TW: "Mekyea? Merɛkye, m'akɔma fie.",
    FO: "Ayɔɔ, ɖo wɛ? Un jɛ ɖo fi e.",
  }

  return (
    <div className="px-6 pt-32 pb-20">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3">
          <span className="inline-grid h-10 w-10 place-items-center rounded-xl border border-blue-bright/30 bg-blue-bright/10 text-blue-bright">
            <Volume2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              TTS — Synthèse vocale
            </h1>
            <p className="text-sm text-text-muted">
              Générer de l&apos;audio à partir de texte
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <span className="text-xs font-medium text-text-muted">Langue :</span>
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setSelectedLang(lang)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                selectedLang.code === lang.code
                  ? "border-blue-bright/60 bg-blue-bright/10 text-blue-bright"
                  : "border-white/10 bg-white/[0.03] text-text-muted hover:border-white/25 hover:text-white/90"
              }`}
            >
              <span>{lang.flag}</span>
              {lang.name}
            </button>
          ))}
        </div>

        <Card className="mt-8 p-7">
          <div className="flex items-center gap-3">
            <FlagChip
              code={selectedLang.code}
              flag={selectedLang.flag}
              size="sm"
            />
            <div>
              <p className="text-sm font-medium text-white">
                {selectedLang.name} — {selectedLang.country}
              </p>
              <p className="text-xs text-text-muted">
                Saisissez le texte à synthétiser
              </p>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholderTexts[selectedLang.code]}
            rows={4}
            className="mt-6 w-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white placeholder-text-muted/50 backdrop-blur-xl transition-colors focus:border-blue-bright/60 focus:outline-none"
          />

          <div className="mt-6 flex justify-center">
            <Button onClick={handleGenerate} disabled={loading || !text.trim()}>
              {loading ? "Génération..." : "Générer l'audio"}
            </Button>
          </div>
        </Card>

        {audioUrl && (
          <Card className="mt-6 p-7" hover={false}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Audio généré</h3>
              <a
                href={audioUrl}
                download={`tts-${selectedLang.code}.wav`}
                className="rounded-full border border-white/10 bg-white/[0.03] p-2 text-text-muted transition-colors hover:text-white"
              >
                <Download className="h-4 w-4" />
              </a>
            </div>
            <audio
              controls
              src={audioUrl}
              className="mt-4 h-12 w-full rounded-lg"
            />
          </Card>
        )}
      </div>
    </div>
  )
}
