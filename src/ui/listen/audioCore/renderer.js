// renderer.js
const listenCapture = require('./listenCapture.js');
const params        = new URLSearchParams(window.location.search);
const isListenView  = params.get('view') === 'listen';


window.pickleGlass = {
    startCapture: listenCapture.startCapture,
    stopCapture: listenCapture.stopCapture,
    isLinux: listenCapture.isLinux,
    isMacOS: listenCapture.isMacOS,
    captureManualScreenshot: listenCapture.captureManualScreenshot,
    getCurrentScreenshot: listenCapture.getCurrentScreenshot,
};


window.api.renderer.onChangeListenCaptureState((_event, { status }) => {
    if (!isListenView) {
        return;
    }
    if (status === "stop") {
        listenCapture.stopCapture();
    } else {
        listenCapture.startCapture();
    }
});

// 监听 session 强制关闭事件（如余额耗尽）
window.api.renderer.onSessionForceEnded((_event, data) => {
    if (!isListenView) {
        return;
    }
    console.log('[renderer] Session force ended:', data);
    listenCapture.stopCapture();
});

// 监听 session 状态变化事件
window.api.renderer.onSessionStateChanged((_event, { isActive }) => {
    if (!isListenView) {
        return;
    }
    if (!isActive) {
        console.log('[renderer] Session state changed to inactive, stopping capture');
        listenCapture.stopCapture();
    }
});
