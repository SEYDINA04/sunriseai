import { Database } from "lucide-react"
import { SectionBadge } from "@/components/shared/SectionBadge"
import { Card } from "@/components/shared/Card"
import { Mic, Volume2, Languages } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/shared/Button"

const features = [
  {
    icon: Mic,
    title: "ASR",
    desc: "Reconnaissance automatique de la parole — transcription audio vers texte en Wolof, Twi et Fon.",
    href: "/demo/asr",
  },
  {
    icon: Volume2,
    title: "TTS",
    desc: "Synthèse vocale — générez de l'audio à partir de texte dans les langues locales africaines.",
    href: "/demo/tts",
  },
  {
    icon: Languages,
    title: "Traduction",
    desc: "Traduction entre langues locales (Wolof, Twi, Fon) et le Français ou l'Anglais.",
    href: "/demo/translate",
  },
]

export function FeaturesSection() {
  return (
    <section id="datasets" className="px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center text-center">
          <SectionBadge icon={<Database />} label="Nos modèles" />
          <h2 className="mt-5 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            Trois types de modèles, une interface
          </h2>
          <p className="mt-4 max-w-2xl text-balance text-sm leading-relaxed text-text-muted">
            Testez, validez et comparez vos modèles ASR, TTS et de traduction
            pour les langues africaines à faible ressource.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feat) => {
            const Icon = feat.icon
            return (
              <Card key={feat.title} className="p-7">
                <span className="inline-grid h-11 w-11 place-items-center rounded-xl border border-blue-bright/30 bg-blue-bright/10 text-blue-bright transition-transform duration-500 ease-out group-hover:scale-105">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-xl font-semibold tracking-tight sm:text-2xl">
                  {feat.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">
                  {feat.desc}
                </p>
                <div className="mt-6">
                  <Link href={feat.href}>
                    <Button variant="ghost" size="sm">
                      Tester le modèle
                      <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                        &rarr;
                      </span>
                    </Button>
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
