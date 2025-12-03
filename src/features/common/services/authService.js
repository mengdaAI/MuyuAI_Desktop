const { BrowserWindow } = require('electron');
const fetch = require('node-fetch');
const encryptionService = require('./encryptionService');
const sessionRepository = require('../repositories/session');

const DEFAULT_API_DOMAIN = 'https://muyu.mengdaai.com';
const INTERVIEW_LOGIN_PATH = '/api/v1/auth/login_by_token';

class AuthService {
    constructor() {
        this.currentUserId = 'default_user';
        this.currentUserMode = 'local'; // 'local' | 'interview'
        this.currentUser = null;
        this.isInitialized = false;
        this.interviewAuth = {
            token: null,
            user: null,
            raw: null,
        };

        this.initializationPromise = null;
        sessionRepository.setAuthService(this);
    }

    async initialize() {
        if (this.isInitialized) return this.initializationPromise;

        this.initializationPromise = (async () => {
            console.log('[AuthService] Initializing in local mode...');

            // Clean up any zombie sessions from previous runs
            await sessionRepository.endAllActiveSessions();

            // Initialize with default local user
            this.currentUserId = 'default_user';
            this.currentUserMode = 'local';
            this.currentUser = null;

            this.isInitialized = true;
            this.broadcastUserState();

            console.log('[AuthService] Initialized successfully in local mode.');
        })();

        return this.initializationPromise;
    }

    broadcastUserState() {
        const userState = this.getCurrentUser();
        console.log('[AuthService] Broadcasting user state change:', userState);
        BrowserWindow.getAllWindows().forEach(win => {
            if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
                win.webContents.send('user-state-changed', userState);
            }
        });
    }

    getCurrentUserId() {
        return this.currentUserId;
    }

    getCurrentUser() {
        if (this.currentUserMode === 'interview' && this.currentUser) {
            return {
                uid: this.currentUser.uid,
                email: this.currentUser.email,
                displayName: this.currentUser.displayName,
                mode: 'interview',
                isLoggedIn: true,
                authToken: this.interviewAuth?.token || null,
                profile: this.interviewAuth?.user || null,
                totalInterviewSeconds: this.interviewAuth?.raw?.totalInterviewSeconds || 0,
            };
        }

        // Local mode (default)
        return {
            uid: this.currentUserId,
            email: 'contact@muyu.ai',
            displayName: 'Default User',
            mode: 'local',
            isLoggedIn: false,
        };
    }

    _getApiDomain() {
        const domain = (process.env.MUYU_API_DOMAIN || DEFAULT_API_DOMAIN).trim().replace(/\/$/, '');
        console.log('[AuthService] API domain:', domain);
        return domain;
    }

    _getInterviewLoginEndpoint() {
        return `${this._getApiDomain()}${INTERVIEW_LOGIN_PATH}`;
    }

    async loginWithInterviewToken(passcode) {
        const sanitized = (passcode || '').trim();
        if (!sanitized) {
            throw new Error('请输入面试口令');
        }

        const endpoint = this._getInterviewLoginEndpoint();
        console.log('[AuthService] Interview login endpoint:', endpoint);
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sanitized }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.message || data?.error || '登录失败，请重试');
            }

            const jwtToken = data?.token || data?.jwt || data?.accessToken || data?.access_token;
            if (!jwtToken) {
                throw new Error('登录响应缺少 token，请联系管理员');
            }

            const userPayload = data?.user || data?.data?.user || null;
            this._setInterviewUserState(userPayload, jwtToken, data);

            console.log('[AuthService] Interview login succeeded.');
            return { token: jwtToken, user: userPayload, raw: data };
        } catch (error) {
            console.error('[AuthService] loginWithInterviewToken failed:', error);
            throw new Error(error?.message || '无法连接登录服务，请稍后再试');
        }
    }

    _setInterviewUserState(userPayload, jwtToken, raw) {
        const inferredId =
            userPayload?.uid ||
            userPayload?.id ||
            userPayload?._id ||
            userPayload?.userId ||
            `interview_${Date.now()}`;

        const normalizedId = String(inferredId);
        const displayName = userPayload?.name || userPayload?.displayName || userPayload?.nickname || 'Interview User';
        const email = userPayload?.email || `${normalizedId}@muyu.ai`;

        this.currentUserId = normalizedId;
        this.currentUserMode = 'interview';
        this.currentUser = {
            uid: normalizedId,
            email,
            displayName,
            mode: 'interview',
            isLoggedIn: true,
        };
        this.interviewAuth = {
            token: jwtToken,
            user: userPayload || null,
            raw: raw || null,
        };

        this.broadcastUserState();
    }

    getInterviewAuthState() {
        return { ...this.interviewAuth };
    }
}

const authService = new AuthService();
module.exports = authService; 
