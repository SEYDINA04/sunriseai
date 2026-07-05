"use client"

import { useState, useRef } from "react"
import { Mic, Square, Upload } from "lucide-react"
import { Button } from "@/components/shared/Button"

interface AudioRecorderProps {
  onAudioReady: (blob: Blob) => void
}

export function AudioRecorder({ onAudioReady }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder.current = new MediaRecorder(stream)
      chunks.current = []

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        onAudioReady(blob)
        stream.getTracks().forEach((t) => t.stop())
      }

      mediaRecorder.current.start()
      setRecording(true)
    } catch {
      console.error("Microphone access denied")
    }
  }

  const stopRecording = () => {
    mediaRecorder.current?.stop()
    setRecording(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setAudioUrl(url)
    onAudioReady(file)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <Button
          onClick={recording ? stopRecording : startRecording}
          variant={recording ? "primary" : "outline"}
        >
          {recording ? (
            <>
              <Square className="h-4 w-4" />
              Arrêter
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              Enregistrer
            </>
          )}
        </Button>

        <span className="text-xs text-text-muted">ou</span>

        <Button
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Upload audio
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {recording && (
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-ping rounded-full bg-red-500" />
          <span className="text-xs text-red-400">Enregistrement...</span>
        </div>
      )}

      {audioUrl && !recording && (
        <audio controls src={audioUrl} className="h-10 w-full max-w-md rounded-lg" />
      )}
    </div>
  )
}
