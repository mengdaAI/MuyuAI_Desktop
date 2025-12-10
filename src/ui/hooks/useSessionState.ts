import { useState, useCallback } from 'react';
import type { ListenSessionStatus } from '../types';
import { useIpcListener } from './useIpcListener';

export function useSessionState() {
  const [listenSessionStatus, setListenSessionStatus] = useState<ListenSessionStatus>('beforeSession');
  const [isTogglingSession, setIsTogglingSession] = useState(false);

  const getListenButtonText = useCallback((status: ListenSessionStatus) => {
    switch (status) {
      case 'beforeSession': return 'Listen';
      case 'inSession': return 'Stop';
      case 'afterSession': return 'Done';
      default: return 'Listen';
    }
  }, []);

  const handleSessionResult = useCallback((event: any, { success }: { success: boolean }) => {
    console.log('[useSessionState] Session state update received:', { success, currentStatus: listenSessionStatus });
    if (success) {
      setListenSessionStatus(prev => {
        const statusMap: Record<ListenSessionStatus, ListenSessionStatus> = {
          beforeSession: 'inSession',
          inSession: 'afterSession',
          afterSession: 'beforeSession',
        };
        return statusMap[prev] || 'beforeSession';
      });
    } else {
      setListenSessionStatus('beforeSession');
    }
    setIsTogglingSession(false);
  }, [listenSessionStatus]);

  useIpcListener(
    window.api.mainHeader.onListenChangeSessionResult,
    window.api.mainHeader.removeOnListenChangeSessionResult,
    handleSessionResult,
    [handleSessionResult]
  );

  const toggleSession = useCallback(async () => {
    if (isTogglingSession) return;

    setIsTogglingSession(true);

    try {
      const listenButtonText = getListenButtonText(listenSessionStatus);
      const isStartingRecording = listenSessionStatus === 'beforeSession';
      const isStoppingRecording = listenSessionStatus === 'inSession';

      // Optimistic update for instant UI feedback
      const statusMap: Record<ListenSessionStatus, ListenSessionStatus> = {
        beforeSession: 'inSession',
        inSession: 'afterSession',
        afterSession: 'beforeSession',
      };
      const nextStatus: ListenSessionStatus = statusMap[listenSessionStatus] || 'beforeSession';

      setListenSessionStatus(nextStatus);
      console.log('[useSessionState] Optimistic status update:', listenSessionStatus, '→', nextStatus);

      // Reset loading state immediately after optimistic update
      setIsTogglingSession(false);

      if (window.api) {
        await window.api.mainHeader.sendListenButtonClick(listenButtonText);

        // 开始收音时启动心跳上报
        if (isStartingRecording) {
          console.log('[useSessionState] Starting recording heartbeat...');
          (window as any).api?.passcode?.startRecordingHeartbeat?.();
        }

        // 停止收音时停止心跳上报
        if (isStoppingRecording) {
          console.log('[useSessionState] Stopping recording heartbeat...');
          (window as any).api?.passcode?.stopRecordingHeartbeat?.();
        }
      }
    } catch (error) {
      console.error('IPC invoke for session change failed:', error);
      // On error, the backend response will reset the status correctly
      setIsTogglingSession(false);
    }
  }, [isTogglingSession, listenSessionStatus, getListenButtonText]);

  return {
    listenSessionStatus,
    isTogglingSession,
    toggleSession,
    getListenButtonText,
  };
}

