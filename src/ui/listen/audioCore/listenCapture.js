const createAecModule = require('./aec.js');

let aecModPromise = null;     // Load only once
let aecMod        = null;
let aecPtr        = 0;        // Reuse a single Rust Aec* instance

/** Load WASM module and initialize once */
async function getAec () {
if (aecModPromise) return aecModPromise;   // Use cached promise

    aecModPromise = createAecModule().then((M) => {
        aecMod = M;

// Bind C symbols to JS wrappers (exactly once)
        M.newPtr   = M.cwrap('AecNew',        'number',
                            ['number','number','number','number']);
        M.cancel   = M.cwrap('AecCancelEcho', null,
                            ['number','number','number','number','number']);
        M.destroy  = M.cwrap('AecDestroy',    null, ['number']);
        return M;
    });

  return aecModPromise;
}

// To observe immediate load failure logs
// getAec().catch(console.error);
// ---------------------------
// Constants & Globals
// ---------------------------
const SAMPLE_RATE = 24000;
const AUDIO_CHUNK_DURATION = 0.1;
const BUFFER_SIZE = 4096;
const ENABLE_CUSTOM_MIC_AEC = false;

const isLinux = window.api.platform.isLinux;
const isMacOS = window.api.platform.isMacOS;

let mediaStream = null;
let micMediaStream = null;
let audioContext = null;
let audioProcessor = null;
let systemAudioContext = null;
let systemAudioProcessor = null;

let systemAudioBuffer = [];
const MAX_SYSTEM_BUFFER_SIZE = 10;

// 标记 session 是否仍然活跃，用于在音频采集时检查是否应该继续发送数据
let isSessionActive = true;

// ---------------------------
// Utility helpers (exact from renderer.js)
// ---------------------------
function isVoiceActive(audioFloat32Array, threshold = 0.005) {
    if (!audioFloat32Array || audioFloat32Array.length === 0) {
        return false;
    }

    let sumOfSquares = 0;
    for (let i = 0; i < audioFloat32Array.length; i++) {
        sumOfSquares += audioFloat32Array[i] * audioFloat32Array[i];
    }
    const rms = Math.sqrt(sumOfSquares / audioFloat32Array.length);

    // console.log(`VAD RMS: ${rms.toFixed(4)}`); // For debugging VAD threshold

    return rms > threshold;
}

function base64ToFloat32Array(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);

    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
    }

    return float32Array;
}

function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        // Improved scaling to prevent clipping
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/* ───────────────────────── JS ↔︎ WASM helpers ───────────────────────── */
function int16PtrFromFloat32(mod, f32) {
  const len   = f32.length;
  const bytes = len * 2;
  const ptr   = mod._malloc(bytes);
// If HEAP16 is unavailable, wrap directly with HEAPU8.buffer
  const heapBuf = (mod.HEAP16 ? mod.HEAP16.buffer : mod.HEAPU8.buffer);
  const i16   = new Int16Array(heapBuf, ptr, len);
  for (let i = 0; i < len; ++i) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    i16[i]  = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return { ptr, view: i16 };
}

function float32FromInt16View(i16) {
  const out = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; ++i) out[i] = i16[i] / 32768;
  return out;
}

/* On shutdown, if needed */
function disposeAec () {
  getAec().then(mod => { if (aecPtr) mod.destroy(aecPtr); });
}

// listenCapture.js

