const { createStreamingLLM } = require('../common/ai/factory');
const modelStateService = require('../common/services/modelStateService');
const { LIVE_INSIGHTS_SYSTEM_PROMPT, liveInsightsUserPrompt } = require('../common/prompts');
const { TextDecoder } = require('util');

class LiveInsightsService {
    constructor({ sendToRenderer }) {
        this.sendToRenderer = sendToRenderer;
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

    async handleTurnFinalized(turn) {
        if (!turn || turn.id !== this.currentTurnId) return;
        this.abortStream('turn_completed');
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
            const modelInfo = await modelStateService.getCurrentModelInfo('llm');
            if (!modelInfo || !modelInfo.apiKey) {
                throw new Error('AI model or API key is not configured.');
            }

            const prompt = this.buildPrompt(turn);
            const messages = [
                { role: 'system', content: prompt.system },
                { role: 'user', content: prompt.user },
            ];

            this.abortController = new AbortController();
            const streamingLLM = createStreamingLLM(modelInfo.provider, {
                apiKey: modelInfo.apiKey,
                model: modelInfo.model,
                temperature: 0.4,
                maxTokens: 1024,
                usePortkey: modelInfo.provider === 'openai-glass',
                portkeyVirtualKey: modelInfo.provider === 'openai-glass' ? modelInfo.apiKey : undefined,
            });

            const response = await streamingLLM.streamChat(messages);
            this.reader = response.body?.getReader?.();
            if (!this.reader) {
                throw new Error('Streaming reader unavailable from provider response.');
            }

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

    buildPrompt(turn) {
        const question = (turn.text || '').trim();
        const systemPrompt = LIVE_INSIGHTS_SYSTEM_PROMPT;
        const userPrompt = liveInsightsUserPrompt(question);

        return {
            system: systemPrompt,
            user: userPrompt,
        };
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
                for (const line of chunk.split('\n')) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (!data || data === '[DONE]') {
                        reader.cancel().catch(() => {});
                        this.completeStream(turnId);
                        return;
                    }
                    try {
                        const json = JSON.parse(data);
                        const token = json.choices?.[0]?.delta?.content || '';
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
}

module.exports = LiveInsightsService;
