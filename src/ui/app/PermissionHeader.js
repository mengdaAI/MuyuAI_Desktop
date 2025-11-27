import { LitElement, html, css } from '../assets/lit-core-2.7.4.min.js';

export class PermissionHeader extends LitElement {
    static styles = css`
        :host {
            display: block;
            transition: opacity 0.3s ease-in, transform 0.3s ease-in;
            will-change: opacity, transform;
        }

        :host(.sliding-out) {
            opacity: 0;
            transform: translateY(-20px);
        }

        :host(.hidden) {
            opacity: 0;
            pointer-events: none;
        }

        * {
            font-family: 'PingFang SC', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
            box-sizing: border-box;
        }

        .container {
            -webkit-app-region: drag;
            width: 650px;
            padding: 40px 50px 35px;
            background: linear-gradient(135deg, rgba(88, 70, 120, 0.85) 0%, rgba(70, 80, 130, 0.85) 50%, rgba(60, 70, 110, 0.85) 100%);
            border-radius: 24px;
            overflow: hidden;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            backdrop-filter: blur(40px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .container::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 24px;
            padding: 1.5px;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.2) 100%);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: destination-out;
            mask-composite: exclude;
            pointer-events: none;
        }

        .close-button {
            -webkit-app-region: no-drag;
            position: absolute;
            top: 20px;
            right: 20px;
            width: 28px;
            height: 28px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 50%;
            color: rgba(255, 255, 255, 0.6);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            z-index: 10;
            font-size: 14px;
            line-height: 1;
            padding: 0;
        }

        .close-button:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.3);
            color: rgba(255, 255, 255, 0.95);
            transform: scale(1.05);
        }

        .close-button:active {
            transform: scale(0.98);
        }

        .header-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 35px;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 18px;
        }

        .logo-icon {
            width: 38px;
            height: 38px;
        }

        .title {
            color: white;
            font-size: 26px;
            font-weight: 600;
            margin: 0;
            text-align: center;
            letter-spacing: 0.5px;
        }

        .subtitle {
            color: rgba(255, 255, 255, 0.8);
            font-size: 12.5px;
            font-weight: 400;
            text-align: center;
            margin: 0;
            line-height: 1.6;
        }

        .permissions-list {
            display: flex;
            flex-direction: column;
            gap: 20px;
            width: 100%;
        }

        .permission-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
            width: 100%;
        }

        .permission-info {
            display: flex;
            align-items: center;
            gap: 18px;
            flex: 1;
        }

        .permission-icon-wrapper {
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.12);
            border-radius: 11px;
            flex-shrink: 0;
            border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .permission-icon {
            width: 26px;
            height: 26px;
            color: rgba(255, 255, 255, 0.9);
        }

        .permission-label {
            color: white;
            font-size: 16px;
            font-weight: 500;
            letter-spacing: 0.3px;
        }

        .permission-button {
            -webkit-app-region: no-drag;
            min-width: 110px;
            height: 42px;
            padding: 0 28px;
            background: rgba(255, 255, 255, 0.08);
            border: 1.5px solid rgba(160, 140, 200, 0.5);
            border-radius: 22px;
            color: white;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            overflow: visible;
            flex-shrink: 0;
        }

        .permission-button::before {
            content: '';
            position: absolute;
            top: -1px;
            left: -1px;
            right: -1px;
            bottom: -1px;
            border-radius: 22px;
            background: linear-gradient(135deg, rgba(180, 160, 220, 0.4) 0%, rgba(140, 120, 200, 0.2) 100%);
            z-index: -1;
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .permission-button:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.15);
            border-color: rgba(180, 160, 220, 0.7);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(140, 120, 200, 0.3);
        }

        .permission-button:hover:not(:disabled)::before {
            opacity: 1;
        }

        .permission-button:active:not(:disabled) {
            transform: translateY(0);
        }

        .permission-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .permission-button.granted {
            background: rgba(34, 197, 94, 0.25);
            border-color: rgba(34, 197, 94, 0.6);
            cursor: default;
        }

        .permission-button.granted:hover {
            background: rgba(34, 197, 94, 0.25);
            transform: none;
            box-shadow: none;
        }

        .continue-section {
            display: flex;
            justify-content: center;
            width: 100%;
            margin-top: 36px;
        }

        .continue-button {
            -webkit-app-region: no-drag;
            min-width: 200px;
            height: 48px;
            padding: 0 48px;
            background: linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(34, 197, 94, 0.85) 100%);
            border: 1.5px solid rgba(34, 197, 94, 0.7);
            border-radius: 24px;
            color: white;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.25s ease;
            position: relative;
            overflow: hidden;
            box-shadow: 0 4px 16px rgba(34, 197, 94, 0.25);
        }

        .continue-button::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 24px;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%);
            pointer-events: none;
        }

        .continue-button:hover:not(:disabled) {
            background: linear-gradient(135deg, rgba(34, 197, 94, 1) 0%, rgba(34, 197, 94, 0.95) 100%);
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(34, 197, 94, 0.4);
            border-color: rgba(34, 197, 94, 0.9);
        }

        .continue-button:active:not(:disabled) {
            transform: translateY(0);
        }

        .continue-button:disabled {
            background: rgba(255, 255, 255, 0.2);
            cursor: not-allowed;
            box-shadow: none;
        }

        .keychain-hint {
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
            text-align: center;
            margin-top: 8px;
            line-height: 1.6;
            max-width: 600px;
        }

        .keychain-hint b {
            color: rgba(255, 255, 255, 0.95);
            font-weight: 600;
        }
        
        /* ────────────────[ GLASS BYPASS ]─────────────── */
        :host-context(body.has-glass) .container,
        :host-context(body.has-glass) .permission-button,
        :host-context(body.has-glass) .continue-button,
        :host-context(body.has-glass) .close-button,
        :host-context(body.has-glass) .permission-icon-wrapper {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            filter: none !important;
            backdrop-filter: none !important;
        }

        :host-context(body.has-glass) .container::after,
        :host-context(body.has-glass) .permission-button::before,
        :host-context(body.has-glass) .continue-button::after {
            display: none !important;
        }

        :host-context(body.has-glass) .permission-button:hover,
        :host-context(body.has-glass) .continue-button:hover,
        :host-context(body.has-glass) .close-button:hover {
            background: transparent !important;
        }
    `;

