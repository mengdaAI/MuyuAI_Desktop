import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWindowDrag, useInterviewTimer, useSessionState, useIpcListener } from '../hooks';
import { MainInterface } from './MainInterface';
import type { Shortcuts, Turn, UserState } from '../types';

export function MainInterfaceContainer() {
  // Core hooks
  const { handleMouseDown, wasJustDragged } = useWindowDrag();
  const { interviewElapsedSeconds } = useInterviewTimer();
  const { listenSessionStatus, isTogglingSession, toggleSession } = useSessionState();

  // UI State adapted for MainInterface
  const [activePanel, setActivePanel] = useState<'input' | 'screenshot' | 'history' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showScreenshotAnswer, setShowScreenshotAnswer] = useState(false);
  const [inputValue, setInputValue] = useState("");
  
  // Turns state
  const [turns, setTurns] = useState<Turn[]>([]);
  const turnMapRef = useRef<Map<string, Turn>>(new Map());

  const sortTurns = useCallback(() => {
    return (Array.from(turnMapRef.current.values()) as Turn[])
      .filter((turn: Turn) => turn.question && turn.question.trim().length > 0)
      .sort((a: Turn, b: Turn) => a.startedAt - b.startedAt);
  }, []);

  const handleTurnReset = useCallback(() => {
    turnMapRef.current.clear();
    setTurns([]);
  }, []);

  const handleTurnUpdate = useCallback((event: any, payload: any) => {
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

  // Register listeners
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
  
  // Additional state from original MainView
  const [shortcuts, setShortcuts] = useState({} as Shortcuts);
  const [totalInterviewSeconds, setTotalInterviewSeconds] = useState(0);
  
  // Refs
  const prevPanelOpen = useRef(false);

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

  // User state listener
  const handleUserStateChange = useCallback((event: any, userState: UserState) => {
    if (userState?.totalInterviewSeconds) {
      setTotalInterviewSeconds(userState.totalInterviewSeconds);
    }
  }, []);

  useIpcListener(
    window.api.common.onUserStateChanged,
    window.api.common.removeOnUserStateChanged,
    handleUserStateChange,
    [handleUserStateChange]
  );

  // Resize window when panel state changes
  useEffect(() => {
    const isPanelOpen = !!(activePanel || showSettings);
    
    if (prevPanelOpen.current !== isPanelOpen) {
      const width = isPanelOpen ? 1200 : 595;
      const height = 600;
      
      if (window.api?.headerController?.resizeHeaderWindow) {
        window.api.headerController.resizeHeaderWindow({ width, height }).catch(console.error);
      }
      
      prevPanelOpen.current = isPanelOpen;
    }
  }, [activePanel, showSettings]);

  // Handlers adapted for MainInterface
  const handleToggleRecording = useCallback(() => {
    toggleSession();
  }, [toggleSession]);

  const handleToggleSettings = useCallback(() => {
    if (!showSettings) {
      setActivePanel(null);
      setShowScreenshotAnswer(false);
    }
    setShowSettings(!showSettings);
  }, [showSettings]);

  const handleToggleInputPanel = useCallback(() => {
    if (activePanel === 'input') {
      setActivePanel(null);
    } else {
      setActivePanel('input');
      setShowScreenshotAnswer(false);
    }
  }, [activePanel]);

  const handleToggleScreenshotPanel = useCallback(() => {
    if (activePanel === 'screenshot') {
      setActivePanel(null);
      setShowScreenshotAnswer(false);
    } else {
      setActivePanel('screenshot');
      setShowScreenshotAnswer(false);
    }
  }, [activePanel]);

  const handleToggleHistoryPanel = useCallback(() => {
    if (activePanel === 'history') {
      setActivePanel(null);
    } else {
      setActivePanel('history');
    }
  }, [activePanel]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const handleSend = useCallback(async () => {
    if (inputValue.trim()) {
      console.log('[MainView] Sending input:', inputValue);
      setInputValue("");
    }
  }, [inputValue]);

  const handleScreenshotAnswer = useCallback(() => {
    setShowScreenshotAnswer(true);
  }, []);

  const handleExitInterview = useCallback(() => {
    if (window.api?.common?.quitApplication) {
      window.api.common.quitApplication();
    }
  }, []);

  // Initialize window size on mount
  useEffect(() => {
    if (window.api?.headerController?.resizeHeaderWindow) {
      window.api.headerController.resizeHeaderWindow({ width: 595, height: 600 }).catch(console.error);
    }
  }, []);

  return (
    <MainInterface
      activePanel={activePanel}
      showSettings={showSettings}
      showScreenshotAnswer={showScreenshotAnswer}
      inputValue={inputValue}
      isRecording={listenSessionStatus === 'inSession'}
      position={{ x: 0, y: 0 }}
      isDragging={false}
      onMouseDown={handleMouseDown}
      onMouseMove={() => {}}
      onMouseUp={() => {}}
      onToggleSettings={handleToggleSettings}
      onToggleRecording={handleToggleRecording}
      onToggleInputPanel={handleToggleInputPanel}
      onToggleScreenshotPanel={handleToggleScreenshotPanel}
      onToggleHistoryPanel={handleToggleHistoryPanel}
      onInputChange={handleInputChange}
      onSend={handleSend}
      onScreenshotAnswer={handleScreenshotAnswer}
      onExitInterview={handleExitInterview}
      turns={turns}
    />
  );
}
