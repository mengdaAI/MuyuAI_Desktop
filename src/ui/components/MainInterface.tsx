import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** 边沿按下后，超过该距离才判定是「缩放」还是「移动窗口」，避免与 useMainWindowDrag 冲突 */
const PENDING_RESIZE_THRESHOLD_PX = 5;

/**
 * 根据边沿与鼠标位移判断用户意图是否为调整窗口大小（而非拖动窗口）。
 * 顶/底边：垂直位移主导 → 缩放；左/右边：水平位移主导 → 缩放。
 * 角区：常见「拖走窗口」为斜向移动，用启发式与 min 分量区分。
 */
function shouldResizeIntent(edge: string, dx: number, dy: number): boolean {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  switch (edge) {
    case "top":
    case "bottom":
      return ay >= ax;
    case "left":
    case "right":
      return ax >= ay;
    case "top-left":
      if (dx > 2 && dy > 2) return false;
      return Math.min(ax, ay) >= 4;
    case "top-right":
      if (dx < -2 && dy > 2) return false;
      return Math.min(ax, ay) >= 4;
    case "bottom-left":
      if (dx > 2 && dy < -2) return false;
      return Math.min(ax, ay) >= 4;
    case "bottom-right":
      return Math.min(ax, ay) >= 4;
    default:
      return true;
  }
}

