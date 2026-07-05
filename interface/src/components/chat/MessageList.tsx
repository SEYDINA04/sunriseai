"use client"

import { useEffect, useRef } from "react"
import type { Message } from "@/lib/types"
import { MessageBubble } from "./MessageBubble"

export function MessageList({ messages }: { messages: Message[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Track the last message's text length so streaming keeps the view pinned.
  const last = messages[messages.length - 1]
  const signature = `${messages.length}:${last?.text?.length ?? 0}:${last?.audioUrl ? 1 : 0}`

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [signature])

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-7 px-4 py-8 sm:px-6">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} className="h-px" />
      </div>
    </div>
  )
}
