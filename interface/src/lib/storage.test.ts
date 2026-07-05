import { describe, it, expect, beforeEach } from "vitest"
import {
  loadConversations,
  saveConversations,
  loadActiveId,
  saveActiveId,
  loadLocale,
  saveLocale,
  uid,
} from "./storage"
import type { Conversation } from "./types"

describe("storage", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("returns an empty array when no conversations are stored", () => {
    expect(loadConversations()).toEqual([])
  })

  it("round-trips conversations through localStorage", () => {
    const conversations: Conversation[] = [
      { id: "1", title: "Test", messages: [], createdAt: 1, updatedAt: 2 },
    ]
    saveConversations(conversations)
    expect(loadConversations()).toEqual(conversations)
  })

  it("returns an empty array for corrupt stored JSON", () => {
    window.localStorage.setItem("bambi.conversations", "{not json")
    expect(loadConversations()).toEqual([])
  })

  it("round-trips the active id and clears it on null", () => {
    saveActiveId("abc")
    expect(loadActiveId()).toBe("abc")
    saveActiveId(null)
    expect(loadActiveId()).toBeNull()
  })

  it("only accepts known locales", () => {
    saveLocale("fr")
    expect(loadLocale()).toBe("fr")
    window.localStorage.setItem("bambi.locale", "xx")
    expect(loadLocale()).toBeNull()
  })

  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uid()))
    expect(ids.size).toBe(1000)
  })
})