function runAecSync(micF32, sysF32) {
    if (!aecMod || !aecPtr || !aecMod.HEAPU8) {
        // console.log('🔊 No AEC module or heap buffer');
        return micF32;
    }

const frameSize = 160; // Frame size configured during AEC module initialization
    const numFrames = Math.floor(micF32.length / frameSize);

// Buffer to hold final processed audio data
    const processedF32 = new Float32Array(micF32.length);

// Match lengths of system and mic audio for stability
    let alignedSysF32 = new Float32Array(micF32.length);
    if (sysF32.length > 0) {
// Trim or pad sysF32 to match micF32 length
        const lengthToCopy = Math.min(micF32.length, sysF32.length);
        alignedSysF32.set(sysF32.slice(0, lengthToCopy));
    }


// Process 2400 samples in a loop of 160-sample frames
    for (let i = 0; i < numFrames; i++) {
        const offset = i * frameSize;

// Slice 160 samples for the current frame
        const micFrame = micF32.subarray(offset, offset + frameSize);
        const echoFrame = alignedSysF32.subarray(offset, offset + frameSize);

// Write frame data into WASM memory
        const micPtr = int16PtrFromFloat32(aecMod, micFrame);
        const echoPtr = int16PtrFromFloat32(aecMod, echoFrame);
        const outPtr = aecMod._malloc(frameSize * 2); // 160 * 2 bytes

// Run AEC (per 160 samples)
        aecMod.cancel(aecPtr, micPtr.ptr, echoPtr.ptr, outPtr, frameSize);

// Read processed frame data from WASM memory
        const heapBuf = (aecMod.HEAP16 ? aecMod.HEAP16.buffer : aecMod.HEAPU8.buffer);
        const outFrameI16 = new Int16Array(heapBuf, outPtr, frameSize);
        const outFrameF32 = float32FromInt16View(outFrameI16);

// Copy processed frame to the correct position in the final buffer
        processedF32.set(outFrameF32, offset);

// Free allocated memory
        aecMod._free(micPtr.ptr);
        aecMod._free(echoPtr.ptr);
        aecMod._free(outPtr);
    }

    return processedF32;
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
//                      New logic ends here
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
}


// System audio data handler
window.api.listenCapture.onSystemAudioData((event, { data }) => {
    systemAudioBuffer.push({
        data: data,
        timestamp: Date.now(),
    });

// Remove stale data
    if (systemAudioBuffer.length > MAX_SYSTEM_BUFFER_SIZE) {
        systemAudioBuffer = systemAudioBuffer.slice(-MAX_SYSTEM_BUFFER_SIZE);
    }
});

// ---------------------------
// Complete token tracker (exact from renderer.js)
// ---------------------------
let tokenTracker = {
    tokens: [],
    audioStartTime: null,

    addTokens(count, type = 'image') {
        const now = Date.now();
        this.tokens.push({
            timestamp: now,
            count: count,
            type: type,
        });

        this.cleanOldTokens();
    },

    calculateImageTokens(width, height) {
        const pixels = width * height;
        if (pixels <= 384 * 384) {
            return 85;
        }

        const tiles = Math.ceil(pixels / (768 * 768));
        return tiles * 85;
    },

    trackAudioTokens() {
        if (!this.audioStartTime) {
            this.audioStartTime = Date.now();
            return;
        }

        const now = Date.now();
        const elapsedSeconds = (now - this.audioStartTime) / 1000;

        const audioTokens = Math.floor(elapsedSeconds * 16);

        if (audioTokens > 0) {
            this.addTokens(audioTokens, 'audio');
            this.audioStartTime = now;
        }
    },

    cleanOldTokens() {
        const oneMinuteAgo = Date.now() - 60 * 1000;
        this.tokens = this.tokens.filter(token => token.timestamp > oneMinuteAgo);
    },

    getTokensInLastMinute() {
        this.cleanOldTokens();
        return this.tokens.reduce((total, token) => total + token.count, 0);
    },

    shouldThrottle() {
        const throttleEnabled = localStorage.getItem('throttleTokens') === 'true';
        if (!throttleEnabled) {
            return false;
        }

        const maxTokensPerMin = parseInt(localStorage.getItem('maxTokensPerMin') || '500000', 10);
        const throttleAtPercent = parseInt(localStorage.getItem('throttleAtPercent') || '75', 10);

        const currentTokens = this.getTokensInLastMinute();
        const throttleThreshold = Math.floor((maxTokensPerMin * throttleAtPercent) / 100);

        return currentTokens >= throttleThreshold;
    },

    // Reset the tracker
    reset() {
        this.tokens = [];
        this.audioStartTime = null;
    },
};

