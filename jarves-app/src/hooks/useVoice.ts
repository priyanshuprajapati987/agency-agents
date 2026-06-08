import { useEffect, useMemo, useRef, useState } from 'react'
import { useSettingsStore } from '../store/settings'
import { VoiceEngine } from '../voice/voiceEngine'

export function useVoice(onTranscriptComplete?: (message: string) => void) {
  const settings = useSettingsStore()
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceName, setSelectedVoiceName] = useState(settings.voiceVoiceName || '')
  const [voiceError, setVoiceError] = useState('')
  const engineRef = useRef<VoiceEngine | null>(null)
  const silenceTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const engine = new VoiceEngine()
    engineRef.current = engine

    engine.onResult((message, interim) => {
      if (!message) return
      setTranscript(message)
      if (!interim) {
        scheduleSubmit(message)
      } else {
        scheduleSubmit(message)
      }
    })

    engine.onError((error) => {
      setIsListening(false)
      setVoiceError(error)
      console.warn('Voice error:', error)
    })

    engine.onSpeakingChange((speaking) => {
      setIsSpeaking(speaking)
      if (!speaking) {
        setTimeout(() => setIsSpeaking(false), 100)
      }
    })

    const loadVoices = () => {
      const available = engine.getVoices()
      setVoices(available)
      if (!selectedVoiceName && available.length > 0) {
        const defaultVoice = engine.selectBestVoice('', available)
        if (defaultVoice) {
          setSelectedVoiceName(defaultVoice.name)
        }
      }
    }

    loadVoices()
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices)

    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices)
      engine.stopListening()
      engine.stopSpeaking()
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (selectedVoiceName) {
      settings.setVoiceVoiceName(selectedVoiceName)
    }
  }, [selectedVoiceName])

  useEffect(() => {
    setSelectedVoiceName(settings.voiceVoiceName || '')
  }, [settings.voiceVoiceName])

  const scheduleSubmit = (message: string) => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current)
    }
    silenceTimerRef.current = window.setTimeout(() => {
      if (message.trim()) {
        onTranscriptComplete?.(message.trim())
        setTranscript('')
      }
      setIsListening(false)
      engineRef.current?.stopListening()
    }, 1500)
  }

  const startVoice = () => {
    setVoiceError('')
    if (!settings.voiceEnabled) {
      settings.setVoiceEnabled(true)
    }
    engineRef.current?.startListening()
    setIsListening(true)
  }

  const stopVoice = () => {
    engineRef.current?.stopListening()
    setIsListening(false)
  }

  const speak = (text: string, force = false) => {
    if (!force && !settings.voiceEnabled) return
    engineRef.current?.speak(text, {
      rate: settings.voiceSpeed,
      pitch: settings.voicePitch,
      voiceName: selectedVoiceName,
    })
  }

  const toggleVoice = () => {
    const next = !settings.voiceEnabled
    settings.setVoiceEnabled(next)
    if (!next) {
      stopVoice()
      engineRef.current?.stopSpeaking()
    }
    return next
  }

  const voiceEnabled = settings.voiceEnabled

  return {
    isListening,
    isSpeaking,
    transcript,
    voices,
    selectedVoiceName,
    setSelectedVoiceName,
    startVoice,
    stopVoice,
    speak,
    voiceEnabled,
    toggleVoice,
    voiceError,
  }
}
