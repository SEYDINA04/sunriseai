"use client"

import { useState } from "react"
import Link from "next/link"
import { Mic, Volume2, Languages, Menu, X } from "lucide-react"

const navLinks = [
  { href: "/", label: "Accueil" },
  { href: "/demo/asr", label: "ASR", icon: Mic },
  { href: "/demo/tts", label: "TTS", icon: Volume2 },
  { href: "/demo/translate", label: "Traduction", icon: Languages },
  { href: "/models", label: "Modèles" },
]

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 transition-all duration-300 bg-transparent py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-white"
        >
          <span className="text-blue-bright">Afriklang</span> Models
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1.5 backdrop-blur-xl md:flex">
          {navLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-4 py-2 text-sm text-text-muted transition-colors hover:text-white"
              >
                {Icon && <Icon className="mr-1.5 inline-block h-4 w-4" />}
                {link.label}
              </Link>
            )
          })}
        </nav>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] p-2 text-text-muted backdrop-blur-xl md:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="mx-6 mt-3 rounded-2xl border border-white/10 bg-obsidian-950/95 p-3 backdrop-blur-xl md:hidden">
          {navLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-text-muted transition-colors hover:text-white"
              >
                {Icon && <Icon className="h-4 w-4 text-blue-bright" />}
                {link.label}
              </Link>
            )
          })}
        </div>
      )}
    </header>
  )
}
