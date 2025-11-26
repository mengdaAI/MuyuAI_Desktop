class TranscriptView {
    constructor() {
        this.messagesContainer = document.getElementById('messages-container');
        this.setupListeners();
        this.renderInitialState();
    }

    setupListeners() {
        if (!window.api || !window.api.liveInsights) {
            console.error('[TranscriptView] window.api.liveInsights not available');
            return;
        }

        // Listen for transcript updates
        window.api.liveInsights.onTurnUpdate((event, turn) => {
            this.handleTurnUpdate(turn);
        });
    }

    renderInitialState() {
        console.log('[TranscriptView] Requesting initial state...');
        if (!window.api || !window.api.liveInsights) return;

        // Request initial history
        window.api.liveInsights.getTurnState().then(state => {
            console.log('[TranscriptView] Received initial state:', state);
            if (state && state.turnHistory) {
                console.log('[TranscriptView] Rendering history:', state.turnHistory.length, 'items');
                this.renderHistory(state.turnHistory);
            }
            if (state && state.activeTurns) {
                console.log('[TranscriptView] Rendering active turns:', state.activeTurns.length, 'items');
                state.activeTurns.forEach(turn => this.handleTurnUpdate(turn));
            }
        }).catch(err => {
            console.error('[TranscriptView] Error getting initial state:', err);
        });
    }

    renderHistory(history) {
        this.messagesContainer.innerHTML = '';
        history.forEach(turn => this.handleTurnUpdate(turn));
        this.scrollToBottom();
    }

    handleTurnUpdate(turn) {
        let text = turn.text;
        if (!text && (turn.finalText || turn.partialText)) {
            text = turn.finalText || turn.partialText;
        }

        if (!text || text.trim() === '') return;

        let messageElement = document.getElementById(`msg-${turn.id}`);
        const isMe = turn.speaker === 'Me';

        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.id = `msg-${turn.id}`;
            messageElement.className = `message ${isMe ? 'me' : 'them'}`;
            this.messagesContainer.appendChild(messageElement);
        }

        messageElement.textContent = text;

        // Add finalized class if turn is complete
        if (turn.status === 'completed' || turn.isFinal) {
            messageElement.classList.add('finalized');
        }

        this.scrollToBottom();
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    new TranscriptView();
});
