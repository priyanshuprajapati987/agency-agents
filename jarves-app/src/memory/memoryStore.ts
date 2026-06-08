export type MemoryMessage = {
  role: 'assistant' | 'user'
  content: string
  timestamp: string
  agentMode: string
}

export type UserPreferences = {
  name: string
  workStyle: string
  preferredAgentMode: string
  language: string
  customInstructions: string
  voiceEnabled?: boolean
}

export type ProjectContext = {
  activeProjects: Array<{ name: string; description: string; createdAt: string }>
  tasks: Array<{ projectName: string; task: string; completed: boolean; createdAt: string }>
  lastTopics: string[]
}

export type SessionStats = {
  totalMessages: number
  lastActive: string
  streak: number
}

export type JarvesMemory = {
  conversationHistory: MemoryMessage[]
  userPreferences: UserPreferences
  projectContext: ProjectContext
  sessionStats: SessionStats
}

const STORAGE_KEY = 'jarves_memory'
const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'your', 'what', 'when', 'where', 'which',
  'would', 'there', 'their', 'about', 'could', 'should', 'these', 'because', 'also', 'other', 'while',
  'after', 'before', 'every', 'about', 'which', 'where', 'their', 'those', 'using', 'using', 'using',
  'still', 'again', 'being', 'being', 'using', 'first', 'just', 'like', 'will', 'into', 'over', 'such',
  'your', 'have', 'with', 'from', 'your', 'has', 'more', 'most', 'some', 'only', 'then', 'than', 'been', 'they',
  'them', 'what', 'when', 'how', 'why', 'who', 'can', 'our', 'all', 'any', 'use', 'used', 'each', 'many', 'many',
  'also', 'also', 'very', 'even', 'much', 'much', 'make', 'made', 'due', 'new', 'one', 'two', 'three', 'four',
])

const DEFAULT_MEMORY: JarvesMemory = {
  conversationHistory: [],
  userPreferences: {
    name: '',
    workStyle: 'Balanced',
    preferredAgentMode: 'Project PM',
    language: 'English',
    customInstructions: '',
    voiceEnabled: false,
  },
  projectContext: {
    activeProjects: [],
    tasks: [],
    lastTopics: [],
  },
  sessionStats: {
    totalMessages: 0,
    lastActive: '',
    streak: 0,
  },
}

export class MemoryStore {
  memory: JarvesMemory

