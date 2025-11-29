import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WelcomeHeader } from '../components/WelcomeHeader';

type HeaderType = 'welcome' | 'apikey' | 'main' | 'permission';

interface HeaderControllerProps {
    containerRef: React.RefObject<HTMLDivElement>;
}

export function HeaderController({ containerRef }: HeaderControllerProps) {
    const [currentHeaderType, setCurrentHeaderType] = useState<HeaderType | null>(null);
    const [passcodeUnlocked, setPasscodeUnlocked] = useState(false);
    const [passcodeStatusChecked, setPasscodeStatusChecked] = useState(false);
    const [passcodeRequired, setPasscodeRequired] = useState(false);
    const [passcodeVerified, setPasscodeVerified] = useState(false);
    const [pendingUserState, setPendingUserState] = useState<any>(null);
    const [lastKnownUserState, setLastKnownUserState] = useState<any>(null);
    const [interviewStartTimestamp, setInterviewStartTimestamp] = useState<number | null>(null);

    // 用于渲染 Web Components 的容器 ref
    const webComponentContainerRef = useRef<HTMLDivElement>(null);

    // 通知主进程 header 状态变化
    const notifyHeaderState = useCallback((state: HeaderType) => {
        const normalizedState = state === 'permission' ? 'apikey' : state;
        (window as any).api?.headerController?.sendHeaderStateChanged(normalizedState);
    }, []);

    // 调整窗口大小
    const resizeForWelcome = useCallback(async () => {
        if (!(window as any).api) return;
        console.log('[HeaderController] _resizeForWelcome: Resizing window to 456x364');
        return (window as any).api.headerController?.resizeHeaderWindow({ width: 456, height: 364 }).catch(() => { });
    }, []);

    const resizeForApiKey = useCallback(async (height = 370) => {
        if (!(window as any).api) return;
        console.log(`[HeaderController] _resizeForApiKey: Resizing window to 456x${height}`);
        return (window as any).api.headerController?.resizeHeaderWindow({ width: 456, height }).catch(() => { });
    }, []);

    const resizeForPermissionHeader = useCallback(async (height: number) => {
        if (!(window as any).api) return;
        const finalHeight = height || 430;
        return (window as any).api.headerController?.resizeHeaderWindow({ width: 710, height: finalHeight }).catch(() => { });
    }, []);

    const resizeForMain = useCallback(async () => {
        if (!(window as any).api) return;
        const width = 72;
        const height = 700;
        console.log(`[HeaderController] _resizeForMain: Resizing window to ${width}x${height}`);
        return (window as any).api.headerController?.resizeHeaderWindow({ width, height }).catch(() => { });
    }, []);

    // 确保密码解锁
    const ensurePasscodeUnlocked = useCallback(async (): Promise<boolean> => {
        if (!(window as any).api?.passcode) {
            console.warn('[HeaderController] Passcode API not available, skipping gate');
            setPasscodeUnlocked(true);
            return true;
        }

        if (passcodeUnlocked) {
            return true;
        }

        if (passcodeStatusChecked && !passcodeUnlocked) {
            return false;
        }

        try {
            const status = await (window as any).api.passcode.getStatus();
            setPasscodeStatusChecked(true);
            const unlocked = !status?.required || !!status?.verified;
            setPasscodeUnlocked(unlocked);
            setPasscodeRequired(!!status?.required);
            setPasscodeVerified(!!status?.verified);

            if (!unlocked) {
                await resizeForWelcome();
                setCurrentHeaderType('welcome');
            }

            return unlocked;
        } catch (error) {
            console.error('[HeaderController] Failed to check passcode status:', error);
            setPasscodeUnlocked(false);
            setPasscodeStatusChecked(true);
            setPasscodeRequired(true);
            return false;
        }
    }, [passcodeUnlocked, passcodeStatusChecked, resizeForWelcome]);

    // 记录面试开始时间
    const recordInterviewStart = useCallback(() => {
        const timestamp = Date.now();
        setInterviewStartTimestamp(timestamp);

        if (typeof window !== 'undefined') {
            (window as any).__interviewStartTimestamp = timestamp;
            try {
                window.localStorage?.setItem('interviewStartTimestamp', String(timestamp));
            } catch (error) {
                console.warn('[HeaderController] Failed to cache interview start time:', error);
            }
            window.dispatchEvent?.(new CustomEvent('interview-started', { detail: { startTime: timestamp } }));
        }
        return timestamp;
    }, []);

    // 检查权限
    const checkPermissions = useCallback(async () => {
        if (!(window as any).api) {
            return { success: true };
        }

        try {
            const permissions = await (window as any).api.headerController?.checkSystemPermissions();
            if (!permissions) {
                return { success: false, error: 'Failed to check permissions' };
            }

            console.log('[HeaderController] Current permissions:', permissions);

            if (!permissions.needsSetup) {
                return { success: true };
            }

            let errorMessage = '';
            if (!permissions.microphone && !permissions.screen) {
                errorMessage = 'Microphone and screen recording access required';
            }

            return {
                success: false,
                error: errorMessage
            };
        } catch (error) {
            console.error('[HeaderController] Error checking permissions:', error);
            return {
                success: false,
                error: 'Failed to check permissions'
            };
        }
    }, []);

    // 转换到权限 header
    const transitionToPermissionHeader = useCallback(async () => {
        if (currentHeaderType === 'permission') {
            console.log('[HeaderController] Already showing permission setup, skipping transition');
            return;
        }

        if ((window as any).api) {
            try {
                const permissionsCompleted = await (window as any).api.headerController?.checkPermissionsCompleted();
                if (permissionsCompleted) {
                    console.log('[HeaderController] Permissions were previously completed, checking current status...');
                    const permissionResult = await checkPermissions();
                    if (permissionResult.success) {
                        await resizeForMain();
                        setCurrentHeaderType('main');
                        return;
                    }
                    console.log('[HeaderController] Permissions were revoked, showing setup again');
                }
            } catch (error) {
                console.error('[HeaderController] Error checking permissions completed status:', error);
            }
        }

        let initialHeight = 430;
        if ((window as any).api) {
            try {
                const userState = await (window as any).api.common?.getCurrentUser();
                if (userState?.mode === 'firebase') {
                    initialHeight = 520;
                }
            } catch (e) {
                console.error('Could not get user state for resize', e);
            }
        }

        await resizeForPermissionHeader(initialHeight);
        setCurrentHeaderType('permission');
        notifyHeaderState('permission');
    }, [currentHeaderType, checkPermissions, resizeForMain, resizeForPermissionHeader, notifyHeaderState]);

    // 应用用户状态
    const applyUserState = useCallback(async (userState: any) => {
        if (!(window as any).api?.apiKeyHeader) {
            setCurrentHeaderType('welcome');
            return;
        }

        const forceMain = await (window as any).api?.headerController?.isDebugForceMainHeader?.();
        if (forceMain) {
            await resizeForMain();
            setCurrentHeaderType('main');
            return;
        }

        const permissionResult = await checkPermissions();
        if (permissionResult.success) {
            await resizeForMain();
            setCurrentHeaderType('main');
        } else {
            await transitionToPermissionHeader();
        }
    }, [resizeForMain, checkPermissions, transitionToPermissionHeader]);

    // 处理用户状态更新
    const handleStateUpdate = useCallback(async (userState: any) => {
        setLastKnownUserState(userState);
        setPendingUserState(userState);

        const passcodeReady = await ensurePasscodeUnlocked();
        if (!passcodeReady) {
            return;
        }

        setPendingUserState(null);
        await applyUserState(userState);
    }, [ensurePasscodeUnlocked, applyUserState]);

    // 处理密码验证成功
    const handlePasscodeVerified = useCallback(async () => {
        console.log('[HeaderController] Passcode verified, resuming normal flow.');
        setPasscodeUnlocked(true);
        setPasscodeStatusChecked(true);
        setPasscodeRequired(false);
        setPasscodeVerified(true);
        recordInterviewStart();

        const nextState = pendingUserState || lastKnownUserState;
        if (nextState) {
            setPendingUserState(null);
            await handleStateUpdate(nextState);
            return;
        }

        if ((window as any).api) {
            const userState = await (window as any).api.common?.getCurrentUser();
            if (userState) {
                await handleStateUpdate(userState);
            }
        } else {
            setCurrentHeaderType('welcome');
        }
    }, [pendingUserState, lastKnownUserState, recordInterviewStart, handleStateUpdate]);

    // 转换到欢迎 header
    const transitionToWelcomeHeader = useCallback(async () => {
        if (currentHeaderType === 'welcome') {
            return resizeForWelcome();
        }
        await resizeForWelcome();
        setCurrentHeaderType('welcome');
        notifyHeaderState('welcome');
    }, [currentHeaderType, resizeForWelcome, notifyHeaderState]);

    // 转换到 API Key header
    const handleApiKeyOption = useCallback(async () => {
        console.log('[HeaderController] API key option selected');
        await resizeForApiKey(400);
        setCurrentHeaderType('apikey');
        notifyHeaderState('apikey');
    }, [resizeForApiKey, notifyHeaderState]);

    // 转换到主 header
    const transitionToMainHeader = useCallback(async () => {
        if (currentHeaderType === 'main') {
            return resizeForMain();
        }
        await resizeForMain();
        setCurrentHeaderType('main');
        notifyHeaderState('main');
    }, [currentHeaderType, resizeForMain, notifyHeaderState]);

    // 处理 Web Components 的渲染
    useEffect(() => {
        if (!webComponentContainerRef.current) return;

        const container = webComponentContainerRef.current;
        container.innerHTML = '';

        if (currentHeaderType === 'apikey') {
            const apikeyHeader = document.createElement('apikey-header');
            // 设置回调等
            if ('stateUpdateCallback' in apikeyHeader) {
                (apikeyHeader as any).stateUpdateCallback = (userState: any) => handleStateUpdate(userState);
            }
            if ('backCallback' in apikeyHeader) {
                (apikeyHeader as any).backCallback = () => transitionToWelcomeHeader();
            }
            container.appendChild(apikeyHeader);
        } else if (currentHeaderType === 'permission') {
            const permissionHeader = document.createElement('permission-setup');
            if ('continueCallback' in permissionHeader) {
                (permissionHeader as any).continueCallback = async () => {
                    if ((window as any).api?.headerController) {
                        console.log('[HeaderController] Re-initializing model state after permission grant...');
                        await (window as any).api.headerController.reInitializeModelState();
                    }
                    await transitionToMainHeader();
                };
            }
            container.appendChild(permissionHeader);
        } else if (currentHeaderType === 'main') {
            console.warn('[HeaderController] main header type not supported in this version');
        }
    }, [currentHeaderType, handleStateUpdate, transitionToWelcomeHeader, transitionToMainHeader]);

    // 初始化
    useEffect(() => {
        const bootstrap = async () => {
            if ((window as any).api) {
                const userState = await (window as any).api.common?.getCurrentUser();
                console.log('[HeaderController] Bootstrapping with initial user state:', userState);
                if (userState) {
                    await handleStateUpdate(userState);
                }
            } else {
                await resizeForWelcome();
                setCurrentHeaderType('welcome');
            }
        };

        bootstrap();

        // 监听用户状态变化
        if ((window as any).api?.headerController) {
            (window as any).api.headerController.onUserStateChanged((event: any, userState: any) => {
                console.log('[HeaderController] Received user state change:', userState);
                handleStateUpdate(userState);
            });

            (window as any).api.headerController.onAuthFailed((event: any, { message }: { message: string }) => {
                console.error('[HeaderController] Received auth failure from main process:', message);
            });

            (window as any).api.headerController.onForceShowApiKeyHeader(async () => {
                console.log('[HeaderController] Received broadcast to show apikey header. Switching now.');
                if (!(await ensurePasscodeUnlocked())) {
                    console.log('[HeaderController] Passcode gate active. Ignoring forced switch.');
                    return;
                }
                const isConfigured = await (window as any).api.apiKeyHeader?.areProvidersConfigured();
                if (!isConfigured) {
                    await resizeForWelcome();
                    setCurrentHeaderType('welcome');
                } else {
                    await resizeForApiKey();
                    setCurrentHeaderType('apikey');
                }
            });
        }
    }, [handleStateUpdate, ensurePasscodeUnlocked, resizeForWelcome, resizeForApiKey]);

    // 渲染不同的 header
    const renderHeader = () => {
        switch (currentHeaderType) {
            case 'welcome':
                return (
                    <WelcomeHeader
                        passcodeRequired={passcodeRequired}
                        passcodeVerified={passcodeVerified}
                        onPasscodeVerified={handlePasscodeVerified}
                    />
                );
            case 'apikey':
            case 'permission':
            case 'main':
                // 暂时使用 Web Components，后续可以逐步迁移
                return <div ref={webComponentContainerRef} style={{ width: '100%', height: '100%' }} />;
            default:
                return null;
        }
    };

    return (
        <div style={{ width: '100%', height: '100%' }}>
            {renderHeader()}
        </div>
    );
}