// Track audio tokens every few seconds
setInterval(() => {
    tokenTracker.trackAudioTokens();
}, 2000);

// ---------------------------
// Audio processing functions (exact from renderer.js)
// ---------------------------
async function setupMicProcessing(micStream) {
/* ── Load WASM first ───────────────────────── */
    if (ENABLE_CUSTOM_MIC_AEC) {
        const mod = await getAec();
        if (!aecPtr) aecPtr = mod.newPtr(160, 1600, 24000, 1);
    }

    const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    await micAudioContext.resume(); 
    const micSource = micAudioContext.createMediaStreamSource(micStream);
    const micProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    micProcessor.onaudioprocess = async (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);
        // console.log('🎤 micProcessor.onaudioprocess');

// Send when samplesPerChunk (=2400) are collected
        while (audioBuffer.length >= samplesPerChunk) {
            let chunk = audioBuffer.splice(0, samplesPerChunk);
let processedChunk = new Float32Array(chunk); // Default

            // ───────────────── WASM AEC ─────────────────
            if (ENABLE_CUSTOM_MIC_AEC && systemAudioBuffer.length > 0) {
                const latest = systemAudioBuffer[systemAudioBuffer.length - 1];
                const sysF32 = base64ToFloat32Array(latest.data);

                processedChunk = runAecSync(new Float32Array(chunk), sysF32);

                // 残差回声抑制：当系统音频较强（面试官在说话）且处理后的麦克风信号
                // 能量未明显超过系统音频时（说明是回声而非用户自己在说话），额外压制。
                // 若用户自己开口说话，声音能量会显著大于系统音频，suppressFactor → 1.0，不影响。
                let sysRms = 0;
                for (let i = 0; i < sysF32.length; i++) sysRms += sysF32[i] * sysF32[i];
                sysRms = Math.sqrt(sysRms / sysF32.length);

                if (sysRms > 0.015) {
                    let micRms = 0;
                    for (let i = 0; i < processedChunk.length; i++) micRms += processedChunk[i] * processedChunk[i];
                    micRms = Math.sqrt(micRms / processedChunk.length);

                    // 若处理后麦克风能量 < 系统音频的 2 倍，认为以回声为主，压制
                    if (micRms < sysRms * 2.0) {
                        const suppressFactor = Math.max(0.05, micRms / (sysRms * 3.0));
                        for (let i = 0; i < processedChunk.length; i++) {
                            processedChunk[i] *= suppressFactor;
                        }
                    }
                }
            }

            // 检查 session 是否仍然活跃，如果非活跃则停止发送音频
            if (!isSessionActive) {
                return; // 停止处理音频
            }

            const pcm16 = convertFloat32ToInt16(processedChunk);
            const b64 = arrayBufferToBase64(pcm16.buffer);

            try {
                const result = await window.api.listenCapture.sendMicAudioContent({
                    data: b64,
                    mimeType: 'audio/pcm;rate=24000',
                });

                // 如果后端返回 session 非活跃错误，立即停止音频采集
                if (!result.success && result.error === 'Session not active') {
                    console.warn('[listenCapture] Session no longer active, stopping audio capture');
                    isSessionActive = false;
                    stopCapture();
                }
            } catch (error) {
                console.error('[listenCapture] Failed to send mic audio:', error);
                // 如果是 session 非活跃错误，停止音频采集
                if (error.message && error.message.includes('not active')) {
                    isSessionActive = false;
                    stopCapture();
                }
            }
        }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micAudioContext.destination);

    audioProcessor = micProcessor;
    return { context: micAudioContext, processor: micProcessor };
}

function setupLinuxMicProcessing(micStream) {
    // Setup microphone audio processing for Linux
    const micAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const micSource = micAudioContext.createMediaStreamSource(micStream);
    const micProcessor = micAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    micProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...inputData);

        // Process audio in chunks
        while (audioBuffer.length >= samplesPerChunk) {
            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            await window.api.listenCapture.sendMicAudioContent({
                data: base64Data,
                mimeType: 'audio/pcm;rate=24000',
            });
        }
    };

    micSource.connect(micProcessor);
    micProcessor.connect(micAudioContext.destination);

    // Store processor reference for cleanup
    audioProcessor = micProcessor;
}

