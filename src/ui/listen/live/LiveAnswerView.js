import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class LiveAnswerView extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 100%;
        }

        .answers-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 12px 16px 16px 16px;
            max-height: 600px;
            overflow-y: auto;
            box-sizing: border-box;
        }

        .answers-container::-webkit-scrollbar {
            width: 8px;
        }

        .answers-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.08);
            border-radius: 4px;
        }

        .answers-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.25);
            border-radius: 4px;
        }

        .answers-container::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.4);
        }

        .turn-card {
            background: rgba(0, 0, 0, 0.35);
            border-radius: 12px;
            padding: 12px 14px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .turn-card.active {
            border-color: rgba(0, 122, 255, 0.55);
            box-shadow: 0 0 12px rgba(0, 122, 255, 0.25);
        }

        .question-label,
        .answer-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: rgba(255, 255, 255, 0.55);
        }

        .question-text {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.92);
            line-height: 1.45;
            white-space: pre-wrap;
        }

        .answer-text {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.88);
            line-height: 1.5;
            white-space: pre-wrap;
        }

        .empty-state {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 150px;
            color: rgba(255, 255, 255, 0.6);
            font-size: 12px;
            font-style: italic;
            padding: 12px;
        }

        .status-row {
            display: flex;
            align-items: center;
            gap: 8px;
            color: rgba(255, 255, 255, 0.55);
            font-size: 11px;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: rgba(0, 122, 255, 0.6);
            animation: pulse 1.4s ease-in-out infinite;
        }

        .status-dot.completed {
            background: rgba(46, 204, 113, 0.7);
            animation: none;
        }

        .status-dot.error {
            background: rgba(231, 76, 60, 0.75);
            animation: none;
        }

        @keyframes pulse {
            0%   { transform: scale(0.7); opacity: 0.6; }
            50%  { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(0.7); opacity: 0.6; }
        }
    `;

    static properties = {
        turns: { type: Array },
        isVisible: { type: Boolean },
    };

    constructor() {
        super();
        this.turns = [];
        this.isVisible = true;

        this._turnMap = new Map();
        this._handleTurnUpdate = this._handleTurnUpdate.bind(this);
        this._handleLiveAnswer = this._handleLiveAnswer.bind(this);
        this._handleTurnReset = this._handleTurnReset.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        if (window.api?.liveInsights) {
            window.api.liveInsights.onTurnUpdate(this._handleTurnUpdate);
            window.api.liveInsights.onLiveAnswer(this._handleLiveAnswer);
            window.api.liveInsights.onTurnStateReset(this._handleTurnReset);

            // Seed with current state if available
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
                    this._notifyUpdated();
                }
            }).catch(() => {});
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.api?.liveInsights) {
            window.api.liveInsights.removeOnTurnUpdate(this._handleTurnUpdate);
            window.api.liveInsights.removeOnLiveAnswer(this._handleLiveAnswer);
            window.api.liveInsights.removeOnTurnStateReset(this._handleTurnReset);
        }
    }

    _handleTurnReset() {
        this._turnMap.clear();
        this.turns = [];
        this._notifyUpdated();
    }

    _handleTurnUpdate(_, payload) {
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
        this._notifyUpdated();
    }

    _handleLiveAnswer(_, payload) {
        if (!payload || !payload.turnId) return;

        const existing = this._turnMap.get(payload.turnId);
        if (!existing) return;

        if (payload.answer !== undefined) {
            existing.answer = payload.answer;
        } else if (payload.token) {
            existing.answer = (existing.answer || '') + payload.token;
        }

        if (payload.status === 'completed') {
            existing.status = 'completed';
        } else if (payload.status === 'error') {
            existing.status = 'error';
        } else if (payload.status === 'aborted') {
            existing.status = 'aborted';
        } else if (payload.status === 'streaming' || payload.status === 'started') {
            existing.status = 'in_progress';
        }

        existing.updatedAt = Date.now();
        this._turnMap.set(existing.id, existing);
        this.turns = this._sortTurns();
        this._notifyUpdated();
    }

    _sortTurns() {
        return Array.from(this._turnMap.values())
            .filter(turn => turn.question && turn.question.trim().length > 0)
            .sort((a, b) => a.startedAt - b.startedAt);
    }

    _notifyUpdated() {
        this.requestUpdate();
        this.dispatchEvent(new CustomEvent('live-answer-updated', {
            detail: { count: this.turns.length },
            bubbles: true,
            composed: true,
        }));
    }

    getAnswersText() {
        if (!this.turns || this.turns.length === 0) return '';
        return this.turns
            .map(turn => {
                const q = turn.question || '';
                const a = turn.answer || '';
                return `Them: ${q}\nAI: ${a}`;
            })
            .join('\n\n');
    }

    _renderStatus(turn) {
        let statusText = '';
        let statusClass = 'status-dot';
        switch (turn.status) {
            case 'completed':
                statusText = 'Completed';
                statusClass += ' completed';
                break;
            case 'error':
                statusText = 'Error';
                statusClass += ' error';
                break;
            case 'aborted':
                statusText = 'Cancelled';
                statusClass += ' error';
                break;
            default:
                statusText = 'Listening...';
        }
        return html`
            <div class="status-row">
                <span class=${statusClass}></span>
                <span>${statusText}</span>
            </div>
        `;
    }

    render() {
        if (!this.turns || this.turns.length === 0) {
            return html`<div class="answers-container">
                <div class="empty-state">等待对方发言以生成实时洞察...</div>
            </div>`;
        }

        const latestTurnId = this.turns[this.turns.length - 1]?.id;

        return html`
            <div class="answers-container">
                ${this.turns.map(turn => html`
                    <div class="turn-card ${turn.id === latestTurnId && turn.status !== 'completed' ? 'active' : ''}">
                        <div>
                            <div class="question-label">对方</div>
                            <div class="question-text">${turn.question}</div>
                        </div>
                        <div>
                            <div class="answer-label">Live Insights</div>
                            <div class="answer-text">${turn.answer || '分析中...'}</div>
                        </div>
                        ${this._renderStatus(turn)}
                    </div>
                `)}
            </div>
        `;
    }
}

customElements.define('live-answer-view', LiveAnswerView);
