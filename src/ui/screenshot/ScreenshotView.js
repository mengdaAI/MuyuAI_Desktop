import { html, css, LitElement } from '../../ui/assets/lit-core-2.7.4.min.js';
import { parser, parser_write, parser_end, default_renderer } from '../../ui/assets/smd.js';

export class ScreenshotView extends LitElement {
    static properties = {
        currentResponse: { type: String },
        isLoading: { type: Boolean },
        isStreaming: { type: Boolean },
    };

    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            color: white;
        }

        * {
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
        }

        .response-container, .response-container * {
            user-select: text !important;
            cursor: text !important;
        }

        .screenshot-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            background: linear-gradient(180deg, rgba(45, 40, 55, 0.95), rgba(35, 30, 45, 0.98));
            border-radius: 20px;
            outline: 1px rgba(255, 255, 255, 0.1) solid;
            outline-offset: -1px;
            backdrop-filter: blur(10px);
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }

        .screenshot-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.15);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            border-radius: 12px;
            filter: blur(10px);
            z-index: -1;
        }

        .response-container {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            font-size: 14px;
            line-height: 1.6;
            background: transparent;
            position: relative;
        }

        .response-container::-webkit-scrollbar {
            width: 6px;
        }

        .response-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
        }

        .response-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }

        .response-container::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .loading-dots {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 40px;
        }

        .loading-dot {
            width: 8px;
            height: 8px;
            background: rgba(255, 255, 255, 0.6);
            border-radius: 50%;
            animation: pulse 1.5s ease-in-out infinite;
        }

        .loading-dot:nth-child(1) {
            animation-delay: 0s;
        }

        .loading-dot:nth-child(2) {
            animation-delay: 0.2s;
        }

        .loading-dot:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes pulse {
            0%, 80%, 100% {
                opacity: 0.3;
                transform: scale(0.8);
            }
            40% {
                opacity: 1;
                transform: scale(1.2);
            }
        }

        .empty-state {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: rgba(255, 255, 255, 0.35);
            font-size: 14px;
            font-weight: 400;
        }

        .response-container pre {
            background: rgba(0, 0, 0, 0.4) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            margin: 8px 0 !important;
            overflow-x: auto !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }

        .response-container code {
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace !important;
            font-size: 11px !important;
        }

        .response-container p code {
            background: rgba(255, 255, 255, 0.1) !important;
            padding: 2px 4px !important;
            border-radius: 3px !important;
            color: #ffd700 !important;
        }

        /* Syntax highlighting */
        .hljs-keyword { color: #ff79c6 !important; }
        .hljs-string { color: #f1fa8c !important; }
        .hljs-comment { color: #6272a4 !important; }
        .hljs-number { color: #bd93f9 !important; }
        .hljs-function { color: #50fa7b !important; }
        .hljs-variable { color: #8be9fd !important; }
        .hljs-built_in { color: #ffb86c !important; }
        .hljs-title { color: #50fa7b !important; }
        .hljs-attr { color: #50fa7b !important; }
        .hljs-tag { color: #ff79c6 !important; }
    `;

    constructor() {
        super();
        this.currentResponse = '';
        this.isLoading = false;
        this.isStreaming = false;

        this.marked = null;
        this.hljs = null;
        this.DOMPurify = null;
        this.isLibrariesLoaded = false;

        this.smdParser = null;
        this.smdContainer = null;
        this.lastProcessedLength = 0;
    }

    connectedCallback() {
        super.connectedCallback();
        this.loadExternalLibraries();
        this.setupIpcListeners();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeIpcListeners();
    }

    async loadExternalLibraries() {
        try {
            if (typeof marked !== 'undefined') {
                this.marked = marked;
            }
            if (typeof hljs !== 'undefined') {
                this.hljs = hljs;
            }
            if (typeof DOMPurify !== 'undefined') {
                this.DOMPurify = DOMPurify;
            }
            this.isLibrariesLoaded = true;
        } catch (error) {
            console.error('Error loading external libraries:', error);
        }
    }

    setupIpcListeners() {
        if (!window.api?.screenshotView) return;

        this.handleStateUpdate = (event, state) => {
            if (state.isLoading !== undefined) this.isLoading = state.isLoading;
            if (state.isStreaming !== undefined) this.isStreaming = state.isStreaming;
            if (state.currentResponse !== undefined) this.currentResponse = state.currentResponse;
            this.requestUpdate();
        };

        this.handleStreamError = (event, { error }) => {
            console.error('Screenshot analysis error:', error);
            this.isLoading = false;
            this.isStreaming = false;
            this.currentResponse = `Error: ${error}`;
            this.requestUpdate();
        };

        window.api.screenshotView.onStateUpdate(this.handleStateUpdate);
        window.api.screenshotView.onStreamError(this.handleStreamError);
    }

    removeIpcListeners() {
        if (!window.api?.screenshotView) return;
        window.api.screenshotView.removeOnStateUpdate(this.handleStateUpdate);
        window.api.screenshotView.removeOnStreamError(this.handleStreamError);
    }

    renderContent() {
        const responseContainer = this.shadowRoot.getElementById('responseContainer');
        if (!responseContainer) return;

        if (this.isLoading) {
            responseContainer.innerHTML = `
                <div class="loading-dots">
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                </div>`;
            this.resetStreamingParser();
            return;
        }

        if (!this.currentResponse) {
            responseContainer.innerHTML = `<div class="empty-state">正在分析截屏...</div>`;
            this.resetStreamingParser();
            return;
        }

        this.renderStreamingMarkdown(responseContainer);
    }

    resetStreamingParser() {
        this.smdParser = null;
        this.smdContainer = null;
        this.lastProcessedLength = 0;
    }

    renderStreamingMarkdown(responseContainer) {
        try {
            if (!this.smdParser || this.smdContainer !== responseContainer) {
                this.smdContainer = responseContainer;
                this.smdContainer.innerHTML = '';

                const renderer = default_renderer(this.smdContainer);
                this.smdParser = parser(renderer);
                this.lastProcessedLength = 0;
            }

            const currentText = this.currentResponse;
            const newText = currentText.slice(this.lastProcessedLength);

            if (newText.length > 0) {
                parser_write(this.smdParser, newText);
                this.lastProcessedLength = currentText.length;
            }

            if (!this.isStreaming && !this.isLoading) {
                parser_end(this.smdParser);
            }

            if (this.hljs) {
                responseContainer.querySelectorAll('pre code').forEach(block => {
                    if (!block.hasAttribute('data-highlighted')) {
                        this.hljs.highlightElement(block);
                        block.setAttribute('data-highlighted', 'true');
                    }
                });
            }

            responseContainer.scrollTop = responseContainer.scrollHeight;
        } catch (error) {
            console.error('Error rendering streaming markdown:', error);
            responseContainer.textContent = this.currentResponse;
        }
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('isLoading') || changedProperties.has('currentResponse')) {
            this.renderContent();
        }
    }

    render() {
        return html`
            <div class="screenshot-container">
                <div class="response-container" id="responseContainer">
                    <div class="empty-state">正在分析截屏...</div>
                </div>
            </div>
        `;
    }
}

customElements.define('screenshot-view', ScreenshotView);
