"use client"

import { useCallback, useRef, useState } from "react"

export type WsStatus = "idle" | "connecting" | "recording" | "done" | "error"

export interface WebSocketASR {
  status: WsStatus
  transcript: string
  start: (lang: string) => Promise<void>
  stop: () => void
}

/** Language code → path slug used by the backend WebSocket endpoint. */
const LANG_SLUG: Record<string, string> = {
  WO: "wo",
  TW: "twi",
}

export function useWebSocketASR(onComplete?: (text: string) => void): WebSocketASR {
  const [status, setStatus] = useState<WsStatus>("idle")
  const [transcript, setTranscript] = useState("")
  const wsRef = useRef<WebSocket | null>(null)
  const mrRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // Ref so the onclose handler always sees the latest transcript
  const transcriptRef = useRef("")

  const cleanup = useCallback(() => {
    mrRef.current?.stop()
    mrRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) {
      wsRef.current.close()
    }
    wsRef.current = null
  }, [])

  const stop = useCallback(() => {
    mrRef.current?.stop()
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close()
    }
  }, [])

  const start = useCallback(
    async (lang: string) => {
      const baseUrl = process.env.NEXT_PUBLIC_ASR_WS_URL
      if (!baseUrl) {
        console.error("NEXT_PUBLIC_ASR_WS_URL is not set")
        setStatus("error")
        return
      }

      const slug = LANG_SLUG[lang.toUpperCase()] ?? lang.toLowerCase()
      const wsUrl = `${baseUrl}/transcribe/live/${slug}`

      setStatus("connecting")
      setTranscript("")
      transcriptRef.current = ""

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onmessage = (e) => {
        const raw = typeof e.data === "string" ? e.data : ""
        let text = raw
        try {
          const parsed = JSON.parse(raw) as { text?: string; partial?: string }
          text = parsed.text ?? parsed.partial ?? raw
        } catch {
          // raw string is the transcript
        }
        transcriptRef.current = text
        setTranscript(text)
      }

      ws.onerror = () => {
        setStatus("error")
        cleanup()
      }

      ws.onclose = () => {
        setStatus("done")
        onComplete?.(transcriptRef.current)
        cleanup()
      }

      ws.onopen = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          streamRef.current = stream

          const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : ""
          const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
          mrRef.current = mr

          mr.ondataavailable = (e) => {
            if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
              ws.send(e.data)
            }
          }

          mr.onstop = () => {
            stream.getTracks().forEach((t) => t.stop())
            if (ws.readyState === WebSocket.OPEN) ws.close()
          }

          mr.start(250)
          setStatus("recording")
        } catch {
          ws.close()
          setStatus("error")
        }
      }
    },
    [cleanup, onComplete],
  )

  return { status, transcript, start, stop }
}
