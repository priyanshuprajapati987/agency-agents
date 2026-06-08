import { useEffect, useRef, useState } from 'react'
import { MemoryStore, type JarvesMemory, type UserPreferences } from '../memory/memoryStore'

export function useMemory() {
  const storeRef = useRef<MemoryStore>(new MemoryStore())
  const [memory, setMemory] = useState<JarvesMemory>(storeRef.current.load())

  useEffect(() => {
    setMemory(storeRef.current.load())
  }, [])

  const refresh = () => {
    setMemory({ ...storeRef.current.memory })
  }

  return {
    memory,
    addMessage: (role: 'assistant' | 'user', content: string, agentMode: string = '') => {
      storeRef.current.addMessage(role, content, agentMode)
      refresh()
    },
    updatePreference: (key: keyof UserPreferences, value: string) => {
      storeRef.current.updatePreference(key, value)
      refresh()
    },
    addProject: (name: string, description: string) => {
      storeRef.current.addProject(name, description)
      refresh()
    },
    addTask: (projectName: string, task: string) => {
      storeRef.current.addTask(projectName, task)
      refresh()
    },
    getContext: (n = 10) => storeRef.current.getRecentContext(n),
    getSystemPromptWithMemory: (basePrompt: string) => storeRef.current.getSystemPromptWithMemory(basePrompt),
    clearHistory: () => {
      storeRef.current.clearHistory()
      refresh()
    },
    clearAll: () => {
      storeRef.current.clearAll()
      refresh()
    },
    exportMemory: () => storeRef.current.exportMemory(),
    importMemory: (json: string) => {
      const valid = storeRef.current.importMemory(json)
      refresh()
      return valid
    },
  }
}
