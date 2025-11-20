import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';

export class MainHeader extends LitElement {
    static properties = {
        isTogglingSession: { type: Boolean, state: true },
        shortcuts: { type: Object, state: true },
        listenSessionStatus: { type: String, state: true },
        interviewStartTime: { type: Number, state: true },
        interviewElapsedSeconds: { type: Number, state: true },
    };

    static styles = css`
        :host {
            display: block;
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            transition: transform 0.2s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.2s ease-out;
        }

        :host(.hiding) {
            animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }

        :host(.showing) {
            animation: slideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        :host(.sliding-in) {
            animation: fadeIn 0.2s ease-out forwards;
        }

        :host(.hidden) {
            opacity: 0;
            transform: translateY(-150%) scale(0.85);
            pointer-events: none;
        }

        .rail-panel {
            position: relative;
            width: 120px;
            min-height: 480px;
            border-radius: 32px;
            padding: 32px 22px 28px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            gap: 24px;
            background: linear-gradient(135deg, rgba(26, 10, 49, 0.95), rgba(59, 16, 82, 0.9));
            box-shadow:
                inset 0 0 0 1px rgba(255, 255, 255, 0.12),
                0 25px 55px rgba(10, 6, 24, 0.6);
            overflow: hidden;
            -webkit-app-region: drag;
        }

        .rail-panel::before,
        .rail-panel::after {
            content: '';
            position: absolute;
            inset: 0;
            pointer-events: none;
        }

        .rail-panel::before {
            background: radial-gradient(circle at 25% -15%, rgba(255, 160, 243, 0.18), transparent 55%);
        }

        .rail-panel::after {
            background: radial-gradient(circle at 90% 25%, rgba(118, 83, 255, 0.35), transparent 45%);
        }

        .rail-panel.state-listening {
            background: linear-gradient(120deg, rgba(11, 19, 60, 0.95), rgba(17, 9, 67, 0.96));
        }

        .rail-panel.state-completed {
            background: linear-gradient(135deg, rgba(4, 35, 52, 0.9), rgba(16, 57, 70, 0.92));
        }

        .rail-top,
        .rail-bottom {
            position: relative;
            z-index: 1;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
        }

        .primary-stack,
        .secondary-stack {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            width: 100%;
        }

        button {
            border: none;
            background: none;
            padding: 0;
            cursor: pointer;
            color: inherit;
            transition: transform 0.15s ease;
            -webkit-app-region: no-drag;
        }

        .listen-toggle {
            width: 58px;
            height: 58px;
            border-radius: 50%;
            border: 1px solid rgba(255, 255, 255, 0.4);
            background: linear-gradient(140deg, rgba(214, 154, 255, 0.18), rgba(139, 84, 255, 0.26));
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 10px 25px rgba(33, 12, 60, 0.65);
        }

        .listen-toggle.is-active {
            background: linear-gradient(140deg, rgba(255, 89, 153, 0.3), rgba(173, 86, 255, 0.45));
        }

        .listen-toggle.is-done {
            background: linear-gradient(140deg, rgba(84, 255, 201, 0.3), rgba(148, 222, 255, 0.35));
        }

        .listen-toggle:disabled {
            cursor: default;
            opacity: 0.8;
        }

        .listen-toggle:hover:not(:disabled) {
            transform: translateY(-2px) scale(1.01);
        }

        .listen-toggle svg {
            width: 18px;
            height: 18px;
        }

        .rail-button {
            width: 46px;
            height: 46px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.18);
            background: rgba(9, 9, 14, 0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: inset 0 0 25px rgba(255, 255, 255, 0.06);
        }

        .rail-button:hover {
            transform: translateY(-1px);
            border-color: rgba(255, 255, 255, 0.4);
        }

        .rail-button svg {
            width: 16px;
            height: 16px;
        }

        .loader {
            width: 18px;
            height: 18px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        .status-cluster {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 14px;
            border-radius: 999px;
            background: rgba(0, 0, 0, 0.28);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
        }

        .status-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #79ffe1;
            box-shadow: 0 0 8px rgba(121, 255, 225, 0.8);
        }

        .rail-panel.state-idle .status-dot {
            background: #ffd28f;
            box-shadow: 0 0 8px rgba(255, 199, 143, 0.8);
        }

        .rail-panel.state-completed .status-dot {
            background: #8fdeff;
            box-shadow: 0 0 8px rgba(143, 222, 255, 0.8);
        }

        .status-text {
            display: flex;
            flex-direction: column;
            gap: 2px;
            text-align: left;
        }

        .status-label {
            font-size: 12px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: rgba(255, 255, 255, 0.8);
        }

        .timer-text {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.8);
        }

        @keyframes spin {
            from {
                transform: rotate(0deg);
            }
            to {
                transform: rotate(360deg);
            }
        }

        /* Glass-friendly styling (keep tint + blur) */
        :host-context(body.has-glass) .rail-panel {
            background: linear-gradient(135deg, rgba(16, 8, 26, 0.82), rgba(37, 11, 54, 0.78));
            box-shadow:
                inset 0 0 0 1px rgba(255, 255, 255, 0.08),
                0 25px 55px rgba(4, 0, 23, 0.5);
            backdrop-filter: blur(22px);
        }

        :host-context(body.has-glass) .rail-panel::before {
            opacity: 0.6;
        }

        :host-context(body.has-glass) .rail-panel::after {
            opacity: 0.45;
        }

        :host-context(body.has-glass) .listen-toggle {
            background: linear-gradient(140deg, rgba(214, 154, 255, 0.25), rgba(139, 84, 255, 0.35));
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.55);
        }

        :host-context(body.has-glass) .rail-button {
            background: rgba(15, 15, 24, 0.32);
            box-shadow: inset 0 0 25px rgba(255, 255, 255, 0.04);
        }

        :host-context(body.has-glass) .status-cluster {
            background: rgba(0, 0, 0, 0.4);
        }
    `;

