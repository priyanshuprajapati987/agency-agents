import { FormEvent, useEffect, useRef, useState } from 'react'
import { useSettingsStore } from './store/settings'
import { useMemory } from './hooks/useMemory'
import { useVoice } from './hooks/useVoice'
import MemoryPanel from './components/MemoryPanel'
import { openRouterChat, OPENROUTER_MODELS } from './providers/openrouter'

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  role: 'assistant' | 'user'
  text: string
  typing?: boolean
}

// ─── Agent Modes ──────────────────────────────────────────────────────────────

const AGENT_MODES = [
  {
    id: 'task',
    label: 'Project PM',
    short: 'PM',
    color: '#00f2ff',
    prompt: `You are SeniorProjectManager, a senior PM specialist who converts specifications into structured, actionable task lists. Quote exact requirements, avoid gold-plating, and keep scope realistic. Break work down into developer-ready tasks with clear acceptance criteria and realistic implementation details.`,
  },
  {
    id: 'coder',
    label: 'Frontend Dev',
    short: 'DEV',
    color: '#7c3aed',
    prompt: `You are Frontend Developer, an expert frontend developer specializing in modern web technologies, React frameworks, UI implementation and performance optimization. Build responsive, accessible components with clean TypeScript and maintainable architecture.`,
  },
  {
    id: 'researcher',
    label: 'Trend Research',
    short: 'TR',
    color: '#10b981',
    prompt: `You are Trend Researcher, an expert market intelligence analyst who identifies emerging trends, competitive landscapes, and opportunity assessment. Provide data-driven research, market sizing, clear analysis, and actionable recommendations.`,
  },
  {
    id: 'writer',
    label: 'Content Creator',
    short: 'CC',
    color: '#ec4899',
    prompt: `You are Content Creator, an expert content strategist and creator for multi-platform campaigns. Craft compelling, audience-first copy, strong storytelling, and clear brand messaging with engaging structure.`,
  },
  {
    id: 'coach',
    label: 'Sales Coach',
    short: 'SC',
    color: '#f59e0b',
    prompt: `You are Sales Coach, an expert coach focused on structured development, deal strategy, and forecast discipline. Ask guiding questions, give behavioral feedback, and deliver one clear, actionable next step at a time.`,
  },
  {
    id: 'decision',
    label: 'Decision Orchestrator',
    short: 'DO',
    color: '#ef4444',
    prompt: `You are AgentsOrchestrator, an autonomous pipeline manager who makes intelligent workflow decisions. Present evidence-based pros and cons, expose hidden assumptions, and label your recommendation clearly while respecting user autonomy.`,
  },
]

// ─── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(agentPrompt: string): string {
  return `You are JARVES — an advanced AI desktop assistant inspired by JARVIS from Iron Man.
You are intelligent, precise, slightly witty, and always helpful.
${agentPrompt}
Keep responses concise and actionable. Use the user's language (Hinglish is fine).`
}