    static properties = {
        microphoneGranted: { type: String },
        screenGranted: { type: String },
        keychainGranted: { type: String },
        isChecking: { type: String },
        continueCallback: { type: Function },
        userMode: { type: String }, // 'local' or 'firebase'
    };

    constructor() {
        super();
        this.microphoneGranted = 'unknown';
        this.screenGranted = 'unknown';
        this.keychainGranted = 'unknown';
        this.isChecking = false;
        this.continueCallback = null;
        this.userMode = 'local'; // Default to local
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('userMode') || changedProperties.has('microphoneGranted') || changedProperties.has('screenGranted') || changedProperties.has('keychainGranted')) {
            const isKeychainRequired = this.userMode === 'firebase';
            const keychainOk = !isKeychainRequired || this.keychainGranted === 'granted';
            const allGranted = this.microphoneGranted === 'granted' && this.screenGranted === 'granted' && keychainOk;
            
            // Base height: header (140px) + 2 permissions (88px each) + padding (40px)
            let newHeight = 430;
            
            if (isKeychainRequired && !keychainOk) {
                newHeight += 90; // Extra row for keychain + hint text
            }
            
            if (allGranted) {
                newHeight += 70; // Add continue button section
            }
            
            console.log(`[PermissionHeader] State changed, requesting resize to ${newHeight}px`);
            this.dispatchEvent(new CustomEvent('request-resize', {
                detail: { height: newHeight },
                bubbles: true,
                composed: true
            }));
        }
    }

    async connectedCallback() {
        super.connectedCallback();

        if (window.api) {
            try {
                const userState = await window.api.common.getCurrentUser();
                this.userMode = userState.mode;
            } catch (e) {
                console.error('[PermissionHeader] Failed to get user state', e);
                this.userMode = 'local'; // Fallback to local
            }
        }

        await this.checkPermissions();
        
        // Set up periodic permission check
        this.permissionCheckInterval = setInterval(async () => {
            if (window.api) {
                try {
                    const userState = await window.api.common.getCurrentUser();
                    this.userMode = userState.mode;
                } catch (e) {
                    this.userMode = 'local';
                }
            }
            this.checkPermissions();
        }, 1000);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.permissionCheckInterval) {
            clearInterval(this.permissionCheckInterval);
        }
    }

    async checkPermissions() {
        if (!window.api || this.isChecking) return;
        
        this.isChecking = true;
        
        try {
            const permissions = await window.api.permissionHeader.checkSystemPermissions();
            console.log('[PermissionHeader] Permission check result:', permissions);
            
            const prevMic = this.microphoneGranted;
            const prevScreen = this.screenGranted;
            const prevKeychain = this.keychainGranted;
            
            this.microphoneGranted = permissions.microphone;
            this.screenGranted = permissions.screen;
            this.keychainGranted = permissions.keychain;
            
            // if permissions changed == UI update
            if (prevMic !== this.microphoneGranted || prevScreen !== this.screenGranted || prevKeychain !== this.keychainGranted) {
                console.log('[PermissionHeader] Permission status changed, updating UI');
                this.requestUpdate();
            }

            const isKeychainRequired = this.userMode === 'firebase';
            const keychainOk = !isKeychainRequired || this.keychainGranted === 'granted';
            
            // if all permissions granted == automatically continue
            if (this.microphoneGranted === 'granted' && 
                this.screenGranted === 'granted' && 
                keychainOk && 
                this.continueCallback) {
                console.log('[PermissionHeader] All permissions granted, proceeding automatically');
                setTimeout(() => this.handleContinue(), 500);
            }
        } catch (error) {
            console.error('[PermissionHeader] Error checking permissions:', error);
        } finally {
            this.isChecking = false;
        }
    }

    async handleMicrophoneClick() {
        if (!window.api || this.microphoneGranted === 'granted') return;
        
        console.log('[PermissionHeader] Requesting microphone permission...');
        
        try {
            const result = await window.api.permissionHeader.checkSystemPermissions();
            console.log('[PermissionHeader] Microphone permission result:', result);
            
            if (result.microphone === 'granted') {
                this.microphoneGranted = 'granted';
                this.requestUpdate();
                return;
              }
            
              if (result.microphone === 'not-determined' || result.microphone === 'denied' || result.microphone === 'unknown' || result.microphone === 'restricted') {
                const res = await window.api.permissionHeader.requestMicrophonePermission();
                if (res.status === 'granted' || res.success === true) {
                    this.microphoneGranted = 'granted';
                    this.requestUpdate();
                    return;
                }
              }
            
            
            // Check permissions again after a delay
            // setTimeout(() => this.checkPermissions(), 1000);
        } catch (error) {
            console.error('[PermissionHeader] Error requesting microphone permission:', error);
        }
    }

    async handleScreenClick() {
        if (!window.api || this.screenGranted === 'granted') return;
        
        console.log('[PermissionHeader] Checking screen recording permission...');
        
        try {
            const permissions = await window.api.permissionHeader.checkSystemPermissions();
            console.log('[PermissionHeader] Screen permission check result:', permissions);
            
            if (permissions.screen === 'granted') {
                this.screenGranted = 'granted';
                this.requestUpdate();
                return;
            }
            if (permissions.screen === 'not-determined' || permissions.screen === 'denied' || permissions.screen === 'unknown' || permissions.screen === 'restricted') {
            console.log('[PermissionHeader] Opening screen recording preferences...');
            await window.api.permissionHeader.openSystemPreferences('screen-recording');
            }
            
            // Check permissions again after a delay
            // (This may not execute if app restarts after permission grant)
            // setTimeout(() => this.checkPermissions(), 2000);
        } catch (error) {
            console.error('[PermissionHeader] Error opening screen recording preferences:', error);
        }
    }

    async handleKeychainClick() {
        if (!window.api || this.keychainGranted === 'granted') return;
        
        console.log('[PermissionHeader] Requesting keychain permission...');
        
        try {
            // Trigger initializeKey to prompt for keychain access
            // Assuming encryptionService is accessible or via API
            await window.api.permissionHeader.initializeEncryptionKey(); // New IPC handler needed
            
            // After success, update status
            this.keychainGranted = 'granted';
            this.requestUpdate();
        } catch (error) {
            console.error('[PermissionHeader] Error requesting keychain permission:', error);
        }
    }

    async handleContinue() {
        const isKeychainRequired = this.userMode === 'firebase';
        const keychainOk = !isKeychainRequired || this.keychainGranted === 'granted';

        if (this.continueCallback && 
            this.microphoneGranted === 'granted' && 
            this.screenGranted === 'granted' && 
            keychainOk) {
            // Mark permissions as completed
            if (window.api && isKeychainRequired) {
                try {
                    await window.api.permissionHeader.markKeychainCompleted();
                    console.log('[PermissionHeader] Marked keychain as completed');
                } catch (error) {
                    console.error('[PermissionHeader] Error marking keychain as completed:', error);
                }
            }
            
            this.continueCallback();
        }
    }

    handleClose() {
        console.log('Close button clicked');
        if (window.api) {
            window.api.common.quitApplication();
        }
    }

    render() {
        const isKeychainRequired = this.userMode === 'firebase';
        const keychainOk = !isKeychainRequired || this.keychainGranted === 'granted';
        const allGranted = this.microphoneGranted === 'granted' && this.screenGranted === 'granted' && keychainOk;

        return html`
            <div class="container">
                <button class="close-button" @click=${this.handleClose} title="关闭应用">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                    </svg>
                </button>

                <div class="header-section">
                    <div class="logo">
                        <svg class="logo-icon" viewBox="0 0 48 48" fill="none">
                            <rect width="48" height="48" rx="12" fill="url(#logo-gradient)" />
                            <path d="M14 18L20 24L14 30M24 30H34" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                            <defs>
                                <linearGradient id="logo-gradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                                    <stop stop-color="#8B5CF6" />
                                    <stop offset="1" stop-color="#6366F1" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <h1 class="title">慕语提问器</h1>
                    </div>
                    <p class="subtitle">请为慕语提问器开启麦克风与屏幕获取权限后开始使用</p>
                </div>

                <div class="permissions-list">
                    <!-- Microphone Permission -->
                    <div class="permission-row">
                        <div class="permission-info">
                            <div class="permission-icon-wrapper">
                                <svg class="permission-icon" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
                                </svg>
                            </div>
                            <span class="permission-label">麦克风</span>
                        </div>
                        <button 
                            class="permission-button ${this.microphoneGranted === 'granted' ? 'granted' : ''}"
                            @click=${this.handleMicrophoneClick}
                            ?disabled=${this.microphoneGranted === 'granted'}
                        >
                            ${this.microphoneGranted === 'granted' ? '✓ 已开启' : '开启权限'}
                        </button>
                    </div>

                    <!-- Screen Recording Permission -->
                    <div class="permission-row">
                        <div class="permission-info">
                            <div class="permission-icon-wrapper">
                                <svg class="permission-icon" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7v2H8v2h8v-2h-2v-2h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H3V4h18v12z"/>
                                </svg>
                            </div>
                            <span class="permission-label">屏幕</span>
                        </div>
                        <button 
                            class="permission-button ${this.screenGranted === 'granted' ? 'granted' : ''}"
                            @click=${this.handleScreenClick}
                            ?disabled=${this.screenGranted === 'granted'}
                        >
                            ${this.screenGranted === 'granted' ? '✓ 已开启' : '开启权限'}
                        </button>
                    </div>

                    <!-- Keychain Permission (if required) -->
                    ${isKeychainRequired ? html`
                        <div class="permission-row">
                            <div class="permission-info">
                                <div class="permission-icon-wrapper">
                                    <svg class="permission-icon" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/>
                                    </svg>
                                </div>
                                <span class="permission-label">数据加密</span>
                            </div>
                            <button 
                                class="permission-button ${this.keychainGranted === 'granted' ? 'granted' : ''}"
                                @click=${this.handleKeychainClick}
                                ?disabled=${this.keychainGranted === 'granted'}
                            >
                                ${this.keychainGranted === 'granted' ? '✓ 已开启' : '开启权限'}
                            </button>
                        </div>
                        ${this.keychainGranted !== 'granted' ? html`
                            <div class="keychain-hint">
                                存储用于加密数据的密钥。请点击"<b>始终允许</b>"以继续。
                            </div>
                        ` : ''}
                    ` : ''}
                </div>

                ${allGranted ? html`
                    <div class="continue-section">
                        <button 
                            class="continue-button" 
                            @click=${this.handleContinue}
                        >
                            继续使用
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }
}

customElements.define('permission-setup', PermissionHeader); 