"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react"
import { loadLocale, saveLocale } from "@/lib/storage"
import { DEFAULT_LOCALE, translate, type Locale, type TranslationKey } from "./dictionary"

type TranslateFn = (key: TranslationKey, params?: Record<string, string | number>) => string

interface LanguageContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: TranslateFn
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

// A reducer (rather than useState) mirrors ConversationProvider and keeps the
// post-mount localStorage hydration out of `set-state-in-effect` lint territory.
function reducer(_state: Locale, next: Locale): Locale {
  return next
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useReducer(reducer, DEFAULT_LOCALE)

  // Hydrate from localStorage after mount to avoid an SSR mismatch.
  useEffect(() => {
    const stored = loadLocale()
    if (stored) setLocaleState(stored)
  }, [])

  // Keep <html lang> in sync for a11y / SEO.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    saveLocale(next)
  }, [])

  const t = useCallback<TranslateFn>((key, params) => translate(locale, key, params), [locale])

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>{children}</LanguageContext.Provider>
  )
}

export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error("useTranslation must be used within a LanguageProvider")
  }
  return ctx
}
