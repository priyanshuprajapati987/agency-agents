import { useMemo, useState } from 'react'
import type { JarvesMemory, UserPreferences } from '../memory/memoryStore'

function formatDate(timestamp: string) {
  if (!timestamp) return 'Never'
  return new Date(timestamp).toLocaleString()
}

function downloadJson(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function MemoryPanel({
  memory,
  onClose,
  clearHistory,
  clearAll,
  exportMemory,
  importMemory,
}: {
  memory: JarvesMemory
  onClose: () => void
  clearHistory: () => void
  clearAll: () => void
  exportMemory: () => string
  importMemory: (json: string) => boolean
}) {
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')

  const recentProjects = useMemo(
    () => memory.projectContext.activeProjects.slice(-5),
    [memory.projectContext.activeProjects]
  )

  const recentTasks = useMemo(
    () => memory.projectContext.tasks.slice(-6),
    [memory.projectContext.tasks]
  )

  const profile = memory.userPreferences

  return (
    <aside style={{
      width: 340,
      height: '100%',
      background: '#0c1322',
      borderLeft: '1px solid #1a2540',
      padding: 20,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: '#00f2ff', marginBottom: 6 }}>🧠 MEMORY</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#dce2f8' }}>Agent Memory Hub</div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#4a5568', cursor: 'pointer', fontSize: 18 }}
          aria-label="Close memory panel"
        >
          ✕
        </button>
      </div>

      <section style={{ border: '1px solid #1a2540', borderRadius: 14, padding: 14, background: '#09101d' }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: '#4a9cff', margin: 0 }}>PROFILE</p>
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={{ fontSize: 10, color: '#4a5568' }}>Name</span>
            <span style={{ color: '#dce2f8', fontWeight: 700 }}>{profile.name || 'Unknown'}</span>
          </div>
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={{ fontSize: 10, color: '#4a5568' }}>Work style</span>
            <span style={{ color: '#dce2f8' }}>{profile.workStyle}</span>
          </div>
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={{ fontSize: 10, color: '#4a5568' }}>Language</span>
            <span style={{ color: '#dce2f8' }}>{profile.language}</span>
          </div>
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={{ fontSize: 10, color: '#4a5568' }}>Preferred agent</span>
            <span style={{ color: '#dce2f8' }}>{profile.preferredAgentMode}</span>
          </div>
        </div>
      </section>

      <section style={{ border: '1px solid #1a2540', borderRadius: 14, padding: 14, background: '#09101d' }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: '#4a9cff', margin: 0 }}>RECENT TOPICS</p>
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {memory.projectContext.lastTopics.length > 0 ? (
            memory.projectContext.lastTopics.map(topic => (
              <span key={topic} style={{
                background: '#0f1a2f',
                border: '1px solid #1a2540',
                borderRadius: 999,
                padding: '6px 10px',
                fontSize: 11,
                color: '#dce2f8',
              }}>{topic}</span>
            ))
          ) : (
            <span style={{ color: '#4a5568', fontSize: 12 }}>No topics detected yet.</span>
          )}
        </div>
      </section>

      <section style={{ border: '1px solid #1a2540', borderRadius: 14, padding: 14, background: '#09101d' }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: '#4a9cff', margin: 0 }}>PROJECTS & TASKS</p>
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {recentProjects.length > 0 ? (
            recentProjects.map(project => (
              <div key={project.name} style={{ border: '1px solid #16223b', borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#dce2f8' }}>{project.name}</div>
                <div style={{ fontSize: 11, color: '#7c8cb0', marginTop: 4 }}>{project.description || 'No description'}</div>
              </div>
            ))
          ) : (
            <span style={{ color: '#4a5568', fontSize: 12 }}>No active projects yet.</span>
          )}
          {recentTasks.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#00f2ff', marginBottom: 8 }}>Recent tasks</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {recentTasks.map((task, index) => (
                  <div key={`${task.projectName}-${index}`} style={{ display: 'grid', gap: 4, padding: 10, border: '1px solid #16223b', borderRadius: 12 }}>
                    <span style={{ fontSize: 11, color: '#4a5568' }}>{task.projectName}</span>
                    <span style={{ color: '#dce2f8', fontSize: 13 }}>{task.task}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section style={{ border: '1px solid #1a2540', borderRadius: 14, padding: 14, background: '#09101d' }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: '#4a9cff', margin: 0 }}>SESSION STATS</p>
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dce2f8', fontSize: 13 }}>
            <span>Conversation count</span>
            <span>{memory.conversationHistory.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dce2f8', fontSize: 13 }}>
            <span>Last active</span>
            <span>{formatDate(memory.sessionStats.lastActive)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dce2f8', fontSize: 13 }}>
            <span>Streak</span>
            <span>{memory.sessionStats.streak} day(s)</span>
          </div>
        </div>
      </section>

      <section style={{ border: '1px solid #1a2540', borderRadius: 14, padding: 14, background: '#09101d', display: 'grid', gap: 10 }}>
        <button
          onClick={() => downloadJson('jarves_memory.json', exportMemory())}
          style={{ background: '#0b1e34', border: '1px solid #0f4cff', borderRadius: 10, padding: '10px 12px', color: '#dce2f8', cursor: 'pointer' }}
        >
          Export Memory
        </button>
        <button
          onClick={clearHistory}
          style={{ background: '#0b1e34', border: '1px solid #10b981', borderRadius: 10, padding: '10px 12px', color: '#dce2f8', cursor: 'pointer' }}
        >
          Clear Conversation History
        </button>
        <button
          onClick={clearAll}
          style={{ background: '#0b1e34', border: '1px solid #ef4444', borderRadius: 10, padding: '10px 12px', color: '#dce2f8', cursor: 'pointer' }}
        >
          Clear All Memory
        </button>
      </section>

      <section style={{ border: '1px solid #1a2540', borderRadius: 14, padding: 14, background: '#09101d', display: 'grid', gap: 10 }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: '#4a9cff', margin: 0 }}>IMPORT MEMORY</p>
        <textarea
          value={importText}
          onChange={e => setImportText(e.target.value)}
          placeholder="Paste memory JSON here"
          style={{
            width: '100%',
            minHeight: 100,
            borderRadius: 10,
            border: '1px solid #1a2540',
            background: '#08101d',
            color: '#dce2f8',
            padding: 10,
            fontSize: 12,
            resize: 'vertical',
          }}
        />
        {importError && <span style={{ color: '#ef4444', fontSize: 12 }}>{importError}</span>}
        <button
          onClick={() => {
            setImportError('')
            const success = importMemory(importText)
            if (!success) {
              setImportError('Invalid JSON payload. Please check and try again.')
            } else {
              setImportText('')
            }
          }}
          style={{ background: '#0b1e34', border: '1px solid #00f2ff', borderRadius: 10, padding: '10px 12px', color: '#dce2f8', cursor: 'pointer' }}
        >
          Import Memory
        </button>
      </section>
    </aside>
  )
}
