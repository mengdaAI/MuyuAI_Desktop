const { TextDecoder } = require('util');
const liveInsightsApi = require('./liveInsightsApi');

// 防抖延迟：收到 partial transcript 后等待一段时间再启动 AI 流
// 避免频繁启动/中断 AI 流导致卡顿
const DEBOUNCE_DELAY_MS = 500;

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

        // 防抖定时器
        this._debounceTimer = null;
    }

    async handleTranscriptUpdate(turn) {
        if (!turn || !turn.text || !turn.text.trim()) return;
        if (turn.speaker !== 'Them') return;

        // 新 turn：立即启动，不防抖
        if (this.currentTurnId !== turn.id) {
            // 清除之前的防抖定时器
            if (this._debounceTimer) {
                clearTimeout(this._debounceTimer);
                this._debounceTimer = null;
            }

            if (this.currentTurnId && this.currentTurnId !== turn.id) {
                this.abortStream('new_turn');
            }

            this.currentTurnId = turn.id;
            this.currentSpeaker = turn.speaker;
            this.currentQuestion = turn.text;
            await this.startStream(turn);
            return;
        }

        // 同一个 turn 的更新：使用防抖，避免频繁启动 AI 流
        // 只有当文本长度增加超过一定阈值时才触发
        const prevLength = (this.currentQuestion || '').length;
        const newLength = (turn.text || '').length;

        // 如果文本长度没有明显增加（小于5个字符），忽略更新
        if (newLength - prevLength < 5 && this.isStreaming) {
            return;
        }

        // 更新当前问题文本
        this.currentQuestion = turn.text;

        // 如果正在流式传输中，不需要重启
        if (this.isStreaming) {
            return;
        }

        // 防抖：延迟启动 AI 流
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }

        this._debounceTimer = setTimeout(async () => {
            this._debounceTimer = null;
            if (this.currentTurnId === turn.id) {
                await this.startStream(turn);
            }
        }, DEBOUNCE_DELAY_MS);
    }

    reset() {
        // 清除防抖定时器
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }

        this.abortStream('reset');
        this.currentTurnId = null;
        this.currentSpeaker = null;
        this.currentQuestion = '';
        this.fullAnswer = '';
        this.isStreaming = false;
    }

    abortStream(reason = 'aborted') {
        // 清除防抖定时器
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = null;
        }

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
            console.error('[LiveInsightsService] startStream error:', error.message);
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
        const lines = chunk.split('\n');
        let currentEvent = null;

        for (const line of lines) {
            // 解析 event: 行
            if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
                continue;
            }

            if (!line.startsWith('data: ')) {
                // 空行重置事件类型
                if (line.trim() === '') {
                    currentEvent = null;
                }
                continue;
            }

            const data = line.slice(6).trim();
            if (!data) continue;
            if (data === '[DONE]') {
                reader.cancel().catch(() => {});
                this.completeStream(turnId);
                return;
            }

            try {
                const json = JSON.parse(data);

                // 处理 skip 事件：服务端判断问题为语气词，无需处理
                if (currentEvent === 'skip' || json.event === 'skip') {
                    this._handleSkipEvent(json, turnId, reader);
                    currentEvent = null;
                    return;
                }

                if (json.status || json.answer || json.reason || json.error) {
                    this._handleStatusEvent(json, turnId);
                    currentEvent = null;
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
                console.error(`[LiveInsightsService] Error parsing chunk for turn ${turnId}:`, err.message);
                continue;
            }
            currentEvent = null;
        }
    }

    _handleSkipEvent(event, turnId, reader) {
        // 取消流读取
        reader.cancel().catch(() => {});

        // 发送 skipped 状态给渲染进程
        this.sendToRenderer('listen:live-answer', {
            turnId: event.turnId || turnId,
            status: 'skipped',
            reason: event.reason || 'acknowledgment',
            confidence: event.confidence,
            method: event.method,
            detectionReason: event.detectionReason,
        });

        // 重置流状态
        this.isStreaming = false;
        this.reader = null;
        this.abortController = null;
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