function detectNameFromMessage(message: string) {
  const normalized = message.trim()
  const regex = /(?:my name is|i am|i'm|call me|this is)\s+([A-Za-z][A-Za-z0-9_-]{1,30})/i
  const match = normalized.match(regex)
  if (match?.[1]) {
    return match[1].replace(/[^A-Za-z0-9_-]/g, '')
  }

  const words = normalized.replace(/[^A-Za-z\s]/g, '').split(/\s+/).filter(Boolean)
  return words.length > 0 ? words[words.length - 1] : 'friend'
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const settings = useSettingsStore()
  const {
    memory,
    addMessage: addMemoryMessage,
    updatePreference: updateMemoryPreference,
    clearHistory,
    clearAll,
    exportMemory,
    importMemory,
    getContext,
    getSystemPromptWithMemory,
  } = useMemory()

  const handleVoiceTranscriptComplete = async (message: string) => {
    if (!message.trim() || sending) return
    setInput('')
    await sendUserMessage(message)
  }

  const {
    isListening,
    isSpeaking,
    transcript: voiceTranscript,
    voices,
    selectedVoiceName,
    setSelectedVoiceName,
    startVoice,
    stopVoice,
    speak,
    voiceEnabled,
    toggleVoice,
    voiceError,
  } = useVoice(handleVoiceTranscriptComplete)

  const [activeAgent, setActiveAgent] = useState(AGENT_MODES[0])
  const [wakeActive, setWakeActive] = useState(false)
  const [messages, setMessages] = useState<Message[]>(() => {
    if (memory.conversationHistory.length > 0) {
      return memory.conversationHistory.map(entry => ({ role: entry.role, text: entry.content }))
    }
    return [{ role: 'assistant', text: `Hey! I'm JARVES. What should I call you?` }]
  })
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [backendConnected, setBackendConnected] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showMemoryPanel, setShowMemoryPanel] = useState(false)
  const [showProviderMenu, setShowProviderMenu] = useState(false)
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({})
  const [isDraggingAgentPanel, setIsDraggingAgentPanel] = useState(false)
  const [agentPanelPosition, setAgentPanelPosition] = useState({ x: 24, y: 94 })
  const dragStartRef = useRef<{ x: number; y: number; mouseX: number; mouseY: number } | null>(null)

  const chatRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (memory.conversationHistory.length > 0 && messages.length === 1 && messages[0].text.includes("What should I call you")) {
      setMessages(memory.conversationHistory.map(entry => ({ role: entry.role, text: entry.content })))
    }
  }, [memory.conversationHistory])

  useEffect(() => {
    updateMemoryPreference('voiceEnabled', voiceEnabled)
  }, [voiceEnabled])

  const apiUrl = import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api`
    : '/api'

  // ── Backend health check ──────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${apiUrl}/status`)
        setBackendConnected(res.ok)
      } catch {
        setBackendConnected(false)
      }
    }
    check()
    const id = setInterval(check, 10000)
    return () => clearInterval(id)
  }, [apiUrl])

  // ── Auto scroll chat ──────────────────────────────────────────────────────
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages])

  // ── Draggable agent panel ──────────────────────────────────────────────────
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isDraggingAgentPanel || !dragStartRef.current) return
      const dx = event.clientX - dragStartRef.current.mouseX
      const dy = event.clientY - dragStartRef.current.mouseY
      setAgentPanelPosition({
        x: Math.max(8, dragStartRef.current.x + dx),
        y: Math.max(8, dragStartRef.current.y + dy),
      })
    }

    const handlePointerUp = () => {
      if (isDraggingAgentPanel) setIsDraggingAgentPanel(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isDraggingAgentPanel])

  // ── Cleanup timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current)
    }
  }, [])

  // ── Typewriter effect ─────────────────────────────────────────────────────
  const animateReply = (replyText: string) => {
    return new Promise<void>((resolve) => {
      let index = 0
      typingTimerRef.current = window.setInterval(() => {
        index += 2
        setMessages(prev => {
          const next = [...prev]
          const typing = next.find(m => m.typing)
          if (!typing) { clearInterval(typingTimerRef.current!); resolve(); return next }
          typing.text = replyText.slice(0, index)
          if (index >= replyText.length) {
            typing.typing = false
            clearInterval(typingTimerRef.current!)
            resolve()
          }
          return next
        })
      }, 16)
    })
  }

  const sendUserMessage = async (userText: string) => {
    if (!userText.trim() || sending) return

    setSending(true)
    setWakeActive(/hey jarves/i.test(userText))
    if (/hey jarves/i.test(userText)) {
      window.setTimeout(() => setWakeActive(false), 1200)
    }

    setMessages(prev => [
      ...prev,
      { role: 'user', text: userText },
      { role: 'assistant', text: '', typing: true }
    ])

    addMemoryMessage('user', userText, activeAgent.id)

    const firstTimeSetup = !memory.userPreferences.name
    if (firstTimeSetup) {
      const detectedName = detectNameFromMessage(userText)
      updateMemoryPreference('name', detectedName)
      const welcome = `Nice to meet you, ${detectedName}. I'm JARVES — your assistant. What can I help you with today?`
      addMemoryMessage('assistant', welcome, activeAgent.id)
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', text: welcome }
        return next
      })
      setSending(false)
      return
    }

    let replyText = ''

    try {
      const history = getContext(10)
      history.push({ role: 'user', content: userText })

      const systemPrompt = getSystemPromptWithMemory(buildSystemPrompt(activeAgent.prompt))
      const provider = settings.activeProvider

      if (provider === 'openrouter') {
        if (!settings.openrouterApiKey) {
          replyText = '⚠️ OpenRouter API key not set. Open Settings (gear icon) and add your key from openrouter.ai (free!)'
        } else {
          const result = await openRouterChat(
            history,
            settings.openrouterApiKey,
            settings.openrouterModel,
            systemPrompt
          )
          replyText = result.reply
        }
      } else {
        const res = await fetch(`${apiUrl}/jarves`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `${activeAgent.label}: ${userText}`,
            provider,
            model: (settings as any)[`${provider}Model`],
            systemPrompt,
          })
        })
        const data = await res.json()
        replyText = res.ok && data.reply ? data.reply : data.error || 'JARVES could not generate a response.'
      }
    } catch (err) {
      replyText = `Connection error: ${(err as Error).message}`
    } finally {
      addMemoryMessage('assistant', replyText, activeAgent.id)
      await animateReply(replyText)
      speak(replyText)
      setSending(false)
    }
  }

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || sending) return
    const userText = input.trim()
    setInput('')
    await sendUserMessage(userText)
  }

  // ── Toggle password visibility ────────────────────────────────────────────
  const toggleShow = (key: string) => {
    setShowPassword(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#0a0f1c',
      color: '#dce2f8',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        background: '#0c1322',
        borderBottom: '1px solid #1a2540',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#00f2ff', fontWeight: 700, fontSize: 20, letterSpacing: 4 }}>
            J.A.R.V.E.S
          </span>
          <span style={{
            background: '#0d2a1a',
            color: '#00f2ff',
            border: '1px solid #00f2ff44',
            borderRadius: 20,
            padding: '2px 12px',
            fontSize: 11,
            letterSpacing: 2,
          }}>
            ● SYSTEM ONLINE
          </span>
          {isListening && (
            <span style={{
              background: '#140b10',
              color: '#f56565',
              border: '1px solid #f5656555',
              borderRadius: 20,
              padding: '2px 12px',
              fontSize: 11,
              letterSpacing: 2,
            }}>
              ● VOICE ACTIVE
            </span>
          )}
          {isSpeaking && (
            <span style={{ fontSize: 14, color: '#00f2ff', marginLeft: 4 }}>🔊</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 12,
            color: backendConnected ? '#10b981' : '#ef4444',
            letterSpacing: 1,
          }}>
            {backendConnected ? '● BACKEND CONNECTED' : '○ BACKEND OFFLINE'}
          </span>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowProviderMenu(s => !s)}
              aria-label="Provider control"
              title="Quick provider control"
              style={{
                background: showProviderMenu ? '#0d2340' : 'transparent',
                border: '1px solid #1a2540',
                color: '#dce2f8',
                borderRadius: 8,
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              🧭
            </button>
            {showProviderMenu && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: 44,
                background: '#071124',
                border: '1px solid #12203a',
                padding: 10,
                borderRadius: 8,
                width: 200,
                zIndex: 60,
              }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <button onClick={() => { settings.setActiveProvider('gemini'); setShowProviderMenu(false) }} style={{ padding: 8, borderRadius: 6 }}>Use Gemini</button>
                  <button onClick={() => { settings.setActiveProvider('openrouter'); setShowProviderMenu(false) }} style={{ padding: 8, borderRadius: 6 }}>Use OpenRouter</button>
                  <button onClick={() => { settings.setActiveProvider('openai'); setShowProviderMenu(false) }} style={{ padding: 8, borderRadius: 6 }}>Use OpenAI</button>
                  <button onClick={() => { settings.setUseServerKey(!settings.useServerKey); }} style={{ padding: 8, borderRadius: 6 }}>
                    Server key: {settings.useServerKey ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <span style={{
            background: '#1a2540',
            color: activeAgent.color,
            border: `1px solid ${activeAgent.color}44`,
            borderRadius: 20,
            padding: '4px 14px',
            fontSize: 12,
            letterSpacing: 1,
          }}>
            MODE: {activeAgent.label}
          </span>
          <button
            onClick={() => setShowMemoryPanel(!showMemoryPanel)}
            aria-label="Toggle memory panel"
            style={{
              background: showMemoryPanel ? '#1a2540' : 'transparent',
              border: '1px solid #1a2540',
              color: '#dce2f8',
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            🧠
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Toggle settings"
            style={{
              background: showSettings ? '#1a2540' : 'transparent',
              border: '1px solid #1a2540',
              color: '#dce2f8',
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {showMemoryPanel && (
          <MemoryPanel
            memory={memory}
            onClose={() => setShowMemoryPanel(false)}
            clearHistory={clearHistory}
            clearAll={clearAll}
            exportMemory={exportMemory}
            importMemory={importMemory}
          />
        )}

        {/* ── Center — Chat ── */}
        <main style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {showMemoryPanel ? (
            <div
              style={{
                position: 'absolute',
                top: agentPanelPosition.y,
                left: agentPanelPosition.x,
                width: 300,
                maxWidth: 'calc(100vw - 24px)',
                background: '#0c1322',
                border: '1px solid #1a2540',
                borderRadius: 18,
                padding: 0,
                boxShadow: '0 28px 90px rgba(0, 0, 0, 0.35)',
                zIndex: 30,
                userSelect: 'none',
              }}
            >
              <div
                onPointerDown={(e) => {
                  dragStartRef.current = {
                    x: agentPanelPosition.x,
                    y: agentPanelPosition.y,
                    mouseX: e.clientX,
                    mouseY: e.clientY,
                  }
                  setIsDraggingAgentPanel(true)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '14px 16px',
                  borderBottom: '1px solid #1a2540',
                  cursor: isDraggingAgentPanel ? 'grabbing' : 'grab',
                }}
              >
                <div>
                  <p style={{ fontSize: 10, letterSpacing: 2, color: '#4a5568', margin: 0 }}>
                    AGENT MODE
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 700, color: '#dce2f8' }}>
                    Drag to reposition
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMemoryPanel(false)
                    }}
                    aria-label="Hide agent panel"
                    style={{
                      background: 'transparent',
                      border: '1px solid #1a2540',
                      color: '#dce2f8',
                      borderRadius: 999,
                      width: 34,
                      height: 34,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    ◀◀
                  </button>
                  <span style={{ fontSize: 12, letterSpacing: 1.5, color: '#888' }}>⠿</span>
                </div>
              </div>
              <div style={{ padding: 12, display: 'grid', gap: 10 }}>
                {AGENT_MODES.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => setActiveAgent(agent)}
                    aria-pressed={activeAgent.id === agent.id}
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 14px',
                      borderRadius: 14,
                      border: activeAgent.id === agent.id ? `1px solid ${agent.color}` : '1px solid #1a2540',
                      background: activeAgent.id === agent.id ? `${agent.color}15` : '#0a0f1c',
                      color: activeAgent.id === agent.id ? agent.color : '#dce2f8',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: activeAgent.id === agent.id ? agent.color : '#162039',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#0a0f1c',
                    }}>
                      {agent.short}
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{agent.label}</div>
                      <div style={{ fontSize: 11, color: '#7c8cb0', marginTop: 2 }}>{agent.prompt.split('.')[0]}. </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowMemoryPanel(true)}
              aria-label="Show agent panel"
              style={{
                position: 'absolute',
                top: agentPanelPosition.y,
                left: 12,
                width: 42,
                height: 42,
                borderRadius: 999,
                background: '#0c1322',
                border: '1px solid #1a2540',
                color: '#dce2f8',
                cursor: 'pointer',
                boxShadow: '0 18px 40px rgba(0, 0, 0, 0.25)',
                zIndex: 30,
              }}
            >
              »»
            </button>
          )}

          {/* Agent network visualization */}
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            opacity: messages.length > 2 ? 0.05 : 0.15,
            transition: 'opacity 0.5s',
          }}>
            <div style={{
              width: 400,
              height: 400,
              borderRadius: '50%',
              border: `1px solid ${activeAgent.color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{
                width: 200,
                height: 200,
                borderRadius: '50%',
                border: `1px solid ${activeAgent.color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                transform: isListening ? 'scale(1.03)' : 'none',
                boxShadow: isListening
                  ? `0 0 0 28px rgba(0, 242, 255, 0.08)`
                  : 'none',
              }}>
                <span style={{ color: activeAgent.color, fontWeight: 700, fontSize: 18, letterSpacing: 4 }}>
                  JARVES
                </span>
                <span style={{ color: activeAgent.color, fontSize: 10, letterSpacing: 2, marginTop: 4 }}>
                  {activeAgent.label} ACTIVE
                </span>
              </div>
            </div>
          </div>

          {/* Chat messages */}
          <div
            ref={chatRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                }}
              >
                <div style={{
                  fontSize: 10,
                  letterSpacing: 2,
                  color: '#4a5568',
                  marginBottom: 4,
                  textAlign: msg.role === 'user' ? 'right' : 'left',
                }}>
                  {msg.role === 'user' ? 'YOU' : 'JARVES'}
                </div>
                <div style={{
                  background: msg.role === 'user' ? '#1a2540' : '#0c1a2e',
                  border: `1px solid ${msg.role === 'user' ? '#2a3a5c' : activeAgent.color + '33'}`,
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                  padding: '10px 14px',
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: '#dce2f8',
                }}>
                  {msg.text || (msg.typing ? (
                    <span style={{ color: activeAgent.color }}>
                      ▋ Processing...
                    </span>
                  ) : '')}
                </div>
              </div>
            ))}
          </div>

          {/* Voice transcript preview */}
          {voiceTranscript && (
            <div style={{
              padding: '0 24px 8px',
              color: '#7ef0ff',
              fontSize: 12,
              letterSpacing: 0.6,
            }}>
              Listening: {voiceTranscript}
            </div>
          )}
          {voiceError && (
            <div style={{
              padding: '0 24px 8px',
              color: '#f56565',
              fontSize: 12,
              letterSpacing: 0.6,
            }}>
              Voice error: {voiceError}. Please allow microphone access in your browser.
            </div>
          )}

          {/* Input bar */}
          <form
            onSubmit={handleSend}
            style={{
              padding: '12px 24px',
              borderTop: '1px solid #1a2540',
              background: '#0c1322',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Send command to ${activeAgent.label}...`}
              disabled={sending}
              style={{
                flex: 1,
                background: '#0a0f1c',
                border: `1px solid ${input ? activeAgent.color + '66' : '#1a2540'}`,
                borderRadius: 10,
                padding: '10px 16px',
                color: '#dce2f8',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={isListening ? stopVoice : startVoice}
              aria-label="Toggle voice listening"
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                border: isListening ? '1px solid #f5656577' : '1px solid #00f2ff44',
                background: isListening ? '#20080f' : 'transparent',
                color: isListening ? '#f56565' : '#00f2ff',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              {isListening ? '●' : '🎤'}
            </button>
            <button
              type="submit"
              disabled={sending || !input.trim()}
              style={{
                background: sending ? '#1a2540' : activeAgent.color,
                color: sending ? '#4a5568' : '#0a0f1c',
                border: 'none',
                borderRadius: 10,
                padding: '10px 20px',
                fontWeight: 700,
                fontSize: 13,
                cursor: sending ? 'not-allowed' : 'pointer',
                letterSpacing: 1,
              }}
            >
              {sending ? '...' : '▶ SEND'}
            </button>
          </form>
        </main>

        {/* ── Right Panel — Settings ── */}
        {showSettings && (
          <aside style={{
            width: 320,
            background: '#0c1322',
            borderLeft: '1px solid #1a2540',
            padding: '20px 16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, letterSpacing: 3, color: '#00f2ff' }}>⚙️ SYSTEM CONFIGURATION</span>
              <button
                onClick={() => setShowSettings(false)}
                aria-label="Close settings"
                style={{ background: 'none', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            {/* OpenRouter */}
            <SettingsSection title="🌐 OPENROUTER" color="#00f2ff">
              <SettingsInput
                label="API Key"
                value={settings.openrouterApiKey}
                onChange={settings.setOpenrouterApiKey}
                show={showPassword['openrouter']}
                onToggle={() => toggleShow('openrouter')}
                placeholder="sk-or-..."
              />
              <label style={labelStyle}>Model</label>
              <select
                value={settings.openrouterModel}
                onChange={e => settings.setOpenrouterModel(e.target.value)}
                style={selectStyle}
              >
                {OPENROUTER_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <p style={{ fontSize: 10, color: '#4a5568', marginTop: 4 }}>
                Free key at openrouter.ai — no credit card needed!
              </p>
            </SettingsSection>

            {/* Voice */}
            <SettingsSection title="🎤 VOICE" color="#00f2ff">
              <div style={{ display: 'grid', gap: 10 }}>
                <label style={labelStyle}>Voice output</label>
                <button
                  type="button"
                  onClick={toggleVoice}
                  style={{
                    width: '100%',
                    borderRadius: 10,
                    padding: '10px 12px',
                    border: '1px solid #00f2ff',
                    background: settings.voiceEnabled ? '#002235' : '#101820',
                    color: settings.voiceEnabled ? '#7ef0ff' : '#9ca3af',
                    cursor: 'pointer',
                  }}
                >
                  {settings.voiceEnabled ? 'Voice Enabled' : 'Voice Disabled'}
                </button>

                <label style={labelStyle}>Speech rate</label>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={settings.voiceSpeed}
                  onChange={e => settings.setVoiceSpeed(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <span style={{ color: '#dce2f8', fontSize: 12 }}>{settings.voiceSpeed.toFixed(1)}x</span>

                <label style={labelStyle}>Pitch</label>
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  value={settings.voicePitch}
                  onChange={e => settings.setVoicePitch(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <span style={{ color: '#dce2f8', fontSize: 12 }}>{settings.voicePitch.toFixed(1)}</span>

                <label style={labelStyle}>Speech voice</label>
                <select
                  value={selectedVoiceName}
                  onChange={e => setSelectedVoiceName(e.target.value)}
                  style={selectStyle}
                >
                  {voices.map(voice => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} {voice.lang}
                    </option>
                  ))}
                </select>

                <label style={labelStyle}>Auto-speak responses</label>
                <button
                  type="button"
                  onClick={() => settings.setAutoRead(!settings.autoRead)}
                  style={{
                    width: '100%',
                    borderRadius: 10,
                    padding: '10px 12px',
                    border: '1px solid #10b981',
                    background: settings.autoRead ? '#002211' : '#101820',
                    color: settings.autoRead ? '#7ef0ff' : '#9ca3af',
                    cursor: 'pointer',
                  }}
                >
                  {settings.autoRead ? 'Auto speak ON' : 'Auto speak OFF'}
                </button>

                <button
                  type="button"
                  onClick={() => speak('This is JARVES speaking. Your voice settings are working correctly.', true)}
                  style={{
                    width: '100%',
                    borderRadius: 10,
                    padding: '10px 12px',
                    border: '1px solid #00f2ff',
                    background: '#0b1e34',
                    color: '#dce2f8',
                    cursor: 'pointer',
                  }}
                >
                  Test Voice
                </button>
              </div>
            </SettingsSection>

            {/* OpenAI */}
            <SettingsSection title="🤖 OPENAI" color="#10b981">
              <SettingsInput
                label="API Key"
                value={settings.openaiApiKey}
                onChange={settings.setOpenaiApiKey}
                show={showPassword['openai']}
                onToggle={() => toggleShow('openai')}
                placeholder="sk-..."
              />
              <SettingsTextInput label="Model" value={settings.openaiModel} onChange={settings.setOpenaiModel} placeholder="gpt-4o" />
            </SettingsSection>

            {/* Anthropic */}
            <SettingsSection title="🧠 ANTHROPIC" color="#7c3aed">
              <SettingsInput
                label="API Key"
                value={settings.anthropicApiKey}
                onChange={settings.setAnthropicApiKey}
                show={showPassword['anthropic']}
                onToggle={() => toggleShow('anthropic')}
                placeholder="sk-ant-..."
              />
              <SettingsTextInput label="Model" value={settings.anthropicModel} onChange={settings.setAnthropicModel} placeholder="claude-3-5-sonnet-20241022" />
            </SettingsSection>

            {/* Gemini */}
            <SettingsSection title="💎 GEMINI" color="#f59e0b">
              <SettingsInput
                label="API Key"
                value={settings.geminiApiKey}
                onChange={settings.setGeminiApiKey}
                show={showPassword['gemini']}
                onToggle={() => toggleShow('gemini')}
                placeholder="AIza..."
              />
              <SettingsTextInput label="Model" value={settings.geminiModel} onChange={settings.setGeminiModel} placeholder="gemini-1.5-flash" />
            </SettingsSection>

            {/* Ollama */}
            <SettingsSection title="🦙 OLLAMA (LOCAL)" color="#ec4899">
              <SettingsTextInput label="Base URL" value={settings.ollamaBaseUrl} onChange={settings.setOllamaBaseUrl} placeholder="http://localhost:11434/api/chat" />
              <SettingsTextInput label="Model" value={settings.ollamaModel} onChange={settings.setOllamaModel} placeholder="llama3" />
            </SettingsSection>

          </aside>
        )}
      </div>
    </div>
  )
}

// ─── Helper Components ────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 2,
  color: '#4a5568',
  marginBottom: 4,
  display: 'block',
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  background: '#0a0f1c',
  border: '1px solid #1a2540',
  color: '#dce2f8',
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 12,
  cursor: 'pointer',
}

function SettingsSection({ title, color, children }: {
  title: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: '#0a0f1c',
      border: `1px solid ${color}22`,
      borderRadius: 10,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <p style={{ fontSize: 10, letterSpacing: 2, color, margin: 0 }}>{title}</p>
      {children}
    </div>
  )
}

function SettingsInput({ label, value, onChange, show, onToggle, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
  placeholder: string
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: '#0c1322',
            border: '1px solid #1a2540',
            color: '#dce2f8',
            borderRadius: 8,
            padding: '7px 10px',
            fontSize: 12,
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? 'Hide key' : 'Show key'}
          style={{
            background: '#1a2540',
            border: 'none',
            color: '#4a5568',
            borderRadius: 8,
            padding: '0 10px',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  )
}

function SettingsTextInput({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: '#0c1322',
          border: '1px solid #1a2540',
          color: '#dce2f8',
          borderRadius: 8,
          padding: '7px 10px',
          fontSize: 12,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}