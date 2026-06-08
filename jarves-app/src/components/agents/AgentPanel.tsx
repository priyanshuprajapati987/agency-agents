import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripHorizontal, X } from 'lucide-react';

export interface AgentMode {
  id: string;
  label: string;
  short: string;
  color: string;
  prompt: string;
}

interface AgentPanelProps {
  agents: AgentMode[];
  activeAgent: AgentMode;
  setActiveAgent: (a: AgentMode) => void;
  position: { x: number; y: number };
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onClose: () => void;
  show: boolean;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({
  agents,
  activeAgent,
  setActiveAgent,
  position,
  isDragging,
  onPointerDown,
  onClose,
  show
}) => {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'absolute',
            top: position.y,
            left: position.x,
            width: 280,
            zIndex: 50,
          }}
          className="glass-panel rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header - Draggable */}
          <div
            onPointerDown={onPointerDown}
            className={`flex items-center justify-between p-4 border-b border-white/5 bg-slate-900/40 
              ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
            `}
          >
            <div className="flex items-center gap-3">
              <GripHorizontal size={16} className="text-slate-500" />
              <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">Agent Mode</span>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body - Agent List */}
          <div className="p-2 flex flex-col gap-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {agents.map(agent => {
              const isActive = activeAgent.id === agent.id;
              return (
                <button
                  key={agent.id}
                  onClick={() => setActiveAgent(agent)}
                  className="flex items-center gap-3 p-3 rounded-xl text-left transition-all duration-200 group relative overflow-hidden"
                  style={{
                    backgroundColor: isActive ? `${agent.color}15` : 'transparent',
                  }}
                >
                  {/* Hover background effect */}
                  {!isActive && (
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                  
                  {/* Avatar Icon */}
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: isActive ? agent.color : 'rgba(255,255,255,0.05)',
                      color: isActive ? '#020617' : agent.color,
                      boxShadow: isActive ? `0 0 15px ${agent.color}40` : 'none'
                    }}
                  >
                    {agent.short}
                  </div>

                  {/* Text info */}
                  <div className="flex flex-col overflow-hidden">
                    <span 
                      className="font-semibold text-[13px] truncate"
                      style={{ color: isActive ? agent.color : '#e2e8f0' }}
                    >
                      {agent.label}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate mt-0.5">
                      {agent.prompt.split('.')[0]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
