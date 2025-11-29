import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useIpcListener } from '../../hooks';
import './SttView.css';

interface SttMessage {
  id: number;
  speaker: string;
  text: string;
  isPartial: boolean;
  isFinal: boolean;
}

interface SttViewProps {
  isVisible?: boolean;
  onMessagesUpdated?: (messages: SttMessage[]) => void;
}

export const SttView = React.forwardRef<{ resetTranscript: () => void }, SttViewProps>(
  ({ isVisible = true, onMessagesUpdated }, ref) => {
    const [sttMessages, setSttMessages] = useState<SttMessage[]>([]);
    const messageIdCounterRef = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const shouldScrollAfterUpdateRef = useRef(false);

    const scrollToBottom = useCallback(() => {
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      }, 0);
    }, []);

    const getSpeakerClass = useCallback((speaker: string) => {
      return speaker.toLowerCase() === 'me' ? 'me' : 'them';
    }, []);

    const resetTranscript = useCallback(() => {
      setSttMessages([]);
    }, []);

    // Expose resetTranscript via ref
    React.useImperativeHandle(ref, () => ({
      resetTranscript
    }));

    const handleSttUpdate = useCallback((event: any, payload: any) => {
      const { speaker, text, isFinal, isPartial } = payload;
      console.log('[SttView] Received update:', { speaker, text, isFinal });
      
      if (text === undefined) return;

      const container = containerRef.current;
      shouldScrollAfterUpdateRef.current = container
        ? container.scrollTop + container.clientHeight >= container.scrollHeight - 10
        : false;

      setSttMessages(prevMessages => {
        const findLastPartialIdx = (spk: string) => {
          for (let i = prevMessages.length - 1; i >= 0; i--) {
            const m = prevMessages[i];
            if (m.speaker === spk && m.isPartial) return i;
          }
          return -1;
        };

        const newMessages = [...prevMessages];
        const targetIdx = findLastPartialIdx(speaker);

        if (isPartial) {
          if (targetIdx !== -1) {
            newMessages[targetIdx] = {
              ...newMessages[targetIdx],
              text,
              isPartial: true,
              isFinal: false,
            };
          } else {
            newMessages.push({
              id: messageIdCounterRef.current++,
              speaker,
              text,
              isPartial: true,
              isFinal: false,
            });
          }
        } else if (isFinal) {
          if (targetIdx !== -1) {
            newMessages[targetIdx] = {
              ...newMessages[targetIdx],
              text,
              isPartial: false,
              isFinal: true,
            };
          } else {
            newMessages.push({
              id: messageIdCounterRef.current++,
              speaker,
              text,
              isPartial: false,
              isFinal: true,
            });
          }
        }

        return newMessages;
      });
    }, []);

    useIpcListener('sttView:onSttUpdate', handleSttUpdate);

    // Notify parent when messages update
    useEffect(() => {
      if (onMessagesUpdated) {
        onMessagesUpdated(sttMessages);
      }

      if (shouldScrollAfterUpdateRef.current) {
        scrollToBottom();
        shouldScrollAfterUpdateRef.current = false;
      }
    }, [sttMessages, onMessagesUpdated, scrollToBottom]);

    if (!isVisible) {
      return <div style={{ display: 'none' }}></div>;
    }

    return (
      <div className="transcription-container" ref={containerRef}>
        {sttMessages.length === 0 ? (
          <div className="empty-state">Waiting for speech...</div>
        ) : (
          sttMessages.map(msg => (
            <div key={msg.id} className={`stt-message ${getSpeakerClass(msg.speaker)}`}>
              {msg.text}
            </div>
          ))
        )}
      </div>
    );
  }
);

SttView.displayName = 'SttView';