    constructor() {
        super();
        this.shortcuts = {};
        this.isVisible = true;
        this.isAnimating = false;
        this.hasSlidIn = false;
        this.settingsHideTimer = null;
        this.isTogglingSession = false;
        this.listenSessionStatus = 'beforeSession';
        this.animationEndTimer = null;
        this.interviewStartTime = null;
        this.interviewElapsedSeconds = 0;
        this._interviewTimerInterval = null;
        this._interviewStartListener = null;
        this.handleAnimationEnd = this.handleAnimationEnd.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.dragState = null;
        this.wasJustDragged = false;
        this._resizeObserver = null;
        this._resizeTarget = null;
        this._pendingResizeSize = null;
        this._lastDispatchedSize = null;
    }

    _getListenButtonText(status) {
        switch (status) {
            case 'beforeSession': return 'Listen';
            case 'inSession'   : return 'Stop';
            case 'afterSession': return 'Done';
            default            : return 'Listen';
        }
    }

    async handleMouseDown(e) {
        // Ignore mousedown originating from interactive controls to prevent accidental drag
        const interactiveSelector =
            '.listen-toggle, .rail-button, .settings-button, .action-rail, .settings-icon';
        if (e.target.closest(interactiveSelector) || ['BUTTON','INPUT','SELECT','A','SVG'].includes(e.target.tagName)) {
            return;
        }

        e.preventDefault();

        const initialPosition = await window.api.mainHeader.getHeaderPosition();

        this.dragState = {
            initialMouseX: e.screenX,
            initialMouseY: e.screenY,
            initialWindowX: initialPosition.x,
            initialWindowY: initialPosition.y,
            moved: false,
        };

        window.addEventListener('mousemove', this.handleMouseMove, { capture: true });
        window.addEventListener('mouseup', this.handleMouseUp, { once: true, capture: true });
    }

    handleMouseMove(e) {
        if (!this.dragState) return;

        const deltaX = Math.abs(e.screenX - this.dragState.initialMouseX);
        const deltaY = Math.abs(e.screenY - this.dragState.initialMouseY);
        
        if (deltaX > 3 || deltaY > 3) {
            this.dragState.moved = true;
        }

        const newWindowX = this.dragState.initialWindowX + (e.screenX - this.dragState.initialMouseX);
        const newWindowY = this.dragState.initialWindowY + (e.screenY - this.dragState.initialMouseY);

        window.api.mainHeader.moveHeaderTo(newWindowX, newWindowY);
    }

