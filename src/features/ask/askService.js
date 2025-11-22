// Lazy require helper to avoid circular dependency issues
const getWindowManager = () => require('../../window/windowManager');
const internalBridge = require('../../bridge/internalBridge');
const askApi = require('./askApi');
const ossApi = require('../common/services/ossApi');

const getWindowPool = () => {
    try {
        return getWindowManager().windowPool;
    } catch {
        return null;
    }
};

const sessionRepository = require('../common/repositories/session');
const askRepository = require('./repositories');
const path = require('node:path');
const fs = require('node:fs');
const os = require('os');
const { promisify, TextDecoder } = require('util');
const execFile = promisify(require('child_process').execFile);
const { desktopCapturer } = require('electron');

// Try to load sharp, but don't fail if it's not available
let sharp;
try {
    sharp = require('sharp');
    console.log('[AskService] Sharp module loaded successfully');
} catch (error) {
    console.warn('[AskService] Sharp module not available:', error.message);
    console.warn('[AskService] Screenshot functionality will work with reduced image processing capabilities');
    sharp = null;
}
async function captureScreenshot(options = {}) {
    if (process.platform === 'darwin') {
        try {
            const tempPath = path.join(os.tmpdir(), `screenshot-${Date.now()}.jpg`);

            await execFile('screencapture', ['-x', '-t', 'jpg', tempPath]);

            const imageBuffer = await fs.promises.readFile(tempPath);
            await fs.promises.unlink(tempPath);

            if (sharp) {
                try {
                    // Resize + compress to keep clarity without exceeding payload limits
                    const baseImage = sharp(imageBuffer);
                    const metadata = await baseImage.metadata();
                    const targetHeight = 900;
                    const processedBuffer = await baseImage
                        .clone()
                        .resize({ height: targetHeight, withoutEnlargement: true })
                        .jpeg({ quality: 85 })
                        .toBuffer();

                    const resizedMeta = await sharp(processedBuffer).metadata();

                    return {
                        success: true,
                        buffer: processedBuffer,
                        width: resizedMeta.width ?? metadata.width ?? null,
                        height: resizedMeta.height ?? metadata.height ?? null,
                        mimeType: 'image/jpeg',
                    };
                } catch (sharpError) {
                    console.warn('Sharp module failed, falling back to basic image processing:', sharpError.message);
                }
            }
            
            // Fallback: Return the original image without resizing
            console.log('[AskService] Using fallback image processing (no resize/compression)');
            return {
                success: true,
                buffer: imageBuffer,
                width: null,
                height: null,
                mimeType: 'image/jpeg',
            };
        } catch (error) {
            console.error('Failed to capture screenshot:', error);
            return { success: false, error: error.message };
        }
    }

    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: {
                width: 1920,
                height: 1080,
            },
        });

        if (sources.length === 0) {
            throw new Error('No screen sources available');
        }
        const source = sources[0];
        const buffer = source.thumbnail.toJPEG(70);
        const size = source.thumbnail.getSize();

        return {
            success: true,
            buffer,
            width: size.width,
            height: size.height,
            mimeType: 'image/jpeg',
        };
    } catch (error) {
        console.error('Failed to capture screenshot using desktopCapturer:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * @class
 * @description
 */
class AskService {
    constructor() {
        this.abortController = null;
        this.state = {
            isVisible: false,
            isLoading: false,
            isStreaming: false,
            currentQuestion: '',
            currentResponse: '',
            showTextInput: true,
        };
        console.log('[AskService] Service instance created.');
    }

    _broadcastState() {
        const askWindow = getWindowPool()?.get('ask');
        if (askWindow && !askWindow.isDestroyed()) {
            askWindow.webContents.send('ask:stateUpdate', this.state);
        }
    }

    async toggleAskButton() {
        const askWindow = getWindowPool()?.get('ask');

        const hasContent = this.state.isLoading || this.state.isStreaming || (this.state.currentResponse && this.state.currentResponse.length > 0);

        if (askWindow && askWindow.isVisible() && hasContent) {
            this.state.showTextInput = !this.state.showTextInput;
            this._broadcastState();
        } else {
            if (askWindow && askWindow.isVisible()) {
                internalBridge.emit('window:requestVisibility', { name: 'ask', visible: false });
                this.state.isVisible = false;
            } else {
                console.log('[AskService] Showing hidden Ask window');
                internalBridge.emit('window:requestVisibility', { name: 'ask', visible: true });
                this.state.isVisible = true;
            }
            if (this.state.isVisible) {
                this.state.showTextInput = true;
                this._broadcastState();
            }
        }
    }

    async closeAskWindow () {
            if (this.abortController) {
                this.abortController.abort('Window closed by user');
                this.abortController = null;
            }
    
            this.state = {
                isVisible      : false,
                isLoading      : false,
                isStreaming    : false,
                currentQuestion: '',
                currentResponse: '',
                showTextInput  : true,
            };
            this._broadcastState();
    
            internalBridge.emit('window:requestVisibility', { name: 'ask', visible: false });
    
            return { success: true };
        }
    

    /**
     * 
     * @param {string[]} conversationTexts
     * @returns {string}
     * @private
     */
    _formatConversationForPrompt(conversationTexts) {
        if (!conversationTexts || conversationTexts.length === 0) {
            return 'No conversation history available.';
        }
        return conversationTexts.slice(-30).join('\n');
    }

    _buildAskApiPayload({ sessionId, userPrompt, conversationHistory, screenshot }) {
        const payload = {
            sessionId: sessionId || null,
            question: (userPrompt || '').trim(),
            context: {
                conversationHistory: conversationHistory || '',
            },
        };

        if (screenshot) {
            const url = typeof screenshot.url === 'string' ? screenshot.url.trim() : '';
            if (url) {
                payload.attachments = {
                    screenshot: {
                        url,
                        width: typeof screenshot.width === 'number' ? screenshot.width : null,
                        height: typeof screenshot.height === 'number' ? screenshot.height : null,
                        mimeType: screenshot.mimeType || 'image/jpeg',
                    },
                };
            }
        }

        return payload;
    }

    async _uploadScreenshotToOss(screenshot) {
        if (!screenshot || !screenshot.buffer || !screenshot.buffer.length) {
            return null;
        }
        try {
            const mimeType = screenshot.mimeType || 'image/jpeg';
            const fileExtension = (mimeType.split('/')?.[1] || 'jpeg').replace('jpeg', 'jpg');
            const base64Data = screenshot.buffer.toString('base64');
            console.log('[AskService] Uploading screenshot via server API', {
                mimeType,
                fileExtension,
                bufferSize: screenshot.buffer.length,
            });

            const uploadResult = await ossApi.uploadScreenshot({
                data: base64Data,
                mimeType,
                fileExtension,
                objectPrefix: 'ask-screenshots',
            });

            if (!uploadResult?.fileUrl) {
                throw new Error('OSS upload API response missing fileUrl');
            }

            console.log('[AskService] Server upload completed', { fileUrl: uploadResult.fileUrl });

            return {
                url: uploadResult.fileUrl,
                width: screenshot.width || null,
                height: screenshot.height || null,
                mimeType,
            };
        } catch (error) {
            console.error('[AskService] Screenshot upload failed:', error);
            return null;
        }
    }

    /**
     * 
     * @param {string} userPrompt
     * @returns {Promise<{success: boolean, response?: string, error?: string}>}
     */
    async sendMessage(userPrompt, conversationHistoryRaw = [], opts = {}) {
        const trimmedPrompt = (userPrompt || '').trim();
        if (!trimmedPrompt) {
            const askWin = getWindowPool()?.get('ask');
            const errorMessage = '请输入要发送的问题内容';
            if (askWin && !askWin.isDestroyed()) {
                askWin.webContents.send('ask-response-stream-error', { error: errorMessage });
            }
            return { success: false, error: errorMessage };
        }

        internalBridge.emit('window:requestVisibility', { name: 'ask', visible: true });
        this.state = {
            ...this.state,
            isLoading: true,
            isStreaming: false,
            currentQuestion: trimmedPrompt,
            currentResponse: '',
            showTextInput: false,
        };
        this._broadcastState();

        if (this.abortController) {
            this.abortController.abort('New request received.');
        }
        this.abortController = new AbortController();
        const { signal } = this.abortController;


        let sessionId;

        try {
            console.log(`[AskService] 🤖 Processing message: ${trimmedPrompt.substring(0, 50)}...`);

            sessionId = await sessionRepository.getOrCreateActive('ask');
            await askRepository.addAiMessage({ sessionId, role: 'user', content: trimmedPrompt });
            console.log(`[AskService] DB: Saved user prompt to session ${sessionId}`);
            
            const screenshotResult = await captureScreenshot({ quality: 'medium' });
            if (!screenshotResult.success) {
                console.warn('[AskService] Screenshot capture failed:', screenshotResult.error);
            }

            let uploadedScreenshot = null;
            if (screenshotResult.success && screenshotResult.buffer?.length) {
                uploadedScreenshot = await this._uploadScreenshotToOss(screenshotResult);
            }

            const conversationHistory = this._formatConversationForPrompt(conversationHistoryRaw);
            const payload = this._buildAskApiPayload({
                sessionId,
                userPrompt: trimmedPrompt,
                conversationHistory,
                screenshot: uploadedScreenshot,
            });

            const reader = await askApi.startAskStream(payload, { signal });
            console.log('[AskService] Ask API reader:', reader)
            const askWin = getWindowPool()?.get('ask');

            if (!askWin || askWin.isDestroyed()) {
                console.error('[AskService] Ask window is not available to send stream to.');
                if (typeof reader.cancel === 'function') {
                    reader.cancel('ask-window-missing').catch(() => {});
                }
                return { success: false, error: 'Ask window is not available.' };
            }

            signal.addEventListener('abort', () => {
                console.log(`[AskService] Aborting stream reader. Reason: ${signal.reason}`);
                reader.cancel(signal.reason).catch(() => { /* ignore */ });
            });

            await this._processStream(reader, askWin, sessionId, signal);
            // Auto-close Ask window after successful stream if requested
            if (opts && opts.autoClose) {
                try {
                    internalBridge.emit('window:requestVisibility', { name: 'ask', visible: false });
                    this.state.isVisible = false;
                    this._broadcastState();
                } catch (_) {}
            }
            return { success: true };

        } catch (error) {
            console.error('[AskService] Error during message processing:', error);
            this.state = {
                ...this.state,
                isLoading: false,
                isStreaming: false,
                showTextInput: true,
            };
            this._broadcastState();

            const askWin = getWindowPool()?.get('ask');
            if (askWin && !askWin.isDestroyed()) {
                const streamError = error.message || 'Unknown error occurred';
                askWin.webContents.send('ask-response-stream-error', { error: streamError });
            }

            // On error, if requested, also close ask window to prevent dangling view
            if (opts && opts.autoClose) {
                try {
                    internalBridge.emit('window:requestVisibility', { name: 'ask', visible: false });
                    this.state.isVisible = false;
                    this._broadcastState();
                } catch (_) {}
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * 
     * @param {ReadableStreamDefaultReader} reader
     * @param {BrowserWindow} askWin
     * @param {number} sessionId 
     * @param {AbortSignal} signal
     * @returns {Promise<void>}
     * @private
     */
    async _processStream(reader, askWin, sessionId, signal) {
        const decoder = new TextDecoder();
        let fullResponse = '';

        try {
            this.state.isLoading = false;
            this.state.isStreaming = true;
            this._broadcastState();

            let shouldStop = false;
            while (!shouldStop) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (!data) continue;
                    if (data === '[DONE]') {
                        shouldStop = true;
                        reader.cancel().catch(() => {});
                        break;
                    }

                    try {
                        const json = JSON.parse(data);
                        if (json.status === 'completed' && typeof json.answer === 'string') {
                            fullResponse = json.answer;
                            this.state.currentResponse = fullResponse;
                            this._broadcastState();
                            continue;
                        }
                        if (json.status === 'error' || json.error) {
                            throw new Error(json.error || 'Ask stream reported an error');
                        }
                        const token = json.token || json.choices?.[0]?.delta?.content || '';
                        if (token) {
                            fullResponse += token;
                            this.state.currentResponse = fullResponse;
                            this._broadcastState();
                        }
                    } catch (parseError) {
                        continue;
                    }
                }
            }
        } catch (streamError) {
            if (signal.aborted) {
                console.log(`[AskService] Stream reading was intentionally cancelled. Reason: ${signal.reason}`);
            } else {
                console.error('[AskService] Error while processing stream:', streamError);
                if (askWin && !askWin.isDestroyed()) {
                    askWin.webContents.send('ask-response-stream-error', { error: streamError.message });
                }
            }
        } finally {
            this.state.isStreaming = false;
            this.state.currentResponse = fullResponse;
            this._broadcastState();
            if (fullResponse) {
                 try {
                    await askRepository.addAiMessage({ sessionId, role: 'assistant', content: fullResponse });
                    console.log(`[AskService] DB: Saved partial or full assistant response to session ${sessionId} after stream ended.`);
                } catch(dbError) {
                    console.error("[AskService] DB: Failed to save assistant response after stream ended:", dbError);
                }
            }
        }
    }

}

const askService = new AskService();

module.exports = askService;