function setupSystemAudioProcessing(systemStream) {
    const systemAudioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const systemSource = systemAudioContext.createMediaStreamSource(systemStream);
    const systemProcessor = systemAudioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);

    let audioBuffer = [];
    const samplesPerChunk = SAMPLE_RATE * AUDIO_CHUNK_DURATION;

    systemProcessor.onaudioprocess = async e => {
        const inputData = e.inputBuffer.getChannelData(0);
        if (!inputData || inputData.length === 0) return;
        
        audioBuffer.push(...inputData);

        while (audioBuffer.length >= samplesPerChunk) {
            // 检查 session 是否仍然活跃，如果非活跃则停止发送音频
            if (!isSessionActive) {
                return; // 停止处理音频
            }

            const chunk = audioBuffer.splice(0, samplesPerChunk);
            const pcmData16 = convertFloat32ToInt16(chunk);
            const base64Data = arrayBufferToBase64(pcmData16.buffer);

            try {
                const result = await window.api.listenCapture.sendSystemAudioContent({
                    data: base64Data,
                    mimeType: 'audio/pcm;rate=24000',
                });

                // 如果后端返回 session 非活跃错误，立即停止音频采集
                if (!result.success && result.error === 'Session not active') {
                    console.warn('[listenCapture] Session no longer active, stopping system audio capture');
                    isSessionActive = false;
                    stopCapture();
                }
            } catch (error) {
                console.error('Failed to send system audio:', error);
                // 如果是 session 非活跃错误，停止音频采集
                if (error.message && error.message.includes('not active')) {
                    isSessionActive = false;
                    stopCapture();
                }
            }
        }
    };

    systemSource.connect(systemProcessor);
    systemProcessor.connect(systemAudioContext.destination);

    return { context: systemAudioContext, processor: systemProcessor };
}

