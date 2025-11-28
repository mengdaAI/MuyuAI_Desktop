import React from "react";
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
}: MainInterfaceProps) {
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
        <p className="absolute font-['PingFang_SC:Semibold',sans-serif] leading-[normal] left-[93px] not-italic text-[rgba(255,255,255,0.7)] text-[14px] top-[96px] w-[420px]">点击右侧按钮开始收音，回答将展示在此区域</p>

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

