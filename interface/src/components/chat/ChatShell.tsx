"use client"

import { useState } from "react"
import { useConversations } from "./ConversationProvider"
import { useChatController } from "@/hooks/useChatController"
import { Sidebar } from "./Sidebar"
import { ChatHeader } from "./ChatHeader"
import { EmptyState } from "./EmptyState"
import { MessageList } from "./MessageList"
import { Composer } from "./Composer"

export function ChatShell() {
  const {
    conversations,
    activeId,
    activeConversation,
    newConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
  } = useConversations()
  const controller = useChatController()

  const [draft, setDraft] = useState("")
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const messages = activeConversation?.messages ?? []
  const hasMessages = messages.length > 0

  const handleNew = () => {
    newConversation()
    setDraft("")
    setMobileOpen(false)
  }
  const handleSelect = (id: string) => {
    selectConversation(id)
    setMobileOpen(false)
  }

  const handleSuggestion = (text: string, langCode: string) => {
    setDraft(text)
    if (controller.mode === "translation") controller.setSourceLang(langCode)
    else controller.setLang(langCode)
  }

  const sidebarProps = {
    conversations,
    activeId,
    onNew: handleNew,
    onSelect: handleSelect,
    onDelete: deleteConversation,
    onRename: renameConversation,
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out md:block ${
          collapsed ? "w-[68px]" : "w-[280px]"
        }`}
      >
        <Sidebar {...sidebarProps} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-50 md:hidden ${mobileOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={`absolute left-0 top-0 h-full w-[280px] shadow-2xl transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar
            {...sidebarProps}
            collapsed={false}
            mobile
            onToggle={() => setMobileOpen(false)}
          />
        </aside>
      </div>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader onOpenSidebar={() => setMobileOpen(true)} onNew={handleNew} />
        <div className="min-h-0 flex-1 overflow-hidden">
          {hasMessages ? (
            <MessageList messages={messages} />
          ) : (
            <EmptyState
              mode={controller.mode}
              lang={controller.lang}
              sourceLang={controller.sourceLang}
              targetLang={controller.targetLang}
              onSuggestion={handleSuggestion}
            />
          )}
        </div>
        <Composer controller={controller} draft={draft} setDraft={setDraft} />
      </div>
    </div>
  )
}
