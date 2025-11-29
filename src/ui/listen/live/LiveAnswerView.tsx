import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useIpcListener } from '../../hooks';
import './LiveAnswerView.css';

interface Turn {
  id: string;
  question: string;
  answer: string;
  status: 'in_progress' | 'completed' | 'error' | 'aborted';
  updatedAt: number;
  startedAt: number;
}

interface LiveAnswerViewProps {
  isVisible?: boolean;
  onUpdated?: (count: number) => void;
}

export const LiveAnswerView = React.forwardRef<{ getAnswersText: () => string }, LiveAnswerViewProps>(
  ({ isVisible = true, onUpdated }, ref) => {
    const [turns, setTurns] = useState<Turn[]>([]);
    const turnMapRef = useRef<Map<string, Turn>>(new Map());

    const sortTurns = useCallback(() => {
      return Array.from(turnMapRef.current.values())
        .filter(turn => turn.question && turn.question.trim().length > 0)
        .sort((a, b) => a.startedAt - b.startedAt);
    }, []);

    const notifyUpdated = useCallback(() => {
      if (onUpdated) {
        onUpdated(turns.length);
      }
    }, [onUpdated, turns.length]);

    const getAnswersText = useCallback(() => {
      if (!turns || turns.length === 0) return '';
      return turns
        .map(turn => {
          const q = turn.question || '';
          const a = turn.answer || '';
          return `Them: ${q}\nAI: ${a}`;
        })
        .join('\n\n');
    }, [turns]);

    // Expose getAnswersText via ref
    React.useImperativeHandle(ref, () => ({
      getAnswersText
    }));

    const handleTurnReset = useCallback(() => {
      turnMapRef.current.clear();
      setTurns([]);
      notifyUpdated();
    }, [notifyUpdated]);

    const handleTurnUpdate = useCallback((event: any, payload: any) => {
      console.log('[LiveAnswerView] Turn update:', payload);
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
        const incoming = payload.text.trim();
        if (!existing.question || payload.event === 'finalized') {
          existing.question = incoming;
        } else {
          existing.question = incoming;
        }
      }

      if (payload.event === 'finalized' || payload.status === 'completed') {
        existing.status = 'completed';
      } else {
        existing.status = 'in_progress';
      }
      existing.updatedAt = payload.timestamp || Date.now();

      turnMapRef.current.set(existing.id, existing);
      setTurns(sortTurns());
      notifyUpdated();
    }, [sortTurns, notifyUpdated]);

    const handleLiveAnswer = useCallback((event: any, payload: any) => {
      console.log('[LiveAnswerView] Live answer:', payload);
      if (!payload || !payload.turnId) return;

      const existing = turnMapRef.current.get(payload.turnId);
      if (!existing) return;

      if (payload.answer !== undefined) {
        existing.answer = payload.answer;
      } else if (payload.token) {
        existing.answer = (existing.answer || '') + payload.token;
      }

      if (payload.status === 'completed') {
        existing.status = 'completed';
      } else if (payload.status === 'error') {
        existing.status = 'error';
      } else if (payload.status === 'aborted') {
        existing.status = 'aborted';
      } else if (payload.status === 'streaming' || payload.status === 'started') {
        existing.status = 'in_progress';
      }

      existing.updatedAt = Date.now();
      turnMapRef.current.set(existing.id, existing);
      setTurns(sortTurns());
      notifyUpdated();
    }, [sortTurns, notifyUpdated]);

    useIpcListener('liveInsights:onTurnUpdate', handleTurnUpdate);
    useIpcListener('liveInsights:onLiveAnswer', handleLiveAnswer);
    useIpcListener('liveInsights:onTurnStateReset', handleTurnReset);

    // Load initial state
    useEffect(() => {
      if (!window.api?.liveInsights) return;

      window.api.liveInsights.getTurnState?.().then(state => {
        if (!state) return;
        const initialTurns: Turn[] = [];
        
        for (const entry of state.activeTurns || []) {
          if (entry.speaker !== 'Them') continue;
          const turn: Turn = {
            id: entry.id,
            question: entry.partialText || entry.finalText || '',
            answer: '',
            status: (entry.status as Turn['status']) || 'in_progress',
            updatedAt: entry.updatedAt || Date.now(),
            startedAt: entry.startedAt || Date.now(),
          };
          turnMapRef.current.set(turn.id, turn);
          initialTurns.push(turn);
        }
        
        for (const entry of state.turnHistory || []) {
          if (entry.speaker !== 'Them') continue;
          const turn: Turn = {
            id: entry.id,
            question: entry.finalText || entry.partialText || '',
            answer: '',
            status: (entry.status as Turn['status']) || 'completed',
            updatedAt: entry.completedAt || entry.updatedAt || Date.now(),
            startedAt: entry.startedAt || Date.now(),
          };
          turnMapRef.current.set(turn.id, turn);
          initialTurns.push(turn);
        }
        
        if (initialTurns.length > 0) {
          setTurns(sortTurns());
        }
      }).catch(() => { });
    }, [sortTurns]);

    const renderStatus = useCallback((turn: Turn) => {
      let statusText = '';
      let statusClass = 'status-dot';
      
      switch (turn.status) {
        case 'completed':
          statusText = 'Completed';
          statusClass += ' completed';
          break;
        case 'error':
          statusText = 'Error';
          statusClass += ' error';
          break;
        case 'aborted':
          statusText = 'Cancelled';
          statusClass += ' error';
          break;
        default:
          statusText = 'Listening...';
      }
      
      return (
        <div className="status-row">
          <span className={statusClass}></span>
          <span>{statusText}</span>
        </div>
      );
    }, []);

    if (!turns || turns.length === 0) {
      return (
        <div className="answers-container">
          <div className="empty-state">等待对方发言以生成实时洞察...</div>
        </div>
      );
    }

    const latestTurnId = turns[turns.length - 1]?.id;

    return (
      <div className="answers-container">
        {turns.map(turn => (
          <div
            key={turn.id}
            className={`turn-card ${turn.id === latestTurnId && turn.status !== 'completed' ? 'active' : ''}`}
          >
            <div>
              <div className="question-label">对方</div>
              <div className="question-text">{turn.question}</div>
            </div>
            <div>
              <div className="answer-label">Live Insights</div>
              <div className="answer-text">{turn.answer || '分析中...'}</div>
            </div>
            {renderStatus(turn)}
          </div>
        ))}
      </div>
    );
  }
);

LiveAnswerView.displayName = 'LiveAnswerView';

