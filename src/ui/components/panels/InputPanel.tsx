import React, { useEffect, useRef } from "react";
import svgPaths from "../../imports/svg-apdjujtony";

interface InputPanelProps {
  inputValue: string;
  history?: { question: string; answer: string }[];
  isAnswering?: boolean;
  remainingMinutes?: number | null;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export function InputPanel({ inputValue, history = [], isAnswering = false, remainingMinutes, onInputChange, onSend }: InputPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isAnswering]);

  return (
    <>
      {/* 输入框区域 - 固定在顶部 */}
      <div className="absolute bg-[rgba(193,127,255,0.1)] h-[44px] left-[22px] rounded-[14px] top-[16px] w-[414px] z-10">
        <div aria-hidden="true" className="absolute border border-[#c17fff] border-solid inset-0 pointer-events-none rounded-[14px]" />
      </div>

      <div className="absolute flex flex-col font-['PingFang_SC:Regular',sans-serif] h-[22px] justify-center leading-[0] left-[40px] not-italic text-[15px] text-white top-[38px] translate-y-[-50%] w-[340px] z-20">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && inputValue.trim() && onSend()}
          className="bg-transparent border-none outline-none leading-[normal] text-white w-full placeholder:text-white placeholder:opacity-50"
          placeholder="输入你想问的任何问题"
        />
      </div>

      {/* 发送按钮 */}
      {inputValue.trim() && (
        <button
          onClick={onSend}
          className="absolute left-[401px] top-[27px] size-[21px] cursor-pointer bg-transparent border-none p-0 z-20"
          data-name="Vector"
        >
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 21 21">
            <path d={svgPaths.p1d306b00} fill="var(--fill-0, #C17FFF)" id="Vector" />
          </svg>
        </button>
      )}

      {/* 历史记录展示区域 */}
      <div
        ref={scrollRef}
        className="absolute left-[22px] top-[76px] w-[414px] h-[280px] overflow-y-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {history.length === 0 && (
          <p className="font-['PingFang_SC:Semibold',sans-serif] leading-[1.5] not-italic text-[#999999] text-[14px] whitespace-pre-wrap">
            {!remainingMinutes || remainingMinutes <= 0
              ? '剩余时长不足，请兑换后继续使用'
              : '此处将展示生成的回答...'
            }
          </p>
        )}

        {history.map((item, index) => (
          <div key={index} className="flex flex-col gap-4 mb-6">
            {/* 提问 */}
            <div className="flex flex-col gap-1">
              <div className="text-[#999999] text-[12px] font-['PingFang_SC:Medium',sans-serif]">
                提问
              </div>
              <div className="text-white text-[14px] font-['PingFang_SC:Regular',sans-serif] leading-relaxed whitespace-pre-wrap">
                {item.question}
              </div>
            </div>

            {/* AI回答 */}
            {(item.answer || (index === history.length - 1 && isAnswering)) && (
              <div className="flex flex-col gap-1">
                <div className="text-[#999999] text-[12px] font-['PingFang_SC:Medium',sans-serif]">
                  AI回答
                </div>
                <div className="text-white text-[14px] font-['PingFang_SC:Regular',sans-serif] leading-relaxed whitespace-pre-wrap">
                  {item.answer || (index === history.length - 1 && isAnswering ? "AI正在回答，请稍等..." : "")}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

