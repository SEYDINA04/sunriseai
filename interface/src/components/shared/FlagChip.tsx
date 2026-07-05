interface FlagChipProps {
  code: string
  flag: string
  size?: "sm" | "md" | "lg"
  onClick?: () => void
}

export function FlagChip({ code, flag, size = "md", onClick }: FlagChipProps) {
  const sizes = {
    sm: "w-10 h-10 text-[9px]",
    md: "w-14 h-14 text-[11px]",
    lg: "w-20 h-20 text-sm",
  }

  return (
    <button
      onClick={onClick}
      className="group/chip relative flex cursor-pointer select-none items-center justify-center rounded-full transition-all duration-300 hover:scale-110"
    >
      <span
        className={`${sizes[size]} pointer-events-none absolute inset-0 flex items-center justify-center rounded-full text-2xl`}
      >
        {flag}
      </span>
      <span
        className={`${sizes[size]} absolute inset-0 rounded-full bg-black/45 backdrop-blur-[1px] transition-opacity duration-300 group-hover/chip:opacity-60`}
      />
      <span
        className={`${sizes[size]} absolute inset-0 rounded-full`}
        style={{
          background:
            "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.18), transparent 55%)",
        }}
      />
      <span
        className={`${sizes[size]} pointer-events-none absolute inset-0 rounded-full border border-white/20 transition-colors duration-300 group-hover/chip:border-white/40`}
      />
      <span
        className={`relative z-10 font-mono font-bold tracking-[0.14em] text-white ${size === "lg" ? "text-sm" : "text-[11px]"}`}
        style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
      >
        {code}
      </span>
    </button>
  )
}
