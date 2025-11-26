import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';


export class MainView extends LitElement {
    static properties = {
        isTogglingSession: { type: Boolean, state: true },
        shortcuts: { type: Object, state: true },
        listenSessionStatus: { type: String, state: true },
        interviewStartTime: { type: Number, state: true },
        interviewElapsedSeconds: { type: Number, state: true },
        totalInterviewSeconds: { type: Number, state: true },
        isVisible: { type: Boolean, state: true },
        isAnimating: { type: Boolean, state: true },
        _scale: { type: Number, state: true },
        viewMode: { type: String, state: true },
        insightsMode: { type: String, state: true },
        sttMessages: { type: Array, state: true },
        turns: { type: Array, state: true },
    };

    constructor() {
        super();
        this.shortcuts = {};
        this.isVisible = true;
        this.isAnimating = false;
        this.isTogglingSession = false;
        this.listenSessionStatus = 'beforeSession';
        this.interviewStartTime = null;
        this.interviewElapsedSeconds = 0;
        this.totalInterviewSeconds = 0;
        this._interviewTimerInterval = null;
        this._interviewStartListener = null;
        this._scale = 1;

        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.dragState = null;
        this.wasJustDragged = false;
        this.viewMode = 'insights';
        this.insightsMode = 'live';

        // STT State
        this.sttMessages = [];
        this.messageIdCounter = 0;
        this._shouldScrollAfterUpdate = false;
        this.handleSttUpdate = this.handleSttUpdate.bind(this);

        // Live Insights State
        this.turns = [];
        this._turnMap = new Map();
        this._handleTurnUpdate = this._handleTurnUpdate.bind(this);
        this._handleLiveAnswer = this._handleLiveAnswer.bind(this);
        this._handleTurnReset = this._handleTurnReset.bind(this);
    }

    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            color: #ffffff;
            font-family: 'PingFang SC', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
        }

        .scale-wrapper {
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
        }

        .frame {
            position: relative;
            width: 524px;
            height: 393px;
            transform: scale(var(--s, 1));
            transform-origin: center center;
            display: flex;
            flex-direction: row;
            background: linear-gradient(180deg, rgba(30, 20, 40, 0.95), rgba(20, 10, 30, 0.98));
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            outline: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        /* Background effects */
        .frame::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                radial-gradient(circle at 10% 20%, rgba(255, 100, 100, 0.15), transparent 40%),
                radial-gradient(circle at 90% 80%, rgba(100, 50, 200, 0.15), transparent 40%);
            pointer-events: none;
            z-index: 0;
        }

        .main-content {
            flex: 1;
            position: relative;
            padding: 24px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            z-index: 1;
            -webkit-app-region: no-drag; /* Ensure content is not draggable if frame is */
            overflow: hidden;
        }

        .content-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            gap: 12px;
            min-height: 0;
        }

        .live-answer-view {
            flex: 1;
            overflow-y: auto;
            padding: 0 4px 16px 0; /* Adjusted padding */
            display: flex;
            flex-direction: column;
            gap: 16px; /* Increased gap */
        }

        .live-answer-view::-webkit-scrollbar { width: 4px; }
        .live-answer-view::-webkit-scrollbar-track { background: transparent; }
        .live-answer-view::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }
        .live-answer-view::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }

        .turn-card {
            background: transparent; /* Transparent background as per design */
            border-radius: 0;
            padding: 0;
            border: none;
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 8px;
        }
        
        .turn-card.active { 
            border: none;
            box-shadow: none;
        }

        .question-label { 
            font-size: 12px; 
            color: rgba(255, 255, 255, 0.4); 
            margin-bottom: 4px;
        }
        
        .answer-label { 
            font-size: 12px; 
            color: rgba(255, 255, 255, 0.4); 
            margin-bottom: 4px;
            margin-top: 8px;
        }

        .question-text { 
            font-size: 14px; 
            color: rgba(255, 255, 255, 0.9); 
            line-height: 1.6; 
            white-space: pre-wrap; 
        }

        .answer-text { 
            font-size: 14px; 
            color: rgba(255, 255, 255, 0.9); 
            line-height: 1.6; 
            white-space: pre-wrap; 
        }

        .live-empty-state { 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            min-height: 150px; 
            color: rgba(255, 255, 255, 0.4); 
            font-size: 13px; 
        }
        
        .status-row { display: none; } /* Hide status row as per design */
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(0, 122, 255, 0.6); animation: pulse 1.4s ease-in-out infinite; }
        .status-dot.completed { background: rgba(46, 204, 113, 0.7); animation: none; }
        .status-dot.error { background: rgba(231, 76, 60, 0.75); animation: none; }
        @keyframes pulse { 0% { transform: scale(0.7); opacity: 0.6; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(0.7); opacity: 0.6; } }

        .status-header {
            font-size: 16px;
            color: rgba(255, 255, 255, 0.9);
            font-weight: 500;
            letter-spacing: 0.5px;
        }

        .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 13px;
            color: rgba(255, 255, 255, 0.6);
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .dot {
            width: 6px;
            height: 6px;
            background-color: #8251FF;
            border-radius: 50%;
            box-shadow: 0 0 8px #8251FF;
        }
        
        .dot.idle {
            background-color: #ffd28f;
            box-shadow: 0 0 8px rgba(255, 199, 143, 0.8);
        }
        
        .dot.listening {
            background-color: #79ffe1;
            box-shadow: 0 0 8px rgba(121, 255, 225, 0.8);
        }
        
        .dot.completed {
            background-color: #8fdeff;
            box-shadow: 0 0 8px rgba(143, 222, 255, 0.8);
        }

        .time-remaining {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .sidebar {
            width: 60px;
            background: rgba(255, 255, 255, 0.03);
            border-left: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding-top: 20px;
            padding-bottom: 20px;
            gap: 24px;
            z-index: 2;
            backdrop-filter: blur(10px);
        }

        .icon-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            color: rgba(255, 255, 255, 0.8);
            background: transparent;
            border: none;
            padding: 0;
        }

        .icon-btn:hover {
            color: #fff;
            background: rgba(255, 255, 255, 0.1);
        }
        
        .icon-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .icon-btn.primary {
            width: 44px;
            height: 44px;
            background: rgba(130, 81, 255, 0.2);
            border: 1px solid rgba(130, 81, 255, 0.4);
            color: #C17FFF;
            margin-bottom: 12px;
        }

        .icon-btn.primary:hover {
            background: rgba(130, 81, 255, 0.3);
            transform: scale(1.05);
            box-shadow: 0 0 15px rgba(130, 81, 255, 0.3);
        }
        
        .icon-btn.primary.active {
             background: rgba(255, 120, 180, 0.28);
             border-color: rgba(255, 120, 180, 0.5);
             color: #ff78b4;
        }
        
        .icon-btn.primary.done {
             background: rgba(84, 255, 201, 0.24);
             border-color: rgba(84, 255, 201, 0.5);
             color: #54ffc9;
        }
        
        .spacer {
            flex: 1;
        }

        svg {
            width: 20px;
            height: 20px;
            fill: currentColor;
        }
        
        .icon-btn.primary svg {
            width: 24px;
            height: 24px;
        }
        
        .loader {
            width: 18px;
            height: 18px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;

    _getListenButtonText(status) {
        switch (status) {
            case 'beforeSession': return 'Listen';
            case 'inSession': return 'Stop';
            case 'afterSession': return 'Done';
            default: return 'Listen';
        }
    }

    async handleMouseDown(e) {
        // Ignore mousedown originating from interactive controls
        if (e.target.closest('.icon-btn') || ['BUTTON', 'INPUT', 'SELECT', 'A', 'SVG'].includes(e.target.tagName)) {
            return;
        }

        e.preventDefault();

        // Use mainHeader API for positioning as it controls the window
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
            console.warn('[MainView] Failed to read interview start time from storage:', error);
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
        this._setupInterviewTimer();

        if (window.api) {
            this._sessionStateTextListener = (event, { success }) => {
                console.log('[MainView] Session state update received:', { success, currentStatus: this.listenSessionStatus });
                if (success) {
                    this.listenSessionStatus = ({
                        beforeSession: 'inSession',
                        inSession: 'afterSession',
                        afterSession: 'beforeSession',
                    })[this.listenSessionStatus] || 'beforeSession';
                } else {
                    this.listenSessionStatus = 'beforeSession';
                }
                console.log('[MainView] New session status:', this.listenSessionStatus);
                this.isTogglingSession = false;
            };
            window.api.mainHeader.onListenChangeSessionResult(this._sessionStateTextListener);

            this._shortcutListener = (event, keybinds) => {
                console.log('[MainView] Received updated shortcuts:', keybinds);
                this.shortcuts = keybinds;
            };
            window.api.mainHeader.onShortcutsUpdated(this._shortcutListener);

            this._setViewListener = (event, payload) => {
                if (!payload) return;
                const { view, insightsMode } = payload;
                if (view === 'transcript') {
                    this.viewMode = 'transcript';
                } else if (view === 'summary') {
                    this.viewMode = 'insights';
                    this.insightsMode = 'summary';
                } else if (view === 'live') {
                    this.viewMode = 'insights';
                    this.insightsMode = 'live';
                } else if (view === 'insights') {
                    this.viewMode = 'insights';
                    if (insightsMode) {
                        this.insightsMode = insightsMode;
                    }
                }
            };
            window.api.listenView.onSetView?.(this._setViewListener);

            // STT Listeners
            window.api.sttView.onSttUpdate(this.handleSttUpdate);

            // User state listener for totalInterviewSeconds
            this._userStateListener = (event, userState) => {
                if (userState?.totalInterviewSeconds) {
                    this.totalInterviewSeconds = userState.totalInterviewSeconds;
                    console.log('[MainView] Updated totalInterviewSeconds:', this.totalInterviewSeconds);
                }
            };
            window.api.common.onUserStateChanged(this._userStateListener);

            // Fetch initial user state
            window.api.common.getCurrentUser().then(userState => {
                if (userState?.totalInterviewSeconds) {
                    this.totalInterviewSeconds = userState.totalInterviewSeconds;
                    console.log('[MainView] Initial totalInterviewSeconds:', this.totalInterviewSeconds);
                }
            }).catch(() => { });

            // Live Insights Listeners
            if (window.api.liveInsights) {
                window.api.liveInsights.onTurnUpdate(this._handleTurnUpdate);
                window.api.liveInsights.onLiveAnswer(this._handleLiveAnswer);
                window.api.liveInsights.onTurnStateReset(this._handleTurnReset);

                // Initial fetch
                window.api.liveInsights.getTurnState?.().then(state => {
                    if (!state) return;
                    const turns = [];
                    for (const entry of state.activeTurns || []) {
                        if (entry.speaker !== 'Them') continue;
                        const turn = {
                            id: entry.id,
                            question: entry.partialText || entry.finalText || '',
                            answer: '',
                            status: entry.status || 'in_progress',
                            updatedAt: entry.updatedAt || Date.now(),
                            startedAt: entry.startedAt || Date.now(),
                        };
                        this._turnMap.set(turn.id, turn);
                        turns.push(turn);
                    }
                    for (const entry of state.turnHistory || []) {
                        if (entry.speaker !== 'Them') continue;
                        const turn = {
                            id: entry.id,
                            question: entry.finalText || entry.partialText || '',
                            answer: '',
                            status: entry.status || 'completed',
                            updatedAt: entry.completedAt || entry.updatedAt || Date.now(),
                            startedAt: entry.startedAt || Date.now(),
                        };
                        this._turnMap.set(turn.id, turn);
                        turns.push(turn);
                    }
                    if (turns.length > 0) {
                        this.turns = this._sortTurns();
                        this.requestUpdate();
                    }
                }).catch(() => { });
            }
        }

        this._resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const width = entry.contentRect?.width || this.getBoundingClientRect().width || 524;
                const scale = Math.max(0.75, Math.min(1.5, width / 524));
                this._scale = scale;
                this.style.setProperty('--s', String(scale));
            }
        });
        this._resizeObserver.observe(this);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._teardownInterviewTimer();

        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }

        if (window.api) {
            if (this._sessionStateTextListener) {
                window.api.mainHeader.removeOnListenChangeSessionResult(this._sessionStateTextListener);
            }
            if (this._shortcutListener) {
                window.api.mainHeader.removeOnShortcutsUpdated(this._shortcutListener);
            }
            if (this._setViewListener) {
                window.api.listenView.removeOnSetView?.(this._setViewListener);
            }

            // Remove STT/Live listeners
            window.api.sttView.removeOnSttUpdate(this.handleSttUpdate);
            if (window.api.liveInsights) {
                window.api.liveInsights.removeOnTurnUpdate(this._handleTurnUpdate);
                window.api.liveInsights.removeOnLiveAnswer(this._handleLiveAnswer);
                window.api.liveInsights.removeOnTurnStateReset(this._handleTurnReset);
            }

            // Remove user state listener
            if (this._userStateListener) {
                window.api.common.removeOnUserStateChanged(this._userStateListener);
            }
        }
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('sttMessages')) {
            if (this._shouldScrollAfterUpdate) {
                this.scrollToBottom();
                this._shouldScrollAfterUpdate = false;
            }
        }
    }

    // --- STT Logic ---
    handleSttUpdate(event, { speaker, text, isFinal, isPartial }) {
        console.log('[MainView] STT update:', { speaker, text, isFinal, messagesCount: this.sttMessages.length });
        if (text === undefined) return;

        const container = this.shadowRoot.querySelector('.transcription-view');
        this._shouldScrollAfterUpdate = container ? container.scrollTop + container.clientHeight >= container.scrollHeight - 10 : false;

        const findLastPartialIdx = spk => {
            for (let i = this.sttMessages.length - 1; i >= 0; i--) {
                const m = this.sttMessages[i];
                if (m.speaker === spk && m.isPartial) return i;
            }
            return -1;
        };

        const newMessages = [...this.sttMessages];
        const targetIdx = findLastPartialIdx(speaker);

        if (isPartial) {
            if (targetIdx !== -1) {
                newMessages[targetIdx] = { ...newMessages[targetIdx], text, isPartial: true, isFinal: false };
            } else {
                newMessages.push({ id: this.messageIdCounter++, speaker, text, isPartial: true, isFinal: false });
            }
        } else if (isFinal) {
            if (targetIdx !== -1) {
                newMessages[targetIdx] = { ...newMessages[targetIdx], text, isPartial: false, isFinal: true };
            } else {
                newMessages.push({ id: this.messageIdCounter++, speaker, text, isPartial: false, isFinal: true });
            }
        }

        this.sttMessages = newMessages;
        console.log('[MainView] Updated sttMessages:', this.sttMessages.length, 'messages');
    }

    scrollToBottom() {
        setTimeout(() => {
            const container = this.shadowRoot.querySelector('.transcription-view');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 0);
    }

    getSpeakerClass(speaker) {
        return speaker.toLowerCase() === 'me' ? 'me' : 'them';
    }

    // --- Live Insights Logic ---
    _handleTurnReset() {
        this._turnMap.clear();
        this.turns = [];
        this.requestUpdate();
    }

    _handleTurnUpdate(_, payload) {
        console.log('[MainView] Turn update:', payload);
        if (!payload || payload.speaker !== 'Them') return;

        const existing = this._turnMap.get(payload.id) || {
            id: payload.id,
            question: '',
            answer: '',
            status: 'in_progress',
            updatedAt: payload.timestamp || Date.now(),
            startedAt: payload.startedAt || payload.timestamp || Date.now(),
        };

        if (payload.text) {
            existing.question = payload.text.trim();
        }
        if (payload.event === 'finalized' || payload.status === 'completed') {
            existing.status = 'completed';
        } else {
            existing.status = 'in_progress';
        }
        existing.updatedAt = payload.timestamp || Date.now();

        this._turnMap.set(existing.id, existing);
        this.turns = this._sortTurns();
        this.requestUpdate();
    }

    _handleLiveAnswer(_, payload) {
        console.log('[MainView] Live answer:', payload);
        if (!payload || !payload.turnId) return;

        const existing = this._turnMap.get(payload.turnId);
        if (!existing) return;

        if (payload.answer !== undefined) {
            existing.answer = payload.answer;
        } else if (payload.token) {
            existing.answer = (existing.answer || '') + payload.token;
        }

        if (payload.status) {
            if (['completed', 'error', 'aborted'].includes(payload.status)) {
                existing.status = payload.status;
            } else if (['streaming', 'started'].includes(payload.status)) {
                existing.status = 'in_progress';
            }
        }

        existing.updatedAt = Date.now();
        this._turnMap.set(existing.id, existing);
        this.turns = this._sortTurns();
        this.requestUpdate();
    }

    _sortTurns() {
        return Array.from(this._turnMap.values())
            .filter(turn => turn.question && turn.question.trim().length > 0)
            .sort((a, b) => a.startedAt - b.startedAt);
    }

    _renderStatus(turn) {
        let statusText = '';
        let statusClass = 'status-dot';
        switch (turn.status) {
            case 'completed': statusText = 'Completed'; statusClass += ' completed'; break;
            case 'error': statusText = 'Error'; statusClass += ' error'; break;
            case 'aborted': statusText = 'Cancelled'; statusClass += ' error'; break;
            default: statusText = 'Listening...';
        }
        return html`
            <div class="status-row">
                <span class=${statusClass}></span>
                <span>${statusText}</span>
            </div>
        `;
    }

    showSettingsWindow(element) {
        if (this.wasJustDragged) return;
        if (window.api) {
            window.api.mainHeader.showSettingsWindow();
        }
    }

    hideSettingsWindow() {
        if (this.wasJustDragged) return;
        if (window.api) {
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

            // 🚀 Optimistic update: immediately change status for instant UI feedback
            const previousStatus = this.listenSessionStatus;
            const nextStatus = ({
                beforeSession: 'inSession',
                inSession: 'afterSession',
                afterSession: 'beforeSession',
            })[this.listenSessionStatus] || 'beforeSession';

            this.listenSessionStatus = nextStatus;
            console.log('[MainView] Optimistic status update:', previousStatus, '→', nextStatus);

            // Reset loading state immediately after optimistic update
            this.isTogglingSession = false;
            this.requestUpdate();

            if (window.api) {
                await window.api.mainHeader.sendListenButtonClick(listenButtonText);
            }
        } catch (error) {
            console.error('IPC invoke for session change failed:', error);
            // On error, the backend response will reset the status correctly
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

    async _handleScreenshotAskClick() {
        if (this.wasJustDragged) return;
        try {
            await window.api?.screenshotView?.toggle?.();
        } catch (error) {
            console.error('Screenshot toggle failed:', error);
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
            await window.api?.mainHeader?.toggleTranscriptView?.();
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
            Cmd: '⌘', Command: '⌘', Ctrl: '⌃', Control: '⌃',
            Alt: '⌥', Option: '⌥', Shift: '⇧', Enter: '↵',
            Backspace: '⌫', Delete: '⌦', Tab: '⇥', Escape: '⎋',
            Up: '↑', Down: '↓', Left: '←', Right: '→',
        };
        return accelerator.split('+').map(key => keyMap[key] || key).join(' ');
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

        const listenButtonClasses = ['icon-btn', 'primary'];
        if (isListening) listenButtonClasses.push('active');
        if (hasCompleted) listenButtonClasses.push('done');

        const askShortcutLabel = this.formatShortcutLabel(this.shortcuts?.nextStep);
        const toggleShortcutLabel = this.formatShortcutLabel(this.shortcuts?.toggleVisibility);
        const listenTitle = listenButtonText === 'Stop' ? '停止聆听' : listenButtonText === 'Done' ? '结束聆听' : '开始聆听';

        return html`
            <div class="scale-wrapper">
                <div class="frame" @mousedown=${this.handleMouseDown}>
                    <div class="main-content">
                        <div class="content-container">
                            <!-- Live Answer View (Unified View) -->
                            ${this.listenSessionStatus === 'inSession' || this.listenSessionStatus === 'afterSession'
                ? html`
                                <div class="live-answer-view">
                                    ${(!this.turns || this.turns.length === 0)
                        ? html`
                                            <div class="live-empty-state">等待对方发言...</div>
                                        `
                        : this.turns.map(turn => {
                            const latestTurnId = this.turns[this.turns.length - 1]?.id;
                            return html`
                                                <div class="turn-card ${turn.id === latestTurnId && turn.status !== 'completed' ? 'active' : ''}">
                                                    <div>
                                                        <div class="question-label">对方发言</div>
                                                        <div class="question-text">${turn.question}</div>
                                                    </div>
                                                    <div>
                                                        <div class="answer-label">AI回答</div>
                                                        <div class="answer-text">${turn.answer || '分析中...'}</div>
                                                    </div>
                                                    ${this._renderStatus(turn)}
                                                </div>
                                            `;
                        })
                    }
                                </div>
                            `
                : html`
                                <div class="status-header">${stateCopy.headline}</div>
                            `}
                        </div>
                        <div class="footer">
                                <div class="status-indicator">
                                    <div class="dot ${panelState}"></div>
                                    <span>${stateCopy.status}</span>
                                </div>
                                <div class="time-remaining">
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                                    <span>${this.totalInterviewSeconds > 0 ? `剩余 ${Math.max(0, Math.ceil((this.totalInterviewSeconds - this.interviewElapsedSeconds) / 60))} 分钟` : (panelState === 'idle' ? '计时 00:00' : `计时 ${elapsed}`)}</span>
                                </div>
                            </div>
                    </div>

                    <div class="sidebar">
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
                    ? html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
                    : isListening
                        ? html`<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>`
                        : html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="8" y1="6" x2="8" y2="18"></line><line x1="4" y1="10" x2="4" y2="14"></line><line x1="16" y1="6" x2="16" y2="18"></line><line x1="20" y1="10" x2="20" y2="14"></line></svg>`
            }
                        </button>
                        
                        <button 
                            class="icon-btn" 
                            @click=${this._handleAskClick}
title = ${askShortcutLabel ? `Ask (${askShortcutLabel})` : 'Ask'}
aria - label="Keyboard"
    >
    <svg viewBox="0 0 24 24"><path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z" fill="currentColor" /></svg>
                        </button >

    <button
        class="icon-btn" 
                            @click=${this._handleScreenshotAskClick}
title = "Screenshots"
aria - label="Scissors"
    >
    <svg viewBox="0 0 24 24"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3h-3z" fill="currentColor" /></svg>
                        </button >

    <button
        class="icon-btn" 
                            @click=${this._handleShowTranscriptClick}
title = "Show Transcript"
aria - label="Chat"
    >
    <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" fill="currentColor" /><path d="M7 9h10v2H7zm0-3h10v2H7z" /></svg>
                        </button >
                        
                        <div class="spacer"></div>

                        <button 
                            class="icon-btn" 
                            @click=${this._handleToggleAllWindowsVisibility}
title = ${toggleShortcutLabel ? `Show/Hide (${toggleShortcutLabel})` : 'Show/Hide'}
aria - label="Hidden"
    >
    <svg viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" fill="currentColor" /></svg>
                        </button >

    <button
        class="icon-btn" 
                            @mouseenter=${(e) => this.showSettingsWindow(e.currentTarget)}
@mouseleave=${() => this.hideSettingsWindow()}
aria - label="Menu"
    >
    <svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="currentColor" /></svg>
                        </button >
                    </div >
                </div >
            </div >
    `;
    }
}

customElements.define('main-view', MainView);