function createSyntheticMouseDownFromPending(
  e: MouseEvent,
  p: { startX: number; startY: number; target: EventTarget | null }
): React.MouseEvent {
  return {
    ...e,
    screenX: p.startX,
    screenY: p.startY,
    target: p.target,
    preventDefault: () => {},
    stopPropagation: () => {},
    button: 0,
    buttons: 1,
  } as unknown as React.MouseEvent;
}

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
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const isNearBottom = useCallback((element: HTMLDivElement) => {
    const thresholdPx = 24;
    return element.scrollHeight - (element.scrollTop + element.clientHeight) <= thresholdPx;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
    setAutoScrollEnabled(true);
    setShowScrollToBottom(false);
  }, []);

  const handleContentScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const atBottom = isNearBottom(container);
    if (atBottom) {
      setAutoScrollEnabled(true);
      setShowScrollToBottom(false);
      return;
    }
    setAutoScrollEnabled(false);
    setShowScrollToBottom(true);
  }, [isNearBottom]);

  useEffect(() => {
    if (!autoScrollEnabled) return;
    scrollToBottom();
  }, [turns, autoScrollEnabled, scrollToBottom]);

  // 基础宽度常量
  const BASE_LEFT_WIDTH = 524;
  const BASE_PANEL_WIDTH = 458;
  const BASE_SETTINGS_WIDTH = 298;
  const MIN_LEFT_WIDTH = 400; // 左侧最小宽度
  const MIN_PANEL_WIDTH = 458; // 右侧普通面板最小宽度
  const MIN_SETTINGS_WIDTH = 298; // 右侧设置面板最小宽度
  const GAP = 6;

  // 使用 ref 记录上一次的面板状态和左侧宽度，用于平滑过渡
  const prevPanelStateRef = useRef<{ activePanel: typeof activePanel; showSettings: boolean }>({
    activePanel: null,
    showSettings: false
  });
  const lastLeftWidthRef = useRef(BASE_LEFT_WIDTH);

  // 计算左侧宽度（Group4的宽度）和右侧面板宽度
  // 使用固定的面板宽度，避免展开/收起时的跳动
  const { leftWidth, rightPanelWidth } = useMemo(() => {
    const prevState = prevPanelStateRef.current;
    const wasPanelOpen = !!(prevState.activePanel || prevState.showSettings);
    const isPanelOpen = !!(activePanel || showSettings);
    
    // 检测面板状态是否刚刚变化
    const panelStateChanged = prevState.activePanel !== activePanel || prevState.showSettings !== showSettings;
    
    if (panelStateChanged) {
      // 面板状态变化时，使用上一次保存的左侧宽度，而不是从当前窗口宽度计算
      // 这样可以避免在窗口大小调整完成前出现跳动
      let currentLeftWidth: number;
      
      if (wasPanelOpen) {
        // 之前面板是打开的，从窗口宽度减去之前的面板宽度
        if (prevState.activePanel) {
          currentLeftWidth = windowSize.width - BASE_PANEL_WIDTH - GAP;
        } else if (prevState.showSettings) {
          currentLeftWidth = windowSize.width - BASE_SETTINGS_WIDTH - GAP;
        } else {
          currentLeftWidth = windowSize.width;
        }
      } else {
        // 之前面板是关闭的，窗口宽度就是左侧宽度
        currentLeftWidth = windowSize.width;
      }
      
      // 确保最小宽度
      currentLeftWidth = Math.max(MIN_LEFT_WIDTH, currentLeftWidth);
      lastLeftWidthRef.current = currentLeftWidth;
      
      // 更新 prevState
      prevPanelStateRef.current = { activePanel, showSettings };
      
      if (!isPanelOpen) {
        // 面板关闭，左侧宽度就是之前计算的值
        return { leftWidth: currentLeftWidth, rightPanelWidth: 0 };
      }
      
      // 面板打开，使用固定的面板宽度
      const fixedRightWidth = showSettings ? BASE_SETTINGS_WIDTH : BASE_PANEL_WIDTH;
      return {
        leftWidth: currentLeftWidth,
        rightPanelWidth: fixedRightWidth
      };
    }
    
    // 面板状态没有变化，正常计算
    if (!isPanelOpen) {
      lastLeftWidthRef.current = windowSize.width;
      return { leftWidth: windowSize.width, rightPanelWidth: 0 };
    }

    // 面板打开时，横向拉伸只调整右侧面板宽度，左侧保持不变
    // 使用上次保存的左侧宽度
    const savedLeftWidth = lastLeftWidthRef.current;
    
    // 右侧面板宽度 = 窗口宽度 - 左侧宽度 - 间距
    const calculatedRightWidth = windowSize.width - savedLeftWidth - GAP;
    
    // 确保右侧面板最小宽度（根据面板类型区分）
    const minRightWidth = showSettings ? MIN_SETTINGS_WIDTH : MIN_PANEL_WIDTH;
    const finalRightWidth = Math.max(minRightWidth, calculatedRightWidth);

    return {
      leftWidth: savedLeftWidth,
      rightPanelWidth: finalRightWidth
    };
  }, [windowSize.width, activePanel, showSettings]);

  // 直接使用计算值，避免额外的 state 和 useEffect 导致的跳动
  const containerWidth = leftWidth;
  const containerHeight = windowSize.height;

  const RESIZE_HANDLE_SIZE = 12; // 窗口边沿拖拽区域大小（像素）- 增大以提高捕获率
  const resizeStateRef = useRef<{ isResizing: boolean; edge: string | null; startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
  const pendingResizeRef = useRef<{
    edge: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    target: EventTarget | null;
  } | null>(null);

  // 计算当前状态下的最小窗口宽度
  const minWindowWidth = useMemo(() => {
    const isPanelOpen = !!(activePanel || showSettings);
    if (!isPanelOpen) {
      return 524; // 面板关闭时，最小宽度 524px
    }
    // 面板打开时，最小宽度 988px
    return 988;
  }, [activePanel, showSettings]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (pendingResizeRef.current && !resizeStateRef.current?.isResizing) {
        const p = pendingResizeRef.current;
        const dx = e.screenX - p.startX;
        const dy = e.screenY - p.startY;
        if (Math.hypot(dx, dy) < PENDING_RESIZE_THRESHOLD_PX) {
          return;
        }
        if (shouldResizeIntent(p.edge, dx, dy)) {
          resizeStateRef.current = {
            isResizing: true,
            edge: p.edge,
            startX: p.startX,
            startY: p.startY,
            startWidth: p.startWidth,
            startHeight: p.startHeight,
          };
          pendingResizeRef.current = null;
        } else {
          pendingResizeRef.current = null;
          onMouseDown(createSyntheticMouseDownFromPending(e, p));
          return;
        }
      }

      if (!resizeStateRef.current?.isResizing) return;

      const { edge, startX, startY, startWidth, startHeight } = resizeStateRef.current;
      const deltaX = e.screenX - startX;
      const deltaY = e.screenY - startY;

      if ((window.api?.headerController as any)?.resizeMainWindow) {
        (window.api.headerController as any).resizeMainWindow({ edge, deltaX, deltaY, startWidth, startHeight, minWidth: minWindowWidth });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (pendingResizeRef.current) {
        pendingResizeRef.current = null;
      }
      if (resizeStateRef.current?.isResizing) {
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
  }, [minWindowWidth, onMouseDown]);

  const handleResizeStart = (edge: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // 阻止默认行为，避免文本选择等

    // 先进入「待定缩放」：待 mousemove 超过阈值并判定为缩放意图后，才真正 isResizing
    // 否则转交给 onMouseDown，走移动窗口逻辑（修复边沿与拖动抢事件导致窗口被拉伸）
    pendingResizeRef.current = {
      edge,
      startX: e.screenX,
      startY: e.screenY,
      startWidth: windowSize.width,
      startHeight: windowSize.height,
      target: e.target,
    };
  };

  const renderAnswerWithHighlights = (
    answer: string,
    highlightRanges?: Turn['highlightRanges']
  ) => {
    if (!answer) {
      return null;
    }
    const ranges = Array.isArray(highlightRanges) ? highlightRanges : [];
    if (ranges.length === 0) {
      return answer;
    }
    const validRanges = ranges
      .filter((range) =>
        Number.isInteger(range.start) &&
        Number.isInteger(range.end) &&
        range.start >= 0 &&
        range.end > range.start &&
        range.end <= answer.length
      )
      .sort((a, b) => a.start - b.start || a.end - b.end);
    if (validRanges.length === 0) {
      return answer;
    }

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    validRanges.forEach((range, index) => {
      if (range.start < cursor) {
        return;
      }
      if (cursor < range.start) {
        nodes.push(
          <span key={`plain-${cursor}-${range.start}`}>
            {answer.slice(cursor, range.start)}
          </span>
        );
      }
      nodes.push(
        <mark
          key={`highlight-${index}-${range.start}`}
          style={{ backgroundColor: 'rgba(255, 214, 10, 0.35)', borderRadius: 2, padding: 0 }}
          title={`${range.type} (${Math.round((range.score || 0) * 100)}%)`}
        >
          {answer.slice(range.start, range.end)}
        </mark>
      );
      cursor = range.end;
    });
    if (cursor < answer.length) {
      nodes.push(<span key={`plain-tail-${cursor}`}>{answer.slice(cursor)}</span>);
    }
    return nodes;
  };

  return (
    <div
      className="relative flex items-center gap-[6px]"
      style={{
        width: 'fit-content',
        height: 'fit-content',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* 窗口边沿拖拽区域 - 用于调整窗口大小 */}
      {/* 上边沿 - 添加 pointer-events: none，除了鼠标悬停时 */}
      <div
        className="absolute top-0 left-0 right-0 z-[9999] pointer-events-none hover:pointer-events-auto"
        style={{
          height: `${RESIZE_HANDLE_SIZE}px`,
          cursor: 'ns-resize',
          WebkitAppRegion: 'no-drag'
        } as React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }}
        onMouseDown={(e) => handleResizeStart('top', e)}
      />
      {/* 下边沿 */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[9999] pointer-events-none hover:pointer-events-auto"
        style={{
          height: `${RESIZE_HANDLE_SIZE}px`,
          cursor: 'ns-resize',
          WebkitAppRegion: 'no-drag'
        } as React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }}
        onMouseDown={(e) => handleResizeStart('bottom', e)}
      />
      {/* 左边沿 */}
      <div
        className="absolute top-0 bottom-0 left-0 z-[9999] pointer-events-none hover:pointer-events-auto"
        style={{
          width: `${RESIZE_HANDLE_SIZE}px`,
          cursor: 'ew-resize',
          WebkitAppRegion: 'no-drag'
        } as React.CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' }}
        onMouseDown={(e) => handleResizeStart('left', e)}
      />
      {/* 右边沿 */}
      <div
        className="absolute top-0 bottom-0 right-0 z-[9999] pointer-events-none hover:pointer-events-auto"
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
      <div 
        className="absolute pr-[18px] pl-[18px] bottom-[18px] left-0 flex item-center justify-between"
        style={{ width: containerWidth - 62 }}
      >
        <StatusIndicator isRecording={isRecording} />
        {typeof remainingMinutes === 'number' && remainingMinutes > 0 && (
          <p className="flex items-center gap-[3px] font-['PingFang_SC:Medium',sans-serif] leading-[normal] not-italic text-[12px] text-[rgba(255,255,255,0.6)] text-nowrap whitespace-pre">
            <LeftTimeIcon />
            剩余 {remainingMinutes} 分钟
          </p>
        )}
      </div>
      <div
        className="absolute top-[16px] flex items-center flex-col justify-between z-10 pb-[6px]"
        style={{ left: containerWidth - 49, height: containerHeight - 32 }}
      >
        <div className="flex items-center flex-col gap-[18px]">
          {/* 右上角收音按钮 */}
          <RecordingButton
            isRecording={isRecording}
            disabled={!isRecording && (!remainingMinutes || remainingMinutes <= 0)}
            onClick={onToggleRecording}
          />
          <InputButton onClick={onToggleInputPanel} isActive={activePanel === 'input'} />
          <ScreenshotButton onClick={onToggleScreenshotPanel} isActive={activePanel === 'screenshot'} />
          <HistoryButton onClick={onToggleHistoryPanel} isActive={activePanel === 'history'} />

        </div>
        <div className="flex items-center flex-col gap-[18px]">
          {/* 侧边栏按钮 */}
          <div className="relative top-[6px]">
            <HideWindowButton onClick={onHideWindow} />
          </div>
          <div className="pt-[2px]">
            <Frame12 onClick={onToggleSettings} />
          </div>
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
        onScroll={handleContentScroll}
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
                    {renderAnswerWithHighlights(turn.answer, turn.highlightRanges)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {showScrollToBottom && (
        <button
          type="button"
          className="absolute z-20 rounded-full text-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.35)] transition hover:bg-[rgba(3,0,16,0.96)]"
          onClick={() => scrollToBottom('smooth')}
          style={{
            background: '#fff',
            color: '#000',
            padding: '3px 6px',
            bottom: '12px',
            right: '50%',
          }}
        >
          回到底部 ▼
        </button>
      )}

      {/* 根据activePanel显示不同内容 - 带动画 */}
      <div
        className={`rounded-[19px] relative transition-all duration-300 ease-out delay-75 ${activePanel || showSettings ? '' : 'hidden'}`}
        style={{
          pointerEvents: activePanel ? 'auto' : 'none',
          background: '#030010BF',
          width: rightPanelWidth,
          height: containerHeight,
          padding: '16px 22px',
          zIndex: 0,
        }}
      >
        {/* 右侧面板的边沿拖拽区域 */}
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

