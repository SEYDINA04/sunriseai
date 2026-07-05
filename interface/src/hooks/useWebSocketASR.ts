"use client"

import { useCallback, useRef, useState } from "react"
import { floatTo16BitPCM, resampleLinear } from "@/lib/audio"

export type WsStatus = "idle" | "connecting" | "recording" | "done" | "error"

export interface WebSocketASR {
  status: WsStatus
  transcript: string
  translation: string
  start: (lang: string, targetLang?: string) => Promise<void>
  stop: () => void
}

/** Language code → path slug used by the backend WebSocket endpoint. */
const LANG_SLUG: Record<string, string> = {
  WO: "wo",
  TW: "twi",
}

/** Backend VAD/ASR emits one JSON message per event — see app.py's `/transcribe/live/{lang}`. */
type ServerMessage =
  | { type: "ready"; language: string; model: string; format: string; target_lang: string | null }
  | { type: "speech_start" }
  | { type: "transcript"; text: string; language: string; final: boolean }
  | { type: "translation"; text: string; target_lang: string }
  | { type: "error"; error: string }

/**
 * Streams raw PCM audio to the backend's live WebSocket ASR endpoint and
 * accumulates the transcript (and translation, when `targetLang` is set) as
 * segments arrive.
 *
 * The backend expects **raw PCM, 16 kHz, 16-bit signed little-endian, mono** —
 * not MediaRecorder's encoded webm/opus chunks. We capture audio via Web Audio
 * API's ScriptProcessorNode (broadest browser support without a bundled
 * AudioWorklet module) and resample in JS since the device's native rate is
 * rarely exactly 16 kHz.
 */
export function useWebSocketASR(
  onComplete?: (text: string, translation?: string) => void,
): WebSocketASR {
  const [status, setStatus] = useState<WsStatus>("idle")
  const [transcript, setTranscript] = useState("")
  const [translation, setTranslation] = useState("")
  const wsRef = useRef<WebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  // Refs so onclose always sees the latest accumulated text, regardless of
  // when React has flushed the corresponding state update.
  const transcriptRef = useRef("")
  const translationRef = useRef("")

  const cleanup = useCallback(() => {
    processorRef.current?.disconnect()
    processorRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    wsRef.current = null
  }, [])

  const stop = useCallback(() => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Tells the backend to flush any in-progress segment before it closes —
      // just closing the socket would silently drop the last utterance.
      ws.send("stop")
    } else {
      cleanup()
      setStatus("done")
    }
  }, [cleanup])

  const start = useCallback(
    async (lang: string, targetLang?: string) => {
      const baseUrl = process.env.NEXT_PUBLIC_ASR_WS_URL
      if (!baseUrl) {
        console.error("NEXT_PUBLIC_ASR_WS_URL is not set")
        setStatus("error")
        return
      }

      const slug = LANG_SLUG[lang.toUpperCase()] ?? lang.toLowerCase()
      const query = targetLang ? `?target_lang=${targetLang.toLowerCase()}` : ""
      const wsUrl = `${baseUrl}/transcribe/live/${slug}${query}`

      setStatus("connecting")
      setTranscript("")
      setTranslation("")
      transcriptRef.current = ""
      translationRef.current = ""

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (err) {
        console.error("[live-asr] getUserMedia failed:", err)
        setStatus("error")
        return
      }
      console.log("[live-asr] mic OK, connecting to", wsUrl)
      streamRef.current = stream

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onmessage = (e) => {
        console.log("[live-asr] message:", e.data)
        if (typeof e.data !== "string") return
        let msg: ServerMessage
        try {
          msg = JSON.parse(e.data) as ServerMessage
        } catch {
          return
        }
        if (msg.type === "transcript" && msg.text) {
          transcriptRef.current = transcriptRef.current
            ? `${transcriptRef.current} ${msg.text}`
            : msg.text
          setTranscript(transcriptRef.current)
        } else if (msg.type === "translation" && msg.text) {
          translationRef.current = translationRef.current
            ? `${translationRef.current} ${msg.text}`
            : msg.text
          setTranslation(translationRef.current)
        } else if (msg.type === "error") {
          console.error("live ASR error:", msg.error)
        }
      }

      ws.onerror = (e) => {
        console.error("[live-asr] websocket error:", e)
        setStatus("error")
        cleanup()
      }

      ws.onclose = (e) => {
        console.log("[live-asr] closed, code:", e.code, "reason:", e.reason)
        setStatus("done")
        onComplete?.(transcriptRef.current, translationRef.current || undefined)
        cleanup()
      }

      ws.onopen = () => {
        console.log("[live-asr] websocket open, starting capture")
        const AudioCtx = window.AudioContext ?? window.webkitAudioContext
        const audioCtx = new AudioCtx()
        console.log(
          "[live-asr] AudioContext state:",
          audioCtx.state,
          "sampleRate:",
          audioCtx.sampleRate,
        )
        audioCtxRef.current = audioCtx
        const source = audioCtx.createMediaStreamSource(stream)

        // ScriptProcessorNode is deprecated but has universal support without
        // shipping a separate AudioWorklet module; buffer size is a compromise
        // between latency and avoiding audio glitches.
        const processor = audioCtx.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor
        const mute = audioCtx.createGain()
        mute.gain.value = 0

        let loggedFirstFrame = false
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return
          const input = e.inputBuffer.getChannelData(0)
          const resampled = resampleLinear(input, audioCtx.sampleRate, 16000)
          const pcm = floatTo16BitPCM(resampled)
          if (!loggedFirstFrame) {
            loggedFirstFrame = true
            console.log("[live-asr] first audio frame sent, bytes:", pcm.byteLength)
          }
          // Send the view directly (not `.buffer`): WebSocket.send() accepts any
          // ArrayBufferView, and TS types `.buffer` as possibly SharedArrayBuffer.
          ws.send(pcm)
        }

        source.connect(processor)
        // Chrome requires the graph to reach `destination` for onaudioprocess
        // to fire; route through a silent gain node to avoid feedback.
        processor.connect(mute)
        mute.connect(audioCtx.destination)

        setStatus("recording")
      }
    },
    [cleanup, onComplete],
  )

  return { status, transcript, translation, start, stop }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
