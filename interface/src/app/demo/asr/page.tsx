"use client"

import { useState } from "react"
import { AudioRecorder } from "@/components/demo/AudioRecorder"
import { Card } from "@/components/shared/Card"
import { Button } from "@/components/shared/Button"
import { FlagChip } from "@/components/shared/FlagChip"
import { languages } from "@/data/languages"
import { Mic, Download, Copy, Check } from "lucide-react"

export default function ASRPage() {
  const [selectedLang, setSelectedLang] = useState(languages[0])
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleAudioReady = (blob: Blob) => {
    setAudioBlob(blob)
    setTranscript(null)
  }

  const handleTranscribe = async () => {
    if (!audioBlob) return
    setLoading(true)
    // Simulate ASR processing
    await new Promise((r) => setTimeout(r, 1500))
    const mockTranscripts: Record<string, string> = {
      WO: "Naka nga def? Mangi fi jàng ak mbind mi. Waaw, dégg naa làkk wi baax na.",
      TW: "Mekyea? Merɛkye, m'akɔma fie. Yɛ gye wo asɛm yi ho.",
      FO: "Ayɔɔ, ɖo wɛ? Un jɛ ɖo fi e. Un kplɔn flanségbé ɖo xɔ́ mɛ.",
    }
    setTranscript(mockTranscripts[selectedLang.code])
    setLoading(false)
  }

  const handleCopy = () => {
    if (!transcript) return
    navigator.clipboard.writeText(transcript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!transcript) return
    const blob = new Blob([transcript], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transcription-${selectedLang.code}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-6 pt-32 pb-20">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3">
          <span className="inline-grid h-10 w-10 place-items-center rounded-xl border border-blue-bright/30 bg-blue-bright/10 text-blue-bright">
            <Mic className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              ASR — Reconnaissance vocale
            </h1>
            <p className="text-sm text-text-muted">
              Transcrire l&apos;audio en texte
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
                Parlez ou uploadez un fichier audio
              </p>
            </div>
          </div>

          <div className="mt-6">
            <AudioRecorder onAudioReady={handleAudioReady} />
          </div>

          {audioBlob && (
            <div className="mt-6 flex justify-center">
              <Button onClick={handleTranscribe} disabled={loading}>
                {loading ? "Transcription..." : "Transcrire"}
              </Button>
            </div>
          )}
        </Card>

        {transcript && (
          <Card className="mt-6 p-7" hover={false}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">
                Transcription ({selectedLang.code})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="rounded-full border border-white/10 bg-white/[0.03] p-2 text-text-muted transition-colors hover:text-white"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="rounded-full border border-white/10 bg-white/[0.03] p-2 text-text-muted transition-colors hover:text-white"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="mt-4 text-base leading-relaxed text-white/85">
              {transcript}
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
