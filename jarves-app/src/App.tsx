import { FormEvent, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from './store/settings';
import { useMemory } from './hooks/useMemory';
import { useVoice } from './hooks/useVoice';
import MemoryPanel from './components/MemoryPanel';
import { openRouterChat } from './providers/openrouter';

import { Sidebar } from './components/layout/Sidebar';
import { MessageBubble } from './components/chat/MessageBubble';
import { ChatInput } from './components/chat/ChatInput';
import { AgentPanel, AgentMode } from './components/agents/AgentPanel';

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = {
  role: 'assistant' | 'user';
  text: string;
  typing?: boolean;
};

// ─── Agent Modes ──────────────────────────────────────────────────────────────
const AGENT_MODES: AgentMode[] = [
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
];

// ─── System prompt builder ────────────────────────────────────────────────────
function buildSystemPrompt(agentPrompt: string): string {
  return `You are JARVES — an advanced AI desktop assistant.
You are intelligent, precise, slightly witty, and always helpful.
${agentPrompt}
Keep responses concise and actionable.`;
}

function detectNameFromMessage(message: string) {
  const normalized = message.trim();
  const regex = /(?:my name is|i am|i'm|call me|this is)\s+([A-Za-z][A-Za-z0-9_-]{1,30})/i;
  const match = normalized.match(regex);
  if (match?.[1]) {
    return match[1].replace(/[^A-Za-z0-9_-]/g, '');
  }
  const words = normalized.replace(/[^A-Za-z\s]/g, '').split(/\s+/).filter(Boolean);
  return words.length > 0 ? words[words.length - 1] : 'friend';
}

export default function App() {
  const settings = useSettingsStore();
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
  } = useMemory();

  const handleVoiceTranscriptComplete = async (message: string) => {
    if (!message.trim() || sending) return;
    setInput('');
    await sendUserMessage(message);
  };

  const {
    isListening,
    isSpeaking,
    transcript: voiceTranscript,
    startVoice,
    stopVoice,
    speak,
    voiceEnabled,
    voiceError,
  } = useVoice(handleVoiceTranscriptComplete);

  const [activeAgent, setActiveAgent] = useState<AgentMode>(AGENT_MODES[0]);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (memory.conversationHistory.length > 0) {
      return memory.conversationHistory.map(entry => ({ role: entry.role, text: entry.content }));
    }
    return [{ role: 'assistant', text: `Hey! I'm JARVES. What should I call you?` }];
  });
  
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  
  // Agent Panel State
  const [showAgentPanel, setShowAgentPanel] = useState(true);
  const [isDraggingAgentPanel, setIsDraggingAgentPanel] = useState(false);
  const [agentPanelPosition, setAgentPanelPosition] = useState({ x: 100, y: 100 });
  const dragStartRef = useRef<{ x: number; y: number; mouseX: number; mouseY: number } | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (memory.conversationHistory.length > 0 && messages.length === 1 && messages[0].text.includes("What should I call you")) {
      setMessages(memory.conversationHistory.map(entry => ({ role: entry.role, text: entry.content })));
    }
  }, [memory.conversationHistory]);

  useEffect(() => {
    updateMemoryPreference('voiceEnabled', voiceEnabled);
  }, [voiceEnabled]);

  const apiUrl = '/api';

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${apiUrl}/status`);
        setBackendConnected(res.ok || res.status === 404); // Using 404 as ok because the endpoint might not exist but the server is up
      } catch {
        setBackendConnected(false);
      }
    };
    check();
    const id = setInterval(check, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isDraggingAgentPanel || !dragStartRef.current) return;
      const dx = event.clientX - dragStartRef.current.mouseX;
      const dy = event.clientY - dragStartRef.current.mouseY;
      setAgentPanelPosition({
        x: Math.max(80, dragStartRef.current.x + dx), // keep away from sidebar
        y: Math.max(8, dragStartRef.current.y + dy),
      });
    };
    const handlePointerUp = () => {
      if (isDraggingAgentPanel) setIsDraggingAgentPanel(false);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingAgentPanel]);

  const animateReply = (replyText: string) => {
    return new Promise<void>((resolve) => {
      let index = 0;
      typingTimerRef.current = window.setInterval(() => {
        index += 2;
        setMessages(prev => {
          const next = [...prev];
          const typing = next.find(m => m.typing);
          if (!typing) { clearInterval(typingTimerRef.current!); resolve(); return next; }
          typing.text = replyText.slice(0, index);
          if (index >= replyText.length) {
            typing.typing = false;
            clearInterval(typingTimerRef.current!);
            resolve();
          }
          return next;
        });
      }, 10); // Faster typing speed
    });
  };

  const sendUserMessage = async (userText: string) => {
    if (!userText.trim() || sending) return;
    setSending(true);

    setMessages(prev => [
      ...prev,
      { role: 'user', text: userText },
      { role: 'assistant', text: '', typing: true }
    ]);
    addMemoryMessage('user', userText, activeAgent.id);

    if (!memory.userPreferences.name) {
      const detectedName = detectNameFromMessage(userText);
      updateMemoryPreference('name', detectedName);
      const welcome = `Nice to meet you, ${detectedName}. I'm JARVES. What can I help you with today?`;
      addMemoryMessage('assistant', welcome, activeAgent.id);
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', text: welcome, typing: false };
        return next;
      });
      setSending(false);
      return;
    }

    let replyText = '';
    try {
      const history = getContext(10);
      history.push({ role: 'user', content: userText });
      const systemPrompt = getSystemPromptWithMemory(buildSystemPrompt(activeAgent.prompt));
      const provider = settings.activeProvider;

      if (provider === 'openrouter') {
        if (!settings.openrouterApiKey) {
          replyText = '⚠️ OpenRouter API key not set. Add it in settings.';
        } else {
          const result = await openRouterChat(history, settings.openrouterApiKey, settings.openrouterModel, systemPrompt);
          replyText = result.reply;
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
        });
        const data = await res.json();
        replyText = res.ok && data.reply ? data.reply : data.error || 'JARVES could not generate a response.';
      }
    } catch (err) {
      replyText = `Connection error: ${(err as Error).message}`;
    } finally {
      addMemoryMessage('assistant', replyText, activeAgent.id);
      await animateReply(replyText);
      speak(replyText);
      setSending(false);
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const userText = input.trim();
    setInput('');
    await sendUserMessage(userText);
  };

  const renderProviderSettings = () => {
    switch (settings.activeProvider) {
      case 'openai':
        return (
          <>
            <div>
              <label className="block text-sm text-slate-400 mb-1">OpenAI API Key</label>
              <input
                type="password"
                value={settings.openaiApiKey}
                onChange={e => settings.setOpenaiApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-slate-800/50 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#00f2ff]"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">OpenAI Model</label>
              <input
                type="text"
                value={settings.openaiModel}
                onChange={e => settings.setOpenaiModel(e.target.value)}
                placeholder="gpt-4o"
                className="w-full bg-slate-800/50 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#00f2ff]"
              />
            </div>
          </>
        )
      case 'anthropic':
        return (
          <>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Anthropic API Key</label>
              <input
                type="password"
                value={settings.anthropicApiKey}
                onChange={e => settings.setAnthropicApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-slate-800/50 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#00f2ff]"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Anthropic Model</label>
              <input
                type="text"
                value={settings.anthropicModel}
                onChange={e => settings.setAnthropicModel(e.target.value)}
                placeholder="claude-3-5-sonnet-20241022"
                className="w-full bg-slate-800/50 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#00f2ff]"
              />
            </div>
          </>
        )
      case 'gemini':
        return (
          <>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Gemini API Key</label>
              <input
                type="password"
                value={settings.geminiApiKey}
                onChange={e => settings.setGeminiApiKey(e.target.value)}
                placeholder="gm-..."
                className="w-full bg-slate-800/50 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#00f2ff]"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Gemini Model</label>
              <input
                type="text"
                value={settings.geminiModel}
                onChange={e => settings.setGeminiModel(e.target.value)}
                placeholder="gemini-1.5-flash"
                className="w-full bg-slate-800/50 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#00f2ff]"
              />
            </div>
          </>
        )
      case 'openrouter':
        return (
          <>
            <div>
              <label className="block text-sm text-slate-400 mb-1">OpenRouter API Key</label>
              <input
                type="password"
                value={settings.openrouterApiKey}
                onChange={e => settings.setOpenrouterApiKey(e.target.value)}
                placeholder="or-..."
                className="w-full bg-slate-800/50 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#00f2ff]"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">OpenRouter Model</label>
              <input
                type="text"
                value={settings.openrouterModel}
                onChange={e => settings.setOpenrouterModel(e.target.value)}
                placeholder="deepseek/deepseek-r1:free"
                className="w-full bg-slate-800/50 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#00f2ff]"
              />
            </div>
          </>
        )
      case 'ollama':
        return (
          <>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Ollama Base URL</label>
              <input
                type="text"
                value={settings.ollamaBaseUrl}
                onChange={e => settings.setOllamaBaseUrl(e.target.value)}
                placeholder="http://localhost:11434/api/chat"
                className="w-full bg-slate-800/50 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#00f2ff]"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Ollama Model</label>
              <input
                type="text"
                value={settings.ollamaModel}
                onChange={e => settings.setOllamaModel(e.target.value)}
                placeholder="llama3"
                className="w-full bg-slate-800/50 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#00f2ff]"
              />
            </div>
          </>
        )
      case 'custom':
        return (
          <>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Custom Base URL</label>
              <input
                type="text"
                value={settings.customBaseUrl}
                onChange={e => settings.setCustomBaseUrl(e.target.value)}
                placeholder="https://your-api.example.com/v1"
                className="w-full bg-slate-800/50 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#00f2ff]"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Custom API Key</label>
              <input
                type="password"
                value={settings.customApiKey}
                onChange={e => settings.setCustomApiKey(e.target.value)}
                placeholder="custom-key"
                className="w-full bg-slate-800/50 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#00f2ff]"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Custom Model</label>
              <input
                type="text"
                value={settings.customModel}
                onChange={e => settings.setCustomModel(e.target.value)}
                placeholder="model-name"
                className="w-full bg-slate-800/50 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#00f2ff]"
              />
            </div>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#070b14] text-slate-200">
      
      {/* Settings Modal - Quick placeholder since we didn't fully extract it */}
      {showSettings && (
         <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
           <div className="glass-panel p-8 rounded-2xl w-full max-w-md shadow-2xl relative">
              <h2 className="text-xl font-bold mb-6 text-white">System Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Provider</label>
                  <select 
                    value={settings.activeProvider}
                    onChange={e => settings.setActiveProvider(e.target.value as any)}
                    className="w-full bg-slate-800/50 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-[#00f2ff]"
                  >
                    <option value="gemini">Gemini</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="ollama">Ollama</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {renderProviderSettings()}
              </div>

              <p className="mt-4 text-xs text-slate-500">API keys are saved locally in your browser only.</p>

              <div className="mt-8 flex justify-end">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                >
                  Done
                </button>
              </div>
           </div>
         </div>
      )}

      {/* Main Layout */}
      <Sidebar 
        backendConnected={backendConnected}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        showMemoryPanel={showMemoryPanel}
        setShowMemoryPanel={setShowMemoryPanel}
        isListening={isListening}
        isSpeaking={isSpeaking}
        activeAgentColor={activeAgent.color}
      />

      {/* Chat / Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Background Gradients */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div 
            className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full opacity-20 blur-[120px] transition-colors duration-1000"
            style={{ backgroundColor: activeAgent.color }}
          />
          <div 
            className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-10 blur-[100px] transition-colors duration-1000"
            style={{ backgroundColor: activeAgent.color }}
          />
        </div>

        {/* Memory Panel */}
        <AnimatePresence>
          {showMemoryPanel && (
            <motion.div 
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              className="absolute top-0 left-0 bottom-0 w-80 z-20 shadow-2xl overflow-hidden"
            >
              <MemoryPanel
                memory={memory}
                onClose={() => setShowMemoryPanel(false)}
                clearHistory={clearHistory}
                clearAll={clearAll}
                exportMemory={exportMemory}
                importMemory={importMemory}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Agent Panel (Draggable) */}
        {!showAgentPanel ? (
          <button 
             onClick={() => setShowAgentPanel(true)}
             className="absolute top-6 left-6 z-30 p-3 rounded-xl glass-panel shadow-lg hover:bg-white/10 transition-colors border border-white/10 text-slate-300 hover:text-white"
          >
            Switch Agent
          </button>
        ) : (
          <AgentPanel 
            agents={AGENT_MODES}
            activeAgent={activeAgent}
            setActiveAgent={setActiveAgent}
            position={agentPanelPosition}
            isDragging={isDraggingAgentPanel}
            onPointerDown={(e) => {
              dragStartRef.current = {
                x: agentPanelPosition.x,
                y: agentPanelPosition.y,
                mouseX: e.clientX,
                mouseY: e.clientY,
              };
              setIsDraggingAgentPanel(true);
            }}
            onClose={() => setShowAgentPanel(false)}
            show={showAgentPanel}
          />
        )}

        {/* Messages */}
        <div 
          ref={chatRef}
          className="flex-1 overflow-y-auto px-6 md:px-12 lg:px-24 py-8 z-10 custom-scrollbar mt-12"
        >
          <div className="max-w-4xl mx-auto w-full pb-8">
            {messages.map((msg, i) => (
              <MessageBubble 
                key={i} 
                message={msg} 
                agentColor={activeAgent.color}
                agentName={activeAgent.label}
              />
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="relative z-20 w-full pb-4 pt-2">
          {/* Voice status indicator */}
          <div className="max-w-4xl mx-auto px-6 mb-2 h-6 flex items-center justify-between">
            {voiceTranscript && (
              <div className="text-xs tracking-wider text-rose-400 font-medium">
                Listening: {voiceTranscript}
              </div>
            )}
            {voiceError && (
              <div className="text-xs text-rose-500 bg-rose-500/10 px-3 py-1 rounded">
                Voice error: {voiceError}
              </div>
            )}
          </div>

          <ChatInput 
            input={input}
            setInput={setInput}
            handleSend={handleSend}
            isListening={isListening}
            startVoice={startVoice}
            stopVoice={stopVoice}
            sending={sending}
            activeAgentColor={activeAgent.color}
            activeAgentLabel={activeAgent.label}
          />
        </div>
      </main>
    </div>
  );
}