/*
 - SttService 是监听页（Listen）里的语音转文字总控类，负责双通道会话（我方 Me、对方 Them）的建立、消息处理、渲染端更新、节流与完成判定、会话保活与续期，以及系统音频采集的管理。
 - 依赖关键组件： createSTT （根据提供商创建 STT 连接）、 modelStateService （读取当前 STT 模型与密钥）、 windowManager （向 Listen 窗口发 IPC）。
 */

const { BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const { createSTT, isVirtualOpenAIProvider } = require('../../common/ai/factory');
const modelStateService = require('../../common/services/modelStateService');

const COMPLETION_DEBOUNCE_MS = 2000; // 2 seconds
const MY_COMPLETION_DEBOUNCE_MS = 3500;

// ── New heartbeat / renewal constants ────────────────────────────────────────────
// Interval to send low-cost keep-alive messages so the remote service does not
// treat the connection as idle. One minute is safely below the typical 2-5 min
// idle timeout window seen on provider websockets.
const KEEP_ALIVE_INTERVAL_MS = 60 * 1000;         // 1 minute

// Interval after which we pro-actively tear down and recreate the STT sessions
// to dodge the 30-minute hard timeout enforced by some providers. 20 minutes
// gives a 10-minute safety buffer.
const SESSION_RENEW_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

// Duration to allow the old and new sockets to run in parallel so we don't
// miss any packets at the exact swap moment.
const SOCKET_OVERLAP_MS = 2 * 1000; // 2 seconds

// ── Auto-reconnect constants ───────────────────────────────────────────────
const MAX_RECONNECT_ATTEMPTS = 3;           // 最大重连次数
const RECONNECT_DELAY_MS = 2000;            // 重连间隔 2 秒
const RECONNECT_BACKOFF_MS = 3000;          // 指数退避增量

function normalizeLanguageCode(input) {
    const raw = (input || '').toString().trim().toLowerCase().replace(/_/g, '-');
    if (!raw) return 'zh';

    const aliases = {
        jp: 'ja',
        'ja-jp': 'ja',
        'zh-cn': 'zh',
        'zh-hans': 'zh',
        'en-us': 'en',
        'en-gb': 'en',
        'es-es': 'es',
        'es-mx': 'es',
        'ru-ru': 'ru',
    };

    if (aliases[raw]) return aliases[raw];
    if (raw.includes('-')) return raw.split('-')[0] || 'zh';
    return raw;
}

function resolveProviderLanguage(provider, rawLanguage, openAiOverride) {
    const normalized = normalizeLanguageCode(rawLanguage);
    const p = provider || 'unknown';

    // 历史兼容：仅对 OpenAI STT 保留该环境变量覆盖
    if (p === 'openai' && openAiOverride) {
        return openAiOverride;
    }

    // Gemini 需要 BCP-47 语言码
    if (p === 'gemini') {
        const geminiMap = {
            zh: 'zh-CN',
            en: 'en-US',
            ja: 'ja-JP',
            es: 'es-ES',
            ru: 'ru-RU',
        };
        return geminiMap[normalized] || `${normalized}-US`;
    }

    // OpenAI / Deepgram / Whisper 等优先使用短码
    return normalized || 'zh';
}

class SttService {
    constructor() {
        this.mySttSession = null;
        this.theirSttSession = null;
        this.myCurrentUtterance = '';
        this.theirCurrentUtterance = '';

        // Turn-completion debouncing
        this.myCompletionBuffer = '';
        this.theirCompletionBuffer = '';
        this.myCompletionTimer = null;
        this.theirCompletionTimer = null;

        // Timestamp tracking for new utterance detection
        this.myLastUpdateTime = 0;
        this.theirLastUpdateTime = 0;

        // Track last received complete text from Doubao API (for incremental extraction)
        this.myLastReceivedText = '';
        this.theirLastReceivedText = '';


        // System audio capture
        this.systemAudioProc = null;

        // Keep-alive / renewal timers
        this.keepAliveInterval = null;
        this.sessionRenewTimeout = null;

        // Callbacks
        this.onTranscriptionComplete = null;
        this.onStatusUpdate = null;
        this.onPartialTranscript = null;
        this.onAiTriggerOnly = null; // 软触发：只启动 AI，不创建新行

        // 两阶段定时器（Doubao 专用）
        // Timer A：1800ms 后仅触发 AI（不分行）
        // Timer B：3500ms 后完整 flush（分行 + AI 兜底）
        this.theirAiTriggerTimer = null;

        this.modelInfo = null;

        // ── Auto-reconnect state ───────────────────────────────────────────
        this._isReconnecting = false;
        this._reconnectAttempts = { my: 0, their: 0 };
        this._language = 'zh';
        this._reconnectTimeout = null;  // 保存重连超时引用以便清理
    }

    setCallbacks({ onTranscriptionComplete, onStatusUpdate, onPartialTranscript, onAiTriggerOnly }) {
        this.onTranscriptionComplete = onTranscriptionComplete;
        this.onStatusUpdate = onStatusUpdate;
        this.onPartialTranscript = onPartialTranscript;
        this.onAiTriggerOnly = onAiTriggerOnly || null;
    }

    emitPartialTranscript(speaker, text, extra = {}) {
        const payload = typeof text === 'object' ? text : { text };
        const normalizedText = payload?.text;

        if (!normalizedText || !normalizedText.trim()) return;

        if (this.onPartialTranscript) {
            try {
                this.onPartialTranscript({
                    speaker,
                    text: normalizedText,
                    timestamp: Date.now(),
                    isPartial: true,
                    isFinal: false,  // 默认值
                    ...extra,  // extra 会覆盖默认值
                    ...payload,  // payload 中的值优先级最高
                });
            } catch (err) {
                console.error('[SttService] Failed to emit partial transcript', err);
            }
        }
    }

    sendToRenderer(channel, data) {
        // Send Listen-related events only to the Listen window (prevents conflicts with Ask window)
        // Lazy-cache windowPool to avoid circular dependency at module load time
        if (!this._windowPool) {
            this._windowPool = require('../../../window/windowManager').windowPool;
        }
        const listenWindow = this._windowPool?.get('listen');

        if (listenWindow && !listenWindow.isDestroyed()) {
            listenWindow.webContents.send(channel, data);
        }
    }

    async handleSendSystemAudioContent(data, mimeType) {
        try {
            await this.sendSystemAudioContent(data, mimeType);
            this.sendToRenderer('system-audio-data', { data });
            return { success: true };
        } catch (error) {
            console.error('Error sending system audio:', error);
            return { success: false, error: error.message };
        }
    }

    flushMyCompletion() {
        const finalText = (this.myCompletionBuffer + this.myCurrentUtterance).trim();
        if (!this.modelInfo || !finalText) return;

        // Notify completion callback
        if (this.onTranscriptionComplete) {
            this.onTranscriptionComplete('Me', finalText);
        }

        // Send to renderer as final
        this.sendToRenderer('stt-update', {
            speaker: 'Me',
            text: finalText,
            isPartial: false,
            isFinal: true,
            timestamp: Date.now(),
        });

        this.myCompletionBuffer = '';
        if (this.myCompletionTimer) {
            clearTimeout(this.myCompletionTimer);
        }
        this.myCompletionTimer = null;
        this.myCurrentUtterance = '';

        if (this.onStatusUpdate) {
            this.onStatusUpdate('Listening...');
        }
    }

    flushTheirCompletion() {
        const finalText = (this.theirCompletionBuffer + this.theirCurrentUtterance).trim();
        if (!this.modelInfo || !finalText) {
            return;
        }

        // Notify completion callback
        if (this.onTranscriptionComplete) {
            this.onTranscriptionComplete('Them', finalText);
        }

        // Send to renderer as final
        this.sendToRenderer('stt-update', {
            speaker: 'Them',
            text: finalText,
            isPartial: false,
            isFinal: true,
            timestamp: Date.now(),
        });

        // 保存最后完成的 utterance，用于检测下一次是否包含重复内容
        this.theirLastCompletedUtterance = finalText;

        this.theirCompletionBuffer = '';
        if (this.theirCompletionTimer) {
            clearTimeout(this.theirCompletionTimer); // 确保 debounce 设的延迟 timer 也被清掉
        }
        this.theirCompletionTimer = null;
        this.theirCurrentUtterance = '';

        if (this.onStatusUpdate) {
            this.onStatusUpdate('Listening...');
        }
    }

    debounceMyCompletion(text) {
        if (this.modelInfo?.provider === 'gemini') {
            this.myCompletionBuffer += text;
        } else {
            this.myCompletionBuffer += (this.myCompletionBuffer ? ' ' : '') + text;
        }

        if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
        this.myCompletionTimer = setTimeout(() => this.flushMyCompletion(), MY_COMPLETION_DEBOUNCE_MS);
    }

    debounceTheirCompletion(text) {
        if (this.modelInfo?.provider === 'gemini') {
            this.theirCompletionBuffer += text;
        } else {
            this.theirCompletionBuffer += (this.theirCompletionBuffer ? ' ' : '') + text;
        }

        if (this.theirCompletionTimer) {
            clearTimeout(this.theirCompletionTimer);
        }
        this.theirCompletionTimer = setTimeout(() => {
            this.flushTheirCompletion();
        }, COMPLETION_DEBOUNCE_MS);
    }

    _hasOverlap(current, incoming) {
        if (!current || !incoming) return false;
        const minOverlap = 2;
        const maxOverlap = Math.min(current.length, incoming.length);
        for (let len = maxOverlap; len >= minOverlap; len--) {
            if (current.slice(-len) === incoming.slice(0, len)) {
                return true;
            }
        }
        return false;
    }

    // 计算两个文本之间的重叠长度（用于滑动窗口截断）
    _calculateOverlapLength(oldText, newText) {
        if (!oldText || !newText) return 0;
        // 最长可能重叠长度
        const maxPossible = Math.min(oldText.length, newText.length);
        // 至少重叠2个字符才算
        const minOverlap = 2;
        
        for (let len = maxPossible; len >= minOverlap; len--) {
            if (oldText.slice(-len) === newText.slice(0, len)) {
                return len;
            }
        }
        return 0;
    }

    // 检测两个文本是否有共同的开头（用于判断滑动窗口是否重置）
    _hasCommonStart(text1, text2, minLength = 10) {
        if (!text1 || !text2 || text1.length < minLength || text2.length < minLength) {
            return false;
        }
        // 检查 text1 的开头是否出现在 text2 的开头
        const start1 = text1.slice(0, minLength).toLowerCase();
        const start2 = text2.slice(0, minLength).toLowerCase();
        // 互相包含或相等
        return start1 === start2 || start1.includes(start2) || start2.includes(start1);
    }

    _extractIncrementalText(lastReceived, newComplete) {
        if (!lastReceived) return newComplete;
        if (!newComplete) return '';

        // 快速路径：严格前缀匹配
        if (newComplete.startsWith(lastReceived)) {
            return newComplete.slice(lastReceived.length).replace(/^[\s,，。、！？!?.…—–‐-]+/, '');
        }

        // 如果 newComplete 比 lastReceived 短，或包含在 lastReceived 中，
        // 说明是回溯修改/删除，返回空字符串（没有新增内容）
        if (newComplete.length <= lastReceived.length || lastReceived.includes(newComplete)) {
            return '';
        }

        // 模糊回退：匹配 lastReceived 末尾 N 个字符在 newComplete 中的位置。
        // Doubao 回溯补标点时通常只改中间的拼接点，而不会改"已处理文本的末尾"，
        // 因此用尾部定位比用整段前缀更稳定。
        const TAIL_MIN = 6;
        const TAIL_MAX = Math.min(lastReceived.length, 20);
        for (let tailLen = TAIL_MAX; tailLen >= TAIL_MIN; tailLen--) {
            const tail = lastReceived.slice(-tailLen);
            const idx = newComplete.indexOf(tail);
            // 匹配位置必须在合理范围内（不超过 lastReceived 长度的 1.5 倍+10），
            // 避免把正文中偶然出现的相同片段误判为拼接点
            if (idx !== -1 && idx + tailLen <= lastReceived.length * 1.5 + 10) {
                return newComplete.slice(idx + tailLen).replace(/^[\s,，。、！？!?.…—–‐-]+/, '');
            }
        }

        // 完全没有重叠：可能是 session 重置后的全新内容，直接返回
        return newComplete;
    }

    _mergeSlidingWindow(current, incoming) {
        if (!current) return incoming;
        if (!incoming) return current;

        // Fast path: incoming extends current (normal accumulation)
        if (incoming.startsWith(current)) {
            return incoming;
        }

        // Overlap check: find longest suffix of current that matches prefix of incoming
        const maxOverlap = Math.min(current.length, incoming.length);
        const minOverlap = 2; // Minimum overlap to consider valid stitching

        for (let len = maxOverlap; len >= minOverlap; len--) {
            if (current.slice(-len) === incoming.slice(0, len)) {
                return current + incoming.slice(len);
            }
        }

        // Fallback: Text is different but no clear overlap
        // This could be:
        // 1. A correction from the API (e.g., "Ideas" -> "Videos")
        // 2. A completely new segment
        // Strategy: Check if incoming contains the essence of current
        
        // If current is contained within incoming (even with corrections before/after), use incoming
        if (incoming.includes(current.slice(0, Math.min(current.length, 20)))) {
            return incoming;
        }
        
        // If incoming is significantly longer, it likely has more content
        if (incoming.length > current.length) {
            return incoming;
        }
        
        // Default: trust the API's latest result
        return incoming;
    }

    async initializeSttSessions(language = 'zh') {
        // 重置所有状态变量，防止跨会话污染
        this.myCurrentUtterance = '';
        this.theirCurrentUtterance = '';
        this.myCompletionBuffer = '';
        this.theirCompletionBuffer = '';
        this.myLastReceivedText = '';
        this.theirLastReceivedText = '';
        this.myLastCompletedUtterance = '';
        this.theirLastCompletedUtterance = '';

        const modelInfo = await modelStateService.getCurrentModelInfo('stt');
        if (!modelInfo || !modelInfo.apiKey) {
            throw new Error('AI model or API key is not configured.');
        }
        this.modelInfo = modelInfo;
        const effectiveLanguage = resolveProviderLanguage(
            this.modelInfo.provider,
            language,
            process.env.OPENAI_TRANSCRIBE_LANG
        );
        console.warn('[SttService][LanguageDebug] initializeSttSessions language resolved:', {
            provider: this.modelInfo.provider,
            model: this.modelInfo.model,
            rawLanguage: language,
            openAiOverride: process.env.OPENAI_TRANSCRIBE_LANG || null,
            effectiveLanguage,
        });

        // 保存 message handlers 供重连时使用
        this._myMessageHandler = null;
        this._theirMessageHandler = null;

        const handleMyMessage = message => {
            if (!this.modelInfo) {
                return;
            }
            // console.log('[SttService] handleMyMessage', message);

            if (this.modelInfo.provider === 'whisper') {
                // Whisper STT emits 'transcription' events with different structure
                if (message.text && message.text.trim()) {
                    const finalText = message.text.trim();

                    // Filter out Whisper noise transcriptions
                    const noisePatterns = [
                        '[BLANK_AUDIO]',
                        '[INAUDIBLE]',
                        '[MUSIC]',
                        '[SOUND]',
                        '[NOISE]',
                        '(BLANK_AUDIO)',
                        '(INAUDIBLE)',
                        '(MUSIC)',
                        '(SOUND)',
                        '(NOISE)'
                    ];

                    const isNoise = noisePatterns.some(pattern =>
                        finalText.includes(pattern) || finalText === pattern
                    );


                    if (!isNoise && finalText.length > 2) {
                        this.debounceMyCompletion(finalText);

                        this.sendToRenderer('stt-update', {
                            speaker: 'Me',
                            text: finalText,
                            isPartial: false,
                            isFinal: true,
                            timestamp: Date.now(),
                        });
                    }
                }
                return;
            } else if (this.modelInfo.provider === 'gemini') {
                if (message.serverContent?.turnComplete) {
                    if (this.myCompletionTimer) {
                        clearTimeout(this.myCompletionTimer);
                        this.flushMyCompletion();
                    }
                    return;
                }

                const transcription = message.serverContent?.inputTranscription;
                if (!transcription || !transcription.text) return;

                const textChunk = transcription.text;
                if (!textChunk.trim() || textChunk.trim() === '<noise>') {
                    return; // 1. Ignore whitespace-only chunks or noise
                }

                this.debounceMyCompletion(textChunk);

                this.sendToRenderer('stt-update', {
                    speaker: 'Me',
                    text: this.myCompletionBuffer,
                    isPartial: true,
                    isFinal: false,
                    timestamp: Date.now(),
                });

                this.emitPartialTranscript('Me', {
                    text: this.myCompletionBuffer,
                    provider: this.modelInfo?.provider,
                    isFinal: false
                });

                // Deepgram 
            } else if (this.modelInfo.provider === 'deepgram' || this.modelInfo.provider === 'doubao') {
                let text;
                let isFinal = false;

                if (this.modelInfo.provider === 'deepgram') {
                    text = message.channel?.alternatives?.[0]?.transcript;
                    isFinal = message.is_final;
                    if (!text || text.trim().length === 0) return;
                } else {
                    text = message.text || message.transcript || message.raw?.result?.text;
                    if (!text || text.trim().length === 0) return;
                    isFinal = message.isFinal ?? false;
                }

                if (isFinal) {
                    if (this.modelInfo.provider === 'doubao') {
                        // Doubao result_type='incremental'：直接用最新完整文本替换并 flush
                        this.myCurrentUtterance = text;
                        this.flushMyCompletion();
                        this.myCurrentUtterance = '';
                    } else {
                        this.myCurrentUtterance = '';
                        // For Deepgram/others that send isFinal but don't auto-flush in flushMyCompletion logic
                        this.sendToRenderer('stt-update', {
                            speaker: 'Me',
                            text: text,
                            isPartial: false,
                            isFinal: true,
                            timestamp: Date.now(),
                        });
                        this.emitPartialTranscript('Me', {
                            text: text,
                            provider: this.modelInfo?.provider,
                            isFinal: true
                        });
                    }
                } else {
                    // 增量模式：直接用最新完整文本替换（避免累积导致的重复问题）
                    if (this.modelInfo.provider === 'doubao') {
                        this.myCurrentUtterance = text;
                        const isFullMode = this.mySttSession?.sessionType === 'my';
                        const continuousText = isFullMode
                            ? this.myCurrentUtterance
                            : (this.myCompletionBuffer + ' ' + this.myCurrentUtterance).trim();
                        
                        this.sendToRenderer('stt-update', {
                            speaker: 'Me',
                            text: continuousText,
                            isPartial: true,
                            isFinal: false,
                            timestamp: Date.now(),
                        });
                        
                        this.emitPartialTranscript('Me', {
                            text: continuousText,
                            provider: this.modelInfo?.provider,
                        });
                        
                        // 重置完成定时器
                        if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
                        this.myCompletionTimer = setTimeout(() => {
                            this.flushMyCompletion();
                        }, MY_COMPLETION_DEBOUNCE_MS);
                    } else {
                        // 其他 provider 保持原有逻辑
                        if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
                        
                        const now = Date.now();
                        const currentUtterance = this.myCurrentUtterance || '';
                        
                        const isSignificantlyLong = currentUtterance.length > 20;
                        const isExtension = text.startsWith(currentUtterance.slice(0, 15));
                        const isDuplicate = currentUtterance === text || 
                                           (currentUtterance.length > 5 && text.length > 5 && 
                                            currentUtterance.includes(text));
                        
                        const isNewUtterance = isSignificantlyLong && !isExtension && !isDuplicate;
                        
                        if (isNewUtterance) {
                            const overlapLen = this._calculateOverlapLength(currentUtterance, text);
                            const uniquePart = overlapLen > 0 ? text.slice(overlapLen).trim() : text;
                            
                            const finalText = (this.myCompletionBuffer + ' ' + currentUtterance).trim();
                            this.emitPartialTranscript('Me', {
                                text: finalText,
                                provider: this.modelInfo?.provider,
                                isFinal: true
                            });
                            
                            this.myCompletionBuffer = '';
                            this.myCurrentUtterance = uniquePart;
                            this.myLastReceivedText = '';
                            
                            this.emitPartialTranscript('Me', {
                                text: uniquePart,
                                provider: this.modelInfo?.provider,
                                isFinal: false
                            });
                        } else {
                            this.myCurrentUtterance = this._mergeSlidingWindow(this.myCurrentUtterance, text);
                            
                            const continuousText = (this.myCompletionBuffer + ' ' + this.myCurrentUtterance).trim();

                            this.sendToRenderer('stt-update', {
                                speaker: 'Me',
                                text: continuousText,
                                isPartial: true,
                                isFinal: false,
                                timestamp: Date.now(),
                            });

                            this.emitPartialTranscript('Me', {
                                text: continuousText,
                                provider: this.modelInfo?.provider,
                            });
                        }

                        this.myCompletionTimer = setTimeout(() => {
                            this.flushMyCompletion();
                        }, MY_COMPLETION_DEBOUNCE_MS);
                    }
                }

            } else {
                const type = message.type;
                const text = message.transcript || message.delta || (message.alternatives && message.alternatives[0]?.transcript) || '';

                if (type === 'conversation.item.input_audio_transcription.delta') {
                    if (this.myCompletionTimer) clearTimeout(this.myCompletionTimer);
                    this.myCompletionTimer = null;
                    this.myCurrentUtterance += text;
                    const continuousText = this.myCompletionBuffer + (this.myCompletionBuffer ? ' ' : '') + this.myCurrentUtterance;
                    if (text && !text.includes('vq_lbr_audio_')) {
                        this.sendToRenderer('stt-update', {
                            speaker: 'Me',
                            text: continuousText,
                            isPartial: true,
                            isFinal: false,
                            timestamp: Date.now(),
                        });
                    }
                    this.emitPartialTranscript('Me', {
                        text: continuousText,
                        provider: this.modelInfo?.provider,
                    });
                } else if (type === 'conversation.item.input_audio_transcription.completed') {
                    if (text && text.trim()) {
                        const finalUtteranceText = text.trim();
                        this.myCurrentUtterance = '';
                        this.debounceMyCompletion(finalUtteranceText);
                    }
                }
            }

            if (message.error) {
                console.error('[Me] STT Session Error:', message.error);
            }
        };

        const handleTheirMessage = message => {
            if (!message || typeof message !== 'object') return;

            if (!this.modelInfo) {
                return;
            }

            if (this.modelInfo.provider === 'whisper') {
                // Whisper STT emits 'transcription' events with different structure
                if (message.text && message.text.trim()) {
                    const finalText = message.text.trim();

                    // Filter out Whisper noise transcriptions
                    const noisePatterns = [
                        '[BLANK_AUDIO]',
                        '[INAUDIBLE]',
                        '[MUSIC]',
                        '[SOUND]',
                        '[NOISE]',
                        '(BLANK_AUDIO)',
                        '(INAUDIBLE)',
                        '(MUSIC)',
                        '(SOUND)',
                        '(NOISE)'
                    ];

                    const isNoise = noisePatterns.some(pattern =>
                        finalText.includes(pattern) || finalText === pattern
                    );


                    // Only process if it's not noise, not a false positive, and has meaningful content
                    if (!isNoise && finalText.length > 2) {
                        this.debounceTheirCompletion(finalText);

                        this.sendToRenderer('stt-update', {
                            speaker: 'Them',
                            text: finalText,
                            isPartial: false,
                            isFinal: true,
                            timestamp: Date.now(),
                        });
                    }
                }
                return;
            } else if (this.modelInfo.provider === 'gemini') {
                if (message.serverContent?.turnComplete) {
                    if (this.theirCompletionTimer) {
                        clearTimeout(this.theirCompletionTimer);
                        this.flushTheirCompletion();
                    }
                    return;
                }

                const transcription = message.serverContent?.inputTranscription;
                if (!transcription || !transcription.text) return;

                const textChunk = transcription.text;
                if (!textChunk.trim() || textChunk.trim() === '<noise>') {
                    return; // 1. Ignore whitespace-only chunks or noise
                }

                this.debounceTheirCompletion(textChunk);

                this.sendToRenderer('stt-update', {
                    speaker: 'Them',
                    text: this.theirCompletionBuffer,
                    isPartial: true,
                    isFinal: false,
                    timestamp: Date.now(),
                });

                this.emitPartialTranscript('Them', {
                    text: this.theirCompletionBuffer,
                    provider: this.modelInfo?.provider,
                });

                // Deepgram
            } else if (this.modelInfo.provider === 'deepgram' || this.modelInfo.provider === 'doubao') {
                let text;
                let isFinal = false;

                if (this.modelInfo.provider === 'deepgram') {
                    text = message.channel?.alternatives?.[0]?.transcript;
                    if (!text || text.trim().length === 0) return;
                    isFinal = message.is_final;
                } else {
                    text = message.text || message.transcript || message.raw?.result?.text;
                    if (!text || text.trim().length === 0) return;
                    isFinal = message.isFinal ?? false;
                }

                if (isFinal) {
                    // 先清除所有定时器，避免竞态条件
                    if (this.theirAiTriggerTimer) {
                        clearTimeout(this.theirAiTriggerTimer);
                        this.theirAiTriggerTimer = null;
                    }
                    if (this.theirCompletionTimer) {
                        clearTimeout(this.theirCompletionTimer);
                        this.theirCompletionTimer = null;
                    }
                    if (this.modelInfo.provider === 'doubao') {
                        // Doubao result_type='incremental'：直接用最新完整文本替换并 flush
                        this.theirCurrentUtterance = text;
                        this.flushTheirCompletion();
                        this.theirCurrentUtterance = '';
                    } else {
                        this.theirCurrentUtterance = '';
                        this.debounceTheirCompletion(text);
                    }
                } else {
                    // ========== isFinal=false: 处理中间结果 ==========

                    if (this.theirCompletionTimer) {
                        clearTimeout(this.theirCompletionTimer);
                    }

                    // 增量模式：直接用最新完整文本替换（避免累积导致的重复问题）
                    if (this.modelInfo.provider === 'doubao') {
                        this.theirCurrentUtterance = text;
                    } else {
                        this.theirCurrentUtterance = text;
                    }

                    // 计算当前展示文本：buffer（已完成分句）+ 当前增量内容
                    const continuousText = (this.theirCompletionBuffer + ' ' + this.theirCurrentUtterance).trim();

                    // 1. 同步到 UI（显示中间结果）
                    this.sendToRenderer('stt-update', {
                        speaker: 'Them',
                        text: continuousText,
                        isPartial: true,
                        isFinal: false,
                        timestamp: Date.now(),
                    });

                    // 2. 发送事件给 listenService 处理 turn 管理
                    this.emitPartialTranscript('Them', {
                        text: continuousText,
                        provider: this.modelInfo?.provider,
                    });

                    // 3. 启动两阶段定时器（Doubao 专用）
                    if (this.modelInfo.provider === 'doubao') {
                        // Timer A（1500ms）：软触发 AI，不分行（缩短以减少延迟感）
                        if (this.theirAiTriggerTimer) clearTimeout(this.theirAiTriggerTimer);
                        this.theirAiTriggerTimer = setTimeout(() => {
                            this.theirAiTriggerTimer = null;
                            const text = (this.theirCompletionBuffer + ' ' + this.theirCurrentUtterance).trim();
                            if (text && this.onAiTriggerOnly) {
                                this.onAiTriggerOnly('Them', text);
                            }
                        }, 1500);

                        // Timer B（2500ms）：完整 flush，创建新行 + AI 兜底（缩短以减少卡顿感）
                        if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
                        this.theirCompletionTimer = setTimeout(() => {
                            this.theirCompletionTimer = null;
                            this.flushTheirCompletion();
                        }, 2500);
                    } else {
                        if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
                        this.theirCompletionTimer = setTimeout(() => {
                            this.flushTheirCompletion();
                        }, 800);
                    }
                }

            } else {
                const type = message.type;
                const text = message.transcript || message.delta || (message.alternatives && message.alternatives[0]?.transcript) || '';
                if (type === 'conversation.item.input_audio_transcription.delta') {
                    if (this.theirCompletionTimer) clearTimeout(this.theirCompletionTimer);
                    this.theirCompletionTimer = null;
                    this.theirCurrentUtterance += text;
                    const continuousText = this.theirCompletionBuffer + (this.theirCompletionBuffer ? ' ' : '') + this.theirCurrentUtterance;
                    if (text && !text.includes('vq_lbr_audio_')) {
                        this.sendToRenderer('stt-update', {
                            speaker: 'Them',
                            text: continuousText,
                            isPartial: true,
                            isFinal: false,
                            timestamp: Date.now(),
                        });
                    }
                    this.emitPartialTranscript('Them', {
                        text: continuousText,
                        provider: this.modelInfo?.provider,
                    });
                } else if (type === 'conversation.item.input_audio_transcription.completed') {
                    if (text && text.trim()) {
                        const finalUtteranceText = text.trim();
                        this.theirCurrentUtterance = '';
                        this.debounceTheirCompletion(finalUtteranceText);
                    }
                }
            }

            if (message.error) {
                console.error('[Them] STT Session Error:', message.error);
            }
        };

        const mySttConfig = {
            language: effectiveLanguage,
            callbacks: {
                onmessage: handleMyMessage,
                onerror: error => {
                    console.error('My STT session error:', error.message);
                    this._handleSTTError('my', error);
                },
                onclose: event => {
                    console.warn('My STT session closed:', event.reason);
                    this._handleSTTClose('my', event);
                },
            },
        };

        const theirSttConfig = {
            language: effectiveLanguage,
            callbacks: {
                onmessage: handleTheirMessage,
                onerror: error => {
                    console.error('Their STT session error:', error.message);
                    this._handleSTTError('their', error);
                },
                onclose: event => {
                    console.warn('Their STT session closed:', event.reason);
                    this._handleSTTClose('their', event);
                },
            },
        };

        const isVirtualProvider = isVirtualOpenAIProvider(this.modelInfo.provider);
        const sttOptions = {
            apiKey: this.modelInfo.apiKey,
            language: effectiveLanguage,
            model: this.modelInfo.model,
            usePortkey: isVirtualProvider,
            portkeyVirtualKey: isVirtualProvider ? this.modelInfo.apiKey : undefined,
        };

        // Add sessionType for Whisper to distinguish between My and Their sessions
        const myOptions = { ...sttOptions, callbacks: mySttConfig.callbacks, sessionType: 'my' };
        const theirOptions = { ...sttOptions, callbacks: theirSttConfig.callbacks, sessionType: 'their' };

        [this.mySttSession, this.theirSttSession] = await Promise.all([
            createSTT(this.modelInfo.provider, myOptions),
            createSTT(this.modelInfo.provider, theirOptions),
        ]);

        // ── Setup keep-alive heart-beats ────────────────────────────────────────
        if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = setInterval(() => {
            this._sendKeepAlive();
        }, KEEP_ALIVE_INTERVAL_MS);

        // ── Schedule session auto-renewal ───────────────────────────────────────
        if (this.sessionRenewTimeout) clearTimeout(this.sessionRenewTimeout);
        this.sessionRenewTimeout = setTimeout(async () => {
            try {
                await this.renewSessions(language);
            } catch (err) {
                console.error('[SttService] Failed to renew STT sessions:', err);
            }
        }, SESSION_RENEW_INTERVAL_MS);

        // 保存 language 供重连使用
        this._language = language;

        // 重置重连计数
        this._reconnectAttempts = { my: 0, their: 0 };

        // 保存 message handlers 供重连时使用
        this._myMessageHandler = handleMyMessage;
        this._theirMessageHandler = handleTheirMessage;

        return true;
    }

    /**
     * Send a lightweight keep-alive to prevent idle disconnects.
     * Currently only implemented for OpenAI provider because Gemini's SDK
     * already performs its own heart-beats.
     */
    _sendKeepAlive() {
        if (!this.isSessionActive()) return;

        if (this.modelInfo?.provider === 'openai') {
            try {
                this.mySttSession?.keepAlive?.();
                this.theirSttSession?.keepAlive?.();
            } catch (err) {
                console.error('[SttService] keepAlive error:', err.message);
            }
        }
    }

    /**
     * Gracefully tears down then recreates the STT sessions. Should be invoked
     * on a timer to avoid provider-side hard timeouts.
     */
    async renewSessions(language = 'zh') {
        if (!this.isSessionActive()) {
            console.warn('[SttService] renewSessions called but no active session.');
            return;
        }

        const oldMySession = this.mySttSession;
        const oldTheirSession = this.theirSttSession;

        // We reuse initializeSttSessions to create fresh sessions with the same
        // language and handlers. The method will update the session pointers
        // and timers, but crucially it does NOT touch the system audio capture
        // pipeline, so audio continues flowing uninterrupted.
        await this.initializeSttSessions(language);

        // Close the old sessions after a short overlap window.
        setTimeout(() => {
            try {
                oldMySession?.close?.();
                oldTheirSession?.close?.();
            } catch (err) {
                console.error('[SttService] Error closing old STT sessions:', err.message);
            }
        }, SOCKET_OVERLAP_MS);
    }

    async sendMicAudioContent(data, mimeType) {
        // const provider = await this.getAiProvider();
        // const isGemini = provider === 'gemini';

        if (!this.mySttSession) {
            throw new Error('User STT session not active');
        }

        let modelInfo = this.modelInfo;
        if (!modelInfo) {
            console.warn('[SttService] modelInfo not found, fetching on-the-fly as a fallback...');
            modelInfo = await modelStateService.getCurrentModelInfo('stt');
        }
        if (!modelInfo) {
            throw new Error('STT model info could not be retrieved.');
        }

        let payload;
        if (modelInfo.provider === 'gemini') {
            payload = { audio: { data, mimeType: mimeType || 'audio/pcm;rate=24000' } };
        } else if (modelInfo.provider === 'deepgram') {
            payload = Buffer.from(data, 'base64');
        } else {
            payload = data;
        }
        await this.mySttSession.sendRealtimeInput(payload);
    }

    async sendSystemAudioContent(data, mimeType) {
        if (!this.theirSttSession) {
            throw new Error('Their STT session not active');
        }

        let modelInfo = this.modelInfo;
        if (!modelInfo) {
            console.warn('[SttService] modelInfo not found, fetching on-the-fly as a fallback...');
            modelInfo = await modelStateService.getCurrentModelInfo('stt');
        }
        if (!modelInfo) {
            throw new Error('STT model info could not be retrieved.');
        }

        let payload;
        if (modelInfo.provider === 'gemini') {
            payload = { audio: { data, mimeType: mimeType || 'audio/pcm;rate=24000' } };
        } else if (modelInfo.provider === 'deepgram') {
            payload = Buffer.from(data, 'base64');
        } else {
            payload = data;
        }

        await this.theirSttSession.sendRealtimeInput(payload);
    }

    killExistingSystemAudioDump() {
        return new Promise(resolve => {
            const killProc = spawn('pkill', ['-f', 'SystemAudioDump'], {
                stdio: 'ignore',
            });

            killProc.on('close', code => {
                resolve();
            });

            killProc.on('error', err => {
                resolve();
            });

            setTimeout(() => {
                killProc.kill();
                resolve();
            }, 2000);
        });
    }

    async startMacOSAudioCapture() {
        if (process.platform !== 'darwin' || !this.theirSttSession) return false;

        await this.killExistingSystemAudioDump();

        const { app } = require('electron');
        const path = require('path');
        const systemAudioPath = app.isPackaged
            ? path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'ui', 'assets', 'SystemAudioDump')
            : path.join(app.getAppPath(), 'src', 'ui', 'assets', 'SystemAudioDump');

        this.systemAudioProc = spawn(systemAudioPath, [], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        if (!this.systemAudioProc.pid) {
            console.error('Failed to start SystemAudioDump');
            return false;
        }

        const CHUNK_DURATION = 0.1;
        const SAMPLE_RATE = 24000;
        const BYTES_PER_SAMPLE = 2;
        const CHANNELS = 2;
        const CHUNK_SIZE = SAMPLE_RATE * BYTES_PER_SAMPLE * CHANNELS * CHUNK_DURATION;

        let audioBuffer = Buffer.alloc(0);

        let modelInfo = this.modelInfo;
        if (!modelInfo) {
            console.warn('[SttService] modelInfo not found, fetching on-the-fly as a fallback...');
            modelInfo = await modelStateService.getCurrentModelInfo('stt');
        }
        if (!modelInfo) {
            throw new Error('STT model info could not be retrieved.');
        }

        this.systemAudioProc.stdout.on('data', async data => {
            audioBuffer = Buffer.concat([audioBuffer, data]);

            while (audioBuffer.length >= CHUNK_SIZE) {
                const chunk = audioBuffer.slice(0, CHUNK_SIZE);
                audioBuffer = audioBuffer.slice(CHUNK_SIZE);

                const monoChunk = CHANNELS === 2 ? this.convertStereoToMono(chunk) : chunk;
                const base64Data = monoChunk.toString('base64');

                this.sendToRenderer('system-audio-data', { data: base64Data });

                if (this.theirSttSession) {
                    try {
                        let payload;
                        if (modelInfo.provider === 'gemini') {
                            payload = { audio: { data: base64Data, mimeType: 'audio/pcm;rate=24000' } };
                        } else if (modelInfo.provider === 'deepgram') {
                            payload = Buffer.from(base64Data, 'base64');
                        } else {
                            payload = base64Data;
                        }

                        await this.theirSttSession.sendRealtimeInput(payload);
                    } catch (err) {
                        console.error('Error sending system audio:', err.message);
                    }
                }
            }
        });

        this.systemAudioProc.stderr.on('data', data => {
            console.error('SystemAudioDump stderr:', data.toString());
        });

        this.systemAudioProc.on('close', code => {
            console.warn('SystemAudioDump process closed with code:', code);
            this.systemAudioProc = null;
        });

        this.systemAudioProc.on('error', err => {
            console.error('SystemAudioDump process error:', err);
            this.systemAudioProc = null;
        });

        return true;
    }

    convertStereoToMono(stereoBuffer) {
        const samples = stereoBuffer.length / 4;
        const monoBuffer = Buffer.alloc(samples * 2);

        for (let i = 0; i < samples; i++) {
            const leftSample = stereoBuffer.readInt16LE(i * 4);
            monoBuffer.writeInt16LE(leftSample, i * 2);
        }

        return monoBuffer;
    }

    stopMacOSAudioCapture() {
        if (this.systemAudioProc) {
            console.warn('Stopping SystemAudioDump...');
            this.systemAudioProc.kill('SIGTERM');
            this.systemAudioProc = null;
        }
    }

    isSessionActive() {
        return !!this.mySttSession && !!this.theirSttSession;
    }

    /**
     * 处理 STT 错误事件，触发自动重连
     */
    _handleSTTError(sessionType, error) {
        const isMySession = sessionType === 'my';
        const session = isMySession ? this.mySttSession : this.theirSttSession;

        // 如果会话已不存在，不处理
        if (!session) return;

        // 检查是否需要重连
        if (this._reconnectAttempts[sessionType] < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_DELAY_MS + (this._reconnectAttempts[sessionType] * RECONNECT_BACKOFF_MS);
            console.log(`[SttService] Scheduling ${sessionType} STT reconnect attempt ${this._reconnectAttempts[sessionType] + 1}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
            this._scheduleReconnect(sessionType, delay);
        } else {
            console.error(`[SttService] ${sessionType} STT max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached, giving up.`);
            this._notifyReconnectFailure(sessionType);
        }
    }

    /**
     * 处理 STT 会话关闭事件，触发自动重连
     */
    _handleSTTClose(sessionType, event) {
        const isMySession = sessionType === 'my';
        const session = isMySession ? this.mySttSession : this.theirSttSession;

        // 如果会话已不存在，不处理
        if (!session) return;

        // 检查是否是正常关闭（如用户主动停止）
        // 这里假设 code 1000 是正常关闭
        if (event.code === 1000 || event.wasClean) {
            console.log(`[SttService] ${sessionType} STT session closed cleanly, not reconnecting.`);
            return;
        }

        // 非正常关闭，触发重连
        if (this._reconnectAttempts[sessionType] < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_DELAY_MS + (this._reconnectAttempts[sessionType] * RECONNECT_BACKOFF_MS);
            console.log(`[SttService] ${sessionType} STT session closed unexpectedly (code: ${event.code}), scheduling reconnect in ${delay}ms`);
            this._scheduleReconnect(sessionType, delay);
        } else {
            console.error(`[SttService] ${sessionType} STT max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached, giving up.`);
            this._notifyReconnectFailure(sessionType);
        }
    }

    /**
     * 调度重连任务
     */
    _scheduleReconnect(sessionType, delay) {
        this._reconnectAttempts[sessionType]++;

        // 清除之前的重连超时
        if (this._reconnectTimeout) {
            clearTimeout(this._reconnectTimeout);
        }

        this._reconnectTimeout = setTimeout(async () => {
            try {
                await this._reconnectSTTSession(sessionType);
                console.log(`[SttService] ${sessionType} STT reconnected successfully.`);
            } catch (err) {
                console.error(`[SttService] ${sessionType} STT reconnection failed:`, err.message);
                // 如果还有重试次数，继续重连
                if (this._reconnectAttempts[sessionType] < MAX_RECONNECT_ATTEMPTS) {
                    const retryDelay = RECONNECT_DELAY_MS + (this._reconnectAttempts[sessionType] * RECONNECT_BACKOFF_MS);
                    this._scheduleReconnect(sessionType, retryDelay);
                } else {
                    this._notifyReconnectFailure(sessionType);
                }
            }
        }, delay);
    }

    /**
     * 重新创建单个 STT 会话
     */
    async _reconnectSTTSession(sessionType) {
        const isMySession = sessionType === 'my';
        const oldSession = isMySession ? this.mySttSession : this.theirSttSession;

        // 关闭旧会话
        try {
            if (oldSession) {
                await oldSession.close();
            }
        } catch (err) {
            console.warn(`[SttService] Error closing old ${sessionType} STT session:`, err.message);
        }

        const language = this._language || 'zh';
        const effectiveLanguage = resolveProviderLanguage(
            this.modelInfo.provider,
            language,
            process.env.OPENAI_TRANSCRIBE_LANG
        );
        const isVirtualProvider = isVirtualOpenAIProvider(this.modelInfo.provider);

        // 复用 initializeSttSessions 中的配置逻辑来创建新会话
        const sttOptions = {
            apiKey: this.modelInfo.apiKey,
            language: effectiveLanguage,
            model: this.modelInfo.model,
            usePortkey: isVirtualProvider,
            portkeyVirtualKey: isVirtualProvider ? this.modelInfo.apiKey : undefined,
        };

        if (isMySession) {
            const mySttConfig = {
                language: effectiveLanguage,
                callbacks: {
                    onmessage: this._myMessageHandler || (() => {}),
                    onerror: error => {
                        console.error('My STT session error:', error.message);
                        this._handleSTTError('my', error);
                    },
                    onclose: event => {
                        console.warn('My STT session closed:', event.reason);
                        this._handleSTTClose('my', event);
                    },
                },
            };
            const myOptions = { ...sttOptions, callbacks: mySttConfig.callbacks, sessionType: 'my' };
            this.mySttSession = await createSTT(this.modelInfo.provider, myOptions);
        } else {
            const theirSttConfig = {
                language: effectiveLanguage,
                callbacks: {
                    onmessage: this._theirMessageHandler || (() => {}),
                    onerror: error => {
                        console.error('Their STT session error:', error.message);
                        this._handleSTTError('their', error);
                    },
                    onclose: event => {
                        console.warn('Their STT session closed:', event.reason);
                        this._handleSTTClose('their', event);
                    },
                },
            };
            const theirOptions = { ...sttOptions, callbacks: theirSttConfig.callbacks, sessionType: 'their' };
            this.theirSttSession = await createSTT(this.modelInfo.provider, theirOptions);
        }

        // 重置 lastReceivedText，防止重连后增量计算基准错误
        if (isMySession) {
            this.myLastReceivedText = '';
            this.myCurrentUtterance = '';
            this.myCompletionBuffer = '';
        } else {
            this.theirLastReceivedText = '';
            this.theirCurrentUtterance = '';
            this.theirCompletionBuffer = '';
        }

        // 更新会话活跃状态
        console.log(`[SttService] ${sessionType} STT session recreated.`);
    }

    /**
     * 通知重连失败（可选：可以通过 callback 通知 UI）
     */
    _notifyReconnectFailure(sessionType) {
        // 可以通过 onStatusUpdate 通知 UI
        if (this.onStatusUpdate) {
            this.onStatusUpdate(`语音服务连接失败，请重新开始面试`);
        }

        // 同时发送错误事件给 renderer
        this.sendToRenderer('stt-error', {
            sessionType,
            message: `${sessionType === 'my' ? '我方' : '对方'}语音识别服务连接失败`,
            timestamp: Date.now(),
        });
    }

    async closeSessions() {
        this.stopMacOSAudioCapture();

        // Clear heartbeat / renewal timers
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
        if (this.sessionRenewTimeout) {
            clearTimeout(this.sessionRenewTimeout);
            this.sessionRenewTimeout = null;
        }

        // Clear reconnect timeout
        if (this._reconnectTimeout) {
            clearTimeout(this._reconnectTimeout);
            this._reconnectTimeout = null;
        }

        // Reset reconnect attempts
        this._reconnectAttempts = { my: 0, their: 0 };

        // Clear timers
        if (this.myCompletionTimer) {
            clearTimeout(this.myCompletionTimer);
            this.myCompletionTimer = null;
        }
        if (this.theirCompletionTimer) {
            clearTimeout(this.theirCompletionTimer);
            this.theirCompletionTimer = null;
        }

        const closePromises = [];
        if (this.mySttSession) {
            closePromises.push(this.mySttSession.close());
            this.mySttSession = null;
        }
        if (this.theirSttSession) {
            closePromises.push(this.theirSttSession.close());
            this.theirSttSession = null;
        }

        await Promise.all(closePromises);
        console.warn('All STT sessions closed.');

        // Reset state
        this.myCurrentUtterance = '';
        this.theirCurrentUtterance = '';
        this.myCompletionBuffer = '';
        this.theirCompletionBuffer = '';
        this.myLastReceivedText = '';
        this.theirLastReceivedText = '';
        if (this.theirAiTriggerTimer) {
            clearTimeout(this.theirAiTriggerTimer);
            this.theirAiTriggerTimer = null;
        }

        // Clear message handlers
        this._myMessageHandler = null;
        this._theirMessageHandler = null;

        this.modelInfo = null;
    }
}

module.exports = SttService;
