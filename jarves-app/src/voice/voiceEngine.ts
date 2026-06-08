const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
const synth = window.speechSynthesis

function stripMarkdown(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\*\*|__|\*|_|~~|#{1,6}|>|-\s|\[|\]|\(|\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type VoiceResultCallback = (transcript: string, interim: boolean) => void
export type VoiceErrorCallback = (message: string) => void
export type VoiceStateCallback = (speaking: boolean) => void

export class VoiceEngine {
  recognition: any | null = null
  resultCallbacks: VoiceResultCallback[] = []
  errorCallbacks: VoiceErrorCallback[] = []
  stateCallbacks: VoiceStateCallback[] = []
  utterance: SpeechSynthesisUtterance | null = null

  constructor() {
    if (SpeechRecognition) {
      this.initRecognition()
    }
    if (synth) {
      synth.onvoiceschanged = () => {
        this.stateCallbacks.forEach(cb => cb(this.isSpeaking()))
      }
    }
  }

  private initRecognition() {
    if (!SpeechRecognition) return
    this.recognition = new SpeechRecognition()
    this.recognition.continuous = false
    this.recognition.interimResults = true
    this.recognition.lang = 'en-US'

    this.recognition.onresult = (event: any) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0]?.transcript || ''
        if (result.isFinal) {
          finalTranscript += text
        } else {
          interimTranscript += text
        }
      }

      if (finalTranscript) {
        this.resultCallbacks.forEach(cb => cb(finalTranscript.trim(), false))
      } else if (interimTranscript) {
        this.resultCallbacks.forEach(cb => cb(interimTranscript.trim(), true))
      }
    }

    this.recognition.onerror = (event: any) => {
      const message = event.error || 'Speech recognition failed'
      this.errorCallbacks.forEach(cb => cb(message))
    }

    this.recognition.onend = () => {
      this.resultCallbacks.forEach(cb => cb('', false))
    }
  }

  startListening() {
    if (!this.recognition) {
      this.initRecognition()
    }
    try {
      this.recognition?.start()
    } catch (error) {
      this.errorCallbacks.forEach(cb => cb('Unable to start microphone'))
    }
  }

  stopListening() {
    try {
      this.recognition?.stop()
    } catch {
      // ignore
    }
  }

  onResult(callback: VoiceResultCallback) {
    this.resultCallbacks.push(callback)
  }

  onError(callback: VoiceErrorCallback) {
    this.errorCallbacks.push(callback)
  }

  onSpeakingChange(callback: VoiceStateCallback) {
    this.stateCallbacks.push(callback)
  }

  speak(text: string, options: { rate?: number; pitch?: number; volume?: number; voiceName?: string } = {}) {
    if (!synth) return
    this.stopSpeaking()
    const utterance = new SpeechSynthesisUtterance(stripMarkdown(text))
    utterance.rate = options.rate ?? 1
    utterance.pitch = options.pitch ?? 1
    utterance.volume = options.volume ?? 1

    const availableVoices = this.getVoices()
    const voice = this.selectBestVoice(options.voiceName, availableVoices)
    if (voice) utterance.voice = voice

    utterance.onstart = () => {
      this.stateCallbacks.forEach(cb => cb(true))
    }

    utterance.onend = () => {
      this.stateCallbacks.forEach(cb => cb(false))
    }

    utterance.onerror = () => {
      this.stateCallbacks.forEach(cb => cb(false))
    }

    this.utterance = utterance
    synth.speak(utterance)
  }

  stopSpeaking() {
    if (!synth) return
    if (synth.speaking || synth.pending) {
      synth.cancel()
    }
  }

  isSpeaking() {
    return !!synth && synth.speaking
  }

  getVoices() {
    return synth ? synth.getVoices() : []
  }

  selectBestVoice(preferredName?: string, voices: SpeechSynthesisVoice[] = this.getVoices()) {
    if (!voices.length) return null
    if (preferredName) {
      const match = voices.find(voice => voice.name === preferredName || voice.voiceURI === preferredName)
      if (match) return match
    }

    const candidates = voices.filter(v => v.lang.startsWith('en'))
    const natural = candidates.find(v => /(Google|Microsoft|Samantha|Joanna|Alloy|Amy|Emma|Daniel)/i.test(v.name))
    return natural || candidates[0] || voices[0]
  }
}
