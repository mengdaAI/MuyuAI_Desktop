const { onAuthStateChanged, signInWithCustomToken, signOut } = require('firebase/auth');
const { BrowserWindow, shell } = require('electron');
const { getFirebaseAuth } = require('./firebaseClient');
const fetch = require('node-fetch');
const encryptionService = require('./encryptionService');
const sessionRepository = require('../repositories/session');
const permissionService = require('./permissionService');

const DEFAULT_INTERVIEW_DOMAIN = 'https://muyu.mengdaai.com';
const INTERVIEW_LOGIN_PATH = '/api/v1/auth/login_by_token';

async function getVirtualKeyByEmail(email, idToken) {
    if (!idToken) {
        throw new Error('Firebase ID token is required for virtual key request');
    }

    const resp = await fetch('https://serverless-api-sf3o.vercel.app/api/virtual_key', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        redirect: 'follow',
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        console.error('[VK] API request failed:', json.message || 'Unknown error');
        throw new Error(json.message || `HTTP ${resp.status}: Virtual key request failed`);
    }

    const vKey = json?.data?.virtualKey || json?.data?.virtual_key || json?.data?.newVKey?.slug;

    if (!vKey) throw new Error('virtual key missing in response');
    return vKey;
}

class AuthService {
    constructor() {
        this.currentUserId = 'default_user';
        this.currentUserMode = 'local'; // 'local' | 'firebase' | 'interview'
        this.currentUser = null;
        this.isInitialized = false;
        this.interviewAuth = {
            token: null,
            user: null,
            raw: null,
        };

        // This ensures the key is ready before any login/logout state change.
        this.initializationPromise = null;

        sessionRepository.setAuthService(this);
    }

    initialize() {
        if (this.isInitialized) return this.initializationPromise;

        this.initializationPromise = new Promise((resolve) => {
            const auth = getFirebaseAuth();
            onAuthStateChanged(auth, async (user) => {
                const previousUser = this.currentUser;

                if (user) {
                    // User signed IN
                    console.log(`[AuthService] Firebase user signed in:`, user.uid);
                    this.currentUser = user;
                    this.currentUserId = user.uid;
                    this.currentUserMode = 'firebase';

                    // Clean up any zombie sessions from a previous run for this user.
                    await sessionRepository.endAllActiveSessions();

                    // ** Initialize encryption key for the logged-in user if permissions are already granted **
                    if (process.platform === 'darwin' && !(await permissionService.checkKeychainCompleted(this.currentUserId))) {
                        console.warn('[AuthService] Keychain permission not yet completed for this user. Deferring key initialization.');
                    } else {
                        await encryptionService.initializeKey(user.uid);
                    }

                    // ***** CRITICAL: Wait for the virtual key and model state update to complete *****
                    try {
                        const idToken = await user.getIdToken(true);
                        const virtualKey = await getVirtualKeyByEmail(user.email, idToken);

                        // 登录成功后不再触发模型或密钥切换，让 AI 配置保持在默认值
                        void virtualKey; // 仍然拉取，便于后续扩展或日志分析
                        console.log(`[AuthService] Virtual key for ${user.email} has been processed and state updated.`);

                    } catch (error) {
                        console.error('[AuthService] Failed to fetch or save virtual key:', error);
                        // This is not critical enough to halt the login, but we should log it.
                    }

                } else {
                    // User signed OUT
                    console.log(`[AuthService] No Firebase user.`);
                    if (previousUser) {
                        console.log(`[AuthService] Clearing API key for logged-out user: ${previousUser.uid}`);
                        // 登出时同样不再自动切换模型或清除虚拟 key
                    }
                    this.currentUser = null;
                    this.currentUserId = 'default_user';
                    this.currentUserMode = 'local';
                    this.interviewAuth = {
                        token: null,
                        user: null,
                        raw: null,
                    };

                    // End active sessions for the local/default user as well.
                    await sessionRepository.endAllActiveSessions();

                    encryptionService.resetSessionKey();
                }
                this.broadcastUserState();
                
                if (!this.isInitialized) {
                    this.isInitialized = true;
                    console.log('[AuthService] Initialized and resolved initialization promise.');
                    resolve();
                }
            });
        });

        return this.initializationPromise;
    }

    async startFirebaseAuthFlow() {
        try {
            const webUrl = process.env.pickleglass_WEB_URL || 'http://localhost:3000';
            const authUrl = `${webUrl}/login?mode=electron`;
            console.log(`[AuthService] Opening Firebase auth URL in browser: ${authUrl}`);
            await shell.openExternal(authUrl);
            return { success: true };
        } catch (error) {
            console.error('[AuthService] Failed to open Firebase auth URL:', error);
            return { success: false, error: error.message };
        }
    }

    async signInWithCustomToken(token) {
        const auth = getFirebaseAuth();
        try {
            const userCredential = await signInWithCustomToken(auth, token);
            console.log(`[AuthService] Successfully signed in with custom token for user:`, userCredential.user.uid);
            // onAuthStateChanged will handle the state update and broadcast
        } catch (error) {
            console.error('[AuthService] Error signing in with custom token:', error);
            throw error; // Re-throw to be handled by the caller
        }
    }

    async signOut() {
        const auth = getFirebaseAuth();
        try {
            // End all active sessions for the current user BEFORE signing out.
            await sessionRepository.endAllActiveSessions();

            await signOut(auth);
            console.log('[AuthService] User sign-out initiated successfully.');
            // onAuthStateChanged will handle the state update and broadcast,
            // which will also re-evaluate the API key status.
        } catch (error) {
            console.error('[AuthService] Error signing out:', error);
        }
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
            };
        }

        const isLoggedIn = !!(this.currentUserMode === 'firebase' && this.currentUser);

        if (isLoggedIn) {
            return {
                uid: this.currentUser.uid,
                email: this.currentUser.email,
                displayName: this.currentUser.displayName,
                mode: 'firebase',
                isLoggedIn: true,
                //////// before_modelStateService ////////
                // hasApiKey: this.hasApiKey // Always true for firebase users, but good practice
                //////// before_modelStateService ////////
            };
        }
        return {
            uid: this.currentUserId, // returns 'default_user'
            email: 'contact@pickle.com',
            displayName: 'Default User',
            mode: 'local',
            isLoggedIn: false,
            //////// before_modelStateService ////////
            // hasApiKey: this.hasApiKey
            //////// before_modelStateService ////////
        };
    }

    _getInterviewDomain() {
        return (process.env.INTERVIEW_API_DOMAIN || DEFAULT_INTERVIEW_DOMAIN).trim().replace(/\/$/, '');
    }

    _getInterviewLoginEndpoint() {
        const envEndpoint = (process.env.INTERVIEW_LOGIN_API || '').trim();
        if (envEndpoint) return envEndpoint;
        return `${this._getInterviewDomain()}${INTERVIEW_LOGIN_PATH}`;
    }

    async loginWithInterviewToken(passcode) {
        const sanitized = (passcode || '').trim();
        if (!sanitized) {
            throw new Error('请输入面试口令');
        }

        const endpoint = this._getInterviewLoginEndpoint();
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
