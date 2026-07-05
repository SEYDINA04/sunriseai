"use client"

import { Card } from "@/components/shared/Card"
import { SectionBadge } from "@/components/shared/SectionBadge"
import { FlagChip } from "@/components/shared/FlagChip"
import { languages, models } from "@/data/languages"
import { CircuitBoard, Mic, Volume2, Languages, Check, Clock, FlaskConical } from "lucide-react"

const statusConfig: Record<
  string,
  { label: string; icon: typeof Check; className: string }
> = {
  ready: {
    label: "Prêt",
    icon: Check,
    className: "text-green-500 border-green-500/30 bg-green-500/10",
  },
  beta: {
    label: "Beta",
    icon: FlaskConical,
    className: "text-amber-500 border-amber-500/30 bg-amber-500/10",
  },
  "coming-soon": {
    label: "Bientôt",
    icon: Clock,
    className: "text-text-muted border-white/10 bg-white/[0.03]",
  },
}

const typeIcons = {
  ASR: Mic,
  TTS: Volume2,
  Translation: Languages,
}

export default function ModelsPage() {
  return (
    <div className="px-6 pt-32 pb-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center text-center">
          <SectionBadge
            icon={<CircuitBoard className="h-3.5 w-3.5" />}
            label="Modèles disponibles"
          />
          <h1 className="mt-5 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            Nos modèles linguistiques
          </h1>
          <p className="mt-4 max-w-xl text-balance text-sm leading-relaxed text-text-muted">
            Tous les modèles disponibles pour le Wolof, le Twi et le Fon.
          </p>
        </div>

        <div className="mt-14 space-y-16">
          {(["ASR", "TTS", "Translation"] as const).map((type) => {
            const TypeIcon = typeIcons[type]
            const typeModels = models.filter((m) => m.type === type)

            return (
              <div key={type}>
                <div className="mb-6 flex items-center gap-3">
                  <span className="inline-grid h-9 w-9 place-items-center rounded-xl border border-blue-bright/30 bg-blue-bright/10 text-blue-bright">
                    <TypeIcon className="h-4 w-4" />
                  </span>
                  <h2 className="text-xl font-semibold">{type}</h2>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-0.5 text-xs text-text-muted">
                    {typeModels.length} modèle{typeModels.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {typeModels.map((model) => {
                    const langInfo = languages.find(
                      (l) => l.code === model.languageCode
                    )
                    const status = statusConfig[model.status]
                    const StatusIcon = status.icon

                    return (
                      <Card key={model.id} className="p-6">
                        <div className="flex items-start justify-between">
                          <FlagChip
                            code={model.languageCode}
                            flag={langInfo?.flag ?? ""}
                            size="sm"
                          />
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${status.className}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                        </div>

                        <h3 className="mt-4 text-base font-semibold">
                          {model.language}
                        </h3>
                        <p className="mt-1 text-sm text-text-muted">
                          {model.description}
                        </p>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
