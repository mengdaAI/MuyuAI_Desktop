import React, { useEffect, useMemo, useRef } from "react";
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
  /** 剩余面试时长（分钟），由后端 summary 接口 remainingSeconds 计算（不在前端自行倒计时推算） */
  remainingMinutes?: number | null;
  inputValue: string;
  inputHistory?: { question: string; answer: string }[];
  isAnswering?: boolean;
  screenshotAnswer?: string;
  isScreenshotLoading?: boolean;
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
  onHideWindow: () => void;
  turns: Turn[];
}

export function MainInterface({
  activePanel,
  showSettings,
  showScreenshotAnswer,
  remainingMinutes,
  inputValue,
  inputHistory,
  isAnswering,
  screenshotAnswer,
  isScreenshotLoading,
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
  onHideWindow,
  turns,
}: MainInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  return (
    <div
      className="relative"
      style={{
        width: activePanel || showSettings ? activePanel ? 988 : 828 : 524,
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <Group4 />
      {typeof remainingMinutes === 'number' && remainingMinutes > 0 && (
        <p className="absolute font-['PingFang_SC:Medium',sans-serif] leading-[normal] top-[358px] left-[356px] not-italic text-[12px] text-[rgba(255,255,255,0.6)] text-nowrap whitespace-pre">
          剩余 {remainingMinutes} 分钟
        </p>
      )}
      <Frame3 />
      <StatusIndicator isRecording={isRecording} />
      <div className="absolute left-[475px] top-[16px] h-[361px] flex items-center flex-col justify-between z-10">
        <div className="flex items-center flex-col gap-[18px]">
          {/* 右上角收音按钮 */}
          <RecordingButton
            isRecording={isRecording}
            onClick={onToggleRecording}
          />
          <InputButton onClick={onToggleInputPanel} isActive={activePanel === 'input'} />
          <ScreenshotButton onClick={onToggleScreenshotPanel} isActive={activePanel === 'screenshot'} />
          <HistoryButton onClick={onToggleHistoryPanel} isActive={activePanel === 'history'} />

        </div>
        <div className="flex items-center flex-col gap-[18px]">
          {/* 侧边栏按钮 */}
          <HideWindowButton onClick={onHideWindow} />
          <Frame12 onClick={onToggleSettings} />
        </div>
      </div>
      {/* 快捷键设置面板 */}
      {showSettings && (
        <SettingsPanel
          onClose={onToggleSettings}
          onExitInterview={onExitInterview}
        />
      )}
      {/* 左侧内容区 */}
      <div
        ref={scrollRef}
        className="absolute left-[22px] top-[18px] w-[420px] h-[330px] overflow-y-auto overflow-x-hidden pb-4"
        style={{ scrollbarWidth: 'none' }}
      >
        {turns.length === 0 && (
          <p className="font-['PingFang_SC:Semibold',sans-serif] leading-[1.5] not-italic text-[rgba(255,255,255,0.7)] text-[14px] whitespace-pre-wrap">
            点击右侧按钮开始收音，回答将展示在此区域
          </p>
        )}
        {turns.map((turn) => {
          // Listen 区域只显示 "Them" (对方) 的问题和 AI 的回答
          if (turn.speaker === 'Me') return null;

          return (
            <div key={turn.id} className="flex flex-col gap-4 mb-6">
              {/* Them (Interviewer) */}
              {turn.question && (
                <div className="flex flex-col gap-1">
                  <div className="text-[rgba(255,255,255,0.4)] text-[12px] font-['PingFang_SC:Medium',sans-serif]">
                    对方发言
                  </div>
                  <div className="text-[rgba(255,255,255,0.9)] text-[14px] font-['PingFang_SC:Regular',sans-serif] leading-relaxed whitespace-pre-wrap">
                    {turn.question}
                  </div>
                </div>
              )}

              {/* Me (AI) */}
              {turn.answer && (
                <div className="flex flex-col gap-1">
                  <div className="text-[rgba(255,255,255,0.4)] text-[12px] font-['PingFang_SC:Medium',sans-serif]">
                    AI回答
                  </div>
                  <div className="text-[rgba(255,255,255,0.9)] text-[14px] font-['PingFang_SC:Regular',sans-serif] leading-relaxed whitespace-pre-wrap">
                    {turn.answer}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 右区域景 - 带动画 */}
      <div
        className={`absolute h-[393px] left-[530px] top-0 w-[458px] transition-all duration-300 ease-out ${activePanel ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
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
        className={`absolute left-[530px] top-0 w-[458px] transition-all duration-300 ease-out delay-75 ${activePanel ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
          }`}
        style={{
          pointerEvents: activePanel ? 'auto' : 'none',
          visibility: activePanel ? 'visible' : 'hidden'
        }}
      >
        {activePanel === 'history' && <HistoryPanel turns={turns} />}
        {activePanel === 'screenshot' && (
          <ScreenshotPanel
            answer={screenshotAnswer}
            isLoading={isScreenshotLoading}
            showAnswer={showScreenshotAnswer}
            onAnswer={onScreenshotAnswer}
          />
        )}
        {activePanel === 'input' && (
          <InputPanel
            inputValue={inputValue}
            history={inputHistory}
            isAnswering={isAnswering}
            onInputChange={onInputChange}
            onSend={onSend}
          />
        )}
      </div>
    </div>
  );
}

