"use client"

import { useState } from "react"
import { PanelLeft, SquarePen, Trash2, Pencil, Check, X } from "lucide-react"
import type { Conversation } from "@/lib/types"
import { useTranslation } from "@/lib/i18n"
import { LogoIcon, LogoLockup } from "./Logo"

export function Sidebar({
  conversations,
  activeId,
  collapsed,
  mobile = false,
  onToggle,
  onNew,
  onSelect,
  onDelete,
  onRename,
}: {
  conversations: Conversation[]
  activeId: string | null
  collapsed: boolean
  mobile?: boolean
  onToggle: () => void
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const { t } = useTranslation()

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)
  const railOnly = collapsed && !mobile

  const startEdit = (c: Conversation) => {
    setEditingId(c.id)
    setEditText(c.title)
  }
  const commitEdit = () => {
    if (editingId) onRename(editingId, editText.trim() || t("untitled"))
    setEditingId(null)
  }

  return (
    <div className="relative h-full overflow-hidden bg-surface-sidebar text-white">
      {/* ── Full layer ──────────────────────────────────────────────
          Fixed at 280px so it never squishes; the parent clips it and
          we crossfade it out as the rail fades in. */}
      <div
        className={`absolute left-0 top-0 flex h-full w-[280px] flex-col transition-opacity duration-200 ${
          railOnly ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        {/* Top: brand + toggle + new chat */}
        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-center justify-between gap-2 pl-2 pr-1">
            <LogoLockup />
            <button
              onClick={onToggle}
              aria-label={mobile ? t("closeMenu") : t("collapseMenu")}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
          </div>
          <button
            onClick={onNew}
            className="mt-1 flex items-center gap-2.5 rounded-full bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.1]"
          >
            <SquarePen className="h-4 w-4" />
            {t("newChat")}
          </button>
        </div>

        {/* History */}
        <div className="scroll-thin flex-1 overflow-y-auto px-3 pb-3">
          <p className="px-3 pb-2 pt-2 text-xs font-medium text-text-muted">{t("recent")}</p>
          {sorted.length === 0 ? (
            <p className="px-3 py-2 text-xs text-text-muted/70">{t("noConversations")}</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {sorted.map((c) => {
                const active = c.id === activeId
                if (editingId === c.id) {
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1"
                    >
                      <input
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit()
                          if (e.key === "Escape") setEditingId(null)
                        }}
                        className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm text-white focus:outline-none"
                      />
                      <button
                        onClick={commitEdit}
                        aria-label={t("confirm")}
                        className="rounded-full p-1 text-text-muted hover:text-white"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        aria-label={t("cancel")}
                        className="rounded-full p-1 text-text-muted hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  )
                }
                return (
                  <li key={c.id} className="group relative">
                    <button
                      onClick={() => onSelect(c.id)}
                      className={`flex w-full items-center rounded-full px-3 py-2 pr-16 text-left text-sm transition-colors ${
                        active
                          ? "bg-blue-bright/15 text-white"
                          : "text-white/80 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="truncate">{c.title || t("newChat")}</span>
                    </button>
                    <div
                      className={`absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 ${
                        active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <button
                        onClick={() => startEdit(c)}
                        aria-label={t("rename")}
                        className="rounded-full p-1.5 text-text-muted hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(c.id)}
                        aria-label={t("delete")}
                        className="rounded-full p-1.5 text-text-muted hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer caption */}
        <div className="border-t border-white/5 px-4 py-3">
          <p className="text-[11px] text-text-muted">Wolof · Twi · Fon</p>
        </div>
      </div>

      {/* ── Rail layer (desktop, collapsed) ─────────────────────────
          Crossfades in over the full layer when the sidebar collapses. */}
      {!mobile && (
        <div
          className={`absolute inset-0 flex flex-col items-center gap-2 p-3 transition-opacity duration-200 ${
            railOnly ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="grid h-10 w-10 place-items-center">
            <LogoIcon className="h-8 w-8" />
          </div>
          <button
            onClick={onToggle}
            aria-label={t("expandMenu")}
            className="grid h-10 w-10 place-items-center rounded-full text-text-muted transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
          <button
            onClick={onNew}
            aria-label={t("newChat")}
            title={t("newChat")}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-white transition-colors hover:bg-white/[0.1]"
          >
            <SquarePen className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  )
}
