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
        this.highlightVersion = 0;
        this.highlightRanges = [];
        this.isStreaming = false;
        this.abortController = null;
        this.reader = null;
        this.decoder = new TextDecoder();

        // 防抖定时器
        this._debounceTimer = null;
        /** SSE 可能跨 TCP chunk 分割，需缓冲到完整 \n\n 帧再解析 */
        this._sseBuffer = '';
        /** 防止 [DONE] / 正常收尾重复 send completed */
        this._liveStreamFinalized = false;
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
        this.highlightVersion = 0;
        this.highlightRanges = [];
        this.isStreaming = false;
        this._sseBuffer = '';
        this._liveStreamFinalized = false;
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
        this._sseBuffer = '';
        this._liveStreamFinalized = false;
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
        this.highlightVersion = 0;
        this.highlightRanges = [];
        this._sseBuffer = '';
        this._liveStreamFinalized = false;
        console.log(`[LiveInsightsService] streamLoop started for turn ${turnId}`);
        this.sendToRenderer('listen:live-answer', {
            turnId,
            status: 'started',
            answer: '',
            highlightVersion: 0,
            highlightRanges: [],
        });

        signal.addEventListener('abort', () => {
            if (this.reader) {
                this.reader.cancel(signal.reason).catch(() => {});
            }
        });

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                const chunk = this.decoder.decode(value, { stream: true });
                this._processChunk(chunk, turnId, reader);
            }
            const tail = this.decoder.decode();
            if (tail) {
                this._processChunk(tail, turnId, reader);
            }
            // 末尾半包 SSE（缺 \n\n）或 TCP 粘包导致未解析的帧，补分隔符再扫一遍
            if (this._sseBuffer.trim()) {
                this._processChunk('\n\n', turnId, reader);
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
        if (this._liveStreamFinalized) {
            return;
        }
        this._liveStreamFinalized = true;
        this.sendToRenderer('listen:live-answer', {
            turnId,
            status: 'completed',
            answer: this.fullAnswer,
            highlightVersion: this.highlightVersion,
            highlightRanges: this.highlightRanges,
        });
        this.isStreaming = false;
        this.reader = null;
        this.abortController = null;
    }

    _processChunk(chunk, turnId, reader) {
        this._sseBuffer += chunk;
        while (true) {
            const frameEnd = this._sseBuffer.indexOf('\n\n');
            if (frameEnd === -1) {
                break;
            }
            const frame = this._sseBuffer.slice(0, frameEnd);
            this._sseBuffer = this._sseBuffer.slice(frameEnd + 2);
            const trimmed = frame.trim();
            if (!trimmed || trimmed.startsWith(':')) {
                continue;
            }
            this._processSseFrame(frame, turnId, reader);
        }
    }

    /**
     * 解析单个 SSE 帧（含 event: 与 data:），与 Nest insights 控制器写入格式一致
     */
    _processSseFrame(frame, turnId, reader) {
        let eventName = null;
        const dataLines = [];
        for (const rawLine of frame.split('\n')) {
            const line = rawLine.replace(/\r$/, '');
            if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trim());
            }
        }
        const dataStr = dataLines.join('\n');
        if (!dataStr) {
            return;
        }
        if (dataStr === '[DONE]') {
            reader.cancel().catch(() => {});
            this.completeStream(turnId);
            return;
        }

        let json;
        try {
            json = JSON.parse(dataStr);
        } catch (err) {
            console.error(`[LiveInsightsService] JSON parse error for turn ${turnId}:`, err.message);
            return;
        }

        const evt = eventName || json.event;

        if (evt === 'skip' || json.event === 'skip') {
            this._handleSkipEvent(json, turnId, reader);
            return;
        }

        if (evt === 'error') {
            this.sendToRenderer('listen:live-answer', {
                turnId: json.turnId || turnId,
                status: 'error',
                error: typeof json.message === 'string' ? json.message : String(json.code || 'Insight stream error'),
                answer: this.fullAnswer,
            });
            return;
        }

        if (evt === 'highlight') {
            this._handleHighlightEvent(json, turnId);
            return;
        }

        if (json.status || json.answer !== undefined || json.reason || json.error) {
            this._handleStatusEvent(json, turnId);
            return;
        }

        const token = json.choices?.[0]?.delta?.content || json.token || '';
        if (token) {
            this.fullAnswer += token;
            this.sendToRenderer('listen:live-answer', {
                turnId,
                status: 'streaming',
                token,
                answer: this.fullAnswer,
                highlightVersion: this.highlightVersion,
                highlightRanges: this.highlightRanges,
            });
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
        if (event.status === 'completed') {
            this._liveStreamFinalized = true;
        }

        const payload = {
            turnId,
            status: event.status || 'streaming',
            answer: event.answer ?? this.fullAnswer,
            highlightVersion: this.highlightVersion,
            highlightRanges: this.highlightRanges,
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

    _handleHighlightEvent(event, turnId) {
        const version = Number(event?.version || 0);
        const ranges = Array.isArray(event?.ranges) ? event.ranges : [];
        if (version <= this.highlightVersion) {
            return;
        }
        this.highlightVersion = version;
        this.highlightRanges = ranges;
        this.sendToRenderer('listen:live-answer', {
            turnId,
            status: 'streaming',
            answer: this.fullAnswer,
            highlightVersion: this.highlightVersion,
            highlightRanges: this.highlightRanges,
        });
    }
}

module.exports = LiveInsightsService;
