/** Audio capture + transcription helpers for visit voice notes. */

export const VOICE_AUDIO_TYPES = [
  'audio/webm',
  'audio/wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/ogg',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/mp4a-latm',
  'video/webm',
  'video/mp4',
]

const MIME_ALIASES = {
  'audio/mp3': 'audio/mpeg',
  'audio/m4a': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
  'audio/aac': 'audio/mp4',
  'audio/mp4a-latm': 'audio/mp4',
}

const RECORDER_MIME_CANDIDATES = [
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/aac',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'video/mp4',
]

export function normalizeAudioMime(mimeType, filename = '') {
  const raw = String(mimeType || '').split(';')[0].trim().toLowerCase()
  if (raw && raw !== 'application/octet-stream') {
    return MIME_ALIASES[raw] || raw
  }
  const name = String(filename || '').toLowerCase()
  if (name.endsWith('.mp4') || name.endsWith('.m4a') || name.endsWith('.aac')) return 'audio/mp4'
  if (name.endsWith('.webm')) return 'audio/webm'
  if (name.endsWith('.ogg') || name.endsWith('.oga')) return 'audio/ogg'
  if (name.endsWith('.wav')) return 'audio/wav'
  if (name.endsWith('.mp3') || name.endsWith('.mpeg')) return 'audio/mpeg'
  return ''
}

export function isAllowedVoiceAudioType(mimeType, filename) {
  const normalized = normalizeAudioMime(mimeType, filename)
  return Boolean(normalized && VOICE_AUDIO_TYPES.includes(normalized))
}

export function filenameForAudioMime(mimeType, filename = '') {
  const normalized = normalizeAudioMime(mimeType, filename)
  if (normalized === 'audio/mp4' || normalized === 'video/mp4') return 'recording.m4a'
  if (normalized === 'audio/ogg') return 'recording.ogg'
  if (normalized === 'audio/wav') return 'recording.wav'
  if (normalized === 'audio/mpeg') return 'recording.mp3'
  if (normalized === 'video/webm' || normalized === 'audio/webm') return 'recording.webm'
  return 'recording.m4a'
}

export function groqMimeForAudio(mimeType, filename = '') {
  const normalized = normalizeAudioMime(mimeType, filename)
  if (normalized === 'video/mp4') return 'audio/mp4'
  if (normalized === 'video/webm') return 'audio/webm'
  return normalized || 'audio/mp4'
}

export function fallbackAudioMime(isTypeSupported) {
  const check = typeof isTypeSupported === 'function'
    ? isTypeSupported
    : (t) => {
        try {
          return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)
        } catch {
          return false
        }
      }
  try {
    if (check('audio/webm') || check('audio/webm;codecs=opus')) return 'audio/webm'
  } catch {
    /* ignore */
  }
  return 'audio/mp4'
}

export function pickRecorderMimeType(isTypeSupported) {
  const check = typeof isTypeSupported === 'function'
    ? isTypeSupported
    : (t) => {
        try {
          return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)
        } catch {
          return false
        }
      }
  for (const candidate of RECORDER_MIME_CANDIDATES) {
    try {
      if (check(candidate)) return candidate
    } catch {
      /* ignore unsupported probe */
    }
  }
  return ''
}

export function detectRecordingSupport({
  isSecureContext,
  hasMediaDevices,
  hasGetUserMedia,
  hasMediaRecorder,
} = {}) {
  if (isSecureContext === false) {
    return {
      ok: false,
      error: 'Microphone requires a secure connection (HTTPS). Open this page over HTTPS and try again.',
    }
  }
  if (!hasMediaDevices || !hasGetUserMedia) {
    return {
      ok: false,
      error: 'This browser cannot access the microphone. Use Safari 14.3+ on iPhone/iPad, or Chrome on desktop.',
    }
  }
  if (!hasMediaRecorder) {
    return {
      ok: false,
      error: 'Recording is not supported in this browser. Use Safari 14.3+ on iPhone/iPad, or Chrome on desktop.',
    }
  }
  return { ok: true, error: null }
}

export function mapGetUserMediaError(error) {
  const name = error?.name || ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Microphone permission denied. Allow access in browser settings, then tap Start Recording again.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No microphone found on this device. Connect a mic and try again.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The microphone is in use by another app. Close it and try again.'
  }
  if (name === 'OverconstrainedError') {
    return 'This microphone cannot be used for recording. Try another device or browser.'
  }
  if (name === 'SecurityError') {
    return 'Microphone access was blocked by the browser. Use HTTPS and allow microphone access.'
  }
  if (name === 'AbortError') {
    return 'Microphone request was cancelled. Tap Start Recording to try again.'
  }
  return 'Could not start recording. Check microphone access and try again.'
}

function providerErrorText(error) {
  if (typeof error === 'string') return error
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    ''
  )
}

function looksLikeRawProviderError(message) {
  return /GROQ_API_KEY not configured|ECONN|ETIMEDOUT|ENOTFOUND|status code|Request failed|decommissioned|model_not_found|AxiosError|timeout of \d+ms|Groq transcription failed/i.test(message || '')
}

export function mapVoiceProviderError(error, { hasGroqKey } = {}) {
  if (hasGroqKey === false) {
    return 'Voice transcription is not configured. Ask an administrator to set GROQ_API_KEY on the server.'
  }
  const providerMessage = providerErrorText(error)
  if (providerMessage && /GROQ_API_KEY not configured/i.test(providerMessage)) {
    return 'Voice transcription is not configured. Ask an administrator to set GROQ_API_KEY on the server.'
  }
  if (typeof error === 'string' && error.trim() && !looksLikeRawProviderError(error)) {
    return error
  }
  const code = error?.code || ''
  const status = error?.response?.status
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timed out/i.test(providerMessage)) {
    return 'Transcription timed out. Try a shorter recording.'
  }
  if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ENETUNREACH' || error?.message === 'Network Error') {
    return 'Could not reach the transcription service. Check the clinic internet connection and try again.'
  }
  if (/decommissioned|model_not_found|model .* not found|does not exist/i.test(providerMessage)) {
    return 'The AI model used for notes is unavailable. Try again in a minute, or type the notes manually.'
  }
  if (status === 401 || status === 403) {
    return 'Transcription service rejected the request. Check GROQ_API_KEY and try again.'
  }
  if (status === 413) {
    return 'Recording is too large to transcribe. Record a shorter clip.'
  }
  if (status === 429) {
    return 'Transcription is busy. Wait a moment and try again.'
  }
  if (status && status >= 400 && status < 500) {
    return 'Transcription failed. Try recording again in a quieter room.'
  }
  if (status && status >= 500) {
    return 'Transcription service is unavailable. Try again in a few minutes.'
  }
  return 'Could not transcribe the recording. Try again.'
}

export function mapVoiceUploadHttpError(status, serverError) {
  if (status === 401) return 'You are not signed in. Refresh and sign in, then record again.'
  if (status === 403) return 'You do not have permission to add clinical voice notes.'
  if (status === 404) return 'This visit was not found. Refresh the page and try again.'
  if (status === 413) return 'Recording is too large to upload. Record a shorter clip.'
  if (status === 429) return 'Too many recordings. Wait a moment and try again.'
  if (typeof serverError === 'string' && serverError.trim()) return serverError
  if (status >= 500) return 'Server error while transcribing. Try again in a few minutes.'
  return 'Could not process recording. Try again.'
}
