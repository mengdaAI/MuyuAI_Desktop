import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { LeftTimeIcon } from "../assets/Svg";

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
  windowSize?: { width: number; height: number };
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
  windowSize = { width: 524, height: 393 },
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

  // 计算左侧宽度（Group4的宽度）
  // 当面板打开时，左侧宽度 = 窗口宽度 - 右侧panel宽度 - 中间间距(6px)
  // 当面板关闭时，左侧宽度 = 窗口宽度
  // 左侧宽度最低为 524px（防止拖拽时过小）
  const leftWidth = useMemo(() => {
    let calculatedWidth: number;
    if (activePanel) {
      // activePanel 打开时，右侧panel宽度为 458px
      calculatedWidth = windowSize.width - 458 - 6;
    } else if (showSettings) {
      // showSettings 打开时，右侧panel宽度为 298px
      calculatedWidth = windowSize.width - 298 - 6;
    } else {
      // 面板关闭时，左侧宽度等于窗口宽度
      calculatedWidth = windowSize.width;
    }
    // 确保左侧宽度最低为 524px
    return Math.max(524, calculatedWidth);
  }, [windowSize.width, activePanel, showSettings]);

  // 使用 state 来存储容器大小，确保响应式更新
  const [containerSize, setContainerSize] = useState({
    width: leftWidth,
    height: windowSize.height
  });

  // 当左侧宽度或窗口高度变化时，更新 containerSize state
  useEffect(() => {
    setContainerSize({
      width: leftWidth,
      height: windowSize.height,
    });
    console.log('[MainInterface] Container size updated:', { leftWidth, windowSize });
  }, [leftWidth, windowSize.height]);

  const RESIZE_HANDLE_SIZE = 12; // 窗口边沿拖拽区域大小（像素）- 增大以提高捕获率
  const resizeStateRef = useRef<{ isResizing: boolean; edge: string | null; startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStateRef.current?.isResizing) return;

      const { edge, startX, startY, startWidth, startHeight } = resizeStateRef.current;
      const deltaX = e.screenX - startX;
      const deltaY = e.screenY - startY;

      if ((window.api?.headerController as any)?.resizeMainWindow) {
        (window.api.headerController as any).resizeMainWindow({ edge, deltaX, deltaY, startWidth, startHeight });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (resizeStateRef.current?.isResizing) {
        console.log('[MainInterface] Resize ended');
        resizeStateRef.current.isResizing = false;
        resizeStateRef.current.edge = null;
        // 清理主进程的 resize 状态
        if ((window.api?.headerController as any)?.clearResizeState) {
          (window.api.headerController as any).clearResizeState();
        }
      }
    };

    // 始终监听，但只在 isResizing 为 true 时处理
    // 使用 capture 模式确保能捕获到事件
    window.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('mouseup', handleMouseUp, true);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, []);

  const handleResizeStart = (edge: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // 不 preventDefault，让浏览器处理鼠标事件
    const mainDiv = e.currentTarget.closest('.relative') as HTMLElement;
    if (!mainDiv) return;

    resizeStateRef.current = {
      isResizing: true,
      edge,
      startX: e.screenX,
      startY: e.screenY,
      startWidth: mainDiv.offsetWidth,
      startHeight: mainDiv.offsetHeight,
    };

    console.log('[MainInterface] Resize started:', { edge, startX: e.screenX, startY: e.screenY, startWidth: mainDiv.offsetWidth, startHeight: mainDiv.offsetHeight });
  };

  // 使用 state 中的容器大小，确保响应式更新
  const containerWidth = containerSize.width;
  const containerHeight = containerSize.height;

  return (
    <div
      className="relative flex items-center gap-[6px]"
      style={{
        // width: containerWidth,
        // height: containerHeight,
        width: 'fit-content',
        height: 'fit-content',
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* 窗口边沿拖拽区域 - 用于调整窗口大小 */}
      {/* 上边沿 */}
      <div
        className="absolute top-0 left-0 right-0 z-[9999]"
        style={{
          height: `${RESIZE_HANDLE_SIZE}px`,
          cursor: 'ns-resize',
          WebkitAppRegion: 'no-drag'
        } as React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }}
        onMouseDown={(e) => handleResizeStart('top', e)}
      />
      {/* 下边沿 */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[9999]"
        style={{
          height: `${RESIZE_HANDLE_SIZE}px`,
          cursor: 'ns-resize',
          WebkitAppRegion: 'no-drag'
        } as React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }}
        onMouseDown={(e) => handleResizeStart('bottom', e)}
      />
      {/* 左边沿 */}
      <div
        className="absolute top-0 bottom-0 left-0 z-[9999]"
        style={{
          width: `${RESIZE_HANDLE_SIZE}px`,
          cursor: 'ew-resize',
          WebkitAppRegion: 'no-drag'
        } as React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }}
        onMouseDown={(e) => handleResizeStart('left', e)}
      />
      {/* 右边沿 */}
      <div
        className="absolute top-0 bottom-0 right-0 z-[9999]"
        style={{
          width: `${RESIZE_HANDLE_SIZE}px`,
          cursor: 'ew-resize',
          WebkitAppRegion: 'no-drag'
        } as React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }}
        onMouseDown={(e) => handleResizeStart('right', e)}
      />
      {/* 四个角 */}
      {/* 左上角 */}
      <div
        className="absolute top-0 left-0 z-[9999]"
        style={{
          width: `${RESIZE_HANDLE_SIZE}px`,
          height: `${RESIZE_HANDLE_SIZE}px`,
          cursor: 'nw-resize',
          WebkitAppRegion: 'no-drag'
        } as React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }}
        onMouseDown={(e) => handleResizeStart('top-left', e)}
      />
      {/* 右上角 */}
      <div
        className="absolute top-0 right-0 z-[9999]"
        style={{
          width: `${RESIZE_HANDLE_SIZE}px`,
          height: `${RESIZE_HANDLE_SIZE}px`,
          cursor: 'ne-resize',
          WebkitAppRegion: 'no-drag'
        } as React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }}
        onMouseDown={(e) => handleResizeStart('top-right', e)}
      />
      {/* 左下角 */}
      <div
        className="absolute bottom-0 left-0 z-[9999]"
        style={{
          width: `${RESIZE_HANDLE_SIZE}px`,
          height: `${RESIZE_HANDLE_SIZE}px`,
          cursor: 'sw-resize',
          WebkitAppRegion: 'no-drag'
        } as React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }}
        onMouseDown={(e) => handleResizeStart('bottom-left', e)}
      />
      {/* 右下角 */}
      <div
        className="absolute bottom-0 right-0 z-[9999]"
        style={{
          width: `${RESIZE_HANDLE_SIZE}px`,
          height: `${RESIZE_HANDLE_SIZE}px`,
          cursor: 'se-resize',
          WebkitAppRegion: 'no-drag'
        } as React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }}
        onMouseDown={(e) => handleResizeStart('bottom-right', e)}
      />
      <Group4 width={containerWidth} height={containerHeight} />
      <div className="absolute pr-[18px] pl-[18px] bottom-[18px] left-0 w-[462px] flex item-center justify-between">
        <StatusIndicator isRecording={isRecording} />
        {typeof remainingMinutes === 'number' && remainingMinutes > 0 && (
          <p className="flex items-center gap-[3px] font-['PingFang_SC:Medium',sans-serif] leading-[normal] not-italic text-[12px] text-[rgba(255,255,255,0.6)] text-nowrap whitespace-pre">
            <LeftTimeIcon />
            剩余 {remainingMinutes} 分钟
          </p>
        )}
      </div>
      <div
        className="absolute top-[16px] flex items-center flex-col justify-between z-10"
        style={{ left: containerWidth - 49, height: containerHeight - 32 }}
      >
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
          leftWidth={leftWidth}
        />
      )}
      {/* 左侧内容区 */}
      <div
        ref={scrollRef}
        className="absolute left-[22px] top-[18px] overflow-y-auto overflow-x-hidden pb-4"
        style={{ scrollbarWidth: 'none', width: containerWidth - 104, height: containerHeight - 63 }}
      >
        {turns.length === 0 && (
          <p className="font-['PingFang_SC:Semibold',sans-serif] leading-[1.5] not-italic text-[rgba(255,255,255,0.7)] text-[14px] whitespace-pre-wrap">
            {!remainingMinutes || remainingMinutes <= 0
              ? '剩余时长不足，请兑换后继续使用'
              : '点击右侧按钮开始收音，回答将展示在此区域'
            }
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

      {/* 根据activePanel显示不同内容 - 带动画 */}
      <div
        className={`rounded-[19px] relative w-[${showSettings ? 298 : 458}px] transition-all duration-300 ease-out delay-75 ${activePanel || showSettings ? '' : 'hidden'}`}
        style={{
          pointerEvents: activePanel ? 'auto' : 'none',
          background: '#030010BF',
          height: containerHeight,
          padding: '16px 22px',
        }}
      >
        {activePanel === 'history' && <HistoryPanel turns={turns} />}
        {activePanel === 'screenshot' && (
          <ScreenshotPanel
            answer={screenshotAnswer}
            isLoading={isScreenshotLoading}
            showAnswer={showScreenshotAnswer}
            remainingMinutes={remainingMinutes}
            onAnswer={onScreenshotAnswer}
          />
        )}
        {activePanel === 'input' && (
          <InputPanel
            inputValue={inputValue}
            history={inputHistory}
            isAnswering={isAnswering}
            remainingMinutes={remainingMinutes}
            onInputChange={onInputChange}
            onSend={onSend}
          />
        )}
      </div>
    </div>
  );
}

