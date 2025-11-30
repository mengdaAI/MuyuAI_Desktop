import React from 'react';
import type { Turn } from '../../types';

interface LiveAnswerPanelProps {
  turns: Turn[];
  sessionStatus: 'beforeSession' | 'inSession' | 'afterSession';
}

export function LiveAnswerPanel({ turns, sessionStatus }: LiveAnswerPanelProps) {
  const renderStatus = (turn: Turn) => {
    let statusText = '';
    let dotColor = 'bg-muyu-blue-500';
    let animateClass = 'animate-pulse-dot';
    
    switch (turn.status) {
      case 'completed': 
        statusText = 'Completed';
        dotColor = 'bg-[rgba(46,204,113,0.7)]';
        animateClass = '';
        break;
      case 'error': 
        statusText = 'Error';
        dotColor = 'bg-status-error/75';
        animateClass = '';
        break;
      case 'aborted': 
        statusText = 'Cancelled';
        dotColor = 'bg-status-error/75';
        animateClass = '';
        break;
      default: 
        statusText = 'Listening...';
    }
    
    return (
      <div className="hidden">
        <span className={`w-2 h-2 rounded-full ${dotColor} ${animateClass}`}></span>
        <span>{statusText}</span>
      </div>
    );
  };

  const stateCopyMap = {
    idle: {
      headline: '点击右侧按钮开始收音，回答将展示在下方区域',
    },
    listening: {
      headline: '聆听对方发言中...',
    },
    completed: {
      headline: '收音结束，可继续查看总结与面试记录。',
    },
  };

  const panelState = sessionStatus === 'afterSession' ? 'completed' : sessionStatus === 'inSession' ? 'listening' : 'idle';
  const stateCopy = stateCopyMap[panelState];

  if (sessionStatus === 'inSession' || sessionStatus === 'afterSession') {
    return (
      <div className="flex-1 overflow-y-auto pr-1 pb-4 flex flex-col gap-4">
        {(!turns || turns.length === 0) ? (
          <div className="flex items-center justify-center min-h-[150px] text-white/40 text-sm">
            等待对方发言...
          </div>
        ) : (
          turns.map(turn => {
            const latestTurnId = turns[turns.length - 1]?.id;
            const isActive = turn.id === latestTurnId && turn.status !== 'completed';
            
            return (
              <div key={turn.id} className="flex flex-col gap-3 mb-2">
                <div>
                  <div className="text-xs text-white/40 mb-1">对方发言</div>
                  <div className="text-md text-white/90 leading-relaxed whitespace-pre-wrap">
                    {turn.question}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/40 mb-1 mt-2">AI回答</div>
                  <div className="text-md text-white/90 leading-relaxed whitespace-pre-wrap">
                    {turn.answer || '分析中...'}
                  </div>
                </div>
                {renderStatus(turn)}
              </div>
            );
          })
        )}
        <style>{`
          .flex-1.overflow-y-auto::-webkit-scrollbar { width: 4px; }
          .flex-1.overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
          .flex-1.overflow-y-auto::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }
          .flex-1.overflow-y-auto::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
        `}</style>
      </div>
    );
  }

  return (
    <div className="text-base text-white/90 font-medium tracking-wide">
      {stateCopy.headline}
    </div>
  );
}

