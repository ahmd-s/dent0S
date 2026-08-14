import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  detectRecordingSupport,
  filenameForAudioMime,
  groqMimeForAudio,
  isAllowedVoiceAudioType,
  mapGetUserMediaError,
  mapVoiceProviderError,
  mapVoiceUploadHttpError,
  normalizeAudioMime,
  pickRecorderMimeType,
  fallbackAudioMime,
} from '../voice-audio.js'

describe('voice audio mime handling', () => {
  it('strips codec suffixes used by Safari and Chrome', () => {
    assert.equal(normalizeAudioMime('audio/mp4;codecs=mp4a.40.2'), 'audio/mp4')
    assert.equal(normalizeAudioMime('audio/webm;codecs=opus'), 'audio/webm')
    assert.equal(isAllowedVoiceAudioType('audio/mp4;codecs=mp4a.40.2'), true)
  })

  it('sends Safari mp4 recordings to Groq as m4a, not webm', () => {
    assert.equal(groqMimeForAudio('audio/mp4'), 'audio/mp4')
    assert.equal(filenameForAudioMime('audio/mp4'), 'recording.m4a')
    assert.notEqual(filenameForAudioMime('audio/mp4'), 'audio.webm')
    assert.equal(groqMimeForAudio('audio/webm;codecs=opus'), 'audio/webm')
    assert.equal(filenameForAudioMime('audio/webm'), 'recording.webm')
  })

  it('prefers mp4 on Safari-like browsers that do not support webm', () => {
    const safari = (type) => type.startsWith('audio/mp4') || type === 'audio/aac'
    assert.equal(pickRecorderMimeType(safari), 'audio/mp4')
    assert.equal(fallbackAudioMime(safari), 'audio/mp4')
  })
})

describe('voice recording error mapping', () => {
  it('maps microphone permission, missing device, and unsupported browser', () => {
    assert.match(mapGetUserMediaError({ name: 'NotAllowedError' }), /permission denied/i)
    assert.match(mapGetUserMediaError({ name: 'NotFoundError' }), /No microphone/i)
    assert.match(detectRecordingSupport({ isSecureContext: false, hasMediaDevices: true, hasGetUserMedia: true, hasMediaRecorder: true }).error, /HTTPS/)
    assert.match(detectRecordingSupport({ isSecureContext: true, hasMediaDevices: false, hasGetUserMedia: false, hasMediaRecorder: false }).error, /cannot access the microphone/)
    assert.match(detectRecordingSupport({ isSecureContext: true, hasMediaDevices: true, hasGetUserMedia: true, hasMediaRecorder: false }).error, /not supported/)
  })

  it('maps transcription config, network, and HTTP failures without claiming success', () => {
    assert.match(mapVoiceProviderError('GROQ_API_KEY not configured', { hasGroqKey: false }), /GROQ_API_KEY/)
    assert.match(mapVoiceProviderError({ code: 'ENOTFOUND' }), /internet connection/)
    assert.match(mapVoiceProviderError({ code: 'ECONNABORTED' }), /timed out/)
    assert.match(mapVoiceUploadHttpError(401), /not signed in/i)
    assert.match(mapVoiceUploadHttpError(502, 'Voice transcription is not configured. Ask an administrator to set GROQ_API_KEY on the server.'), /GROQ_API_KEY/)
  })
})
