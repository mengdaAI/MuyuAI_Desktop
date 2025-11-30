import React from 'react';
import type { ListenSessionStatus, Shortcuts } from '../../types';
import { formatShortcutLabel } from '../../utils';

interface ActionSidebarProps {
  sessionStatus: ListenSessionStatus;
  isTogglingSession: boolean;
  onToggleSession: () => void;
  onAskClick: () => void;
  onScreenshotClick: () => void;
  onTranscriptClick: () => void;
  onToggleVisibility: () => void;
  onSettingsEnter: () => void;
  onSettingsLeave: () => void;
  shortcuts?: Shortcuts;
  wasJustDragged?: boolean;
}

export function ActionSidebar({
  sessionStatus,
  isTogglingSession,
  onToggleSession,
  onAskClick,
  onScreenshotClick,
  onTranscriptClick,
  onToggleVisibility,
  onSettingsEnter,
  onSettingsLeave,
  shortcuts = {},
  wasJustDragged = false,
}: ActionSidebarProps) {
  const getListenButtonText = (status: ListenSessionStatus) => {
    switch (status) {
      case 'beforeSession': return 'Listen';
      case 'inSession': return 'Stop';
      case 'afterSession': return 'Done';
      default: return 'Listen';
    }
  };

  const listenButtonText = getListenButtonText(sessionStatus);
  const isListening = listenButtonText === 'Stop';
  const hasCompleted = listenButtonText === 'Done';
  
  // Primary button states
  let primaryButtonClasses = 'w-11 h-11 mb-3 rounded-full flex items-center justify-center cursor-pointer transition-all border p-0 ';
  primaryButtonClasses += 'bg-primary/20 border-primary/40 text-primary-light ';
  primaryButtonClasses += 'hover:bg-primary/30 hover:scale-105 hover:shadow-[0_0_15px_rgba(130,81,255,0.3)] ';
  
  if (isListening) {
    primaryButtonClasses += '!bg-[rgba(255,120,180,0.28)] !border-[rgba(255,120,180,0.5)] !text-primary-active ';
  } else if (hasCompleted) {
    primaryButtonClasses += '!bg-[rgba(84,255,201,0.24)] !border-[rgba(84,255,201,0.5)] !text-primary-done ';
  }

  const iconButtonClasses = 'w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all text-white/80 bg-transparent border-none p-0 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed';

  const listenTitle = isListening ? '停止聆听' : hasCompleted ? '结束聆听' : '开始聆听';
  const askShortcutLabel = formatShortcutLabel(shortcuts.nextStep);
  const toggleShortcutLabel = formatShortcutLabel(shortcuts.toggleVisibility);

  const handleClick = (handler: () => void) => (e: React.MouseEvent) => {
    if (wasJustDragged) return;
    handler();
  };

  return (
    <div className="w-15 bg-white/[0.03] border-l border-white/[0.08] flex flex-col items-center pt-5 pb-5 gap-6 z-[2] backdrop-blur-[10px]">
      <button 
        className={primaryButtonClasses}
        onClick={handleClick(onToggleSession)}
        disabled={isTogglingSession}
        title={listenTitle}
        aria-label={listenTitle}
      >
        {isTogglingSession ? (
          <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin-slow"></div>
        ) : hasCompleted ? (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        ) : isListening ? (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="2" x2="12" y2="22"></line>
            <line x1="8" y1="6" x2="8" y2="18"></line>
            <line x1="4" y1="10" x2="4" y2="14"></line>
            <line x1="16" y1="6" x2="16" y2="18"></line>
            <line x1="20" y1="10" x2="20" y2="14"></line>
          </svg>
        )}
      </button>
      
      <button 
        className={iconButtonClasses}
        onClick={handleClick(onAskClick)}
        title={askShortcutLabel ? `Ask (${askShortcutLabel})` : 'Ask'}
        aria-label="Keyboard"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z" />
        </svg>
      </button>

      <button
        className={iconButtonClasses}
        onClick={handleClick(onScreenshotClick)}
        title="Screenshots"
        aria-label="Scissors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3h-3z" />
        </svg>
      </button>

      <button
        className={iconButtonClasses}
        onClick={handleClick(onTranscriptClick)}
        title="Show Transcript"
        aria-label="Chat"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          <path d="M7 9h10v2H7zm0-3h10v2H7z" />
        </svg>
      </button>
      
      <div className="flex-1"></div>

      <button 
        className={iconButtonClasses}
        onClick={handleClick(onToggleVisibility)}
        title={toggleShortcutLabel ? `Show/Hide (${toggleShortcutLabel})` : 'Show/Hide'}
        aria-label="Hidden"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
        </svg>
      </button>

      <button
        className={iconButtonClasses}
        onMouseEnter={onSettingsEnter}
        onMouseLeave={onSettingsLeave}
        aria-label="Menu"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>
    </div>
  );
}

