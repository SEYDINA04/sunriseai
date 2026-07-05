import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-white/10 px-6 py-16 sm:py-20">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8">
        <Link href="/" className="text-lg font-semibold text-white">
          <span className="text-blue-bright">Afriklang</span> Models
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-text-muted">
          <Link href="/" className="transition-colors hover:text-white">
            Accueil
          </Link>
          <Link
            href="/demo/asr"
            className="transition-colors hover:text-white"
          >
            ASR
          </Link>
          <Link
            href="/demo/tts"
            className="transition-colors hover:text-white"
          >
            TTS
          </Link>
          <Link
            href="/demo/translate"
            className="transition-colors hover:text-white"
          >
            Traduction
          </Link>
          <Link
            href="/models"
            className="transition-colors hover:text-white"
          >
            Modèles
          </Link>
        </nav>

        <p className="text-xs text-text-muted/70">
          &copy; {new Date().getFullYear()} Afriklang Models. Construit avec
          soin, en Afrique, pour les équipes IA.
        </p>
      </div>
    </footer>
  )
}
