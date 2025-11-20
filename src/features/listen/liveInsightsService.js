const { TextDecoder } = require('util');
const liveInsightsApi = require('./liveInsightsApi');

class LiveInsightsService {
    constructor({ sendToRenderer, buildStreamPayload } = {}) {
        this.sendToRenderer = sendToRenderer;
        this.buildStreamPayload = typeof buildStreamPayload === 'function' ? buildStreamPayload : null;
        this.currentTurnId = null;
        this.currentSpeaker = null;
        this.currentQuestion = '';
        this.fullAnswer = '';
        this.isStreaming = false;
        this.abortController = null;
        this.reader = null;
        this.decoder = new TextDecoder();
    }

    async handleTranscriptUpdate(turn) {
        if (!turn || !turn.text || !turn.text.trim()) return;
        if (turn.speaker !== 'Them') return;
        if (this.currentTurnId === turn.id && this.currentQuestion === turn.text && this.isStreaming) {
            return;
        }

        if (this.currentTurnId && this.currentTurnId !== turn.id) {
            this.abortStream('new_turn');
        }

        this.currentTurnId = turn.id;
        this.currentSpeaker = turn.speaker;
        this.currentQuestion = turn.text;

        await this.startStream(turn);
    }

    reset() {
        this.abortStream('reset');
        this.currentTurnId = null;
        this.currentSpeaker = null;
        this.currentQuestion = '';
        this.fullAnswer = '';
        this.isStreaming = false;
    }

    abortStream(reason = 'aborted') {
        if (this.abortController) {
            try {
                this.abortController.abort(reason);
            } catch (err) {}
        }
        if (this.reader) {
            try {
                this.reader.cancel(reason).catch(() => {});
            } catch (err) {}
            this.reader = null;
        }
        if (this.isStreaming) {
            this.sendToRenderer('listen:live-answer', {
                turnId: this.currentTurnId,
                status: 'aborted',
                reason,
                answer: this.fullAnswer,
            });
        }
        this.abortController = null;
        this.isStreaming = false;
    }

    async startStream(turn) {
        try {
            this.abortController = new AbortController();
            const payload = this.buildStreamPayload ? (this.buildStreamPayload(turn) || {}) : {};
            if (!payload.turn) {
                payload.turn = {
                    id: turn.id,
                    speaker: turn.speaker,
                    text: turn.text,
                    timestamp: turn.timestamp || Date.now(),
                };
            }
            this.reader = await liveInsightsApi.startInsightStream(payload, { signal: this.abortController.signal });
            this.streamLoop(this.reader, this.abortController.signal, turn.id);
        } catch (error) {
            this.sendToRenderer('listen:live-answer', {
                turnId: turn.id,
                status: 'error',
                error: error.message,
            });
            this.reset();
        }
    }

    async streamLoop(reader, signal, turnId) {
        this.isStreaming = true;
        this.fullAnswer = '';
        this.sendToRenderer('listen:live-answer', {
            turnId,
            status: 'started',
            answer: '',
        });

        signal.addEventListener('abort', () => {
            if (this.reader) {
                this.reader.cancel(signal.reason).catch(() => {});
            }
        });

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = this.decoder.decode(value);
                this._processChunk(chunk, turnId, reader);
            }
            this.completeStream(turnId);
        } catch (err) {
            if (signal.aborted) {
                this.sendToRenderer('listen:live-answer', {
                    turnId,
                    status: 'aborted',
                    reason: signal.reason,
                    answer: this.fullAnswer,
                });
            } else {
                this.sendToRenderer('listen:live-answer', {
                    turnId,
                    status: 'error',
                    error: err.message,
                });
            }
        } finally {
            this.isStreaming = false;
            this.reader = null;
            this.abortController = null;
        }
    }

    completeStream(turnId) {
        this.sendToRenderer('listen:live-answer', {
            turnId,
            status: 'completed',
            answer: this.fullAnswer,
        });
        this.isStreaming = false;
        this.reader = null;
        this.abortController = null;
    }

    _processChunk(chunk, turnId, reader) {
        for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data) continue;
            if (data === '[DONE]') {
                reader.cancel().catch(() => {});
                this.completeStream(turnId);
                return;
            }

            try {
                const json = JSON.parse(data);
                if (json.status || json.answer || json.reason || json.error) {
                    this._handleStatusEvent(json, turnId);
                    continue;
                }
                const token = json.choices?.[0]?.delta?.content || json.token || '';
                if (token) {
                    this.fullAnswer += token;
                    this.sendToRenderer('listen:live-answer', {
                        turnId,
                        status: 'streaming',
                        token,
                        answer: this.fullAnswer,
                    });
                }
            } catch (err) {
                continue;
            }
        }
    }

    _handleStatusEvent(event, turnId) {
        const payload = {
            turnId,
            status: event.status || 'streaming',
            answer: event.answer ?? this.fullAnswer,
        };

        if (event.reason) {
            payload.reason = event.reason;
        }
        if (event.error) {
            payload.error = event.error;
        }

        if (event.status === 'completed' && typeof event.answer === 'string') {
            this.fullAnswer = event.answer;
            payload.answer = event.answer;
        }

        this.sendToRenderer('listen:live-answer', payload);
    }
}

module.exports = LiveInsightsService;
