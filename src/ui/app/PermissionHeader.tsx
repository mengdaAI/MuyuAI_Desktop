import React, { useState, useEffect, useCallback, useRef } from 'react';
import './PermissionHeader.css';

interface PermissionHeaderProps {
  continueCallback?: () => void;
}

type PermissionStatus = 'unknown' | 'granted' | 'denied' | 'not-determined' | 'restricted';

export function PermissionHeader({ continueCallback }: PermissionHeaderProps) {
  const [microphoneGranted, setMicrophoneGranted] = useState<PermissionStatus>('unknown');
  const [screenGranted, setScreenGranted] = useState<PermissionStatus>('unknown');
  const [keychainGranted, setKeychainGranted] = useState<PermissionStatus>('unknown');
  const [isChecking, setIsChecking] = useState(false);
  const [userMode, setUserMode] = useState<'local' | 'firebase'>('local');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isKeychainRequired = userMode === 'firebase';
  const keychainOk = !isKeychainRequired || keychainGranted === 'granted';
  const allGranted = microphoneGranted === 'granted' && screenGranted === 'granted' && keychainOk;

  const checkPermissions = useCallback(async () => {
    if (!window.api || isChecking) return;

    setIsChecking(true);

    try {
      const permissions = await window.api.permissionHeader.checkSystemPermissions();
      console.log('[PermissionHeader] Permission check result:', permissions);

      const prevMic = microphoneGranted;
      const prevScreen = screenGranted;
      const prevKeychain = keychainGranted;

      setMicrophoneGranted(permissions.microphone);
      setScreenGranted(permissions.screen);
      setKeychainGranted(permissions.keychain);

      if (prevMic !== permissions.microphone || prevScreen !== permissions.screen || prevKeychain !== permissions.keychain) {
        console.log('[PermissionHeader] Permission status changed, updating UI');
      }

      const keychainOk = !isKeychainRequired || permissions.keychain === 'granted';

      if (permissions.microphone === 'granted' && 
          permissions.screen === 'granted' && 
          keychainOk && 
          continueCallback) {
        console.log('[PermissionHeader] All permissions granted, proceeding automatically');
        setTimeout(() => handleContinue(), 500);
      }
    } catch (error) {
      console.error('[PermissionHeader] Error checking permissions:', error);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, microphoneGranted, screenGranted, keychainGranted, isKeychainRequired, continueCallback]);

  useEffect(() => {
    const loadUserState = async () => {
      if (window.api) {
        try {
          const userState = await window.api.common.getCurrentUser();
          setUserMode(userState.mode);
        } catch (e) {
          console.error('[PermissionHeader] Failed to get user state', e);
          setUserMode('local');
        }
      }
    };

    loadUserState();
    checkPermissions();

    // Set up periodic permission check
    intervalRef.current = setInterval(async () => {
      if (window.api) {
        try {
          const userState = await window.api.common.getCurrentUser();
          setUserMode(userState.mode);
        } catch (e) {
          setUserMode('local');
        }
      }
      checkPermissions();
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkPermissions]);

  // Calculate and notify height changes
  useEffect(() => {
    let newHeight = 430;

    if (isKeychainRequired && !keychainOk) {
      newHeight += 90;
    }

    if (allGranted) {
      newHeight += 70;
    }

    console.log(`[PermissionHeader] State changed, requesting resize to ${newHeight}px`);
    
    // Dispatch custom event for parent component
    const event = new CustomEvent('request-resize', {
      detail: { height: newHeight },
      bubbles: true,
    });
    window.dispatchEvent(event);
  }, [userMode, microphoneGranted, screenGranted, keychainGranted, isKeychainRequired, keychainOk, allGranted]);

  const handleMicrophoneClick = useCallback(async () => {
    if (!window.api || microphoneGranted === 'granted') return;

    console.log('[PermissionHeader] Requesting microphone permission...');

    try {
      const result = await window.api.permissionHeader.checkSystemPermissions();
      console.log('[PermissionHeader] Microphone permission result:', result);

      if (result.microphone === 'granted') {
        setMicrophoneGranted('granted');
        return;
      }

      if (['not-determined', 'denied', 'unknown', 'restricted'].includes(result.microphone)) {
        const res = await window.api.permissionHeader.requestMicrophonePermission();
        if (res.status === 'granted' || res.success === true) {
          setMicrophoneGranted('granted');
          return;
        }
      }
    } catch (error) {
      console.error('[PermissionHeader] Error requesting microphone permission:', error);
    }
  }, [microphoneGranted]);

  const handleScreenClick = useCallback(async () => {
    if (!window.api || screenGranted === 'granted') return;

    console.log('[PermissionHeader] Checking screen recording permission...');

    try {
      const permissions = await window.api.permissionHeader.checkSystemPermissions();
      console.log('[PermissionHeader] Screen permission check result:', permissions);

      if (permissions.screen === 'granted') {
        setScreenGranted('granted');
        return;
      }
      
      if (['not-determined', 'denied', 'unknown', 'restricted'].includes(permissions.screen)) {
        console.log('[PermissionHeader] Opening screen recording preferences...');
        await window.api.permissionHeader.openSystemPreferences('screen-recording');
      }
    } catch (error) {
      console.error('[PermissionHeader] Error opening screen recording preferences:', error);
    }
  }, [screenGranted]);

  const handleKeychainClick = useCallback(async () => {
    if (!window.api || keychainGranted === 'granted') return;

    console.log('[PermissionHeader] Requesting keychain permission...');

    try {
      await window.api.permissionHeader.initializeEncryptionKey();
      setKeychainGranted('granted');
    } catch (error) {
      console.error('[PermissionHeader] Error requesting keychain permission:', error);
    }
  }, [keychainGranted]);

  const handleContinue = useCallback(async () => {
    const keychainOk = !isKeychainRequired || keychainGranted === 'granted';

    if (continueCallback && 
        microphoneGranted === 'granted' && 
        screenGranted === 'granted' && 
        keychainOk) {
      if (window.api && isKeychainRequired) {
        try {
          await window.api.permissionHeader.markKeychainCompleted();
          console.log('[PermissionHeader] Marked keychain as completed');
        } catch (error) {
          console.error('[PermissionHeader] Error marking keychain as completed:', error);
        }
      }

      continueCallback();
    }
  }, [isKeychainRequired, keychainGranted, continueCallback, microphoneGranted, screenGranted]);

  const handleClose = useCallback(() => {
    console.log('Close button clicked');
    if (window.api) {
      window.api.common.quitApplication();
    }
  }, []);

  return (
    <div className="permission-header-container">
      <button className="close-button" onClick={handleClose} title="关闭应用">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <div className="header-section">
        <div className="logo">
          <svg className="logo-icon" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="url(#logo-gradient)" />
            <path d="M14 18L20 24L14 30M24 30H34" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="logo-gradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8B5CF6" />
                <stop offset="1" stopColor="#6366F1" />
              </linearGradient>
            </defs>
          </svg>
          <h1 className="title">慕语提问器</h1>
        </div>
        <p className="subtitle">请为慕语提问器开启麦克风与屏幕获取权限后开始使用</p>
      </div>

      <div className="permissions-list">
        {/* Microphone Permission */}
        <div className="permission-row">
          <div className="permission-info">
            <div className="permission-icon-wrapper">
              <svg className="permission-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
              </svg>
            </div>
            <span className="permission-label">麦克风</span>
          </div>
          <button 
            className={`permission-button ${microphoneGranted === 'granted' ? 'granted' : ''}`}
            onClick={handleMicrophoneClick}
            disabled={microphoneGranted === 'granted'}
          >
            {microphoneGranted === 'granted' ? '✓ 已开启' : '开启权限'}
          </button>
        </div>

        {/* Screen Recording Permission */}
        <div className="permission-row">
          <div className="permission-info">
            <div className="permission-icon-wrapper">
              <svg className="permission-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/>
              </svg>
            </div>
            <span className="permission-label">屏幕</span>
          </div>
          <button 
            className={`permission-button ${screenGranted === 'granted' ? 'granted' : ''}`}
            onClick={handleScreenClick}
            disabled={screenGranted === 'granted'}
          >
            {screenGranted === 'granted' ? '✓ 已开启' : '开启权限'}
          </button>
        </div>

        {/* Keychain Permission (if required) */}
        {isKeychainRequired && (
          <>
            <div className="permission-row">
              <div className="permission-info">
                <div className="permission-icon-wrapper">
                  <svg className="permission-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/>
                  </svg>
                </div>
                <span className="permission-label">数据加密</span>
              </div>
              <button 
                className={`permission-button ${keychainGranted === 'granted' ? 'granted' : ''}`}
                onClick={handleKeychainClick}
                disabled={keychainGranted === 'granted'}
              >
                {keychainGranted === 'granted' ? '✓ 已开启' : '开启权限'}
              </button>
            </div>
            {keychainGranted !== 'granted' && (
              <div className="keychain-hint">
                存储用于加密数据的密钥。请点击"<b>始终允许</b>"以继续。
              </div>
            )}
          </>
        )}
      </div>

      {allGranted && (
        <div className="continue-section">
          <button 
            className="continue-button" 
            onClick={handleContinue}
          >
            继续使用
          </button>
        </div>
      )}
    </div>
  );
}

