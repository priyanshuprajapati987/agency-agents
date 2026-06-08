import React, { FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, SendHorizontal, Loader2 } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (s: string) => void;
  handleSend: (e: FormEvent) => void;
  isListening: boolean;
  startVoice: () => void;
  stopVoice: () => void;
  sending: boolean;
  activeAgentColor: string;
  activeAgentLabel: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  handleSend,
  isListening,
  startVoice,
  stopVoice,
  sending,
  activeAgentColor,
  activeAgentLabel
}) => {
  return (
    <form
      onSubmit={handleSend}
      className="p-4 md:p-6 w-full max-w-4xl mx-auto flex items-end gap-3 z-10"
    >
      <div 
        className="flex-1 glass-surface rounded-2xl flex items-center p-2 border transition-all duration-300"
        style={{ 
          borderColor: input ? `${activeAgentColor}50` : 'rgba(255,255,255,0.05)',
          boxShadow: input ? `0 4px 20px ${activeAgentColor}10` : 'none'
        }}
      >
        <button
          type="button"
          onClick={isListening ? stopVoice : startVoice}
          className={`p-3 rounded-xl transition-all duration-300 flex-shrink-0
            ${isListening ? 'bg-rose-500/20 text-rose-400' : 'hover:bg-white/5 text-slate-400 hover:text-white'}
          `}
        >
          {isListening ? (
            <span className="relative flex h-5 w-5 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <MicOff size={20} />
            </span>
          ) : (
            <Mic size={20} />
          )}
        </button>

        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Message ${activeAgentLabel}...`}
          disabled={sending}
          className="flex-1 bg-transparent border-none outline-none resize-none min-h-[44px] max-h-32 px-4 py-3 text-[15px] text-slate-100 placeholder-slate-500"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend(e as unknown as FormEvent);
            }
          }}
        />

        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="p-3 rounded-xl flex items-center justify-center transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          style={{ 
            backgroundColor: (input.trim() && !sending) ? `${activeAgentColor}20` : 'transparent',
            color: (input.trim() && !sending) ? activeAgentColor : '#64748b'
          }}
        >
          {sending ? <Loader2 size={20} className="animate-spin" /> : <SendHorizontal size={20} />}
        </button>
      </div>
    </form>
  );
};
