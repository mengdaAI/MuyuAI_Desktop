# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Glass by Pickle is a desktop AI assistant application built with Electron that provides real-time screen monitoring, audio transcription, and AI-powered insights. The project consists of three main components:
- **Electron Desktop App** (main application) - `src/`
- **Next.js Web Dashboard** (user account management) - `pickleglass_web/`
- **Firebase Cloud Services** (data synchronization) - `functions/`

## Essential Commands

### Development
```bash
npm run setup          # Full installation and build (run this first)
npm run start          # Development mode (builds renderer and starts Electron)
npm run build:renderer # Build renderer process only
npm run build:all      # Build both renderer and web dashboard
npm run watch:renderer # Watch mode for renderer development
```

### Production
```bash
npm run build          # Production build for current platform
npm run build:win      # Windows-specific build
npm run package        # Package for distribution
npm run publish        # Build and publish (requires credentials)
```

### Code Quality
```bash
npm run lint           # Run ESLint on all .ts,.tsx,.js files
```

### Web Dashboard (separate directory)
```bash
cd pickleglass_web
npm run dev            # Next.js development server
npm run build          # Production build
npm run start          # Production server
```

## High-Level Architecture

### Core Architectural Principles

1. **Centralized Data Logic**: All database operations happen in the Electron main process. UI layers cannot access data directly.

2. **Service-Repository Pattern**:
   - Views (`*.html`, `*View.js`) → UI layer, delegates to Services
   - Services (`*Service.js`) → Business logic, mediates between Views and Repositories
   - Repositories (`*.repository.js`) → Data access layer only

3. **Dual Database System**: Repository factory pattern switches between SQLite (local) and Firebase (cloud) based on user authentication state.

4. **Feature-Based Modularity**: Code organized by feature in `src/features/`. Each feature is self-contained.

5. **IPC Communication**: Secure inter-process communication between main and renderer processes.

### Key Directory Structure

```
src/
├── features/           # Feature-based modules
│   ├── ask/           # AI Q&A functionality
│   ├── listen/        # Audio transcription and meetings
│   ├── settings/      # Application settings
│   └── common/        # Shared services and utilities
├── ui/                # UI components
├── bridge/            # IPC communication bridges
├── window/            # Window management
├── index.js           # Main Electron process entry
└── preload.js         # Renderer preload script

pickleglass_web/
├── app/               # Next.js app directory
├── backend_node/      # Express.js API server
├── components/        # React components
└── utils/             # Utility functions
```

### Critical Implementation Patterns

1. **Repository Pattern**: Every repository handling user data must have both SQLite and Firebase implementations with identical interfaces. The factory in `index.js` selects based on authentication.

2. **AI Provider Abstraction**: New AI providers are added by creating modules in `src/common/ai/providers/` that conform to the base interface and registering in `factory.js`.

3. **Web Dashboard IPC Flow**: When web dashboard needs local data, it makes HTTP request → Node.js backend → IPC to Electron main → Service/Repository → SQLite → response back through same chain.

4. **Encryption**: All sensitive user data (API keys, conversations, transcriptions) must be encrypted before Firebase storage using `createEncryptedConverter`.

5. **Schema Management**: SQLite schema defined only in `src/common/config/schema.js` - any database changes must be updated there.

## Development Requirements

- **Node.js v20.x.x** (critical requirement - native dependencies will fail with other versions)
- **Python** (for native dependencies)
- **Build Tools for Visual Studio** (Windows users)

## Code Style

- **Prettier**: 4-space tabs, single quotes, 150 character line width
- **ESLint**: JavaScript/TypeScript linting
- **No formal testing framework** - manual testing only

## Key Technical Details

- **Electron v30.5.1** with esbuild for renderer bundling
- **Next.js v14.2.30** for web dashboard
- **SQLite** via better-sqlite3 for local data
- **Firebase** for cloud synchronization
- **Multiple AI providers**: OpenAI, Claude, Gemini, local LLM (Ollama)
- **STT providers**: Deepgram, local Whisper
- **Cross-platform**: macOS, Windows, Linux support