// ---------------------------
// Main capture functions (exact from renderer.js)
// ---------------------------
async function startCapture(screenshotIntervalSeconds = 5, imageQuality = 'medium') {

    // Reset token tracker when starting new capture session
    tokenTracker.reset();

    // 重置 session 活跃标志
    isSessionActive = true;

    try {
        if (isMacOS) {

            const sessionActive = await window.api.listenCapture.isSessionActive();
            if (!sessionActive) {
                throw new Error('STT sessions not initialized - please wait for initialization to complete');
            }

            // On macOS, use SystemAudioDump for audio and getDisplayMedia for screen

            // Start macOS audio capture
            const audioResult = await window.api.listenCapture.startMacosSystemAudio();
            if (!audioResult.success) {
                console.warn('[listenCapture] macOS audio start failed:', audioResult.error);

// Already running → stop, then retry
                if (audioResult.error === 'already_running') {
                    await window.api.listenCapture.stopMacosSystemAudio();
                    await new Promise(r => setTimeout(r, 500));
                    const retry = await window.api.listenCapture.startMacosSystemAudio();
                    if (!retry.success) {
                        throw new Error('Retry failed: ' + retry.error);
                    }
                } else {
                    throw new Error('Failed to start macOS audio capture: ' + audioResult.error);
                }
            }

            try {
                micMediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: false,
                });

                const { context, processor } = await setupMicProcessing(micMediaStream);
                audioContext = context;
                audioProcessor = processor;
            } catch (micErr) {
                console.warn('Failed to get microphone on macOS:', micErr);
                throw new Error(`麦克风访问失败: ${micErr.message}。请确保：1) 麦克风已连接；2) 应用有麦克风权限；3) 麦克风没有被其他应用占用。`);
            }
            ////////// for index & subjects //////////

        } else if (isLinux) {

            const sessionActive = await window.api.listenCapture.isSessionActive();
            if (!sessionActive) {
                throw new Error('STT sessions not initialized - please wait for initialization to complete');
            }
            
            // Linux - use display media for screen capture and getUserMedia for microphone
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: 1,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false, // Don't use system audio loopback on Linux
            });

            // Get microphone input for Linux
            let micMediaStream = null;
            try {
                micMediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: false,
                });

                // Setup audio processing for microphone on Linux
                setupLinuxMicProcessing(micMediaStream);
            } catch (micError) {
                console.warn('Failed to get microphone access on Linux:', micError);
                throw new Error(`麦克风访问失败: ${micError.message}。请确保：1) 麦克风已连接；2) 应用有麦克风权限；3) 麦克风没有被其他应用占用。`);
            }

        } else {
            // Windows - capture mic and system audio separately using native loopback

            // Ensure STT sessions are initialized before starting audio capture
            const sessionActive = await window.api.listenCapture.isSessionActive();
            if (!sessionActive) {
                throw new Error('STT sessions not initialized - please wait for initialization to complete');
            }

            // 1. Get user's microphone
            try {
                micMediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        sampleRate: SAMPLE_RATE,
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: false,
                });
                const { context, processor } = await setupMicProcessing(micMediaStream);
                audioContext = context;
                audioProcessor = processor;
            } catch (micErr) {
                console.error('Could not get microphone access on Windows:', micErr);
                throw new Error(`麦克风访问失败: ${micErr.message}。请确保：1) 麦克风已连接；2) 应用有麦克风权限；3) 麦克风没有被其他应用占用。`);
            }

            // 2. Get system audio using native Electron loopback
            try {
                mediaStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true // This will now use native loopback from our handler
                });

                // Verify we got audio tracks
                const audioTracks = mediaStream.getAudioTracks();
                if (audioTracks.length === 0) {
                    throw new Error('No audio track in native loopback stream');
                }

                const { context, processor } = setupSystemAudioProcessing(mediaStream);
                systemAudioContext = context;
                systemAudioProcessor = processor;
            } catch (sysAudioErr) {
                console.error('Failed to start Windows native loopback audio:', sysAudioErr);
                throw new Error(`系统音频访问失败: ${sysAudioErr.message}。请确保：1) 点击"允许"授予屏幕和音频权限；2) 选择要共享的屏幕或窗口；3) 在弹出的权限对话框中勾选"分享音频"选项。`);
            }
        }
    } catch (err) {
        console.error('Error starting capture:', err);
        // Note: pickleGlass.e() is not available in this context, commenting out
        // pickleGlass.e().setStatus('error');
    }
}

function stopCapture() {
    // Clean up microphone resources
    if (audioProcessor) {
        audioProcessor.disconnect();
        audioProcessor = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }

    // Clean up system audio resources
    if (systemAudioProcessor) {
        systemAudioProcessor.disconnect();
        systemAudioProcessor = null;
    }
    if (systemAudioContext) {
        systemAudioContext.close();
        systemAudioContext = null;
    }

    // Stop and release media stream tracks
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if (micMediaStream) {
        micMediaStream.getTracks().forEach(t => t.stop());
        micMediaStream = null;
    }

    // Stop macOS audio capture if running
    if (isMacOS) {
        window.api.listenCapture.stopMacosSystemAudio().catch(err => {
            console.error('Error stopping macOS audio:', err);
        });
    }
}

// ---------------------------
// Exports & global registration
// ---------------------------
module.exports = {
getAec,          // Newly created initialization function
runAecSync,      // Synchronous version
disposeAec,      // Destroy Rust object if needed
    startCapture,
    stopCapture,
    isLinux,
    isMacOS,
};

// Expose functions to global scope for external access (exact from renderer.js)
if (typeof window !== 'undefined') {
    window.listenCapture = module.exports;
    window.pickleGlass = window.pickleGlass || {};
    window.pickleGlass.startCapture = startCapture;
    window.pickleGlass.stopCapture = stopCapture;
}