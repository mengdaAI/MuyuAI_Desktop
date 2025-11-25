# Electron 应用实时调试指南

## 🚀 快速开始

### **方法 1: 使用现有的开发模式 (推荐)**

```bash
# 启用自动重载和调试模式
ENABLE_ELECTRON_RELOAD=true INTERVIEW_PASSCODE_REQUIRED=false DEBUG_FORCE_MAIN_HEADER=true npm start
```

**这个命令会**:
- ✅ 自动重载主进程代码 (修改 `src/index.js` 等文件会自动重启)
- ✅ 自动重载渲染进程代码 (修改 UI 文件会自动刷新)
- ✅ 跳过面试口令验证
- ✅ 直接显示主界面

---

### **方法 2: 分离式开发 (更灵活)**

**终端 1: 启动 UI 监听**
```bash
npm run watch:renderer
```
这会持续监听 UI 代码变化并自动重新编译。

**终端 2: 启动 Electron**
```bash
ENABLE_ELECTRON_RELOAD=true npm start
```

---

## 🔧 调试工具

### **1. Chrome DevTools (渲染进程)**

所有 Electron 窗口都会自动打开 DevTools (开发模式下)：

```javascript
// src/window/windowManager.js
if (!app.isPackaged) {
    header.webContents.openDevTools({ mode: 'detach' });
    listen.webContents.openDevTools({ mode: 'detach' });
    ask.webContents.openDevTools({ mode: 'detach' });
}
```

**功能**:
- 🔍 查看 DOM 结构
- 📊 监控网络请求
- 🐛 设置断点调试
- 📝 查看 Console 日志
- ⚡ 性能分析

---

### **2. 主进程调试 (Node.js)**

#### **方法 A: 使用 console.log**
```javascript
// src/index.js
console.log('[DEBUG] Starting initialization...');
console.log('[DEBUG] User state:', userState);
```

查看输出: 在启动 Electron 的终端中

---

#### **方法 B: 使用 VS Code 调试器**

创建 `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Electron Main Process",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "runtimeArgs": [
        ".",
        "--remote-debugging-port=9223"
      ],
      "env": {
        "ENABLE_ELECTRON_RELOAD": "false",
        "INTERVIEW_PASSCODE_REQUIRED": "false",
        "DEBUG_FORCE_MAIN_HEADER": "true"
      },
      "outputCapture": "std",
      "sourceMaps": true
    }
  ]
}
```

**使用方法**:
1. 在 VS Code 中打开项目
2. 在代码中设置断点
3. 按 `F5` 或点击"运行和调试"
4. 选择 "Debug Electron Main Process"

---

#### **方法 C: 使用 Chrome DevTools (主进程)**

```bash
# 启动时添加调试参数
node --inspect-brk ./node_modules/electron/cli.js .
```

然后:
1. 打开 Chrome 浏览器
2. 访问 `chrome://inspect`
3. 点击 "inspect" 连接到 Electron 进程

---

## 📁 实时监听文件变化

### **当前配置 (electron-reloader)**

```javascript
// src/index.js (第 1-9 行)
try {
    if (process.env.ENABLE_ELECTRON_RELOAD !== 'false') {
        const reloader = require('electron-reloader');
        reloader(module, {
            watchRenderer: true,  // 监听渲染进程
        });
    }
} catch (err) {}
```

**监听范围**:
- ✅ 主进程文件 (`src/index.js`, `src/features/**`, `src/bridge/**`)
- ✅ 渲染进程文件 (`src/ui/**`)
- ✅ 自动重启/刷新

---

### **UI 代码监听 (esbuild watch)**

```bash
npm run watch:renderer
```

**监听文件**:
- `src/ui/app/HeaderController.js` → `public/build/header.js`
- `src/ui/app/PickleGlassApp.js` → `public/build/content.js`

**工作流程**:
1. 修改 `src/ui/listen/ListenView.js`
2. esbuild 自动重新编译 `content.js`
3. electron-reloader 检测到变化
4. 自动刷新窗口

---

## 🎯 推荐的开发工作流

### **场景 1: 修改 UI 组件**

```bash
# 终端 1
npm run watch:renderer

# 终端 2
ENABLE_ELECTRON_RELOAD=true npm start
```

**修改文件**: `src/ui/listen/ListenView.js`
**效果**: 窗口自动刷新，立即看到变化

---

### **场景 2: 修改主进程逻辑**

```bash
ENABLE_ELECTRON_RELOAD=true npm start
```

**修改文件**: `src/features/listen/listenService.js`
**效果**: Electron 自动重启

---

### **场景 3: 调试复杂问题**

```bash
# 使用 VS Code 调试器
# 1. 设置断点
# 2. 按 F5 启动调试
# 3. 逐步执行代码
```

---

## 🐛 常见调试技巧

### **1. 查看 IPC 通信**

```javascript
// 在主进程中
ipcMain.handle('some-action', (event, data) => {
    console.log('[IPC] Received:', data);
    const result = doSomething(data);
    console.log('[IPC] Sending:', result);
    return result;
});

// 在渲染进程中
const result = await window.api.someAction(data);
console.log('[Renderer] Received:', result);
```

---

### **2. 查看窗口状态**

```javascript
// 在渲染进程 DevTools Console 中
console.log('Window bounds:', window.api.headerController.getHeaderPosition());
console.log('Current user:', await window.api.common.getCurrentUser());
```

---

### **3. 监控性能**

```javascript
// 在渲染进程中
console.time('render-time');
// ... 执行代码
console.timeEnd('render-time');
```

---

## 📊 环境变量说明

| 变量 | 作用 | 默认值 |
|------|------|--------|
| `ENABLE_ELECTRON_RELOAD` | 启用自动重载 | `true` |
| `INTERVIEW_PASSCODE_REQUIRED` | 需要面试口令 | `true` |
| `DEBUG_FORCE_MAIN_HEADER` | 强制显示主界面 | `false` |
| `NODE_ENV` | 环境模式 | `development` |

---

## 🎨 热重载示例

```bash
# 完整的开发命令
ENABLE_ELECTRON_RELOAD=true \
INTERVIEW_PASSCODE_REQUIRED=false \
DEBUG_FORCE_MAIN_HEADER=true \
npm start
```

**修改任何文件**:
- `src/ui/**/*.js` → 窗口自动刷新
- `src/features/**/*.js` → 应用自动重启
- `src/index.js` → 应用自动重启

---

## 🚨 故障排查

### **问题: 修改代码后没有自动重载**

**解决方案**:
1. 检查 `ENABLE_ELECTRON_RELOAD` 是否为 `true`
2. 确认 `electron-reloader` 已安装: `npm list electron-reloader`
3. 查看终端是否有错误信息

---

### **问题: DevTools 没有自动打开**

**解决方案**:
```javascript
// 临时添加到 windowManager.js
header.webContents.openDevTools({ mode: 'detach' });
```

---

### **问题: 断点不生效**

**解决方案**:
1. 确保 source maps 已启用 (build.js 中 `sourcemap: true`)
2. 使用 VS Code 调试器而不是 Chrome DevTools
3. 检查文件路径是否正确

---

## 📝 总结

**最简单的开发命令**:
```bash
ENABLE_ELECTRON_RELOAD=true npm start
```

**最完整的开发设置**:
```bash
# 终端 1: UI 监听
npm run watch:renderer

# 终端 2: 启动应用
ENABLE_ELECTRON_RELOAD=true \
INTERVIEW_PASSCODE_REQUIRED=false \
DEBUG_FORCE_MAIN_HEADER=true \
npm start
```

现在你可以实时修改代码并立即看到效果了！🎉
