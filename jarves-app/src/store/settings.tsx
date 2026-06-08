/**
 * settings.tsx
 * ============
 * Zustand store for JARVES settings — API keys, voice, provider config
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'ollama'
  | 'openrouter'
  | 'custom'

interface SettingsStore {
  // Active provider
  activeProvider: ProviderType
  setActiveProvider: (value: ProviderType) => void

  // OpenAI
  openaiApiKey: string
  openaiModel: string
  setOpenaiApiKey: (value: string) => void
  setOpenaiModel: (value: string) => void

  // Anthropic
  anthropicApiKey: string
  anthropicModel: string
  setAnthropicApiKey: (value: string) => void
  setAnthropicModel: (value: string) => void

  // Gemini
  geminiApiKey: string
  geminiModel: string
  setGeminiApiKey: (value: string) => void
  setGeminiModel: (value: string) => void

  // OpenRouter
  openrouterApiKey: string
  openrouterModel: string
  setOpenrouterApiKey: (value: string) => void
  setOpenrouterModel: (value: string) => void

  // Ollama
  ollamaBaseUrl: string
  ollamaModel: string
  setOllamaBaseUrl: (value: string) => void
  setOllamaModel: (value: string) => void

  // Custom
  customApiKey: string
  customBaseUrl: string
  customModel: string
  setCustomApiKey: (value: string) => void
  setCustomBaseUrl: (value: string) => void
  setCustomModel: (value: string) => void

  // Voice settings
  voiceEnabled: boolean
  voiceLanguage: string
  voiceSpeed: number
  voicePitch: number
  voiceVoiceName: string
  autoRead: boolean
  useServerKey: boolean
  setUseServerKey: (value: boolean) => void
  setVoiceEnabled: (value: boolean) => void
  setVoiceLanguage: (value: string) => void
  setVoiceSpeed: (value: number) => void
  setVoicePitch: (value: number) => void
  setVoiceVoiceName: (value: string) => void
  setAutoRead: (value: boolean) => void
}

// ─── Local Storage Key ────────────────────────────────────────────────────────

const STORAGE_KEY = 'jarves_settings_v1'

function loadFromStorage(): Partial<SettingsStore> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveToStorage(data: Partial<SettingsStore>) {
  try {
    // Never save setter functions
    const { ...rest } = data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
  } catch {
    // ignore
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SettingsContext = createContext<SettingsStore>({} as SettingsStore)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const saved = loadFromStorage()

  // Active provider
  const [activeProvider, setActiveProviderState] = useState<ProviderType>(
    saved.activeProvider ?? 'openrouter'
  )

  // OpenAI
  const [openaiApiKey, setOpenaiApiKeyState] = useState(saved.openaiApiKey ?? '')
  const [openaiModel, setOpenaiModelState] = useState(saved.openaiModel ?? 'gpt-4o')

  // Anthropic
  const [anthropicApiKey, setAnthropicApiKeyState] = useState(saved.anthropicApiKey ?? '')
  const [anthropicModel, setAnthropicModelState] = useState(saved.anthropicModel ?? 'claude-3-5-sonnet-20241022')

  // Gemini
  const [geminiApiKey, setGeminiApiKeyState] = useState(saved.geminiApiKey ?? '')
  const [geminiModel, setGeminiModelState] = useState(saved.geminiModel ?? 'gemini-1.5-flash')

  // OpenRouter
  const [openrouterApiKey, setOpenrouterApiKeyState] = useState(saved.openrouterApiKey ?? '')
  const [openrouterModel, setOpenrouterModelState] = useState(
    saved.openrouterModel ?? 'deepseek/deepseek-r1:free'
  )

  // Ollama
  const [ollamaBaseUrl, setOllamaBaseUrlState] = useState(
    saved.ollamaBaseUrl ?? 'http://localhost:11434/api/chat'
  )
  const [ollamaModel, setOllamaModelState] = useState(saved.ollamaModel ?? 'llama3')

  // Custom
  const [customApiKey, setCustomApiKeyState] = useState(saved.customApiKey ?? '')
  const [customBaseUrl, setCustomBaseUrlState] = useState(saved.customBaseUrl ?? '')
  const [customModel, setCustomModelState] = useState(saved.customModel ?? '')

  // Voice
  const [voiceEnabled, setVoiceEnabledState] = useState(saved.voiceEnabled ?? false)
  const [voiceLanguage, setVoiceLanguageState] = useState(saved.voiceLanguage ?? 'en-US')
  const [voiceSpeed, setVoiceSpeedState] = useState(saved.voiceSpeed ?? 1)
  const [voicePitch, setVoicePitchState] = useState(saved.voicePitch ?? 1)
  const [voiceVoiceName, setVoiceVoiceNameState] = useState(saved.voiceVoiceName ?? '')
  const [autoRead, setAutoReadState] = useState(saved.autoRead ?? false)
  const [useServerKey, setUseServerKeyState] = useState(saved.useServerKey ?? true)

  // Setters with localStorage save
  const setActiveProvider = (v: ProviderType) => { setActiveProviderState(v); saveToStorage({ activeProvider: v }) }
  const setOpenaiApiKey = (v: string) => { setOpenaiApiKeyState(v); saveToStorage({ openaiApiKey: v }) }
  const setOpenaiModel = (v: string) => { setOpenaiModelState(v); saveToStorage({ openaiModel: v }) }
  const setAnthropicApiKey = (v: string) => { setAnthropicApiKeyState(v); saveToStorage({ anthropicApiKey: v }) }
  const setAnthropicModel = (v: string) => { setAnthropicModelState(v); saveToStorage({ anthropicModel: v }) }
  const setGeminiApiKey = (v: string) => { setGeminiApiKeyState(v); saveToStorage({ geminiApiKey: v }) }
  const setGeminiModel = (v: string) => { setGeminiModelState(v); saveToStorage({ geminiModel: v }) }
  const setOpenrouterApiKey = (v: string) => { setOpenrouterApiKeyState(v); saveToStorage({ openrouterApiKey: v }) }
  const setOpenrouterModel = (v: string) => { setOpenrouterModelState(v); saveToStorage({ openrouterModel: v }) }
  const setOllamaBaseUrl = (v: string) => { setOllamaBaseUrlState(v); saveToStorage({ ollamaBaseUrl: v }) }
  const setOllamaModel = (v: string) => { setOllamaModelState(v); saveToStorage({ ollamaModel: v }) }
  const setCustomApiKey = (v: string) => { setCustomApiKeyState(v); saveToStorage({ customApiKey: v }) }
  const setCustomBaseUrl = (v: string) => { setCustomBaseUrlState(v); saveToStorage({ customBaseUrl: v }) }
  const setCustomModel = (v: string) => { setCustomModelState(v); saveToStorage({ customModel: v }) }
  const setVoiceEnabled = (v: boolean) => { setVoiceEnabledState(v); saveToStorage({ voiceEnabled: v }) }
  const setVoiceLanguage = (v: string) => { setVoiceLanguageState(v); saveToStorage({ voiceLanguage: v }) }
  const setVoiceSpeed = (v: number) => { setVoiceSpeedState(v); saveToStorage({ voiceSpeed: v }) }
  const setVoicePitch = (v: number) => { setVoicePitchState(v); saveToStorage({ voicePitch: v }) }
  const setVoiceVoiceName = (v: string) => { setVoiceVoiceNameState(v); saveToStorage({ voiceVoiceName: v }) }
  const setAutoRead = (v: boolean) => { setAutoReadState(v); saveToStorage({ autoRead: v }) }
  const setUseServerKey = (v: boolean) => { setUseServerKeyState(v); saveToStorage({ useServerKey: v }) }

  const value = useMemo(() => ({
    activeProvider, setActiveProvider,
    openaiApiKey, openaiModel, setOpenaiApiKey, setOpenaiModel,
    anthropicApiKey, anthropicModel, setAnthropicApiKey, setAnthropicModel,
    geminiApiKey, geminiModel, setGeminiApiKey, setGeminiModel,
    openrouterApiKey, openrouterModel, setOpenrouterApiKey, setOpenrouterModel,
    ollamaBaseUrl, ollamaModel, setOllamaBaseUrl, setOllamaModel,
    customApiKey, customBaseUrl, customModel, setCustomApiKey, setCustomBaseUrl, setCustomModel,
    voiceEnabled, voiceLanguage, voiceSpeed, voicePitch, voiceVoiceName, autoRead,
    useServerKey, setUseServerKey,
    setVoiceEnabled, setVoiceLanguage, setVoiceSpeed, setVoicePitch, setVoiceVoiceName, setAutoRead,
  }), [
    activeProvider, openaiApiKey, openaiModel,
    anthropicApiKey, anthropicModel,
    geminiApiKey, geminiModel,
    openrouterApiKey, openrouterModel,
    ollamaBaseUrl, ollamaModel,
    customApiKey, customBaseUrl, customModel,
    voiceEnabled, voiceLanguage, voiceSpeed, voicePitch, voiceVoiceName, autoRead,
    useServerKey,
  ])

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettingsStore() {
  return useContext(SettingsContext)
}