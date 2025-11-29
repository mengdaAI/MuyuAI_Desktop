// Global type definitions for the application

export type ViewType = 'main' | 'listen' | 'ask' | 'settings' | 'transcript' | 'screenshot' | 'shortcut-settings' | 'history' | 'help' | 'setup';

export type ListenSessionStatus = 'beforeSession' | 'inSession' | 'afterSession';

export interface HeaderPosition {
  x: number;
  y: number;
}

export interface WindowDimensions {
  width: number;
  height: number;
}

export interface Shortcuts {
  nextStep?: string;
  toggleVisibility?: string;
  [key: string]: string | undefined;
}

export interface UserState {
  uid: string;
  email: string;
  displayName: string;
  mode: 'local' | 'firebase';
  isLoggedIn: boolean;
  totalInterviewSeconds?: number;
}

export interface SttMessage {
  id: number;
  speaker: 'Me' | 'Them';
  text: string;
  isPartial: boolean;
  isFinal: boolean;
}

export interface Turn {
  id: string;
  question: string;
  answer: string;
  status: 'in_progress' | 'completed' | 'error' | 'aborted';
  updatedAt: number;
  startedAt: number;
}

export interface PermissionStatus {
  microphone: 'granted' | 'denied' | 'not-determined';
  screen: 'granted' | 'denied' | 'not-determined';
  keychain: 'granted' | 'denied' | 'not-determined';
  needsSetup: boolean;
}

// Window API Types
export interface WindowAPI {
  // Common APIs
  common: {
    getCurrentUser: () => Promise<UserState>;
    onUserStateChanged: (callback: (event: any, userState: UserState) => void) => void;
    removeOnUserStateChanged: (callback: (event: any, userState: UserState) => void) => void;
    quitApplication: () => Promise<void>;
  };

  // Main Header APIs
  mainHeader: {
    getHeaderPosition: () => Promise<HeaderPosition>;
    moveHeaderTo: (x: number, y: number) => void;
    sendHeaderAnimationFinished: (state: string) => void;
    showSettingsWindow: () => void;
    hideSettingsWindow: () => void;
    cancelHideSettingsWindow: () => void;
    sendListenButtonClick: (listenButtonText: string) => Promise<void>;
    sendAskButtonClick: () => Promise<void>;
    openLiveInsightsView: () => Promise<void>;
    openTranscriptView: () => Promise<void>;
    toggleTranscriptView: () => Promise<void>;
    sendToggleAllWindowsVisibility: () => Promise<void>;
    onListenChangeSessionResult: (callback: (event: any, result: { success: boolean }) => void) => void;
    removeOnListenChangeSessionResult: (callback: (event: any, result: { success: boolean }) => void) => void;
    onShortcutsUpdated: (callback: (event: any, shortcuts: Shortcuts) => void) => void;
    removeOnShortcutsUpdated: (callback: (event: any, shortcuts: Shortcuts) => void) => void;
  };

  // Header Controller APIs
  headerController: {
    sendHeaderStateChanged: (state: string) => void;
    reInitializeModelState: () => Promise<void>;
    resizeHeaderWindow: (dimensions: WindowDimensions) => Promise<void>;
    checkSystemPermissions: () => Promise<PermissionStatus>;
    checkPermissionsCompleted: () => Promise<boolean>;
    isDebugForceMainHeader: () => Promise<boolean>;
    onUserStateChanged: (callback: (event: any, userState: UserState) => void) => void;
    onAuthFailed: (callback: (event: any, data: { message: string }) => void) => void;
    onForceShowApiKeyHeader: (callback: () => void) => void;
  };

  // Listen View APIs
  listenView?: {
    onSetView?: (callback: (event: any, payload: { view: string; insightsMode?: string }) => void) => void;
    removeOnSetView?: (callback: (event: any, payload: any) => void) => void;
    adjustWindowHeight?: (windowName: string, height: number) => Promise<void>;
  };

  // STT View APIs
  sttView: {
    onSttUpdate: (callback: (event: any, data: { speaker: string; text: string; isFinal: boolean; isPartial: boolean }) => void) => void;
    removeOnSttUpdate: (callback: (event: any, data: any) => void) => void;
  };

  // Live Insights APIs
  liveInsights?: {
    onTurnUpdate: (callback: (event: any, payload: any) => void) => void;
    removeOnTurnUpdate: (callback: (event: any, payload: any) => void) => void;
    onLiveAnswer: (callback: (event: any, payload: any) => void) => void;
    removeOnLiveAnswer: (callback: (event: any, payload: any) => void) => void;
    onTurnStateReset: (callback: () => void) => void;
    removeOnTurnStateReset: (callback: () => void) => void;
    getTurnState?: () => Promise<any>;
  };

  // Screenshot APIs
  screenshotView?: {
    toggle?: () => Promise<void>;
  };

  // API Key Header APIs
  apiKeyHeader?: {
    areProvidersConfigured: () => Promise<boolean>;
  };

  // Passcode APIs
  passcode?: {
    getStatus: () => Promise<{ required: boolean; verified: boolean }>;
  };
}

declare global {
  interface Window {
    api: WindowAPI;
    __interviewStartTimestamp?: number;
  }
}

export {};

