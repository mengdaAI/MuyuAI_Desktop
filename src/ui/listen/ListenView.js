import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';
import './stt/SttView.js';
import './summary/SummaryView.js';
import './live/LiveAnswerView.js';

export class ListenView extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 400px;
            height: 100%;
            min-height: 640px; /* Match MainHeader min-height */
            transform: translate3d(0, 0, 0);
            backface-visibility: hidden;
            transition: transform 0.2s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.2s ease-out;
            will-change: transform, opacity;
        }

        :host(.hiding) {
            animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }

        :host(.showing) {
            animation: slideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        :host(.hidden) {
            opacity: 0;
            transform: translateY(-150%) scale(0.85);
            pointer-events: none;
        }

        * {
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
        }

        /* Allow text selection in insights responses */
        .insights-container, .insights-container *, .markdown-content {
            user-select: text !important;
            cursor: text !important;
        }

        .assistant-container {
            display: flex;
            flex-direction: column;
            color: #ffffff;
            box-sizing: border-box;
            position: relative;
            background: linear-gradient(180deg, rgba(30, 20, 40, 0.95), rgba(20, 10, 30, 0.98)); /* Darker gradient */
            overflow: hidden;
            border-top-left-radius: 28px;
            border-bottom-left-radius: 28px;
            border-top-right-radius: 0;
            border-bottom-right-radius: 0;
            width: 100%;
            height: 100%;
            min-height: 640px;
        }

        /* Gradient overlay for the "reddish" look in the design */
        .assistant-container::before {
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

        .content-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 24px;
            position: relative;
            z-index: 1;
            overflow-y: auto;
        }

        .status-headline {
            font-size: 18px;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.9);
            margin-bottom: 20px;
        }

        .bottom-bar {
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 24px;
            background: rgba(0, 0, 0, 0.2);
            position: relative;
            z-index: 1;
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: rgba(255, 255, 255, 0.8);
        }

        .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: #7d5eff; /* Purple/Blue dot */
            box-shadow: 0 0 8px rgba(125, 94, 255, 0.6);
        }

        .timer-display {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: rgba(255, 255, 255, 0.6);
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar {
            width: 4px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
        }
    `;

    static properties = {
        viewMode: { type: String },
        insightsMode: { type: String },
        isHovering: { type: Boolean },
        isAnimating: { type: Boolean },
        copyState: { type: String },
        elapsedTime: { type: String },
        captureStartTime: { type: Number },
        isSessionActive: { type: Boolean },
        hasCompletedRecording: { type: Boolean },
    };

    constructor() {
        super();
        this.isSessionActive = false;
        this.hasCompletedRecording = false;
        this.viewMode = 'insights';
        this.insightsMode = 'live';
        this.isHovering = false;
        this.isAnimating = false;
        this.elapsedTime = '00:00';
        this.captureStartTime = null;
        this.timerInterval = null;
        this.adjustHeightThrottle = null;
        this.isThrottled = false;
        this.copyState = 'idle';
        this.copyTimeout = null;

        this.adjustWindowHeight = this.adjustWindowHeight.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        // Only start timer if session is active
        if (this.isSessionActive) {
            this.startTimer();
        }
        if (window.api) {
            window.api.listenView.onSessionStateChanged((event, { isActive }) => {
                const wasActive = this.isSessionActive;
                this.isSessionActive = isActive;

                if (!wasActive && isActive) {
                    this.hasCompletedRecording = false;
                    this.startTimer();
                    this.insightsMode = 'live';
                    // Reset child components
                    this.updateComplete.then(() => {
                        const sttView = this.shadowRoot.querySelector('stt-view');
                        const summaryView = this.shadowRoot.querySelector('summary-view');
                        if (sttView) sttView.resetTranscript();
                        if (summaryView) summaryView.resetAnalysis();
                    });
                    this.requestUpdate();
                }
                if (wasActive && !isActive) {
                    this.hasCompletedRecording = true;
                    this.stopTimer();
                    this.requestUpdate();
                }
            });
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
                this.requestUpdate();
                // We no longer adjust window height dynamically as it should match MainHeader
                // this.adjustWindowHeightThrottled(); 
            };
            window.api.listenView.onSetView?.(this._setViewListener);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.stopTimer();

        if (this.adjustHeightThrottle) {
            clearTimeout(this.adjustHeightThrottle);
            this.adjustHeightThrottle = null;
        }
        if (this.copyTimeout) {
            clearTimeout(this.copyTimeout);
        }
        if (window.api && this._setViewListener) {
            window.api.listenView.removeOnSetView?.(this._setViewListener);
            this._setViewListener = null;
        }
    }

    startTimer() {
        this.captureStartTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.captureStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60)
                .toString()
                .padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            this.elapsedTime = `${minutes}:${seconds}`;
            this.requestUpdate();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    adjustWindowHeight() {
        // Disabled dynamic height adjustment to keep it consistent with MainHeader
        /*
        if (!window.api) return;

        this.updateComplete
            .then(() => {
                // ... logic removed ...
                // window.api.listenView.adjustWindowHeight('listen', targetHeight);
            })
            .catch(error => {
                console.error('Error in adjustWindowHeight:', error);
            });
        */
    }

    setInsightsMode(mode) {
        if (this.insightsMode === mode) return;
        this.insightsMode = mode;
        if (this.viewMode !== 'insights') {
            this.viewMode = 'insights';
        }
        this.requestUpdate();
    }

    toggleViewMode() {
        this.viewMode = this.viewMode === 'insights' ? 'transcript' : 'insights';
        if (this.viewMode === 'insights' && !this.insightsMode) {
            this.insightsMode = 'live';
        }
        this.requestUpdate();
    }

    handleCopyHover(isHovering) {
        this.isHovering = isHovering;
        if (isHovering) {
            this.isAnimating = true;
        } else {
            this.isAnimating = false;
        }
        this.requestUpdate();
    }

    async handleCopy() {
        // ... (Copy logic remains if needed, but UI controls are removed)
    }

    adjustWindowHeightThrottled() {
        // Disabled
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        // Disabled height adjustment
    }

    handleSttMessagesUpdated(event) {
        // Disabled height adjustment
    }

    handleLiveAnswerUpdated() {
        // Disabled height adjustment
    }

    firstUpdated() {
        super.firstUpdated();
        // Ensure we set the height to match MainHeader initially if needed, 
        // but CSS height: 640px should handle it for now.
        if (window.api) {
            window.api.listenView.adjustWindowHeight('listen', 640);
        }
    }

    render() {
        return html`
            <div class="assistant-container">
                <div class="content-area">
                    <div class="status-headline">聆听对方发言中...</div>
                    
                    <stt-view 
                        .isVisible=${this.viewMode === 'transcript'}
                        @stt-messages-updated=${this.handleSttMessagesUpdated}
                    ></stt-view>

                    <live-answer-view
                        .isVisible=${this.viewMode === 'insights' && this.insightsMode === 'live'}
                        ?hidden=${!(this.viewMode === 'insights' && this.insightsMode === 'live')}
                        @live-answer-updated=${this.handleLiveAnswerUpdated}
                    ></live-answer-view>

                    <summary-view 
                        .isVisible=${this.viewMode === 'insights' && this.insightsMode === 'summary'}
                        .hasCompletedRecording=${this.hasCompletedRecording}
                    ></summary-view>
                </div>

                <div class="bottom-bar">
                    <div class="status-indicator">
                        <div class="status-dot"></div>
                        <span>聆听中...</span>
                    </div>
                    <div class="timer-display">
                        <span>🕒 剩余 67分钟</span>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('listen-view', ListenView);
