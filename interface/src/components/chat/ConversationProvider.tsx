"use client"

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useCallback,
  type ReactNode,
} from "react"
import type { Conversation, Message } from "@/lib/types"
import {
  loadConversations,
  saveConversations,
  loadActiveId,
  saveActiveId,
  uid,
} from "@/lib/storage"

interface State {
  conversations: Conversation[]
  activeId: string | null
  hydrated: boolean
}

type Action =
  | { type: "HYDRATE"; conversations: Conversation[]; activeId: string | null }
  | { type: "NEW" }
  | { type: "SELECT"; id: string }
  | { type: "DELETE"; id: string }
  | { type: "RENAME"; id: string; title: string }
  | { type: "CREATE"; conversation: Conversation }
  | { type: "ADD_MESSAGE"; id: string; message: Message }
  | { type: "UPDATE_MESSAGE"; id: string; messageId: string; patch: Partial<Message> }

function touch(conv: Conversation): Conversation {
  return { ...conv, updatedAt: Date.now() }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return {
        conversations: action.conversations,
        activeId: action.activeId,
        hydrated: true,
      }
    case "NEW":
      return { ...state, activeId: null }
    case "SELECT":
      return { ...state, activeId: action.id }
    case "DELETE": {
      const conversations = state.conversations.filter((c) => c.id !== action.id)
      const activeId = state.activeId === action.id ? null : state.activeId
      return { ...state, conversations, activeId }
    }
    case "RENAME":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.id ? touch({ ...c, title: action.title }) : c,
        ),
      }
    case "CREATE":
      return {
        ...state,
        conversations: [action.conversation, ...state.conversations],
        activeId: action.conversation.id,
      }
    case "ADD_MESSAGE":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.id ? touch({ ...c, messages: [...c.messages, action.message] }) : c,
        ),
      }
    case "UPDATE_MESSAGE":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.id
            ? touch({
                ...c,
                messages: c.messages.map((m) =>
                  m.id === action.messageId ? { ...m, ...action.patch } : m,
                ),
              })
            : c,
        ),
      }
    default:
      return state
  }
}

interface ConversationContextValue {
  conversations: Conversation[]
  activeId: string | null
  activeConversation: Conversation | undefined
  hydrated: boolean
  newConversation: () => void
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => void
  renameConversation: (id: string, title: string) => void
  /** Creates a conversation (if none active) and returns the id to operate on. */
  ensureConversation: (title: string) => string
  addMessage: (conversationId: string, message: Message) => void
  updateMessage: (conversationId: string, messageId: string, patch: Partial<Message>) => void
}

const ConversationContext = createContext<ConversationContextValue | null>(null)

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    conversations: [],
    activeId: null,
    hydrated: false,
  })

  // Hydrate from localStorage after mount to avoid SSR mismatch.
  useEffect(() => {
    dispatch({
      type: "HYDRATE",
      conversations: loadConversations(),
      activeId: loadActiveId(),
    })
  }, [])

  // Persist whenever state changes (after hydration only).
  useEffect(() => {
    if (!state.hydrated) return
    saveConversations(state.conversations)
  }, [state.conversations, state.hydrated])

  useEffect(() => {
    if (!state.hydrated) return
    saveActiveId(state.activeId)
  }, [state.activeId, state.hydrated])

  // Keep a ref so ensureConversation can read the latest activeId synchronously
  // from event handlers (which run after commit, so the effect has synced it).
  const activeIdRef = useRef(state.activeId)
  useEffect(() => {
    activeIdRef.current = state.activeId
  }, [state.activeId])

  const newConversation = useCallback(() => dispatch({ type: "NEW" }), [])
  const selectConversation = useCallback((id: string) => dispatch({ type: "SELECT", id }), [])
  const deleteConversation = useCallback((id: string) => dispatch({ type: "DELETE", id }), [])
  const renameConversation = useCallback(
    (id: string, title: string) => dispatch({ type: "RENAME", id, title }),
    [],
  )

  const ensureConversation = useCallback((title: string): string => {
    const existing = activeIdRef.current
    if (existing) return existing
    const id = uid()
    const now = Date.now()
    const conversation: Conversation = {
      id,
      title: title.slice(0, 60),
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
    activeIdRef.current = id
    dispatch({ type: "CREATE", conversation })
    return id
  }, [])

  const addMessage = useCallback(
    (conversationId: string, message: Message) =>
      dispatch({ type: "ADD_MESSAGE", id: conversationId, message }),
    [],
  )
  const updateMessage = useCallback(
    (conversationId: string, messageId: string, patch: Partial<Message>) =>
      dispatch({ type: "UPDATE_MESSAGE", id: conversationId, messageId, patch }),
    [],
  )

  const activeConversation = state.conversations.find((c) => c.id === state.activeId)

  const value: ConversationContextValue = {
    conversations: state.conversations,
    activeId: state.activeId,
    activeConversation,
    hydrated: state.hydrated,
    newConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    ensureConversation,
    addMessage,
    updateMessage,
  }

  return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>
}

export function useConversations(): ConversationContextValue {
  const ctx = useContext(ConversationContext)
  if (!ctx) {
    throw new Error("useConversations must be used within a ConversationProvider")
  }
  return ctx
}
