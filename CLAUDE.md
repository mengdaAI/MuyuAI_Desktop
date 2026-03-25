# MuyuAI Desktop - 幕语桌面端

## Project Overview

幕语 (Muyu) is a real-time AI voice subtitle and assistant desktop application built with Electron. It provides real-time speech-to-text, AI-powered live answers, summaries, and screenshot analysis during interviews and meetings.

- **Product name**: 幕语 (muyu)
- **App ID**: com.muyulab.muyu
- **Current version**: v1.0.39
- **Backend API**: https://resume-api.muyulab.com
- **Web companion**: https://resume.muyulab.com

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Electron | 30.5.1 | Desktop framework |
| React | 19.2.0 | UI components (renderer process) |
| TypeScript/TSX | - | Migrating from JS (partial) |
| Tailwind CSS | 3.4.18 | Styling (migrating from plain CSS) |
| esbuild | 0.25.5 | Bundler (build.js) |
| better-sqlite3 | 9.6.0 | Local database |
| electron-store | 8.2.0 | Settings persistence |
| electron-updater | 6.6.2 | Auto-update |
| sharp | 0.34.2 | Image processing |

### AI SDKs
- `@anthropic-ai/sdk` - Claude API
- `openai` - OpenAI API
- `@google/genai` + `@google/generative-ai` - Google Gemini
- `@deepgram/sdk` - Speech-to-text
- `portkey-ai` - AI gateway

## Architecture

### Process Model (Electron)
```
Main Process (src/index.js)          ← Node.js, manages app lifecycle
  ├── Window Manager (src/window/)   ← Creates/manages BrowserWindows
  ├── Feature Services (src/features/) ← Business logic (Node.js)
  ├── Bridge Layer (src/bridge/)     ← IPC routing between main ↔ renderer
  └── Preload Script (preload.js)    ← Exposes window.api to renderer

Renderer Process (src/ui/)           ← React + esbuild bundle
  ├── Header Window (headerApp.tsx)  ← Top bar, controls
  ├── Content Window (contentApp.tsx via App.tsx) ← Main content area
  ├── Screenshot Window (screenshotApp.tsx)
  └── Transcript Window (transcriptApp.tsx)
```

### Key Directories

```
src/
├── index.js              # Electron main process entry
├── preload.js            # Preload script (window.api bridge)
├── bridge/
│   ├── featureBridge.js  # IPC: renderer → main feature calls
│   ├── windowBridge.js   # IPC: window management commands
│   └── internalBridge.js # IPC: internal communication
├── features/             # Main process business logic
│   ├── ask/              # AI question-answering feature
│   ├── listen/           # Real-time listening (STT + AI)
│   │   ├── stt/          # Speech-to-text
│   │   └── summary/      # AI summarization
│   ├── settings/         # App settings management
│   ├── shortcuts/        # Keyboard shortcuts
│   └── common/
│       ├── ai/           # AI provider abstractions
│       ├── config/       # Environment & constants
│       ├── services/     # Shared services (auth, db, encryption, etc.)
│       ├── repositories/ # Data access (session, user, presets, ollama)
│       ├── prompts/      # AI prompt templates
│       └── utils/        # Shared utilities
├── window/
│   ├── windowManager.js      # Window creation & lifecycle
│   ├── windowLayoutManager.js # Window positioning
│   └── smoothMovementManager.js # Smooth window animations
└── ui/                   # Renderer process (React)
    ├── app/
    │   ├── App.tsx           # Main router component
    │   ├── headerApp.tsx     # Header window entry
    │   ├── contentApp.tsx    # Content window entry
    │   └── StartupFlow.tsx   # Onboarding flow
    ├── ask/                  # AI Q&A view
    ├── listen/               # Listen mode views + audioCore
    ├── screenshot/           # Screenshot capture & analysis
    ├── transcript/           # Transcript view
    ├── settings/             # Settings views
    ├── components/           # Shared React components
    │   ├── ui/               # Base UI primitives (shadcn-style)
    │   ├── buttons/          # Button components
    │   ├── panels/           # Panel components
    │   ├── figma/            # Figma-exported components
    │   └── icons/            # Icon components
    ├── hooks/                # Custom React hooks
    ├── types/                # TypeScript type definitions
    ├── utils/                # UI utilities
    ├── styles/tailwind.css   # Tailwind entry point
    └── assets/               # Static assets (icons, etc.)
```

### Multi-Window Architecture

The app uses multiple Electron BrowserWindows managed by `windowManager.js`:
- **header** window: Top control bar (always-on-top, draggable)
- **content** window: Main content area
- **screenshot** window: Screenshot capture overlay
- **transcript** window: Transcript display

Windows communicate via IPC through the bridge layer.

### IPC Communication

Renderer → Main: `window.api.*` (exposed via preload.js)
Main → Renderer: `webContents.send()` via bridge layer

### View Routing

`App.tsx` manages view switching via `currentView` state. Views:
`main` | `listen` | `ask` | `settings` | `shortcut-settings` | `transcript` | `screenshot` | `history` | `help` | `setup`

## Development

```bash
npm run dev          # Dev mode (watch renderer + electron with nodemon)
npm run start        # Build renderer then start electron
npm run build        # Production build (esbuild + electron-builder)
npm run build:renderer  # Build renderer only (esbuild + tailwind)
npm run lint         # ESLint
```

### Build System

- `build.js` uses esbuild to bundle 4 renderer entry points into `public/build/`
- Tailwind CSS is built via postcss-cli into `public/build/tailwind.css`
- Entry points: `headerApp.tsx`, `contentApp.tsx`, `screenshotApp.tsx`, `transcriptApp.tsx`

### Environment Variables

`.env` (dev) / `.env.production` (prod):
- `MUYU_API_DOMAIN` - Backend API base URL
- `MUYU_WEB_URL` - Web app URL
- `STT_BACKEND_ENDPOINT` - WebSocket endpoint for STT streaming
- `MUYU_CONTENT_PROTECTION` - Hide window content (true/false)
- `MUYU_ALWAYS_ON_TOP` - Keep window always on top

## CI/CD

- **Build & Release**: `.github/workflows/build.yml` — Triggered by `v*` tags
  - Builds for: macOS Intel, macOS Apple Silicon, Windows (NSIS)
  - Uses electron-builder, signs & notarizes macOS builds
  - Publishes to Volcengine TOS: `https://desktop-release.tos-cn-beijing.volces.com/`

## Migration Status (LitElement → React+TS)

The project is migrating from LitElement to React + TypeScript + Tailwind.

**Completed**: MainView, AskView, PermissionHeader, ShortCutSettingsView, SettingsView, ScreenshotView, TranscriptView, App.tsx (router)

**The migration is mostly complete** — the main `App.tsx` uses React routing, and most views are React+TSX. Some legacy `.js` files may still exist but the active code paths use the React versions.

## Conventions

- React components use function components with hooks
- React components wrapped as Custom Elements for Electron integration
- IPC calls go through `window.api` (defined in preload.js)
- Business logic lives in `src/features/` (main process), UI in `src/ui/` (renderer)
- Use Tailwind CSS for styling; avoid adding new CSS files
- Component library follows shadcn/ui patterns (`src/ui/components/ui/`)
