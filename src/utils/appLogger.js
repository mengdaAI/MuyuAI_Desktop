/**
 * appLogger.js
 * 将 Main Process 及所有 Renderer 窗口的 console 输出同时写入 app.log。
 *
 * - 开发模式：写入项目根目录 app.log
 * - 打包模式：写入 app.getPath('logs')/app.log（macOS: ~/Library/Logs/<AppName>/）
 * - 超过 5MB 自动轮转（重命名为 app.YYYY-MM-DDTHH-mm-ss.log），保留最近 3 份
 * - 每次启动写入分隔行，方便区分多次会话
 *
 * 用法（在 index.js 最顶部，require('electron') 之后立即调用）：
 *   const appLogger = require('./utils/appLogger');
 *   appLogger.init(app);                     // 初始化文件写入，覆盖 console
 *   appLogger.attachRenderer(win, 'content'); // 挂载 Renderer 窗口日志
 */

const fs   = require('fs');
const path = require('path');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_BACKUPS   = 3;

let _stream  = null;
let _logPath = null;
let _isProd  = false;

// 保留原始 console 引用（覆盖前保存）
const _orig = {
    log:   console.log.bind(console),
    info:  console.info  ? console.info.bind(console)  : console.log.bind(console),
    warn:  console.warn.bind(console),
    error: console.error.bind(console),
};

// ─── 内部工具 ────────────────────────────────────────────────────────────────

function _serialize(arg) {
    if (arg === null)        return 'null';
    if (arg === undefined)   return 'undefined';
    if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}${arg.stack ? '\n' + arg.stack : ''}`;
    }
    if (typeof arg === 'object') {
        try { return JSON.stringify(arg); } catch { return '[Object]'; }
    }
    return String(arg);
}

function _write(level, args) {
    if (!_stream) return;
    try {
        const ts  = new Date().toISOString();
        const msg = args.map(_serialize).join(' ');
        _stream.write(`${ts} [${level}] ${msg}\n`);
    } catch (_) {
        // 写入失败时不抛出，避免影响主流程
    }
}

function _rotateIfNeeded(logPath) {
    try {
        if (!fs.existsSync(logPath)) return;
        if (fs.statSync(logPath).size < MAX_FILE_SIZE) return;

        // 重命名旧文件
        const ts  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const bak = path.join(path.dirname(logPath), `app.${ts}.log`);
        fs.renameSync(logPath, bak);

        // 清理超出数量的备份（按名称升序，删最旧的）
        const dir  = path.dirname(logPath);
        const baks = fs.readdirSync(dir)
            .filter(f => /^app\.\d{4}-\d{2}-\d{2}T/.test(f) && f.endsWith('.log'))
            .sort();
        while (baks.length > MAX_BACKUPS) {
            try { fs.unlinkSync(path.join(dir, baks.shift())); } catch {}
        }
    } catch (_) {}
}

// ─── 公开 API ─────────────────────────────────────────────────────────────────

/**
 * 初始化日志文件，并覆盖 console.log / info / warn / error。
 *
 * 生产环境（app.isPackaged）策略：
 *   - console.log / console.info → 纯空函数，零开销，不写文件，不输出终端
 *   - console.warn / console.error → 写文件（不输出终端，避免无意义的 stderr）
 *
 * 开发环境：所有级别同时写终端 + 写文件，方便调试。
 *
 * @param {Electron.App} app  - Electron app 对象（require('electron').app）
 */
function init(app) {
    if (_stream) return; // 防止重复初始化

    const isProd = app.isPackaged;
    _isProd = isProd;

    const logDir = isProd
        ? app.getPath('logs')
        : path.join(__dirname, '..', '..'); // 开发模式：项目根目录

    try {
        fs.mkdirSync(logDir, { recursive: true });
    } catch (_) {}

    _logPath = path.join(logDir, 'app.log');
    _rotateIfNeeded(_logPath);

    try {
        _stream = fs.createWriteStream(_logPath, { flags: 'a' });
    } catch (e) {
        _orig.error('[AppLogger] 无法打开日志文件:', e.message);
        return;
    }

    // 启动分隔符
    const sep = '─'.repeat(72);
    _stream.write(`\n${sep}\n${new Date().toISOString()} SESSION START (${isProd ? 'production' : 'development'})\n${sep}\n`);

    if (isProd) {
        // 生产环境：log/info 静默，warn/error 只写文件（不打终端）
        const noop = () => {};
        console.log  = noop;
        console.info = noop;
        console.warn  = (...a) => _write('WARN ', a);
        console.error = (...a) => _write('ERROR', a);
    } else {
        // 开发环境：所有级别写终端 + 写文件
        console.log   = (...a) => { _orig.log(...a);   _write('INFO ', a); };
        console.info  = (...a) => { _orig.info(...a);  _write('INFO ', a); };
        console.warn  = (...a) => { _orig.warn(...a);  _write('WARN ', a); };
        console.error = (...a) => { _orig.error(...a); _write('ERROR', a); };
        _orig.log(`[AppLogger] 日志写入：${_logPath}`);
    }
}

/**
 * 将指定 BrowserWindow 的 Renderer console 输出也写入 app.log。
 * 每条日志前缀为 [R:<winName>]，方便区分来源。
 *
 * 生产环境只收 WARN（level=1）和 ERROR（level=2），跳过 INFO/DEBUG。
 *
 * @param {Electron.BrowserWindow} win
 * @param {string} winName - 窗口名称标签，如 'content'、'header'
 */
function attachRenderer(win, winName) {
    if (!win || !win.webContents) return;
    const tag = `[R:${winName || 'win'}]`;
    win.webContents.on('console-message', (_evt, level, message, line, sourceId) => {
        // level: 0=INFO, 1=WARN, 2=ERROR, 3=DEBUG
        // 生产环境只记录 WARN/ERROR
        if (_isProd && level !== 1 && level !== 2) return;
        const lvlMap = { 0: 'INFO ', 1: 'WARN ', 2: 'ERROR', 3: 'DEBUG' };
        const lv  = lvlMap[level] ?? 'INFO ';
        const src = sourceId ? ` @${path.basename(sourceId)}:${line}` : '';
        _write(lv, [`${tag} ${message}${src}`]);
    });
}

/** 返回当前日志文件路径（未初始化时为 null）。 */
function getPath() {
    return _logPath;
}

/** 关闭写入流（app 退出时调用）。 */
function close() {
    if (_stream) {
        try { _stream.end(); } catch (_) {}
        _stream = null;
    }
}

module.exports = { init, attachRenderer, getPath, close };
