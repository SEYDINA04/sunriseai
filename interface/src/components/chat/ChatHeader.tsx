"use client"

import { Menu, SquarePen } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { LocaleToggle } from "./LocaleToggle"

export function ChatHeader({
  onOpenSidebar,
  onNew,
}: {
  onOpenSidebar: () => void
  onNew: () => void
}) {
  const { t } = useTranslation()
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-3 sm:px-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSidebar}
          aria-label={t("openMenu")}
          className="grid h-10 w-10 place-items-center rounded-full text-text-muted transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onNew}
          aria-label={t("newChat")}
          className="grid h-10 w-10 place-items-center rounded-full text-text-muted transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
        >
          <SquarePen className="h-5 w-5" />
        </button>
        <LocaleToggle />
      </div>
    </header>
  )
}
