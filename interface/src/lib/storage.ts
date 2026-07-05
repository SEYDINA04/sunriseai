import type { Conversation } from "./types"
import type { Locale } from "./i18n/dictionary"
import { LOCALES } from "./i18n/dictionary"

const CONVERSATIONS_KEY = "bambi.conversations"
const ACTIVE_KEY = "bambi.activeId"
const LOCALE_KEY = "bambi.locale"

const isBrowser = () => typeof window !== "undefined"

export function loadLocale(): Locale | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(LOCALE_KEY)
    return raw && (LOCALES as string[]).includes(raw) ? (raw as Locale) : null
  } catch {
    return null
  }
}

export function saveLocale(locale: Locale): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    // ignore
  }
}

export function loadConversations(): Conversation[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as Conversation[]
  } catch {
    return []
  }
}

export function saveConversations(conversations: Conversation[]): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations))
  } catch {
    // Quota exceeded or serialization issue fail silently, history is best-effort.
  }
}

export function loadActiveId(): string | null {
  if (!isBrowser()) return null
  try {
    return window.localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function saveActiveId(id: string | null): void {
  if (!isBrowser()) return
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id)
    else window.localStorage.removeItem(ACTIVE_KEY)
  } catch {
    // ignore
  }
}

/** Stable-ish unique id without external deps. */
export function uid(): string {
  if (isBrowser() && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
