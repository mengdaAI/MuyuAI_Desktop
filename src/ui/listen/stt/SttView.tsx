import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useIpcListener } from '../../hooks';

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
      return <div className="hidden"></div>;
    }

    return (
      <div 
        ref={containerRef}
        className="overflow-y-auto p-3 pb-4 flex flex-col gap-2 min-h-0 max-h-[600px] relative z-[1] flex-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {sttMessages.length === 0 ? (
          <div className="flex items-center justify-center h-[100px] text-white/60 text-xs italic">
            Waiting for speech...
          </div>
        ) : (
          sttMessages.map(msg => (
            <div 
              key={msg.id} 
              className={`
                px-3 py-2 rounded-muyu max-w-[80%] 
                break-words leading-relaxed text-base mb-1 box-border
                ${getSpeakerClass(msg.speaker) === 'me'
                  ? 'bg-muyu-blue-500 text-white self-end ml-auto rounded-br-sm'
                  : 'bg-muyu-dark-100 text-white/90 self-start mr-auto rounded-bl-sm'
                }
              `}
            >
              {msg.text}
            </div>
          ))
        )}
        
        {/* Custom scrollbar styles */}
        <style>{`
          .transcription-container::-webkit-scrollbar {
            width: 8px;
          }
          .transcription-container::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
            border-radius: 4px;
          }
          .transcription-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
          }
          .transcription-container::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
          }
        `}</style>
      </div>
    );
  }
);

SttView.displayName = 'SttView';

