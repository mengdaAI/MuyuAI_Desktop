import React, { useEffect, useRef } from "react";
import { Turn } from "../types";
import { Frame1, Frame2, Frame3, Group4 } from "./icons";
import { HideWindowButton } from "./buttons/HideWindowButton";
import { Frame12 } from "./icons/Frame12";
import { SettingsPanel } from "./panels/SettingsPanel";
import { RecordingButton } from "./buttons/RecordingButton";
import { InputButton } from "./buttons/InputButton";
import { ScreenshotButton } from "./buttons/ScreenshotButton";
import { HistoryButton } from "./buttons/HistoryButton";
import { StatusIndicator } from "./ui/StatusIndicator";
import { InputPanel } from "./panels/InputPanel";
import { ScreenshotPanel } from "./panels/ScreenshotPanel";
import { HistoryPanel } from "./panels/HistoryPanel";
import svgPathsScreenshot from "../imports/svg-h6kjo5xaf0";

interface MainInterfaceProps {
  activePanel: 'input' | 'screenshot' | 'history' | null;
  showSettings: boolean;
  showScreenshotAnswer: boolean;
  inputValue: string;
  isRecording: boolean;
  position: { x: number; y: number };
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onToggleSettings: () => void;
  onToggleRecording: () => void;
  onToggleInputPanel: () => void;
  onToggleScreenshotPanel: () => void;
  onToggleHistoryPanel: () => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onScreenshotAnswer: () => void;
  onExitInterview: () => void;
  turns: Turn[];
}

export function MainInterface({
  activePanel,
  showSettings,
  showScreenshotAnswer,
  inputValue,
  isRecording,
  position,
  isDragging,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onToggleSettings,
  onToggleRecording,
  onToggleInputPanel,
  onToggleScreenshotPanel,
  onToggleHistoryPanel,
  onInputChange,
  onSend,
  onScreenshotAnswer,
  onExitInterview,
  turns,
}: MainInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div
        className="relative h-[600px]"
        style={{
          width: activePanel || showSettings ? '1200px' : '595px',
          transform: `translate(${position.x}px, ${position.y}px)`,
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <Frame1 />
        <Frame2 />
        <Group4 />
        <p className="absolute font-['PingFang_SC:Medium',sans-serif] leading-[normal] left-[442px] not-italic text-[12px] text-[rgba(255,255,255,0.6)] text-nowrap top-[436px] whitespace-pre">剩余 67分钟</p>
        <Frame3 />

        <StatusIndicator isRecording={isRecording} />

        {/* 侧边栏按钮 */}
        <HideWindowButton />
        <Frame12 onClick={onToggleSettings} />

        {/* 快捷键设置面板 */}
        {showSettings && (
          <SettingsPanel
            onClose={onToggleSettings}
            onExitInterview={onExitInterview}
          />
        )}

        {/* 右上角收音按钮 */}
        <RecordingButton
          isRecording={isRecording}
          onClick={onToggleRecording}
        />
        <InputButton onClick={onToggleInputPanel} isActive={activePanel === 'input'} />
        <ScreenshotButton onClick={onToggleScreenshotPanel} isActive={activePanel === 'screenshot'} />
        <HistoryButton onClick={onToggleHistoryPanel} isActive={activePanel === 'history'} />

        {/* 左侧内容区 */}
        <div 
          ref={scrollRef}
          className="absolute left-[93px] top-[96px] w-[420px] h-[400px] overflow-y-auto overflow-x-hidden pb-4" 
          style={{ scrollbarWidth: 'none' }}
        >
          {turns.length === 0 && (
            <p className="font-['PingFang_SC:Semibold',sans-serif] leading-[1.5] not-italic text-[rgba(255,255,255,0.7)] text-[14px] whitespace-pre-wrap">
              点击右侧按钮开始收音，回答将展示在此区域
            </p>
          )}
          {turns.map((turn) => (
            <div key={turn.id} className="flex flex-col gap-2 mb-4">
              {/* Them (Interviewer) */}
              {turn.question && (
                <div className="flex flex-row gap-2 items-start">
                  <div className="text-[rgba(255,255,255,0.9)] text-[14px] font-['PingFang_SC:Semibold',sans-serif] leading-relaxed whitespace-pre-wrap">
                    {turn.question}
                  </div>
                </div>
              )}
              
              {/* Me (AI) */}
              {turn.answer && (
                <div className="flex flex-row gap-2 items-start justify-end mt-1">
                  <div className="max-w-[90%] p-3 rounded-lg bg-[rgba(193,127,255,0.15)] text-white text-[14px] font-['PingFang_SC:Regular',sans-serif] leading-relaxed whitespace-pre-wrap border border-[rgba(193,127,255,0.3)]">
                    {turn.answer}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 右区域景 - 带动画 */}
        <div
          className={`absolute h-[393px] left-[601px] top-[78px] w-[458px] transition-all duration-300 ease-out ${activePanel ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
            }`}
          style={{
            pointerEvents: activePanel ? 'auto' : 'none',
            visibility: activePanel ? 'visible' : 'hidden'
          }}
        >
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 458 393">
            <g id="Rectangle 3">
              <path d={svgPathsScreenshot.p1c581180} fill="var(--fill-0, #030010)" fillOpacity="0.75" />
              <path d={svgPathsScreenshot.p17092832} stroke="var(--stroke-0, white)" strokeOpacity="0.2" />
            </g>
          </svg>
        </div>

        {/* 根据activePanel显示不同内容 - 带动画 */}
        <div
          className={`absolute left-[601px] top-[78px] w-[458px] transition-all duration-300 ease-out delay-75 ${activePanel ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
            }`}
          style={{
            pointerEvents: activePanel ? 'auto' : 'none',
            visibility: activePanel ? 'visible' : 'hidden'
          }}
        >
          {activePanel === 'history' && <HistoryPanel />}
          {activePanel === 'screenshot' && (
            <ScreenshotPanel
              showAnswer={showScreenshotAnswer}
              onAnswer={onScreenshotAnswer}
            />
          )}
          {activePanel === 'input' && (
            <InputPanel
              inputValue={inputValue}
              onInputChange={onInputChange}
              onSend={onSend}
            />
          )}
        </div>
      </div>
    </div>
  );
}

