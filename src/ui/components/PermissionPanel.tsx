import React, { useState, useEffect, useCallback, useRef } from "react";
import svgPathsPermission from "../imports/svg-nskm8ew5pp";
import svgPathsStartup from "../imports/svg-7hkh1j06cm";
import { MuyuLogo } from "./MuyuLogo";

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
  const checkPermissionsRef = useRef<(() => Promise<void>) | null>(null);

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
      className="absolute h-[308px] left-1/2 top-[106px] translate-x-[-50%] w-[455px]"
      style={{
        ['-webkit-app-region' as any]: 'drag',
        fontFamily: "'PingFang SC', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        userSelect: 'none',
      } as React.CSSProperties}
    >
      {/* 背景 */}
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 455 308">
        <g id="Group 3">
          <g id="Rectangle 1">
            <rect fill="var(--fill-0, #030010)" fillOpacity="0.7" height="308" rx="19" width="455" />
            <rect height="307" rx="18.5" stroke={allGranted ? "var(--stroke-0, #C17FFF)" : "var(--stroke-0, white)"} strokeOpacity="0.2" width="454" x="0.5" y="0.5" />
          </g>
        </g>
      </svg>
      {/* 关闭按钮 */}
      <button
        onClick={handleClose}
        className="absolute left-[425px] top-[12px] size-[20px] cursor-pointer bg-transparent border-none p-0 z-10"
        style={{
          ['-webkit-app-region' as any]: 'no-drag',
        } as React.CSSProperties}
        title="关闭应用"
      >
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
          <path d={svgPathsStartup.p3be22e00} fill="var(--fill-0, white)" fillOpacity="0.2" />
        </svg>
      </button>

      {/* Logo */}
      <MuyuLogo
        svgPaths={svgPathsPermission}
        className="absolute h-[25.762px] left-[139px] top-[45px] w-[177px]"
      />

      {/* 说明文字 */}
      <p className="absolute font-['PingFang_SC:Regular',sans-serif] h-[21px] leading-[normal] left-[48px] not-italic text-[15px] text-white top-[88px] w-[360px]">
        请为幕语提词器开启麦克风与屏幕获取权限后开始使用
      </p>

      {/* 麦克风权限 */}
      <div className="absolute left-[35px] top-[152px] flex items-center h-[39px]">
        {/* 麦克风图标 */}
        <div className="size-[35px] flex items-center justify-center">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 35 35">
            <g id="Frame">
              <path d={svgPathsPermission.p28290880} fill="var(--fill-0, white)" fillOpacity="0.8" />
              <path d={svgPathsPermission.p3e227e00} fill="var(--fill-0, white)" fillOpacity="0.8" />
              <path d={svgPathsPermission.p72a380} fill="var(--fill-0, white)" fillOpacity="0.8" />
            </g>
          </svg>
        </div>

        {/* 麦克风文字 */}
        <p className="font-['PingFang_SC:Semibold',sans-serif] leading-[normal] ml-[6px] not-italic text-[18px] text-white">
          麦克风
        </p>

        {/* 麦克风按钮 */}
        <button
          onClick={micGranted ? undefined : handleMicrophoneClick}
          disabled={micGranted}
          className={`absolute h-[39px] left-[276px] rounded-[22px] top-0 w-[109px] flex items-center justify-center border border-solid ${micGranted ? 'cursor-default' : 'cursor-pointer hover:bg-[rgba(193,127,255,0.25)]'
            } transition-colors`}
          style={{
            ['-webkit-app-region' as any]: 'no-drag',
            backgroundColor: 'rgba(193,127,255,0.15)',
            borderColor: micGranted ? 'rgba(193,127,255,0.4)' : '#c17fff'
          } as React.CSSProperties}
        >
          <span
            className="font-['PingFang_SC:Semibold',sans-serif] not-italic text-[15px]"
            style={{
              color: micGranted ? 'rgba(220,185,255,0.4)' : '#dcb9ff'
            }}
          >
            {micGranted ? '已开启' : '开启权限'}
          </span>
        </button>
      </div>

      {/* 屏幕权限 */}
      <div className="absolute left-[35px] top-[216px] flex items-center h-[39px]">
        {/* 屏幕图标 */}
        <div className="w-[35px] h-[35px] flex items-center justify-center">
          <svg className="block w-[20px] h-[20px]" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
            <path d={svgPathsPermission.pc2bf780} fill="var(--fill-0, white)" fillOpacity="0.8" />
          </svg>
        </div>

        {/* 屏幕文字 */}
        <p className="font-['PingFang_SC:Semibold',sans-serif] leading-[normal] ml-[6px] not-italic text-[18px] text-white">
          屏幕
        </p>

        {/* 屏幕按钮 */}
        <button
          onClick={screenGrantedState ? undefined : handleScreenClick}
          disabled={screenGrantedState}
          className={`absolute h-[39px] left-[276px] rounded-[22px] top-0 w-[109px] flex items-center justify-center border border-solid ${screenGrantedState ? 'cursor-default' : 'cursor-pointer hover:bg-[rgba(193,127,255,0.25)]'
            } transition-colors`}
          style={{
            ['-webkit-app-region' as any]: 'no-drag',
            backgroundColor: 'rgba(193,127,255,0.15)',
            borderColor: screenGrantedState ? 'rgba(193,127,255,0.4)' : '#c17fff'
          } as React.CSSProperties}
        >
          <span
            className="font-['PingFang_SC:Semibold',sans-serif] not-italic text-[15px]"
            style={{
              color: screenGrantedState ? 'rgba(220,185,255,0.4)' : '#dcb9ff'
            }}
          >
            {screenGrantedState ? '已开启' : '开启权限'}
          </span>
        </button>
      </div>

      {/* Keychain Permission (if required) */}
      {isKeychainRequired && (
        <>
          <div className="absolute left-[35px] top-[280px] flex items-center h-[39px]">
            {/* Keychain 图标 - 使用简单的锁图标样式 */}
            <div className="w-[35px] h-[35px] flex items-center justify-center">
              <svg className="block w-[20px] h-[20px]" fill="none" preserveAspectRatio="none" viewBox="0 0 24 24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" fill="var(--fill-0, white)" fillOpacity="0.8" />
              </svg>
            </div>

            {/* Keychain 文字 */}
            <p className="font-['PingFang_SC:Semibold',sans-serif] leading-[normal] ml-[6px] not-italic text-[18px] text-white">
              数据加密
            </p>

            {/* Keychain 按钮 */}
            <button
              onClick={keychainGrantedState ? undefined : handleKeychainClick}
              disabled={keychainGrantedState}
              className={`absolute h-[39px] left-[276px] rounded-[22px] top-0 w-[109px] flex items-center justify-center border border-solid ${keychainGrantedState ? 'cursor-default' : 'cursor-pointer hover:bg-[rgba(193,127,255,0.25)]'
                } transition-colors`}
              style={{
                ['-webkit-app-region' as any]: 'no-drag',
                backgroundColor: 'rgba(193,127,255,0.15)',
                borderColor: keychainGrantedState ? 'rgba(193,127,255,0.4)' : '#c17fff'
              } as React.CSSProperties}
            >
              <span
                className="font-['PingFang_SC:Semibold',sans-serif] not-italic text-[15px]"
                style={{
                  color: keychainGrantedState ? 'rgba(220,185,255,0.4)' : '#dcb9ff'
                }}
              >
                {keychainGrantedState ? '已开启' : '开启权限'}
              </span>
            </button>
          </div>
          {!keychainGrantedState && (
            <div className="absolute left-[35px] top-[325px] text-white/70 text-xs leading-[1.6] w-[385px]">
              存储用于加密数据的密钥。请点击"<b className="text-white/95 font-semibold">始终允许</b>"以继续。
            </div>
          )}
        </>
      )}
    </div>
  );
}