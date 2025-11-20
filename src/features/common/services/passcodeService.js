const fetch = require('node-fetch');
const authService = require('./authService');

const loggerPrefix = '[PasscodeService]';
const DEFAULT_API_DOMAIN = 'https://muyu.mengdaai.com';
const SESSION_START_PATH = '/api/v1/session/start';
const SESSION_STOP_PATH = '/api/v1/session/stop';

class PasscodeService {
    constructor() {
        this.isVerified = false;
        const domain = (process.env.INTERVIEW_API_DOMAIN || DEFAULT_API_DOMAIN).trim().replace(/\/$/, '');
        const customEndpoint = (process.env.INTERVIEW_PASSCODE_API || '').trim();
        this.sessionEndpoint = customEndpoint || `${domain}${SESSION_START_PATH}`;
        const customStopEndpoint = (process.env.INTERVIEW_SESSION_STOP_API || '').trim();
        this.sessionStopEndpoint = customStopEndpoint || `${domain}${SESSION_STOP_PATH}`;
        this.requirePasscode = process.env.INTERVIEW_PASSCODE_REQUIRED !== 'false';
        this.activeSession = null;
    }

    isPasscodeRequired() {
        return this.requirePasscode && !this.isVerified;
    }

    getStatus() {
        const required = this.isPasscodeRequired();
        return {
            required,
            verified: this.isVerified || !required,
        };
    }

    reset() {
        this.isVerified = false;
        this.activeSession = null;
    }

    getActiveSessionInfo() {
        if (!this.activeSession) {
            return null;
        }
        try {
            return { ...this.activeSession };
        } catch (_) {
            return this.activeSession;
        }
    }

    getActiveSessionId() {
        const session = this.getActiveSessionInfo();
        if (!session) return null;
        return (
            session.sessionId ||
            session.session_id ||
            session.id ||
            session.interview_session_id ||
            null
        );
    }

    async verify(input) {
        if (!this.requirePasscode) {
            this.isVerified = true;
            return { success: true, skip: true };
        }

        const candidate = (input || '').trim();
        if (!candidate) {
            return { success: false, error: '请输入面试口令' };
        }

        if (!/^[A-Za-z0-9]{8}$/.test(candidate)) {
            return { success: false, error: '口令需为 8 位字母或数字组合' };
        }

        if (!this.sessionEndpoint) {
            console.warn(`${loggerPrefix} Session endpoint missing, using mock verification.`);
            await this.mockVerify(candidate);
            this.isVerified = true;
            return { success: true, mocked: true };
        }

        const loginResult = await this._loginWithToken(candidate);
        if (!loginResult.success) {
            return loginResult;
        }

        const sessionResult = await this._startInterviewSession(candidate, loginResult.token);
        if (!sessionResult.success) {
            return sessionResult;
        }

        this.activeSession = sessionResult.session || null;
        this.isVerified = true;
        console.log(`${loggerPrefix} Passcode verified, interview session started.`);
        return { success: true };
    }

    async _loginWithToken(passcode) {
        try {
            const result = await authService.loginWithInterviewToken(passcode);
            if (!result?.token) {
                return { success: false, error: '登录响应缺少 token，请联系管理员' };
            }
            return { success: true, token: result.token };
        } catch (error) {
            console.error(`${loggerPrefix} login error:`, error);
            return {
                success: false,
                error: error?.message || '登录失败，请稍后重试',
            };
        }
    }

    async _startInterviewSession(passcode, jwtToken) {
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (jwtToken) {
                headers.Authorization = `Bearer ${jwtToken}`;
            }

            const response = await fetch(this.sessionEndpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({ token: passcode }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                return {
                    success: false,
                    error: data?.message || data?.error || '口令验证失败，请重试',
                };
            }

            const status = typeof data?.status === 'string' ? data.status.toLowerCase() : null;
            if (status && status !== 'active') {
                return {
                    success: false,
                    error: '当前面试未开放，请稍后再试',
                };
            }

            return { success: true, session: data || null };
        } catch (error) {
            console.error(`${loggerPrefix} session start error:`, error);
            return {
                success: false,
                error: '无法连接验证服务，请稍后重试',
            };
        }
    }

    async stopActiveSession(sessionId = null) {
        return {success: true, skipped: true}
        // TODO 临时跳过 stop session logic for debug

        const targetSessionId = sessionId || this.activeSession?.session_id || this.activeSession?.sessionId;
        console.log(`${loggerPrefix} stopActiveSession called with sessionId:`, targetSessionId);
        if (!targetSessionId) {
            console.log(`${loggerPrefix} No active interview session to stop.`);
            return { success: true, skipped: true };
        }

        if (!this.sessionStopEndpoint) {
            console.warn(`${loggerPrefix} Session stop endpoint missing, skipping stop call.`);
            return { success: false, error: 'Session stop endpoint not configured' };
        }

        try {
            const headers = { 'Content-Type': 'application/json' };
            const { token } = authService.getInterviewAuthState?.() || {};
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const response = await fetch(this.sessionStopEndpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({ sessionId: targetSessionId }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                return {
                    success: false,
                    error: data?.message || data?.error || 'Session stop failed',
                };
            }

            console.log(`${loggerPrefix} Interview session ${targetSessionId} stopped successfully.`);
            this.activeSession = null;
            return { success: true, data };
        } catch (error) {
            console.error(`${loggerPrefix} session stop error:`, error);
            return {
                success: false,
                error: error?.message || 'Failed to stop interview session',
            };
        }
    }

    async mockVerify(passcode) {
        console.log(`${loggerPrefix} No API endpoint configured. Mock-verifying passcode "${passcode}".`);
        await new Promise(resolve => setTimeout(resolve, 300));
        return { success: true };
    }
}

module.exports = new PasscodeService();
