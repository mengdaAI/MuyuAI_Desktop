import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useIpcListener } from '../../hooks';

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
      let dotClass = 'w-2 h-2 rounded-full';
      
      switch (turn.status) {
        case 'completed':
          statusText = 'Completed';
          dotClass += ' bg-[rgba(46,204,113,0.7)]';
          break;
        case 'error':
          statusText = 'Error';
          dotClass += ' bg-[rgba(231,76,60,0.75)]';
          break;
        case 'aborted':
          statusText = 'Cancelled';
          dotClass += ' bg-[rgba(231,76,60,0.75)]';
          break;
        default:
          statusText = 'Listening...';
          dotClass += ' bg-[rgba(0,122,255,0.6)] animate-pulse-slow';
      }
      
      return (
        <div className="flex items-center gap-2 text-white/55 text-2xs">
          <span className={dotClass}></span>
          <span>{statusText}</span>
        </div>
      );
    }, []);

    if (!turns || turns.length === 0) {
      return (
        <div className="flex flex-col gap-3 p-3 pr-4 pb-4 h-full max-h-none overflow-y-auto box-border">
          <div className="flex items-center justify-center min-h-[150px] text-white/60 text-sm italic px-3">
            等待对方发言以生成实时洞察...
          </div>
        </div>
      );
    }

    const latestTurnId = turns[turns.length - 1]?.id;

    return (
      <div className="flex flex-col gap-3 p-3 pr-4 pb-4 h-full max-h-none overflow-y-auto box-border">
        {turns.map(turn => (
          <div
            key={turn.id}
            className={`
              bg-black/35 rounded-muyu p-3 px-3.5 
              border border-white/[0.06] flex flex-col gap-2.5
              ${turn.id === latestTurnId && turn.status !== 'completed' 
                ? 'border-blue-500/55 shadow-[0_0_12px_rgba(0,122,255,0.25)]' 
                : ''
              }
            `}
          >
            <div>
              <div className="text-2xs uppercase tracking-wider text-white/55">对方</div>
              <div className="text-base text-white/92 leading-[1.45] whitespace-pre-wrap">
                {turn.question}
              </div>
            </div>
            <div>
              <div className="text-2xs uppercase tracking-wider text-white/55">Live Insights</div>
              <div className="text-sm text-white/88 leading-relaxed whitespace-pre-wrap">
                {turn.answer || '分析中...'}
              </div>
            </div>
            {renderStatus(turn)}
          </div>
        ))}
        
        {/* Custom scrollbar styles */}
        <style>{`
          .answers-container::-webkit-scrollbar {
            width: 8px;
          }
          .answers-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.08);
            border-radius: 4px;
          }
          .answers-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.25);
            border-radius: 4px;
          }
          .answers-container::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.4);
          }
        `}</style>
      </div>
    );
  }
);

LiveAnswerView.displayName = 'LiveAnswerView';

