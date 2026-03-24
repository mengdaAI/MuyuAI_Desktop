# MuyuAI_Desktop Repo Wiki

> AI 智能体增强上下文 - 幕语桌面客户端 (Electron)

## 项目概述

**MuyuAI_Desktop** 是「幕语」面试辅助系统的 Electron 桌面客户端，提供实时语音转写、AI 面试提示、屏幕截图分析等功能。

### 技术栈
- **框架**: Electron 30.x
- **UI**: React 19 + Lit + TailwindCSS
- **构建**: esbuild
- **数据**: Better-SQLite3 + Firestore (云端)
- **AI**: OpenAI / Gemini / Kimi / Ollama / Whisper

---

## 目录结构

```
MuyuAI_Desktop/
├── src/
│   ├── index.js                 # Electron 主进程入口
│   ├── preload.js               # Preload 脚本 (IPC 桥接)
│   ├── window/
│   │   ├── windowManager.js     # 窗口管理 (创建/销毁/布局)
│   │   ├── windowLayoutManager.js   # 窗口布局计算
│   │   └── smoothMovementManager.js # 平滑动画控制
│   ├── bridge/
│   │   ├── featureBridge.js     # 功能 IPC 通道注册
│   │   ├── windowBridge.js     # 窗口 IPC 通道
│   │   └── internalBridge.js   # 进程内事件总线
│   ├── features/
│   │   ├── common/             # 公共模块
│   │   │   ├── ai/            # AI 工厂与提供商
│   │   │   ├── config/        # 配置管理
│   │   │   ├── prompts/       # Prompt 模板
│   │   │   ├── repositories/   # 数据仓储
│   │   │   └── services/      # 核心服务
│   │   ├── ask/               # AI 问答功能
│   │   ├── listen/            # 实时语音转写
│   │   ├── settings/          # 设置管理
│   │   └── shortcuts/         # 快捷键管理
│   └── ui/                    # 渲染进程 UI
│       ├── app/               # 主应用
│       ├── listen/            # Listen 窗口
│       ├── ask/               # Ask 窗口
│       ├── screenshot/        # 截图窗口
│       ├── settings/          # 设置窗口
│       └── transcript/        # 转写窗口
├── public/
│   ├── assets/                # 静态资源
│   └── build/                 # esbuild 产物
└── package.json
```

---

## 核心架构

### 1. Electron 主进程 (`src/index.js`)

**职责**:
- 应用启动与初始化
- 窗口管理
- IPC 通道注册
- 自动更新 (electron-updater)

**初始化流程**:
```
app.whenReady()
  ├── databaseInitializer.initialize()     # 初始化 SQLite
  ├── authService.initialize()             # 认证服务
  ├── modelStateService.initialize()       # 模型状态
  ├── featureBridge.initialize()           # IPC 通道
  ├── windowBridge.initialize()
  ├── setupWebDataHandlers()
  ├── ollamaModelRepository.initializeDefaultModels()
  ├── ollamaService.autoWarmUpSelectedModel()
  └── createWindows()
```

**优雅退出**:
```
before-quit
  ├── listenService.closeSession()         # 停止录音
  ├── sessionRepository.endAllActiveSessions()
  ├── ollamaService.shutdown()
  └── databaseInitializer.close()
```

---

### 2. 窗口系统 (`src/window/`)

#### 窗口类型

| 窗口名 | 用途 | 层级 |
|--------|------|------|
| `header` | 主悬浮条 (常驻) | 顶层 |
| `main` | 主内容窗口 | 顶层 |
| `listen` | Listen 模式窗口 | 顶层 |
| `ask` | Ask 问答窗口 | 顶层 |
| `settings` | 设置窗口 | 顶层 |
| `shortcuts` | 快捷键设置 | 模态 |
| `transcript` | 转写记录 | 顶层 |

#### 窗口特性

- **内容保护**: `setContentProtection(true)` - 屏幕共享时隐藏
- **置顶**: `alwaysOnTop` - 默认开启
- **透明背景**: 支持透明窗口
- **跨屏支持**: 自动检测多显示器

#### 关键配置
```javascript
// windowManager.js
isContentProtectionOn = true;  // 默认隐藏 (可通过 MUYU_CONTENT_PROTECTION=false 关闭)
isAlwaysOnTopOn = true;        // 默认置顶
```

---

### 3. IPC 桥接层 (`src/bridge/`)

#### featureBridge.js
注册所有主进程 IPC 通道：

**设置服务**:
- `settings:getPresets` - 获取预设
- `settings:get-model-settings` - 获取模型设置
- `settings:set-selected-model` - 设置模型

