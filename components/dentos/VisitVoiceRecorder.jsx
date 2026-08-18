'use client'
/** DentOS — visit form voice dictation (MediaRecorder → POST /api/voice/transcribe). */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { toast } from 'sonner'
import {
  detectRecordingSupport,
  filenameForAudioMime,
  mapGetUserMediaError,
  mapVoiceUploadHttpError,
  pickRecorderMimeType,
  fallbackAudioMime,
} from '@/lib/voice-audio'

function formatTimer(totalSec) {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function recordingSupport() {
  return detectRecordingSupport({
    isSecureContext: typeof window === 'undefined' ? true : window.isSecureContext,
    hasMediaDevices: typeof navigator !== 'undefined' && !!navigator.mediaDevices,
    hasGetUserMedia: typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function',
    hasMediaRecorder: typeof MediaRecorder !== 'undefined',
  })
}

/**
 * Doctor-controlled voice capture → server Whisper + Claude → draft fields (parent merges into visit form).
 */
export function VisitVoiceRecorder({ visitId, onApplyExtraction, disabled }) {
  const [phase, setPhase] = useState('idle')
  const [seconds, setSeconds] = useState(0)
  const [lastTranscript, setLastTranscript] = useState('')
  const [error, setError] = useState('')
  const chunksRef = useRef([])
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const tickRef = useRef(null)
  const releaseTimerRef = useRef(null)

  const showError = useCallback((message) => {
    const text = message || 'Voice notes failed. Try again.'
    setError(text)
    toast.error(text)
  }, [])

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const stopStreamTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current)
      releaseTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearTick()
      try {
        mediaRecorderRef.current?.stop()
      } catch {
        /* ignore */
      }
      stopStreamTracks()
    }
  }, [clearTick, stopStreamTracks])

  const uploadBlob = useCallback(
    async blob => {
      if (!visitId) {
        showError('This visit is missing an id. Refresh the page and try again.')
        setPhase('idle')
        return
      }
      setPhase('processing')
      setError('')
      const mime = blob.type || 'audio/webm'
      const fd = new FormData()
      fd.append('audio', blob, filenameForAudioMime(mime))
      fd.append('visit_id', visitId)
      try {
        const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showError(mapVoiceUploadHttpError(res.status, data.error))
          if (data.transcript) setLastTranscript(data.transcript)
          setPhase('idle')
          return
        }
        setLastTranscript(data.transcript || '')
        onApplyExtraction?.({
          transcript: data.transcript || '',
          fields: data.extracted || data.visit_draft || {},
        })
        toast.success('Voice notes added to the form. Review and edit before saving.')
      } catch {
        showError('Network error while uploading audio. Check your connection and try again.')
      } finally {
        setPhase('idle')
        setSeconds(0)
      }
    },
    [visitId, onApplyExtraction, showError]
  )

  const startRecording = async () => {
    if (!visitId || disabled || phase === 'recording' || phase === 'processing') return
    setError('')
    const support = recordingSupport()
    if (!support.ok) {
      showError(support.error)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickRecorderMimeType()
      let recorder
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      } catch {
        recorder = new MediaRecorder(stream)
      }
      chunksRef.current = []
      recorder.ondataavailable = e => {
        if (e.data?.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onerror = () => {
        showError('Recording was interrupted. Tap Start Recording to try again.')
        clearTick()
        stopStreamTracks()
        mediaRecorderRef.current = null
        setPhase('idle')
        setSeconds(0)
      }
      recorder.onstop = () => {
        clearTick()
        const mime = recorder.mimeType || mimeType || fallbackAudioMime()
        const blob = new Blob(chunksRef.current, { type: mime })
        chunksRef.current = []
        stopStreamTracks()
        mediaRecorderRef.current = null
        if (!blob.size) {
          showError('No audio was captured. Check the microphone and try again.')
          setPhase('idle')
          setSeconds(0)
          return
        }
        void uploadBlob(blob)
      }
      mediaRecorderRef.current = recorder
      try {
        recorder.start(1000)
      } catch {
        recorder.start()
      }
      setPhase('recording')
      setSeconds(0)
      tickRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch (e) {
      stopStreamTracks()
      showError(mapGetUserMediaError(e))
      setPhase('idle')
    }
  }

  const stopRecording = () => {
    const mr = mediaRecorderRef.current
    clearTick()
    if (!mr || mr.state === 'inactive') {
      stopStreamTracks()
      setPhase(phase === 'processing' ? 'processing' : 'idle')
      setSeconds(0)
      return
    }
    setPhase('processing')
    try {
      if (typeof mr.requestData === 'function' && mr.state === 'recording') {
        try { mr.requestData() } catch { /* Safari may not support timeslice flush */ }
      }
      mr.stop()
    } catch {
      showError('Could not stop recording. The microphone has been released.')
      stopStreamTracks()
      mediaRecorderRef.current = null
      setPhase('idle')
      setSeconds(0)
      return
    }
    releaseTimerRef.current = setTimeout(() => stopStreamTracks(), 1500)
  }

  const recording = phase === 'recording'
  const processing = phase === 'processing'
  const busy = disabled || processing

  return (
    <Card className="p-4 bg-muted border-border rounded-lg border-dashed">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">Voice notes</div>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            Record a short dictation after the visit. Text is added as editable drafts—review before saving.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!recording && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 border-[#0D9488] text-foreground hover:bg-[#0D9488]/10"
              disabled={busy || !visitId}
              onClick={startRecording}
            >
              <span className="mr-1.5" aria-hidden>
                🎤
              </span>
              Start Recording
            </Button>
          )}
          {recording && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="relative flex h-2.5 w-2.5" aria-hidden>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
                </span>
                <span className="text-red-700 font-medium tabular-nums">{formatTimer(seconds)}</span>
                <span className="sr-only">Recording</span>
              </div>
              <Button type="button" size="sm" variant="destructive" className="h-9" onClick={stopRecording}>
                <span aria-hidden>⏹</span>
                <span className="ml-1.5">Stop Recording</span>
              </Button>
            </>
          )}
          {processing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-3.5 w-3.5 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" aria-hidden />
              <span>Sending audio and structuring notes…</span>
            </div>
          )}
        </div>
      </div>
      {error && (
        <div role="alert" className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {lastTranscript && (
        <Accordion type="single" collapsible className="w-full mt-3 border border-border rounded-md bg-card px-2">
          <AccordionItem value="transcript" className="border-0">
            <AccordionTrigger className="text-xs py-2 hover:no-underline">Raw transcript (verification)</AccordionTrigger>
            <AccordionContent>
              <pre className="text-xs whitespace-pre-wrap bg-muted/50 p-3 rounded-md max-h-48 overflow-auto text-foreground">
                {lastTranscript}
              </pre>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </Card>
  )
}
