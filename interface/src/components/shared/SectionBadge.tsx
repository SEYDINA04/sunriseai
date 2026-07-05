import { ReactNode } from "react"

interface SectionBadgeProps {
  icon: ReactNode
  label: string
}

export function SectionBadge({ icon, label }: SectionBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-text-muted backdrop-blur-md"
      style={{ boxShadow: "inset 0 0 12px rgba(0,83,159,0.25)" }}
    >
      <span className="text-blue-bright [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
      </span>
      <span className="tracking-wide">{label}</span>
    </span>
  )
}
