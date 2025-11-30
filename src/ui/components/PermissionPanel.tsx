import React, { useState, useEffect, useCallback, useRef } from "react";

interface PermissionPanelProps {
  onComplete?: () => void;
  onClose?: () => void;
  continueCallback?: () => void;
}

type PermissionStatus = 'unknown' | 'granted' | 'denied' | 'not-determined' | 'restricted';

export default function PermissionPanel({ onComplete, onClose, continueCallback }: PermissionPanelProps) {
  const [microphoneGranted, setMicrophoneGranted] = useState<PermissionStatus>('unknown');
  const [screenGranted, setScreenGranted] = useState<PermissionStatus>('unknown');
  const [keychainGranted, setKeychainGranted] = useState<PermissionStatus>('unknown');
  const [isChecking, setIsChecking] = useState(false);
  const [userMode, setUserMode] = useState<'local' | 'firebase'>('local');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const userModeRef = useRef<'local' | 'firebase'>('local');
  const continueCallbackRef = useRef(continueCallback);
  const onCompleteRef = useRef(onComplete);
  const isCheckingRef = useRef(false);

  const isKeychainRequired = userMode === 'firebase';
  const keychainOk = !isKeychainRequired || keychainGranted === 'granted';
  const allGranted = microphoneGranted === 'granted' && screenGranted === 'granted' && keychainOk;

  // 更新 ref 以保持最新值
  useEffect(() => {
    userModeRef.current = userMode;
  }, [userMode]);

  useEffect(() => {
    continueCallbackRef.current = continueCallback;
  }, [continueCallback]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // 更新 isChecking ref
  useEffect(() => {
    isCheckingRef.current = isChecking;
  }, [isChecking]);

  // 使用 useRef 存储 checkPermissions 函数，避免依赖问题
  const checkPermissionsRef = useRef<() => Promise<void>>();

  checkPermissionsRef.current = async () => {
    if (!(window as any).api || isCheckingRef.current) {
      return;
    }

    isCheckingRef.current = true;
    setIsChecking(true);

    try {
      const permissions = await (window as any).api.permissionHeader.checkSystemPermissions();
      console.log('[PermissionPanel] Permission check result:', permissions);

      setMicrophoneGranted(prev => {
        if (prev !== permissions.microphone) {
          console.log('[PermissionPanel] Microphone permission changed:', prev, '->', permissions.microphone);
        }
        return permissions.microphone;
      });
      setScreenGranted(prev => {
        if (prev !== permissions.screen) {
          console.log('[PermissionPanel] Screen permission changed:', prev, '->', permissions.screen);
        }
        return permissions.screen;
      });
      setKeychainGranted(prev => {
        if (prev !== permissions.keychain) {
          console.log('[PermissionPanel] Keychain permission changed:', prev, '->', permissions.keychain);
        }
        return permissions.keychain;
      });

      // Check if all permissions are granted using ref to avoid dependency issues
      const currentUserMode = userModeRef.current;
      const isKeychainRequired = currentUserMode === 'firebase';
      const keychainOk = !isKeychainRequired || permissions.keychain === 'granted';

      if (permissions.microphone === 'granted' && 
          permissions.screen === 'granted' && 
          keychainOk && 
          (continueCallbackRef.current || onCompleteRef.current)) {
        console.log('[PermissionPanel] All permissions granted, proceeding automatically');
        setTimeout(() => {
          if (continueCallbackRef.current) {
            continueCallbackRef.current();
          } else if (onCompleteRef.current) {
            onCompleteRef.current();
          }
        }, 500);
      }
    } catch (error) {
      console.error('[PermissionPanel] Error checking permissions:', error);
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadUserState = async () => {
      if ((window as any).api && mounted) {
        try {
          const userState = await (window as any).api.common.getCurrentUser();
          if (mounted) {
            setUserMode(userState.mode);
          }
        } catch (e) {
          console.error('[PermissionPanel] Failed to get user state', e);
          if (mounted) {
            setUserMode('local');
          }
        }
      }
    };

    loadUserState();
    
    // 延迟执行第一次权限检查，避免立即触发
    const initialCheckTimeout = setTimeout(() => {
      if (mounted && checkPermissionsRef.current) {
        checkPermissionsRef.current();
      }
    }, 500);

    // Set up periodic permission check - 增加到 5 秒，减少刷新频率
    intervalRef.current = setInterval(async () => {
      if (!mounted || !(window as any).api) return;
      
      // 只在没有正在检查时才执行
      if (isCheckingRef.current) {
        console.log('[PermissionPanel] Skipping check, already in progress');
        return;
      }

      try {
        const userState = await (window as any).api.common.getCurrentUser();
        if (mounted) {
          setUserMode(prev => {
            if (prev !== userState.mode) {
              console.log('[PermissionPanel] User mode changed:', prev, '->', userState.mode);
            }
            return userState.mode;
          });
        }
      } catch (e) {
        if (mounted) {
          setUserMode('local');
        }
      }
      
      if (mounted && checkPermissionsRef.current) {
        checkPermissionsRef.current();
      }
    }, 5000); // 增加到 5 秒

    return () => {
      mounted = false;
      clearTimeout(initialCheckTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []); // 空依赖数组，只在挂载时执行一次

  // Calculate and notify height changes (only when layout actually changes)
  const prevHeightRef = useRef<number | null>(null);
  useEffect(() => {
    let newHeight = 430;

    if (isKeychainRequired && !keychainOk) {
      newHeight += 90;
    }

    if (allGranted) {
      newHeight += 70;
    }

    // 只在高度真正变化时才发送事件
    if (prevHeightRef.current !== newHeight) {
      console.log(`[PermissionPanel] Height changed from ${prevHeightRef.current}px to ${newHeight}px, requesting resize`);
      prevHeightRef.current = newHeight;
      
      // Dispatch custom event for parent component
      const event = new CustomEvent('request-resize', {
        detail: { height: newHeight },
        bubbles: true,
      });
      window.dispatchEvent(event);
    }
  }, [userMode, microphoneGranted, screenGranted, keychainGranted, isKeychainRequired, keychainOk, allGranted]);

  const handleMicrophoneClick = useCallback(async () => {
    if (!(window as any).api || microphoneGranted === 'granted') return;

    console.log('[PermissionPanel] Requesting microphone permission...');

    try {
      const result = await (window as any).api.permissionHeader.checkSystemPermissions();
      console.log('[PermissionPanel] Microphone permission result:', result);

      if (result.microphone === 'granted') {
        setMicrophoneGranted('granted');
        return;
      }

      if (['not-determined', 'denied', 'unknown', 'restricted'].includes(result.microphone)) {
        const res = await (window as any).api.permissionHeader.requestMicrophonePermission();
        if (res.status === 'granted' || res.success === true) {
          setMicrophoneGranted('granted');
          return;
        }
      }
    } catch (error) {
      console.error('[PermissionPanel] Error requesting microphone permission:', error);
    }
  }, [microphoneGranted]);

  const handleScreenClick = useCallback(async () => {
    if (!(window as any).api || screenGranted === 'granted') return;

    console.log('[PermissionPanel] Checking screen recording permission...');

    try {
      const permissions = await (window as any).api.permissionHeader.checkSystemPermissions();
      console.log('[PermissionPanel] Screen permission check result:', permissions);

      if (permissions.screen === 'granted') {
        setScreenGranted('granted');
        return;
      }

      if (['not-determined', 'denied', 'unknown', 'restricted'].includes(permissions.screen)) {
        console.log('[PermissionPanel] Opening screen recording preferences...');
        await (window as any).api.permissionHeader.openSystemPreferences('screen-recording');
      }
    } catch (error) {
      console.error('[PermissionPanel] Error opening screen recording preferences:', error);
    }
  }, [screenGranted]);

  const handleKeychainClick = useCallback(async () => {
    if (!(window as any).api || keychainGranted === 'granted') return;

    console.log('[PermissionPanel] Requesting keychain permission...');

    try {
      await (window as any).api.permissionHeader.initializeEncryptionKey();
      setKeychainGranted('granted');
    } catch (error) {
      console.error('[PermissionPanel] Error requesting keychain permission:', error);
    }
  }, [keychainGranted]);

  const handleContinue = useCallback(async () => {
    const keychainOk = !isKeychainRequired || keychainGranted === 'granted';

    if ((continueCallback || onComplete) &&
      microphoneGranted === 'granted' &&
      screenGranted === 'granted' &&
      keychainOk) {
      if ((window as any).api && isKeychainRequired) {
        try {
          await (window as any).api.permissionHeader.markKeychainCompleted();
          console.log('[PermissionPanel] Marked keychain as completed');
        } catch (error) {
          console.error('[PermissionPanel] Error marking keychain as completed:', error);
        }
      }

      if (continueCallback) {
        continueCallback();
      } else if (onComplete) {
        onComplete();
      }
    }
  }, [isKeychainRequired, keychainGranted, continueCallback, onComplete, microphoneGranted, screenGranted]);

  const handleClose = useCallback(() => {
    console.log('Close button clicked');
    if (onClose) {
      onClose();
    } else if ((window as any).api) {
      (window as any).api.common.quitApplication();
    }
  }, [onClose]);

  const micGranted = microphoneGranted === 'granted';
  const screenGrantedState = screenGranted === 'granted';
  const keychainGrantedState = keychainGranted === 'granted';

  // 计算容器高度
  let containerHeight = 308;
  if (isKeychainRequired && !keychainOk) {
    containerHeight += 90;
  }
  if (allGranted) {
    containerHeight += 70;
  }

  return (
    <div
      className="relative flex flex-col items-center w-[650px] rounded-[24px] overflow-hidden backdrop-blur-[40px] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
      style={{
        padding: '40px 50px 35px',
        background: 'linear-gradient(135deg, rgba(88, 70, 120, 0.85) 0%, rgba(70, 80, 130, 0.85) 50%, rgba(60, 70, 110, 0.85) 100%)',
        ['-webkit-app-region' as any]: 'drag',
        fontFamily: "'PingFang SC', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        userSelect: 'none',
      } as React.CSSProperties}
    >
      {/* 关闭按钮 */}
      <button
        onClick={handleClose}
        className="absolute top-5 right-5 w-7 h-7 rounded-full flex items-center justify-center z-10 transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          ['-webkit-app-region' as any]: 'no-drag',
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: 'rgba(255, 255, 255, 0.6)',
        } as React.CSSProperties}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.95)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
        }}
        title="关闭应用"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Header Section */}
      <div className="flex flex-col items-center mb-[35px]">
        <div className="flex items-center gap-3 mb-[18px]">
          <svg className="w-[38px] h-[38px]" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="url(#logo-gradient)" />
            <path d="M14 18L20 24L14 30M24 30H34" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="logo-gradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8B5CF6" />
                <stop offset="1" stopColor="#6366F1" />
              </linearGradient>
            </defs>
          </svg>
          <h1 className="text-white text-[26px] font-semibold m-0 text-center tracking-[0.5px]">慕语提问器</h1>
        </div>
        <p className="text-white/80 text-[12.5px] font-normal text-center m-0 leading-[1.6]">请为慕语提问器开启麦克风与屏幕获取权限后开始使用</p>
        </div>

      {/* Permissions List */}
      <div className="flex flex-col gap-5 w-full">
        {/* Microphone Permission */}
        <div className="flex items-center justify-between gap-6 w-full">
          <div className="flex items-center gap-[18px] flex-1">
            <div className="w-11 h-11 flex items-center justify-center rounded-[11px] flex-shrink-0 border border-white/15" style={{ background: 'rgba(255, 255, 255, 0.12)' }}>
              <svg className="w-[26px] h-[26px] text-white/90" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" />
              </svg>
            </div>
            <span className="text-white text-base font-medium tracking-[0.3px]">麦克风</span>
          </div>
        <button
            className={`min-w-[110px] h-[42px] px-7 rounded-[22px] text-white text-sm font-medium cursor-pointer transition-all duration-200 flex-shrink-0 ${micGranted ? 'cursor-default' : 'hover:-translate-y-[1px]'} active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed`}
          style={{
              ['-webkit-app-region' as any]: 'no-drag',
              background: micGranted ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              border: `1.5px solid ${micGranted ? 'rgba(34, 197, 94, 0.6)' : 'rgba(160, 140, 200, 0.5)'}`,
            } as React.CSSProperties}
            onClick={handleMicrophoneClick}
            disabled={micGranted}
            onMouseEnter={(e) => {
              if (!micGranted) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(180, 160, 220, 0.7)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(140, 120, 200, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!micGranted) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(160, 140, 200, 0.5)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {micGranted ? '✓ 已开启' : '开启权限'}
          </button>
        </div>

        {/* Screen Recording Permission */}
        <div className="flex items-center justify-between gap-6 w-full">
          <div className="flex items-center gap-[18px] flex-1">
            <div className="w-11 h-11 flex items-center justify-center rounded-[11px] flex-shrink-0 border border-white/15" style={{ background: 'rgba(255, 255, 255, 0.12)' }}>
              <svg className="w-[26px] h-[26px] text-white/90" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z" />
              </svg>
            </div>
            <span className="text-white text-base font-medium tracking-[0.3px]">屏幕</span>
          </div>
          <button
            className={`min-w-[110px] h-[42px] px-7 rounded-[22px] text-white text-sm font-medium cursor-pointer transition-all duration-200 flex-shrink-0 ${screenGrantedState ? 'cursor-default' : 'hover:-translate-y-[1px]'} active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed`}
            style={{
              ['-webkit-app-region' as any]: 'no-drag',
              background: screenGrantedState ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              border: `1.5px solid ${screenGrantedState ? 'rgba(34, 197, 94, 0.6)' : 'rgba(160, 140, 200, 0.5)'}`,
            } as React.CSSProperties}
            onClick={handleScreenClick}
            disabled={screenGrantedState}
            onMouseEnter={(e) => {
              if (!screenGrantedState) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(180, 160, 220, 0.7)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(140, 120, 200, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (!screenGrantedState) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(160, 140, 200, 0.5)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {screenGrantedState ? '✓ 已开启' : '开启权限'}
        </button>
      </div>

        {/* Keychain Permission (if required) */}
        {isKeychainRequired && (
          <>
            <div className="flex items-center justify-between gap-6 w-full">
              <div className="flex items-center gap-[18px] flex-1">
                <div className="w-11 h-11 flex items-center justify-center rounded-[11px] flex-shrink-0 border border-white/15" style={{ background: 'rgba(255, 255, 255, 0.12)' }}>
                  <svg className="w-[26px] h-[26px] text-white/90" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" />
          </svg>
        </div>
                <span className="text-white text-base font-medium tracking-[0.3px]">数据加密</span>
              </div>
        <button
                className={`min-w-[110px] h-[42px] px-7 rounded-[22px] text-white text-sm font-medium cursor-pointer transition-all duration-200 flex-shrink-0 ${keychainGrantedState ? 'cursor-default' : 'hover:-translate-y-[1px]'} active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed`}
          style={{
                  ['-webkit-app-region' as any]: 'no-drag',
                  background: keychainGrantedState ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                  border: `1.5px solid ${keychainGrantedState ? 'rgba(34, 197, 94, 0.6)' : 'rgba(160, 140, 200, 0.5)'}`,
                } as React.CSSProperties}
                onClick={handleKeychainClick}
                disabled={keychainGrantedState}
                onMouseEnter={(e) => {
                  if (!keychainGrantedState) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.borderColor = 'rgba(180, 160, 220, 0.7)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(140, 120, 200, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!keychainGrantedState) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(160, 140, 200, 0.5)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                {keychainGrantedState ? '✓ 已开启' : '开启权限'}
              </button>
            </div>
            {!keychainGrantedState && (
              <div className="text-white/70 text-xs text-center mt-2 leading-[1.6] max-w-[600px]">
                存储用于加密数据的密钥。请点击"<b className="text-white/95 font-semibold">始终允许</b>"以继续。
              </div>
            )}
          </>
        )}
      </div>

      {/* Continue Button */}
      {allGranted && (
        <div className="flex justify-center w-full mt-9">
          <button
            className="min-w-[200px] h-12 px-12 rounded-[24px] text-white text-[15px] font-semibold cursor-pointer transition-all duration-[250ms] relative overflow-hidden hover:-translate-y-[2px] active:translate-y-0 disabled:bg-white/20 disabled:cursor-not-allowed disabled:shadow-none"
            style={{
              ['-webkit-app-region' as any]: 'no-drag',
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(34, 197, 94, 0.85) 100%)',
              border: '1.5px solid rgba(34, 197, 94, 0.7)',
              boxShadow: '0 4px 16px rgba(34, 197, 94, 0.25)',
            } as React.CSSProperties}
            onClick={handleContinue}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 1) 0%, rgba(34, 197, 94, 0.95) 100%)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(34, 197, 94, 0.4)';
              e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(34, 197, 94, 0.85) 100%)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(34, 197, 94, 0.25)';
              e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.7)';
            }}
          >
            继续使用
        </button>
      </div>
      )}
    </div>
  );
}