    handleMouseUp(e) {
        if (!this.dragState) return;

        const wasDragged = this.dragState.moved;

        window.removeEventListener('mousemove', this.handleMouseMove, { capture: true });
        this.dragState = null;

        if (wasDragged) {
            this.wasJustDragged = true;
            setTimeout(() => {
                this.wasJustDragged = false;
            }, 0);
        }
    }

    toggleVisibility() {
        if (this.isAnimating) {
            console.log('[MainHeader] Animation already in progress, ignoring toggle');
            return;
        }
        
        if (this.animationEndTimer) {
            clearTimeout(this.animationEndTimer);
            this.animationEndTimer = null;
        }
        
        this.isAnimating = true;
        
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    hide() {
        this.classList.remove('showing');
        this.classList.add('hiding');
    }
    
    show() {
        this.classList.remove('hiding', 'hidden');
        this.classList.add('showing');
    }
    
    handleAnimationEnd(e) {
        if (e.target !== this) return;
    
        this.isAnimating = false;
    
        if (this.classList.contains('hiding')) {
            this.classList.add('hidden');
            if (window.api) {
                window.api.mainHeader.sendHeaderAnimationFinished('hidden');
            }
        } else if (this.classList.contains('showing')) {
            if (window.api) {
                window.api.mainHeader.sendHeaderAnimationFinished('visible');
            }
            this._dispatchResizeRequest(true);
        }
    }

    startSlideInAnimation() {
        if (this.hasSlidIn) return;
        this.classList.add('sliding-in');
    }

    _getStoredInterviewStart() {
        if (typeof window === 'undefined') {
            return null;
        }

        const directValue = Number(window.__interviewStartTimestamp);
        if (Number.isFinite(directValue) && directValue > 0) {
            return directValue;
        }

        try {
            const stored = window.localStorage?.getItem('interviewStartTimestamp');
            const parsed = Number(stored);
            if (Number.isFinite(parsed) && parsed > 0) {
                return parsed;
            }
        } catch (error) {
            console.warn('[MainHeader] Failed to read interview start time from storage:', error);
        }

        return null;
    }

    _setupInterviewTimer() {
        if (typeof window === 'undefined') {
            return;
        }

        if (this._interviewTimerInterval) {
            clearInterval(this._interviewTimerInterval);
            this._interviewTimerInterval = null;
        }
        if (this._interviewStartListener) {
            window.removeEventListener('interview-started', this._interviewStartListener);
        }

        this._interviewStartListener = (event) => {
            const timestamp = Number(event?.detail?.startTime);
            if (Number.isFinite(timestamp) && timestamp > 0) {
                this.interviewStartTime = timestamp;
                this._updateInterviewElapsed();
            }
        };

        window.addEventListener('interview-started', this._interviewStartListener);

        const storedStart = this._getStoredInterviewStart();
        if (storedStart) {
            this.interviewStartTime = storedStart;
        }

        this._updateInterviewElapsed();
        this._interviewTimerInterval = setInterval(() => this._updateInterviewElapsed(), 1000);
    }

    _teardownInterviewTimer() {
        if (this._interviewTimerInterval) {
            clearInterval(this._interviewTimerInterval);
            this._interviewTimerInterval = null;
        }

        if (typeof window !== 'undefined' && this._interviewStartListener) {
            window.removeEventListener('interview-started', this._interviewStartListener);
            this._interviewStartListener = null;
        }
    }

    _updateInterviewElapsed() {
        if (!this.interviewStartTime) {
            if (this.interviewElapsedSeconds !== 0) {
                this.interviewElapsedSeconds = 0;
            }
            return;
        }

        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - this.interviewStartTime) / 1000));
        if (elapsedSeconds !== this.interviewElapsedSeconds) {
            this.interviewElapsedSeconds = elapsedSeconds;
        }
    }

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('animationend', this.handleAnimationEnd);
        this._setupInterviewTimer();

        if (window.api) {

            this._sessionStateTextListener = (event, { success }) => {
                if (success) {
                    this.listenSessionStatus = ({
                        beforeSession: 'inSession',
                        inSession: 'afterSession',
                        afterSession: 'beforeSession',
                    })[this.listenSessionStatus] || 'beforeSession';
                } else {
                    this.listenSessionStatus = 'beforeSession';
                }
        this.isTogglingSession = false; // ✨ Only clear loading state
            };
            window.api.mainHeader.onListenChangeSessionResult(this._sessionStateTextListener);

            this._shortcutListener = (event, keybinds) => {
                console.log('[MainHeader] Received updated shortcuts:', keybinds);
                this.shortcuts = keybinds;
            };
            window.api.mainHeader.onShortcutsUpdated(this._shortcutListener);
        }

        this.updateComplete.then(() => this._initializeResizeObserver()).catch(() => {});
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('animationend', this.handleAnimationEnd);
        this._teardownInterviewTimer();
        if (this._resizeObserver) {
            try {
                this._resizeObserver.disconnect();
            } catch (error) {
                console.warn('Failed to disconnect header resize observer', error);
            }
            this._resizeObserver = null;
        }
        this._resizeTarget = null;
        this._pendingResizeSize = null;
        this._lastDispatchedSize = null;
        
        if (this.animationEndTimer) {
            clearTimeout(this.animationEndTimer);
            this.animationEndTimer = null;
        }
        
        if (window.api) {
            if (this._sessionStateTextListener) {
                window.api.mainHeader.removeOnListenChangeSessionResult(this._sessionStateTextListener);
            }
            if (this._shortcutListener) {
                window.api.mainHeader.removeOnShortcutsUpdated(this._shortcutListener);
            }
        }
    }

    firstUpdated() {
        super.firstUpdated?.();
        this._initializeResizeObserver();
    }

    _initializeResizeObserver() {
        const panel = this.shadowRoot?.querySelector('.rail-panel');
        if (!panel) return;
        if (this._resizeTarget !== panel) {
            if (this._resizeObserver) {
                this._resizeObserver.disconnect();
            } else if (window.ResizeObserver) {
                this._resizeObserver = new ResizeObserver(entries => {
                    entries.forEach(entry => {
                        const { width, height } = entry.contentRect || entry.target.getBoundingClientRect();
                        this._applyWindowResize(width, height);
                    });
                });
            }
            if (this._resizeObserver) {
                this._resizeObserver.observe(panel);
            }
            this._resizeTarget = panel;
        }
        const rect = panel.getBoundingClientRect();
        this._applyWindowResize(rect.width, rect.height);
    }

    _applyWindowResize(width, height) {
        if (!window.api?.headerController?.resizeHeaderWindow) return;
        const padding = 24;
        const targetWidth = Math.ceil(width + padding);
        const targetHeight = Math.ceil(height + padding);
        if (
            this._pendingResizeSize &&
            Math.abs(targetWidth - this._pendingResizeSize.width) <= 2 &&
            Math.abs(targetHeight - this._pendingResizeSize.height) <= 2
        ) {
            return;
        }
        this._pendingResizeSize = { width: targetWidth, height: targetHeight };
        this._dispatchResizeRequest();
    }

    _dispatchResizeRequest(force = false) {
        if (!this._pendingResizeSize || !window.api?.headerController?.resizeHeaderWindow) return;
        if (!force && this._lastDispatchedSize) {
            const { width, height } = this._pendingResizeSize;
            if (
                Math.abs(width - this._lastDispatchedSize.width) <= 1 &&
                Math.abs(height - this._lastDispatchedSize.height) <= 1
            ) {
                return;
            }
        }
        const { width, height } = this._pendingResizeSize;
        this._lastDispatchedSize = { width, height };
        window.api.headerController
            .resizeHeaderWindow({ width, height })
            .catch(error => console.warn('Failed to resize header window', error));
    }

    showSettingsWindow(element) {
        if (this.wasJustDragged) return;
        if (window.api) {
            console.log(`[MainHeader] showSettingsWindow called at ${Date.now()}`);
            window.api.mainHeader.showSettingsWindow();

        }
    }

    hideSettingsWindow() {
        if (this.wasJustDragged) return;
        if (window.api) {
            console.log(`[MainHeader] hideSettingsWindow called at ${Date.now()}`);
            window.api.mainHeader.hideSettingsWindow();
        }
    }

    async _handleListenClick() {
        if (this.wasJustDragged) return;
        if (this.isTogglingSession) {
            return;
        }

        this.isTogglingSession = true;

        try {
            const listenButtonText = this._getListenButtonText(this.listenSessionStatus);
            if (window.api) {
                await window.api.mainHeader.sendListenButtonClick(listenButtonText);
            }
        } catch (error) {
            console.error('IPC invoke for session change failed:', error);
            this.isTogglingSession = false;
        }
    }

    async _handleAskClick() {
        if (this.wasJustDragged) return;

        try {
            if (window.api) {
                await window.api.mainHeader.sendAskButtonClick();
            }
        } catch (error) {
            console.error('IPC invoke for ask button failed:', error);
        }
    }

    async _handleLiveInsightsClick() {
        if (this.wasJustDragged) return;
        try {
            await window.api?.mainHeader.openLiveInsightsView();
        } catch (error) {
            console.error('IPC invoke for live insights failed:', error);
        }
    }

    async _handleShowTranscriptClick() {
        if (this.wasJustDragged) return;
        try {
            await window.api?.mainHeader?.openTranscriptView?.();
        } catch (error) {
            console.error('IPC invoke for transcript view failed:', error);
        }
    }

    async _handleToggleAllWindowsVisibility() {
        if (this.wasJustDragged) return;

        try {
            if (window.api) {
                await window.api.mainHeader.sendToggleAllWindowsVisibility();
            }
        } catch (error) {
            console.error('IPC invoke for all windows visibility button failed:', error);
        }
    }


    formatShortcutLabel(accelerator) {
        if (!accelerator) return '';
        const keyMap = {
            Cmd: '⌘',
            Command: '⌘',
            Ctrl: '⌃',
            Control: '⌃',
            Alt: '⌥',
            Option: '⌥',
            Shift: '⇧',
            Enter: '↵',
            Backspace: '⌫',
            Delete: '⌦',
            Tab: '⇥',
            Escape: '⎋',
            Up: '↑',
            Down: '↓',
            Left: '←',
            Right: '→',
        };
        return accelerator
            .split('+')
            .map(key => keyMap[key] || key)
            .join(' ');
    }

    formatElapsedTime(totalSeconds) {
        const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = safeSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    render() {
        const listenButtonText = this._getListenButtonText(this.listenSessionStatus);
        const isListening = listenButtonText === 'Stop';
        const hasCompleted = listenButtonText === 'Done';
        const panelState = hasCompleted ? 'completed' : isListening ? 'listening' : 'idle';
        const stateCopyMap = {
            idle: {
                headline: '点击右侧按钮开始收音，回答将展示在下方区域',
                subline: '准备好面试问题，开始后可实时查看回答。',
                status: '等待中',
            },
            listening: {
                headline: '聆听对方发言中...',
                subline: '小抄会实时整理要点与回答草稿，请保持专注。',
                status: '聆听中',
            },
            completed: {
                headline: '收音结束，可继续查看总结与面试记录。',
                subline: '需要继续录音时，可随时再次启动聆听。',
                status: '已结束',
            },
        };
        const stateCopy = stateCopyMap[panelState];
        const elapsed = this.formatElapsedTime(this.interviewElapsedSeconds);
        const listenButtonClasses = ['listen-toggle'];
        if (isListening) listenButtonClasses.push('is-active');
        if (hasCompleted) listenButtonClasses.push('is-done');
        const askShortcutLabel = this.formatShortcutLabel(this.shortcuts.nextStep);
        const toggleShortcutLabel = this.formatShortcutLabel(this.shortcuts.toggleVisibility);
        const listenTitle =
            listenButtonText === 'Stop'
                ? '停止聆听'
                : listenButtonText === 'Done'
                ? '结束聆听'
                : '开始聆听';

        return html`
            <div class="rail-panel state-${panelState}" @mousedown=${this.handleMouseDown}>
                <div class="rail-top">
                    <button
                        class=${listenButtonClasses.join(' ')}
                        @click=${this._handleListenClick}
                        ?disabled=${this.isTogglingSession}
                        title=${listenTitle}
                        aria-label=${listenTitle}
                    >
                        ${this.isTogglingSession
                            ? html`<div class="loader"></div>`
                            : hasCompleted
                            ? html`
                                  <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2.5">
                                      <path d="M4 9.5l3.2 3.2L14 5.7" stroke-linecap="round" stroke-linejoin="round"></path>
                                  </svg>
                              `
                            : isListening
                            ? html`<svg viewBox="0 0 10 10" fill="currentColor"><rect width="10" height="10" rx="2" /></svg>`
                            : html`
                                  <svg viewBox="0 0 14 18" fill="none" stroke="currentColor" stroke-width="2">
                                      <rect x="2" y="2" width="3" height="14" rx="1"></rect>
                                      <rect x="9" y="2" width="3" height="14" rx="1"></rect>
                                  </svg>
                              `}
                    </button>
                    <div class="primary-stack">
                        <button
                            class="rail-button"
                            @click=${this._handleAskClick}
                            title=${askShortcutLabel ? `Ask (${askShortcutLabel})` : 'Ask'}
                            aria-label="Ask"
                        >
                            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="3" y="3" width="3" height="3" rx="0.6"></rect>
                                <rect x="8" y="3" width="3" height="3" rx="0.6"></rect>
                                <rect x="13" y="3" width="3" height="3" rx="0.6"></rect>
                                <rect x="3" y="8" width="3" height="3" rx="0.6"></rect>
                                <rect x="8" y="8" width="3" height="3" rx="0.6"></rect>
                                <rect x="13" y="8" width="3" height="3" rx="0.6"></rect>
                            </svg>
                        </button>
                        <button
                            class="rail-button"
                            @click=${this._handleLiveInsightsClick}
                            title="Ask (Live View)"
                            aria-label="Ask (Live View)"
                        >
                            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M5 4H3a2 2 0 00-2 2v2" stroke-linecap="round"></path>
                                <path d="M13 4h2a2 2 0 012 2v2" stroke-linecap="round"></path>
                                <path d="M5 14H3a2 2 0 01-2-2v-2" stroke-linecap="round"></path>
                                <path d="M13 14h2a2 2 0 002-2v-2" stroke-linecap="round"></path>
                            </svg>
                        </button>
                        <button
                            class="rail-button"
                            @click=${this._handleShowTranscriptClick}
                            title="Show Transcript"
                            aria-label="Show Transcript"
                        >
                            <svg viewBox="0 0 20 18" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path
                                    d="M4 4h12a2 2 0 012 2v5a2 2 0 01-2 2H9l-4 3v-3H4a2 2 0 01-2-2V6a2 2 0 012-2z"
                                    stroke-linejoin="round"
                                ></path>
                                <circle cx="7" cy="9" r="1"></circle>
                                <circle cx="10" cy="9" r="1"></circle>
                                <circle cx="13" cy="9" r="1"></circle>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="rail-bottom">
                    <div class="secondary-stack">
                        <button
                            class="rail-button"
                            @click=${this._handleToggleAllWindowsVisibility}
                            title=${toggleShortcutLabel ? `Show/Hide (${toggleShortcutLabel})` : 'Show/Hide'}
                            aria-label="Show or Hide windows"
                        >
                            <svg viewBox="0 0 22 16" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M1 8s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z"></path>
                                <circle cx="11" cy="8" r="3"></circle>
                            </svg>
                        </button>
                        <button
                            class="rail-button settings-button"
                            @mouseenter=${(e) => this.showSettingsWindow(e.currentTarget)}
                            @mouseleave=${() => this.hideSettingsWindow()}
                            title="Settings"
                            aria-label="Settings"
                        >
                            <svg viewBox="0 0 4 16" fill="currentColor">
                                <circle cx="2" cy="3" r="1"></circle>
                                <circle cx="2" cy="8" r="1"></circle>
                                <circle cx="2" cy="13" r="1"></circle>
                            </svg>
                        </button>
                    </div>
                    <div class="status-cluster">
                        <span class="status-dot"></span>
                        <div class="status-text">
                            <span class="status-label">${stateCopy.status}</span>
                            <span class="timer-text">${panelState === 'idle' ? '计时 00:00' : `计时 ${elapsed}`}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('main-header', MainHeader);
