import { Mic, Volume2, Languages } from "lucide-react"
import { Button } from "@/components/shared/Button"
import { languages } from "@/data/languages"
import Link from "next/link"

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden px-6 pt-40 pb-32 sm:pt-48 sm:pb-40">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          maskImage: "radial-gradient(circle at center, black 55%, transparent 78%)",
          background:
            "radial-gradient(circle at 50% 50%, rgba(0,83,159,0.15), transparent 60%)",
        }}
      />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
        <span
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-text-muted backdrop-blur-md"
          style={{ boxShadow: "inset 0 0 12px rgba(0,83,159,0.25)" }}
        >
          <span className="text-blue-bright">
            <Languages className="h-3.5 w-3.5" />
          </span>
          <span className="tracking-wide">Modèles linguistiques</span>
        </span>

        <h1 className="mt-5 max-w-4xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl md:text-7xl">
          Testez vos modèles de{" "}
          <span className="text-blue-bright">langues africaines</span>
        </h1>

        <p className="mt-4 max-w-xl text-balance text-base leading-relaxed text-text-muted sm:text-lg">
          ASR, TTS et Traduction pour le Wolof, le Twi et le Fon —
          une plateforme pour valider vos modèles de langues locales.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/demo/asr">
            <Button size="lg">
              <Mic className="h-5 w-5" />
              Essayer ASR
            </Button>
          </Link>
          <Link href="/demo/tts">
            <Button variant="outline" size="lg">
              <Volume2 className="h-5 w-5" />
              Essayer TTS
            </Button>
          </Link>
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-5">
          {languages.map((lang) => (
            <div
              key={lang.code}
              className="flex flex-col items-center gap-2"
            >
              <span className="text-4xl">{lang.flag}</span>
              <span className="text-sm font-medium text-white/85">
                {lang.name}
              </span>
              <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-text-muted">
                {lang.code}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
