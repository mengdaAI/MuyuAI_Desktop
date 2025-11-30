import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWindowDrag, useInterviewTimer, useSessionState, useIpcListener } from '../hooks';
import { LiveAnswerPanel, StatusFooter, ActionSidebar } from './components';
import type { Shortcuts, Turn, UserState } from '../types';

export function MainView() {
  const { handleMouseDown, wasJustDragged } = useWindowDrag();
  const { interviewElapsedSeconds } = useInterviewTimer();
  const { listenSessionStatus, isTogglingSession, toggleSession } = useSessionState();
  
  const [shortcuts, setShortcuts] = useState({} as Shortcuts);
  const [totalInterviewSeconds, setTotalInterviewSeconds] = useState(0);
  const [turns, setTurns] = useState([] as Turn[]);
  const [scale, setScale] = useState(1);
  
  const turnMapRef = useRef(new Map() as Map<string, Turn>);
  const resizeObserverRef = useRef(null as ResizeObserver | null);
  const containerRef = useRef(null as HTMLDivElement | null);

  // Shortcuts listener
  const handleShortcutsUpdate = useCallback((event: any, keybinds: Shortcuts) => {
    console.log('[MainView] Received updated shortcuts:', keybinds);
    setShortcuts(keybinds);
  }, []);

  useIpcListener(
    window.api.mainHeader.onShortcutsUpdated,
    window.api.mainHeader.removeOnShortcutsUpdated,
    handleShortcutsUpdate,
    [handleShortcutsUpdate]
  );

  // User state listener for totalInterviewSeconds
  const handleUserStateChange = useCallback((event: any, userState: UserState) => {
    if (userState?.totalInterviewSeconds) {
      setTotalInterviewSeconds(userState.totalInterviewSeconds);
      console.log('[MainView] Updated totalInterviewSeconds:', userState.totalInterviewSeconds);
    }
  }, []);

  useIpcListener(
    window.api.common.onUserStateChanged,
    window.api.common.removeOnUserStateChanged,
    handleUserStateChange,
    [handleUserStateChange]
  );

  // Live Insights listeners
  const handleTurnReset = useCallback(() => {
    turnMapRef.current.clear();
    setTurns([]);
  }, []);

  const sortTurns = useCallback(() => {
    return (Array.from(turnMapRef.current.values()) as Turn[])
      .filter((turn: Turn) => turn.question && turn.question.trim().length > 0)
      .sort((a: Turn, b: Turn) => a.startedAt - b.startedAt);
  }, []);

  const handleTurnUpdate = useCallback((event: any, payload: any) => {
    console.log('[MainView] Turn update:', payload);
    if (!payload || payload.speaker !== 'Them') return;

    const existing = turnMapRef.current.get(payload.id) || {
      id: payload.id,
      question: '',
      answer: '',
      status: 'in_progress' as const,
      updatedAt: payload.timestamp || Date.now(),
      startedAt: payload.startedAt || payload.timestamp || Date.now(),
    };

    if (payload.text) {
      existing.question = payload.text.trim();
    }
    if (payload.event === 'finalized' || payload.status === 'completed') {
      existing.status = 'completed';
    } else {
      existing.status = 'in_progress';
    }
    existing.updatedAt = payload.timestamp || Date.now();

    turnMapRef.current.set(existing.id, existing);
    setTurns(sortTurns());
  }, [sortTurns]);

  const handleLiveAnswer = useCallback((event: any, payload: any) => {
    console.log('[MainView] Live answer:', payload);
    if (!payload || !payload.turnId) return;

    const existing = turnMapRef.current.get(payload.turnId);
    if (!existing) return;

    if (payload.answer !== undefined) {
      existing.answer = payload.answer;
    } else if (payload.token) {
      existing.answer = (existing.answer || '') + payload.token;
    }

    if (payload.status) {
      if (['completed', 'error', 'aborted'].includes(payload.status)) {
        existing.status = payload.status;
      } else if (['streaming', 'started'].includes(payload.status)) {
        existing.status = 'in_progress';
      }
    }

    existing.updatedAt = Date.now();
    turnMapRef.current.set(existing.id, existing);
    setTurns(sortTurns());
  }, [sortTurns]);

  useEffect(() => {
    if (!window.api.liveInsights) return;

    window.api.liveInsights.onTurnUpdate(handleTurnUpdate);
    window.api.liveInsights.onLiveAnswer(handleLiveAnswer);
    window.api.liveInsights.onTurnStateReset(handleTurnReset);

    // Initial fetch
    window.api.liveInsights.getTurnState?.().then(state => {
      if (!state) return;
      const newTurns: Turn[] = [];
      
      for (const entry of state.activeTurns || []) {
        if (entry.speaker !== 'Them') continue;
        const turn: Turn = {
          id: entry.id,
          question: entry.partialText || entry.finalText || '',
          answer: '',
          status: entry.status || 'in_progress',
          updatedAt: entry.updatedAt || Date.now(),
          startedAt: entry.startedAt || Date.now(),
        };
        turnMapRef.current.set(turn.id, turn);
        newTurns.push(turn);
      }
      
      for (const entry of state.turnHistory || []) {
        if (entry.speaker !== 'Them') continue;
        const turn: Turn = {
          id: entry.id,
          question: entry.finalText || entry.partialText || '',
          answer: '',
          status: entry.status || 'completed',
          updatedAt: entry.completedAt || entry.updatedAt || Date.now(),
          startedAt: entry.startedAt || Date.now(),
        };
        turnMapRef.current.set(turn.id, turn);
        newTurns.push(turn);
      }
      
      if (newTurns.length > 0) {
        setTurns(sortTurns());
      }
    }).catch(() => {});

    return () => {
      window.api.liveInsights?.removeOnTurnUpdate(handleTurnUpdate);
      window.api.liveInsights?.removeOnLiveAnswer(handleLiveAnswer);
      window.api.liveInsights?.removeOnTurnStateReset(handleTurnReset);
    };
  }, [handleTurnUpdate, handleLiveAnswer, handleTurnReset, sortTurns]);

  // Fetch initial user state
  useEffect(() => {
    window.api.common.getCurrentUser().then(userState => {
      if (userState?.totalInterviewSeconds) {
        setTotalInterviewSeconds(userState.totalInterviewSeconds);
        console.log('[MainView] Initial totalInterviewSeconds:', userState.totalInterviewSeconds);
      }
    }).catch(() => {});
  }, []);

  // Resize observer for responsive scaling
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect?.width || containerRef.current!.getBoundingClientRect().width || 524;
        const newScale = Math.max(0.75, Math.min(1.5, width / 524));
        setScale(newScale);
      }
    });

    observer.observe(containerRef.current);
    resizeObserverRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, []);

  // Button handlers
  const handleAskClick = useCallback(async () => {
    if (wasJustDragged) return;
    try {
      await window.api.mainHeader.sendAskButtonClick();
    } catch (error) {
      console.error('IPC invoke for ask button failed:', error);
    }
  }, [wasJustDragged]);

  const handleScreenshotClick = useCallback(async () => {
    if (wasJustDragged) return;
    try {
      await window.api?.screenshotView?.toggle?.();
    } catch (error) {
      console.error('Screenshot toggle failed:', error);
    }
  }, [wasJustDragged]);

  const handleTranscriptClick = useCallback(async () => {
    if (wasJustDragged) return;
    try {
      await window.api?.mainHeader?.toggleTranscriptView?.();
    } catch (error) {
      console.error('IPC invoke for transcript view failed:', error);
    }
  }, [wasJustDragged]);

  const handleToggleVisibility = useCallback(async () => {
    if (wasJustDragged) return;
    try {
      await window.api.mainHeader.sendToggleAllWindowsVisibility();
    } catch (error) {
      console.error('IPC invoke for all windows visibility button failed:', error);
    }
  }, [wasJustDragged]);

  const handleSettingsEnter = useCallback(() => {
    if (wasJustDragged) return;
    window.api.mainHeader.showSettingsWindow();
  }, [wasJustDragged]);

  const handleSettingsLeave = useCallback(() => {
    if (wasJustDragged) return;
    window.api.mainHeader.hideSettingsWindow();
  }, [wasJustDragged]);

  return (
    <div 
      ref={containerRef} 
      className="block w-full h-full text-white font-['PingFang_SC','Helvetica_Neue',-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif] overflow-hidden"
    >
      <div className="relative w-full h-full flex items-center justify-center bg-transparent">
        <div 
          className="relative w-[524px] h-[393px] flex flex-row rounded-muyu-lg overflow-hidden shadow-muyu-lg outline outline-1 outline-white/10"
          style={{ 
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            background: 'linear-gradient(180deg, rgba(30, 20, 40, 0.95), rgba(20, 10, 30, 0.98))'
          }}
          onMouseDown={handleMouseDown}
        >
          {/* Background gradient effects */}
          <div 
            className="absolute inset-0 pointer-events-none z-0" 
            style={{
              background: `
                radial-gradient(circle at 10% 20%, rgba(255, 100, 100, 0.15), transparent 40%),
                radial-gradient(circle at 90% 80%, rgba(100, 50, 200, 0.15), transparent 40%)
              `
            }}
          />

          <div className="flex-1 relative p-6 flex flex-col justify-between z-[1] overflow-hidden">
            <div className="flex-1 flex flex-col overflow-y-auto gap-3 min-h-0">
              <LiveAnswerPanel 
                turns={turns} 
                sessionStatus={listenSessionStatus}
              />
            </div>
            <StatusFooter 
              sessionStatus={listenSessionStatus}
              elapsedSeconds={interviewElapsedSeconds}
              totalInterviewSeconds={totalInterviewSeconds}
            />
          </div>

          <ActionSidebar
            sessionStatus={listenSessionStatus}
            isTogglingSession={isTogglingSession}
            onToggleSession={toggleSession}
            onAskClick={handleAskClick}
            onScreenshotClick={handleScreenshotClick}
            onTranscriptClick={handleTranscriptClick}
            onToggleVisibility={handleToggleVisibility}
            onSettingsEnter={handleSettingsEnter}
            onSettingsLeave={handleSettingsLeave}
            shortcuts={shortcuts}
            wasJustDragged={wasJustDragged}
          />
        </div>
      </div>
    </div>
  );
}

