import { useRef, useCallback, useState } from 'react';
import type { HeaderPosition } from '../types';

interface DragState {
  initialMouseX: number;
  initialMouseY: number;
  initialWindowX: number;
  initialWindowY: number;
  moved: boolean;
}

export function useMainWindowDrag() {
  const dragStateRef = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [wasJustDragged, setWasJustDragged] = useState(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStateRef.current) return;

    const deltaX = Math.abs(e.screenX - dragStateRef.current.initialMouseX);
    const deltaY = Math.abs(e.screenY - dragStateRef.current.initialMouseY);

    if (deltaX > 3 || deltaY > 3) {
      dragStateRef.current.moved = true;
    }

    const newWindowX = dragStateRef.current.initialWindowX + (e.screenX - dragStateRef.current.initialMouseX);
    const newWindowY = dragStateRef.current.initialWindowY + (e.screenY - dragStateRef.current.initialMouseY);

    window.api.mainHeader.moveMainWindowTo(newWindowX, newWindowY);
  }, []);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!dragStateRef.current) return;

    const wasDragged = dragStateRef.current.moved;

    window.removeEventListener('mousemove', handleMouseMove, { capture: true } as any);
    dragStateRef.current = null;
    setIsDragging(false);
    
    // 通知主进程拖动结束
    if (window.api?.common?.sendIpcEvent) {
      window.api.common.sendIpcEvent('window:drag-end');
    }

    if (wasDragged) {
      setWasJustDragged(true);
      // 500ms 后重置 wasJustDragged 状态
      setTimeout(() => setWasJustDragged(false), 500);
    }
  }, [handleMouseMove]);

  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    // Ignore mousedown originating from interactive controls
    const target = e.target as HTMLElement;
    const interactiveSelector = '.icon-btn, .rail-button, button, input, select, a, svg';

    if (target.closest(interactiveSelector) || ['BUTTON', 'INPUT', 'SELECT', 'A', 'SVG'].includes(target.tagName)) {
      return;
    }

    e.preventDefault();
    setWasJustDragged(false);

    // 获取main窗口的初始位置（因为我们只在main状态下使用这个hook）
    const initialPosition = window.api.mainHeader.getMainWindowPosition();

    dragStateRef.current = {
      initialMouseX: e.screenX,
      initialMouseY: e.screenY,
      initialWindowX: initialPosition.x,
      initialWindowY: initialPosition.y,
      moved: false,
    };

    setIsDragging(true);
    
    // 通知主进程拖动开始
    if (window.api?.common?.sendIpcEvent) {
      window.api.common.sendIpcEvent('window:drag-start');
    }

    window.addEventListener('mousemove', handleMouseMove, { capture: true } as any);
    window.addEventListener('mouseup', handleMouseUp, { once: true, capture: true } as any);
  }, [handleMouseMove, handleMouseUp]);

  return {
    handleMouseDown,
    wasJustDragged,
    isDragging,
  };
}
