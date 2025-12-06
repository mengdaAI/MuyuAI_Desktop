import React, { useEffect, useRef } from "react";
import { Turn } from "../../types";

interface HistoryPanelProps {
  turns?: Turn[];
}

export function HistoryPanel({ turns = [] }: HistoryPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  return (
    <div
      ref={scrollRef}
      className="w-[398px] h-[357px] overflow-y-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      {turns.length === 0 && (
        <p className="font-['PingFang_SC:Regular',sans-serif] leading-[20px] text-[14px] text-[rgba(255,255,255,0.6)] mt-4">
          暂无历史对话记录...
        </p>
      )}

      {turns.map((turn) => (
        <div key={turn.id} className={`flex flex-col gap-1 mb-4 ${turn.speaker === 'Me' ? 'items-end' : 'items-start'}`}>
          <div className={`text-[#999999] text-[12px] font-['PingFang_SC:Medium',sans-serif] ${turn.speaker === 'Me' ? 'mr-2' : 'ml-2'}`}>
            {turn.speaker === 'Me' ? '我' : '对方'}
          </div>
          <div className={`relative max-w-[90%] ${turn.speaker === 'Me' ? 'items-end' : 'items-start'}`}>
            <div className={`${turn.speaker === 'Me'
              ? 'bg-[rgba(193,127,255,0.4)] rounded-tr-none rounded-tl-[10px] rounded-br-[10px] rounded-bl-[10px]'
              : 'bg-[rgba(255,255,255,0.15)] rounded-tl-none rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px]'} 
                 px-3 py-2.5 min-w-[60px]`}>
              <p className="font-['PingFang_SC:Regular',sans-serif] text-[14px] text-white leading-relaxed whitespace-pre-wrap break-words">
                {turn.question}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

