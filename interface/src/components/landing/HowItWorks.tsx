import { Mic, ArrowRight, Volume2 } from "lucide-react"
import { SectionBadge } from "@/components/shared/SectionBadge"

const steps = [
  {
    icon: Mic,
    title: "Enregistrer",
    desc: "Parlez dans le micro ou uploadez un fichier audio dans la langue de votre choix.",
  },
  {
    icon: ArrowRight,
    title: "Traiter",
    desc: "Le modèle ASR transcrit, le moteur de traduction convertit, le TTS synthétise.",
  },
  {
    icon: Volume2,
    title: "Écouter",
    desc: "Écoutez le résultat, téléchargez la transcription ou l'audio généré.",
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center text-center">
          <SectionBadge
            icon={
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3"
                />
              </svg>
            }
            label="Comment ça marche"
          />
          <h2 className="mt-5 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            De l&apos;audio au texte, en 3 étapes
          </h2>
          <p className="mt-4 max-w-xl text-balance text-sm leading-relaxed text-text-muted">
            Une interface simple pour tester vos modèles de langues africaines.
          </p>
        </div>

        <div className="relative mt-14 grid gap-5 sm:grid-cols-3">
          <div className="absolute left-1/3 right-1/3 top-12 hidden h-px bg-gradient-to-r from-transparent via-blue-bright to-transparent opacity-50 sm:block" />

          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <div key={step.title} className="flex flex-col items-center text-center">
                <span className="inline-grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-xl">
                  <Icon className="h-7 w-7 text-blue-bright" />
                </span>
                <span className="mt-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-bright/20 text-xs font-semibold text-blue-bright">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-lg font-semibold sm:text-xl">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  {step.desc}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
