export const OPENROUTER_MODELS = [
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (FREE)', free: true },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'LLaMA 3.1 8B (FREE)', free: true },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (FREE)', free: true },
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B (FREE)', free: true },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', free: false },
  { id: 'openai/gpt-4o', name: 'GPT-4o', free: false },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', free: false },
]

export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface OpenRouterResponse {
  reply: string
  model: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
  }
}

export async function openRouterChat(
  messages: OpenRouterMessage[],
  apiKey: string,
  model: string = 'deepseek/deepseek-r1:free',
  systemPrompt?: string
): Promise<OpenRouterResponse> {
  if (!apiKey) {
    throw new Error('OpenRouter API key is required. Get a free key at openrouter.ai')
  }

  const allMessages: OpenRouterMessage[] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'JARVES Assistant',
    },
    body: JSON.stringify({
      model,
      messages: allMessages,
      max_tokens: 2048,
    }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(
      error?.error?.message || `OpenRouter error ${res.status}`
    )
  }

  const data = await res.json()
  const reply = data.choices?.[0]?.message?.content ?? ''

  return {
    reply,
    model: data.model ?? model,
    usage: data.usage,
  }
}