**快捷键**:
- `shortcut:getDefaultShortcuts` - 获取默认快捷键
- `shortcut:saveShortcuts` - 保存快捷键
- `shortcut:toggleAllWindowsVisibility` - 切换窗口可见

**权限**:
- `check-system-permissions` - 检查系统权限
- `request-microphone-permission` - 请求麦克风权限
- `open-system-preferences` - 打开系统偏好设置

**用户/认证**:
- `get-current-user` - 获取当前用户
- `initialize-encryption-key` - 初始化加密密钥

**AI 服务**:
- `ollama:get-status` - Ollama 状态
- `ollama:pull-model` - 下载模型
- `whisper:download-model` - 下载 Whisper 模型

**Ask 功能**:
- `ask:sendQuestionFromAsk` - 发送问题
- `ask:sendQuestionFromInputPanel` - 面板输入
- `screenshot:analyze` - 截屏分析

#### internalBridge.js
进程内 EventEmitter，用于主进程各模块间通信

#### preload.js
通过 `contextBridge.exposeInMainWorld` 暴露 `window.api.*` 给渲染进程

---

### 4. 功能模块 (`src/features/`)

#### 4.1 Listen 模块 (`listen/`)
**功能**: 实时语音转写、AI 面试提示

**核心文件**:
- `listenService.js` - 主服务
- `stt/sttService.js` - 语音转写
- `liveInsightsService.js` - 实时 AI 提示

**关键流程**:
```
启动会话
  └── sttService.initializeSttSessions()
      └── STT 模型连接 (麦克风/系统音频)
          └── 实时转写 → listenService.handleTranscriptionComplete()
              ├── 保存到数据库 (sttRepository)
              └── 发送给 AI (liveInsightsService)
                  └── AI 提示 → UI (listen:live-answer)
```

**会话状态**:
```javascript
// Turn 管理
{
  id: 'turn-1',
  speaker: 'Me' | 'Them',
  partialText: '',    // 增量文本
  finalText: '',     // 完整文本
  status: 'in_progress' | 'completed'
}
```

**API 端点**:
- `POST /api/v1/insights/stream` - 获取 AI 提示 (SSE)
- `POST /api/v1/sessions/heartbeat` - 心跳保活

#### 4.2 Ask 模块 (`ask/`)
**功能**: AI 问答、屏幕截图分析

**核心文件**:
- `askService.js` - 主服务
- `askApi.js` - API 调用
- `repositories/` - 数据持久化

**截图流程**:
```javascript
// macOS
screencapture -x -t jpg temp.jpg
sharp.resize({ height: 900 }).jpeg({ quality: 85 })

// Windows
desktopCapturer.getSources()
source.thumbnail.toJPEG(70)
```

**消息发送流程**:
```
askService.sendMessage()
  ├── 收集上下文 (简历、JD、历史对话)
  ├── 截图压缩
  └── 调用 LLM 流式响应
      └── 写入 ai_messages 表
```

#### 4.3 Settings 模块 (`settings/`)
**功能**: 模型配置、预设管理

**核心文件**:
- `settingsService.js` - 设置服务
- `repositories/` - 数据仓储

**模型选择**:
```javascript
// 提供商优先级
1. OpenAI (gpt-4.1)
2. Kimi (kimi-k2-turbo-preview)
3. Gemini (gemini-2.5-flash)
4. Anthropic (claude-3-5-sonnet)
5. Ollama (本地)
6. Whisper (本地 STT)
```

#### 4.4 Common 模块 (`common/`)

**AI 工厂** (`ai/factory.js`):
```javascript
const PROVIDERS = {
  'openai': { name: 'OpenAI', llmModels: ['gpt-4.1'] },
  'gemini': { name: 'Gemini', llmModels: ['gemini-2.5-flash'] },
  'kimi': { name: 'Kimi', llmModels: ['kimi-k2-turbo-preview'] },
  'anthropic': { name: 'Anthropic', llmModels: ['claude-3-5-sonnet'] },
  'ollama': { name: 'Ollama (Local)', llmModels: [] },  // 动态加载
  'whisper': { name: 'Whisper (Local)', sttModels: ['nova-2'] }
};

// 工厂方法
createLLM(provider, options);
createStreamingLLM(provider, options);
createSTT(provider, options);
```

**配置管理** (`config/config.js`):
```javascript
{
  apiUrl: process.env.MUYU_API_DOMAIN,
  webUrl: process.env.MUYU_WEB_URL,
  apiTimeout: 30000,
  enableJWT: true,
  enableSQLiteStorage: true
}
```

