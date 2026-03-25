/**
 * 日志工具 - 控制台日志分级
 * 在生产环境可选择性关闭详细日志
 */

const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4,
};

// 当前日志级别 - 可通过环境变量或配置覆盖
const currentLevel = process.env.LOG_LEVEL 
    ? LOG_LEVELS[process.env.LOG_LEVEL] 
    : LOG_LEVELS.info; // 默认 info 级别

function createLogger(prefix) {
    return {
        error: (...args) => {
            if (LOG_LEVELS.error <= currentLevel) {
                console.error(`[${prefix}]`, ...args);
            }
        },
        warn: (...args) => {
            if (LOG_LEVELS.warn <= currentLevel) {
                console.warn(`[${prefix}]`, ...args);
            }
        },
        info: (...args) => {
            if (LOG_LEVELS.info <= currentLevel) {
                console.log(`[${prefix}]`, ...args);
            }
        },
        debug: (...args) => {
            if (LOG_LEVELS.debug <= currentLevel) {
                console.log(`[${prefix}]`, ...args);
            }
        },
        // 仅在 trace 级别打印，不传参数避免开销
        trace: (...args) => {
            if (LOG_LEVELS.trace <= currentLevel) {
                console.log(`[${prefix}]`, ...args);
            }
        },
    };
}

module.exports = { createLogger, LOG_LEVELS };