  constructor() {
    this.memory = { ...DEFAULT_MEMORY }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memory))
    } catch {
      // ignore localStorage errors
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        this.memory = { ...DEFAULT_MEMORY }
        this.save()
        return this.memory
      }
      const parsed = JSON.parse(raw)
      this.memory = {
        ...DEFAULT_MEMORY,
        ...parsed,
        conversationHistory: Array.isArray(parsed.conversationHistory) ? parsed.conversationHistory : [],
        userPreferences: {
          ...DEFAULT_MEMORY.userPreferences,
          ...(parsed.userPreferences || {}),
        },
        projectContext: {
          ...DEFAULT_MEMORY.projectContext,
          ...(parsed.projectContext || {}),
          activeProjects: Array.isArray(parsed.projectContext?.activeProjects) ? parsed.projectContext.activeProjects : [],
          tasks: Array.isArray(parsed.projectContext?.tasks) ? parsed.projectContext.tasks : [],
          lastTopics: Array.isArray(parsed.projectContext?.lastTopics) ? parsed.projectContext.lastTopics : [],
        },
        sessionStats: {
          ...DEFAULT_MEMORY.sessionStats,
          ...(parsed.sessionStats || {}),
        },
      }
      return this.memory
    } catch {
      this.memory = { ...DEFAULT_MEMORY }
      this.save()
      return this.memory
    }
  }

  clearHistory() {
    this.memory.conversationHistory = []
    this.memory.projectContext.lastTopics = []
    this.memory.sessionStats.totalMessages = 0
    this.memory.sessionStats.lastActive = ''
    this.memory.sessionStats.streak = 0
    this.save()
  }

  clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    this.memory = { ...DEFAULT_MEMORY }
    this.save()
  }

  addMessage(role: 'assistant' | 'user', content: string, agentMode: string = '') {
    const timestamp = new Date().toISOString()
    const message: MemoryMessage = { role, content, timestamp, agentMode }
    this.memory.conversationHistory.push(message)
    if (this.memory.conversationHistory.length > 100) {
      this.memory.conversationHistory = this.memory.conversationHistory.slice(-100)
    }
    this.memory.sessionStats.totalMessages += 1
    this.memory.sessionStats.lastActive = timestamp
    this.memory.sessionStats.streak = this.computeStreak(timestamp)
    if (role === 'user') {
      this.extractAndSaveTopics(content)
    }
    this.save()
    return message
  }

  updatePreference(key: keyof UserPreferences, value: string | boolean) {
    if (key in this.memory.userPreferences) {
      this.memory.userPreferences[key] = value as any
      this.save()
    }
  }

  addProject(name: string, description: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    this.memory.projectContext.activeProjects.push({
      name: trimmed,
      description: description.trim(),
      createdAt: new Date().toISOString(),
    })
    this.save()
  }

  addTask(projectName: string, task: string) {
    const trimmedName = projectName.trim()
    const trimmedTask = task.trim()
    if (!trimmedName || !trimmedTask) return
    this.memory.projectContext.tasks.push({
      projectName: trimmedName,
      task: trimmedTask,
      completed: false,
      createdAt: new Date().toISOString(),
    })
    this.save()
  }

  getRecentContext(n = 10) {
    return this.memory.conversationHistory
      .slice(-n)
      .map(message => ({ role: message.role, content: message.content }))
  }

  extractAndSaveTopics(message: string) {
    const words = message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter(word => word.length > 4 && !STOPWORDS.has(word))

    const counts = words.reduce<Record<string, number>>((acc, word) => {
      acc[word] = (acc[word] || 0) + 1
      return acc
    }, {})

    const topics = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word)

    const combined = [...topics, ...this.memory.projectContext.lastTopics]
    this.memory.projectContext.lastTopics = Array.from(new Set(combined)).slice(0, 10)
    this.save()
  }

  clearAllHistory() {
    this.clearHistory()
  }

  exportMemory() {
    return JSON.stringify(this.memory, null, 2)
  }

  importMemory(json: string) {
    try {
      const parsed = JSON.parse(json)
      this.memory = {
        ...DEFAULT_MEMORY,
        ...parsed,
        conversationHistory: Array.isArray(parsed.conversationHistory) ? parsed.conversationHistory : [],
        userPreferences: {
          ...DEFAULT_MEMORY.userPreferences,
          ...(parsed.userPreferences || {}),
        },
        projectContext: {
          ...DEFAULT_MEMORY.projectContext,
          ...(parsed.projectContext || {}),
          activeProjects: Array.isArray(parsed.projectContext?.activeProjects) ? parsed.projectContext.activeProjects : [],
          tasks: Array.isArray(parsed.projectContext?.tasks) ? parsed.projectContext.tasks : [],
          lastTopics: Array.isArray(parsed.projectContext?.lastTopics) ? parsed.projectContext.lastTopics : [],
        },
        sessionStats: {
          ...DEFAULT_MEMORY.sessionStats,
          ...(parsed.sessionStats || {}),
        },
      }
      this.save()
      return true
    } catch {
      return false
    }
  }

  getSystemPromptWithMemory(basePrompt: string) {
    const { userPreferences, projectContext } = this.memory
    const userName = userPreferences.name || 'friend'
    const recentTopics = projectContext.lastTopics.length > 0 ? projectContext.lastTopics.join(', ') : 'None'
    const activeProjects = projectContext.activeProjects.length > 0
      ? projectContext.activeProjects.map(project => project.name).join(', ')
      : 'None'
    const instructions = userPreferences.customInstructions || 'No custom instructions.'

    return `${basePrompt}

USER MEMORY:
- Name: ${userName}
- Preferences: ${userPreferences.workStyle}, ${userPreferences.language}
- Recent topics: ${recentTopics}
- Active projects: ${activeProjects}
- Custom instructions: ${instructions}
Always remember and reference this context naturally in responses.`
  }

  private computeStreak(timestamp: string) {
    const previous = this.memory.sessionStats.lastActive ? new Date(this.memory.sessionStats.lastActive) : null
    if (!previous) {
      return 1
    }
    const current = new Date(timestamp)
    const diffMs = current.getTime() - previous.getTime()
    return diffMs <= 24 * 60 * 60 * 1000 ? this.memory.sessionStats.streak + 1 : 1
  }
}
