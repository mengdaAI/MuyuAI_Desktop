import React from 'react';
import type { Turn } from '../../types';

interface LiveAnswerPanelProps {
  turns: Turn[];
  sessionStatus: 'beforeSession' | 'inSession' | 'afterSession';
}

export function LiveAnswerPanel({ turns, sessionStatus }: LiveAnswerPanelProps) {
  const renderStatus = (turn: Turn) => {
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
      <div className="live-answer-view">
        {(!turns || turns.length === 0) ? (
          <div className="live-empty-state">等待对方发言...</div>
        ) : (
          turns.map(turn => {
            const latestTurnId = turns[turns.length - 1]?.id;
            const isActive = turn.id === latestTurnId && turn.status !== 'completed';
            
            return (
              <div key={turn.id} className={`turn-card ${isActive ? 'active' : ''}`}>
                <div>
                  <div className="question-label">对方发言</div>
                  <div className="question-text">{turn.question}</div>
                </div>
                <div>
                  <div className="answer-label">AI回答</div>
                  <div className="answer-text">{turn.answer || '分析中...'}</div>
                </div>
                {renderStatus(turn)}
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="status-header">{stateCopy.headline}</div>
  );
}

