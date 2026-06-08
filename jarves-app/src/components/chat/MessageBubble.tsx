import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';

interface Message {
  role: 'assistant' | 'user';
  text: string;
  typing?: boolean;
}

interface MessageBubbleProps {
  message: Message;
  agentColor?: string;
  agentName?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  agentColor = '#00f2ff',
  agentName = 'JARVES' 
}) => {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6`}
    >
      <div className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-4`}>
        
        {/* Avatar */}
        <div className="flex-shrink-0 mt-1">
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center glass-surface shadow-lg border-opacity-20`}
            style={{ 
              borderColor: isUser ? 'rgba(255,255,255,0.1)' : `${agentColor}40`,
              color: isUser ? '#f8fafc' : agentColor,
              backgroundColor: isUser ? 'rgba(255,255,255,0.05)' : `${agentColor}15`
            }}
          >
            {isUser ? <User size={16} /> : <Bot size={16} />}
          </div>
        </div>

        {/* Message Content */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <span className="text-[10px] tracking-widest text-slate-500 mb-2 uppercase font-medium">
            {isUser ? 'You' : agentName}
          </span>
          
          <div 
            className={`glass-panel p-4 md:p-5 shadow-2xl relative group`}
            style={{
              borderRadius: isUser ? '20px 20px 4px 20px' : '4px 20px 20px 20px',
              border: `1px solid ${isUser ? 'rgba(255,255,255,0.08)' : `${agentColor}30`}`,
              background: isUser ? 'rgba(30, 41, 59, 0.5)' : `linear-gradient(145deg, rgba(16,24,39,0.7) 0%, ${agentColor}08 100%)`
            }}
          >
            <p className="text-slate-200 text-[14px] leading-relaxed whitespace-pre-wrap">
              {message.text || (message.typing && (
                <span className="animate-pulse flex items-center gap-2" style={{ color: agentColor }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animation-delay-150"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animation-delay-300"></span>
                </span>
              ))}
            </p>
          </div>
        </div>
        
      </div>
    </motion.div>
  );
};
