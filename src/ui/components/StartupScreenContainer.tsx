import React, { useState, useEffect } from 'react';
import { StartupScreen } from './StartupScreen';

interface StartupScreenContainerProps {
    passcodeRequired?: boolean;
    passcodeVerified?: boolean;
    onPasscodeVerified?: () => void;
    onContentChanged?: () => void;
}

export function StartupScreenContainer({
    passcodeRequired = false,
    passcodeVerified = false,
    onPasscodeVerified,
    onContentChanged,
}: StartupScreenContainerProps) {
    const [passcodeValue, setPasscodeValue] = useState('');
    const [passcodeError, setPasscodeError] = useState('');
    const [showRechargeLink, setShowRechargeLink] = useState(false);
    const [isVerifyingPasscode, setIsVerifyingPasscode] = useState(false);

    useEffect(() => {
        onContentChanged?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [passcodeValue, passcodeError, passcodeVerified, isVerifyingPasscode, showRechargeLink]);

    const passcodeGateActive = passcodeRequired && !passcodeVerified;

    const handlePasscodeInput = (value: string) => {
        const sanitized = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
        setPasscodeValue(sanitized);
        setPasscodeError('');
        setShowRechargeLink(false);
    };

    const handlePasscodeSubmit = async () => {
        if (!passcodeGateActive) {
            onPasscodeVerified?.();
            return;
        }

        const code = (passcodeValue || '').trim();
        if (!/^[A-Za-z0-9]{8}$/.test(code)) {
            setPasscodeError('请输入完整的8位字母数字面试码');
            return;
        }

        if (!window.api?.passcode) {
            onPasscodeVerified?.();
            return;
        }

        setIsVerifyingPasscode(true);
        setPasscodeError('');
        setShowRechargeLink(false);
        try {
            const result = await window.api.passcode?.verify(code);
            if (result?.success) {
                setPasscodeValue('');
                onPasscodeVerified?.();
            } else {
                setPasscodeError(result?.error || '面试码验证失败，请重试');
                setShowRechargeLink(!!result?.rechargeRequired);
            }
        } catch (error: any) {
            setPasscodeError(error?.message || '面试码验证失败，请稍后再试');
            setShowRechargeLink(false);
        } finally {
            setIsVerifyingPasscode(false);
        }
    };

    const handleClose = () => {
        window.api?.common?.quitApplication();
    };

    const handleCreateInterview = async () => {
        // 优先从主进程配置获取 Web URL，回退到默认官网地址
        const fallback = 'https://www.muyulab.com/';
        try {
            const webUrl = await window.api?.common?.getWebUrl();
            const baseUrl = (webUrl || fallback).replace(/\/$/, '');
            await window.api?.common?.openExternal(baseUrl + '/');
        } catch {
            await window.api?.common?.openExternal(fallback);
        }
    };

    const handleRecharge = async () => {
        const fallback = 'https://www.muyulab.com/';
        try {
            const webUrl = await window.api?.common?.getWebUrl();
            const baseUrl = (webUrl || fallback).replace(/\/$/, '');
            await window.api?.common?.openExternal(baseUrl + '/duration/recharge');
        } catch {
            await window.api?.common?.openExternal(fallback + 'duration/recharge');
        }
    };

    return (
        <StartupScreen
            interviewCode={passcodeValue}
            onInterviewCodeChange={handlePasscodeInput}
            onStartInterview={handlePasscodeSubmit}
            onClose={handleClose}
            onCreateInterview={handleCreateInterview}
            onRecharge={showRechargeLink ? handleRecharge : undefined}
            passcodeError={passcodeError}
            passcodeVerified={passcodeVerified}
            isVerifyingPasscode={isVerifyingPasscode}
            passcodeRequired={passcodeRequired}
        />
    );
}

