import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Database, BrainCircuit, Mic, Volume2 } from 'lucide-react';

interface SidebarProps {
  backendConnected: boolean;
  showSettings: boolean;
  setShowSettings: (s: boolean) => void;
  showMemoryPanel: boolean;
  setShowMemoryPanel: (s: boolean) => void;
  isListening: boolean;
  isSpeaking: boolean;
  activeAgentColor: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  backendConnected,
  showSettings,
  setShowSettings,
  showMemoryPanel,
  setShowMemoryPanel,
  isListening,
  isSpeaking,
  activeAgentColor
}) => {
  return (
    <div className="w-[72px] h-full flex flex-col items-center py-6 glass-panel border-r border-white/5 border-l-0 border-y-0 z-40 bg-[#070b14]/80">
      
      {/* Top Section - Logo */}
      <div className="mb-12 relative group cursor-pointer flex flex-col items-center">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden transition-all duration-300 group-hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${activeAgentColor}20, transparent)`,
            border: `1px solid ${activeAgentColor}40`,
            boxShadow: `0 0 20px ${activeAgentColor}15`
          }}
        >
          <BrainCircuit size={20} color={activeAgentColor} />
          
          {/* Active Pulse effect */}
          {(isListening || isSpeaking) && (
             <motion.div 
               animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
               transition={{ repeat: Infinity, duration: 1.5 }}
               className="absolute inset-0 rounded-xl"
               style={{ backgroundColor: activeAgentColor }}
             />
          )}
        </div>
        
        {/* Connection Status Indicator */}
        <div className="mt-4 flex flex-col items-center gap-1.5">
          <div 
            className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} 
            style={{ boxShadow: `0 0 8px ${backendConnected ? '#34d399' : '#f43f5e'}` }}
          />
        </div>
      </div>

      {/* Middle Section - Controls */}
      <div className="flex-1 flex flex-col gap-6 items-center w-full">
        
        <button
          onClick={() => setShowMemoryPanel(!showMemoryPanel)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 relative group
            ${showMemoryPanel ? 'bg-white/10 shadow-inner' : 'hover:bg-white/5'}
          `}
        >
          <Database size={18} className={`${showMemoryPanel ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
          {/* Tooltip */}
          <div className="absolute left-14 bg-slate-800 text-xs px-2 py-1 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap text-slate-200">
            Memory Bank
          </div>
        </button>

      </div>

      {/* Bottom Section - Settings */}
      <div className="mt-auto flex flex-col gap-4 items-center">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 relative group
            ${showSettings ? 'bg-white/10 shadow-inner' : 'hover:bg-white/5'}
          `}
        >
          <Settings size={18} className={`${showSettings ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
          <div className="absolute left-14 bg-slate-800 text-xs px-2 py-1 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap text-slate-200">
            System Preferences
          </div>
        </button>
      </div>
    </div>
  );
};