**服务层** (`services/`):
| 服务 | 功能 |
|------|------|
| `authService.js` | 用户认证、Firebase |
| `modelStateService.js` | 模型状态、API Key |
| `ollamaService.js` | Ollama 运行时 |
| `whisperService.js` | Whisper STT |
| `encryptionService.js` | 数据加密 |
| `passcodeService.js` | 面试口令 |
| `ossApi.js` | 对象存储 |
| `sqliteClient.js` | SQLite 客户端 |

---

### 5. UI 层 (`src/ui/`)

#### 技术栈
- **框架**: React 19 (主 UI) + Lit (部分组件)
- **样式**: TailwindCSS
- **构建**: esbuild

#### 核心组件

**主应用** (`app/`):
- `App.tsx` - 主应用入口
- `MainView.tsx` - 主视图
- `HeaderView.tsx` - 悬浮条

**Listen 窗口** (`listen/`):
- `ListenView.tsx` - 转写界面
- `audioCore/` - 音频捕获
- `summary/` - 摘要服务

**Ask 窗口** (`ask/`):
- `AskView.tsx` - 问答界面

**Hooks** (`hooks/`):
| Hook | 用途 |
|------|------|
| `useIpcListener.ts` | IPC 事件监听 |
| `useSessionState.ts` | 会话状态 |
| `useStreamingMarkdown.ts` | Markdown 流式渲染 |
| `useInterviewTimer.ts` | 面试计时 |

---

### 6. 数据持久化

#### SQLite Schema
```sql
-- 用户表
CREATE TABLE users (...);

-- 会话表
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  type TEXT,        -- 'listen' | 'ask'
  title TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  user_id TEXT
);

-- 转写表
CREATE TABLE transcripts (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  speaker TEXT,     -- 'Me' | 'Them'
  text TEXT,
  created_at INTEGER
);

-- AI 消息表
CREATE TABLE ai_messages (...);

-- 摘要表
CREATE TABLE summaries (...);

-- 预设表
CREATE TABLE presets (...);

-- 提供者设置
CREATE TABLE provider_settings (...);

-- 快捷键
CREATE TABLE shortcuts (...);

-- 权限
CREATE TABLE permissions (...);
```

#### 仓储适配器
```javascript
// 根据用户登录状态切换数据源
if (authService.isLoggedIn()) {
  // Firestore 实现
} else {
  // SQLite 实现
}
```

---

## 开发命令

```bash
# 开发
npm start                    # 启动开发模式 (同时编译渲染代码)
npm run dev                  # 并行 watch 模式

# 构建
npm run build:renderer       # 仅构建渲染代码
npm run build:all            # 构建所有
npm run build                # 打包应用

# 打包
npm run package:mac          # macOS
npm run package:win          # Windows
npm run build:mac:dmg        # macOS DMG
npm run build:win:nsis       # Windows NSIS

# 测试
npm run lint                 # ESLint
```

---

## 环境变量

### 必需配置
```bash
# API 配置
MUYU_API_DOMAIN=https://api.muyulab.com
MUYU_WEB_URL=https://tici.muyulab.com

# 开发调试
ENABLE_ELECTRON_RELOAD=true
DEBUG_FORCE_MAIN_HEADER=true
NODE_ENV=development

# 窗口行为
MUYU_CONTENT_PROTECTION=true   # 默认隐藏 (屏幕共享)
MUYU_ALWAYS_ON_TOP=true        # 默认置顶
```

---

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + \` | 显示/隐藏主窗口 |
| `Cmd/Ctrl + Enter` | AI 问答 |
| `Cmd/Ctrl + 方向键` | 移动窗口位置 |

---

## 自动更新

- 使用 `electron-updater`
- 启动时自动检查更新
- 下载完成后提示用户重启
- 版本: `v1.0.35`

---

## 安全特性

1. **Context Isolation**: 所有渲染进程启用
2. **Preload 沙箱**: 仅暴露白名单 API
3. **内容保护**: `setContentProtection` 防止屏幕录制
4. **API Key 加密**: 使用 `encryptionService` 加密存储

---

## 注意事项

1. **macOS 音频捕获**: 使用 `screencapture` + `sox` 处理
2. **Windows 音频捕获**: 使用 `loopback` 捕获系统音频
3. **窗口层级**: 所有功能窗口使用 `alwaysOnTop` 保持在最前
4. **内存管理**: 大文件 (截图) 及时释放

---

## 域名配置

| 服务 | 域名 |
|------|------|
| API | https://api.muyulab.com |
| Web | https://tici.muyulab.com |

---

*最后更新: 2026-03-24*
