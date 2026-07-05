"use client"

import { useCallback, useRef, useState } from "react"
import { useTranslation } from "@/lib/i18n"

export interface UseAudioRecorder {
  recording: boolean
  /** Object URL for the most recent recording/upload, for inline preview. */
  previewUrl: string | null
  start: () => Promise<void>
  stop: () => void
  reset: () => void
  error: string | null
}

/**
 * Encapsulates MediaRecorder logic so the composer can record inline.
 * Emits the final Blob via `onReady` once recording stops.
 */
export function useAudioRecorder(onReady: (blob: Blob) => void): UseAudioRecorder {
  const { t } = useTranslation()
  const [recording, setRecording] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorder.current = recorder
      chunks.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" })
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
        onReady(blob)
        stream.getTracks().forEach((t) => t.stop())
      }

      recorder.start()
      setRecording(true)
    } catch {
      setError(t("error.microphone"))
    }
  }, [onReady, t])

  const stop = useCallback(() => {
    mediaRecorder.current?.stop()
    setRecording(false)
  }, [])

  const reset = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    chunks.current = []
  }, [])

  return { recording, previewUrl, start, stop, reset, error }
}
