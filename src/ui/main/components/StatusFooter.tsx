import React from 'react';
import type { ListenSessionStatus } from '../../types';

interface StatusFooterProps {
  sessionStatus: ListenSessionStatus;
  elapsedSeconds: number;
  totalInterviewSeconds: number;
}

export function StatusFooter({ sessionStatus, elapsedSeconds, totalInterviewSeconds }: StatusFooterProps) {
  const formatElapsedTime = (totalSeconds: number) => {
    const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const panelState = sessionStatus === 'afterSession' ? 'completed' : sessionStatus === 'inSession' ? 'listening' : 'idle';
  
  const stateCopyMap = {
    idle: { status: '等待中' },
    listening: { status: '聆听中' },
    completed: { status: '已结束' },
  };
  
  const dotColors = {
    idle: 'bg-status-idle shadow-[0_0_8px_rgba(255,199,143,0.8)]',
    listening: 'bg-status-listening shadow-[0_0_8px_rgba(121,255,225,0.8)]',
    completed: 'bg-status-completed shadow-[0_0_8px_rgba(143,222,255,0.8)]',
  };
  
  const stateCopy = stateCopyMap[panelState];
  const dotColor = dotColors[panelState];
  const elapsed = formatElapsedTime(elapsedSeconds);

  return (
    <div className="flex justify-between items-center text-sm text-white/60">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></div>
        <span>{stateCopy.status}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
        </svg>
        <span>
          {totalInterviewSeconds > 0 
            ? `剩余 ${Math.max(0, Math.ceil((totalInterviewSeconds - elapsedSeconds) / 60))} 分钟` 
            : (panelState === 'idle' ? '计时 00:00' : `计时 ${elapsed}`)}
        </span>
      </div>
    </div>
  );
}

