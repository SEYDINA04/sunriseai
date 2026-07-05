import Image from "next/image"

/**
 * The official Bambi logo mark, served from public/bambi.svg (single source
 * of truth update that file to change the logo everywhere).
 */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <Image
      src="/bambi.svg"
      alt="Bambi"
      width={1020}
      height={1020}
      priority
      unoptimized
      className={className}
    />
  )
}

/** Alias of the logo mark, for call sites that want a standalone app icon. */
export function LogoIcon({ className = "h-8 w-8" }: { className?: string }) {
  return <LogoMark className={className} />
}

/** The full Bambi lockup: logo mark + wordmark. */
export function LogoLockup({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-7 w-7 shrink-0" />
      <span className="font-display text-[18px] font-semibold tracking-tight text-white">
        Bambi
      </span>
    </span>
  )
}
