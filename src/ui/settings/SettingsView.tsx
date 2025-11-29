import React, { useState, useEffect, useCallback, useRef } from 'react';
import './SettingsView.css';

interface ProviderConfig {
  name: string;
  llmModels: Array<{ id: string; name: string }>;
  sttModels: Array<{ id: string; name: string; installed?: boolean }>;
}

interface OllamaModel {
  name: string;
  installed: boolean;
  installing?: boolean;
}

interface Preset {
  id: string;
  title: string;
  is_default: number;
}

export function SettingsView() {
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({});
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isContentProtectionOn, setIsContentProtectionOn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providerConfig, setProviderConfig] = useState<Record<string, ProviderConfig>>({});
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({ openai: '', gemini: '', anthropic: '', whisper: '' });
  const [availableLlmModels, setAvailableLlmModels] = useState<Array<{ id: string; name: string }>>([]);
  const [availableSttModels, setAvailableSttModels] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedLlm, setSelectedLlm] = useState<string | null>(null);
  const [selectedStt, setSelectedStt] = useState<string | null>(null);
  const [isLlmListVisible, setIsLlmListVisible] = useState(false);
  const [isSttListVisible, setIsSttListVisible] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [autoUpdateLoading, setAutoUpdateLoading] = useState(true);
  const [ollamaStatus, setOllamaStatus] = useState({ installed: false, running: false });
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [installingModels, setInstallingModels] = useState<Record<string, number>>({});

  const containerRef = useRef<HTMLDivElement>(null);

  const updateScrollHeight = useCallback(() => {
    const rawHeight = window.innerHeight || (window.screen ? window.screen.height : 0);
    const MIN_HEIGHT = 300;
    const maxHeight = Math.max(MIN_HEIGHT, rawHeight);

    if (containerRef.current) {
      containerRef.current.style.maxHeight = `${maxHeight}px`;
    }
  }, []);

  const loadAutoUpdateSetting = useCallback(async () => {
    if (!window.api) return;
    setAutoUpdateLoading(true);
    try {
      const enabled = await window.api.settingsView.getAutoUpdate();
      setAutoUpdateEnabled(enabled);
      console.log('Auto-update setting loaded:', enabled);
    } catch (e) {
      console.error('Error loading auto-update setting:', e);
      setAutoUpdateEnabled(true);
    }
    setAutoUpdateLoading(false);
  }, []);

  const loadLocalAIStatus = useCallback(async () => {
    try {
      const ollamaStatus = await window.api.settingsView.getOllamaStatus();
      if (ollamaStatus?.success) {
        setOllamaStatus({ installed: ollamaStatus.installed, running: ollamaStatus.running });
        setOllamaModels(ollamaStatus.models || []);
      }

      if (apiKeys?.whisper === 'local') {
        const whisperModelsResult = await window.api.settingsView.getWhisperInstalledModels();
        if (whisperModelsResult?.success) {
          const installedWhisperModels = whisperModelsResult.models;
          setProviderConfig(prev => {
            const updated = { ...prev };
            if (updated.whisper) {
              updated.whisper.sttModels.forEach(m => {
                const installedInfo = installedWhisperModels.find((i: any) => i.id === m.id);
                if (installedInfo) {
                  m.installed = installedInfo.installed;
                }
              });
            }
            return updated;
          });
        }
      }
    } catch (error) {
      console.error('Error loading LocalAI status:', error);
    }
  }, [apiKeys]);

  const refreshModelData = useCallback(async () => {
    const [availableLlm, availableStt, selected, storedKeys] = await Promise.all([
      window.api.settingsView.getAvailableModels({ type: 'llm' }),
      window.api.settingsView.getAvailableModels({ type: 'stt' }),
      window.api.settingsView.getSelectedModels(),
      window.api.settingsView.getAllKeys()
    ]);
    setAvailableLlmModels(availableLlm);
    setAvailableSttModels(availableStt);
    setSelectedLlm(selected.llm);
    setSelectedStt(selected.stt);
    setApiKeys(storedKeys);
  }, []);

  const refreshOllamaStatus = useCallback(async () => {
    const ollamaStatusResult = await window.api.settingsView.getOllamaStatus();
    if (ollamaStatusResult?.success) {
      setOllamaStatus({ installed: ollamaStatusResult.installed, running: ollamaStatusResult.running });
      setOllamaModels(ollamaStatusResult.models || []);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    if (!window.api) return;
    setIsLoading(true);
    try {
      const [userState, modelSettings, presetsData, contentProtection, shortcutsData] = await Promise.all([
        window.api.settingsView.getCurrentUser(),
        window.api.settingsView.getModelSettings(),
        window.api.settingsView.getPresets(),
        window.api.settingsView.getContentProtectionStatus(),
        window.api.settingsView.getCurrentShortcuts()
      ]);

      if (userState && userState.isLoggedIn) setFirebaseUser(userState);

      if (modelSettings.success) {
        const { config, storedKeys, availableLlm, availableStt, selectedModels } = modelSettings.data;
        setProviderConfig(config);
        setApiKeys(storedKeys);
        setAvailableLlmModels(availableLlm);
        setAvailableSttModels(availableStt);
        setSelectedLlm(selectedModels.llm);
        setSelectedStt(selectedModels.stt);
      }

      setPresets(presetsData || []);
      setIsContentProtectionOn(contentProtection);
      setShortcuts(shortcutsData || {});
      
      if (presetsData && presetsData.length > 0) {
        const firstUserPreset = presetsData.find((p: Preset) => p.is_default === 0);
        if (firstUserPreset) setSelectedPreset(firstUserPreset);
      }

      loadLocalAIStatus();
    } catch (error) {
      console.error('Error loading initial settings data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadLocalAIStatus]);

  const handleToggleAutoUpdate = useCallback(async () => {
    if (!window.api || autoUpdateLoading) return;
    setAutoUpdateLoading(true);
    try {
      const newValue = !autoUpdateEnabled;
      const result = await window.api.settingsView.setAutoUpdate(newValue);
      if (result && result.success) {
        setAutoUpdateEnabled(newValue);
      } else {
        console.error('Failed to update auto-update setting');
      }
    } catch (e) {
      console.error('Error toggling auto-update:', e);
    }
    setAutoUpdateLoading(false);
  }, [autoUpdateEnabled, autoUpdateLoading]);

  const getProviderForModel = useCallback((type: 'llm' | 'stt', modelId: string) => {
    for (const [providerId, config] of Object.entries(providerConfig)) {
      const models = type === 'llm' ? config.llmModels : config.sttModels;
      if (models?.some(m => m.id === modelId)) {
        return providerId;
      }
    }
    return null;
  }, [providerConfig]);

  const installOllamaModel = useCallback(async (modelName: string) => {
    try {
      setInstallingModels(prev => ({ ...prev, [modelName]: 0 }));

      const progressHandler = (event: any, data: any) => {
        if (data.service === 'ollama' && data.model === modelName) {
          setInstallingModels(prev => ({ ...prev, [modelName]: data.progress || 0 }));
        }
      };

      window.api.settingsView.onLocalAIInstallProgress(progressHandler);

      try {
        const result = await window.api.settingsView.pullOllamaModel(modelName);

        if (result.success) {
          console.log(`[SettingsView] Model ${modelName} installed successfully`);
          setInstallingModels(prev => {
            const updated = { ...prev };
            delete updated[modelName];
            return updated;
          });

          await refreshOllamaStatus();
          await refreshModelData();
        } else {
          throw new Error(result.error || 'Installation failed');
        }
      } finally {
        window.api.settingsView.removeOnLocalAIInstallProgress(progressHandler);
      }
    } catch (error) {
      console.error(`[SettingsView] Error installing model ${modelName}:`, error);
      setInstallingModels(prev => {
        const updated = { ...prev };
        delete updated[modelName];
        return updated;
      });
    }
  }, [refreshOllamaStatus, refreshModelData]);

  const downloadWhisperModel = useCallback(async (modelId: string) => {
    setInstallingModels(prev => ({ ...prev, [modelId]: 0 }));

    try {
      const progressHandler = (event: any, data: any) => {
        if (data.service === 'whisper' && data.model === modelId) {
          setInstallingModels(prev => ({ ...prev, [modelId]: data.progress || 0 }));
        }
      };

      window.api.settingsView.onLocalAIInstallProgress(progressHandler);

      const result = await window.api.settingsView.downloadWhisperModel(modelId);

      if (result.success) {
        setProviderConfig(prev => {
          const updated = { ...prev };
          if (updated.whisper?.sttModels) {
            const modelInfo = updated.whisper.sttModels.find(m => m.id === modelId);
            if (modelInfo) {
              modelInfo.installed = true;
            }
          }
          return updated;
        });

        setInstallingModels(prev => {
          const updated = { ...prev };
          delete updated[modelId];
          return updated;
        });

        await loadLocalAIStatus();
        await selectModel('stt', modelId);
      } else {
        setInstallingModels(prev => {
          const updated = { ...prev };
          delete updated[modelId];
          return updated;
        });
        alert(`Failed to download Whisper model: ${result.error}`);
      }

      window.api.settingsView.removeOnLocalAIInstallProgress(progressHandler);
    } catch (error: any) {
      console.error(`[SettingsView] Error downloading Whisper model ${modelId}:`, error);
      setInstallingModels(prev => {
        const updated = { ...prev };
        delete updated[modelId];
        return updated;
      });
      alert(`Error downloading ${modelId}: ${error.message}`);
    }
  }, [loadLocalAIStatus]);

  const selectModel = useCallback(async (type: 'llm' | 'stt', modelId: string) => {
    const provider = getProviderForModel(type, modelId);
    
    if (provider === 'ollama') {
      const ollamaModel = ollamaModels.find(m => m.name === modelId);
      if (ollamaModel && !ollamaModel.installed && !ollamaModel.installing) {
        await installOllamaModel(modelId);
        return;
      }
    }

    if (provider === 'whisper' && type === 'stt') {
      const isInstalling = installingModels[modelId] !== undefined;
      const whisperModelInfo = providerConfig.whisper?.sttModels.find(m => m.id === modelId);

      if (whisperModelInfo && !whisperModelInfo.installed && !isInstalling) {
        await downloadWhisperModel(modelId);
        return;
      }
    }

    setSaving(true);
    await window.api.settingsView.setSelectedModel({ type, modelId });
    if (type === 'llm') setSelectedLlm(modelId);
    if (type === 'stt') setSelectedStt(modelId);
    setIsLlmListVisible(false);
    setIsSttListVisible(false);
    setSaving(false);
  }, [getProviderForModel, ollamaModels, installingModels, providerConfig, installOllamaModel, downloadWhisperModel]);

  const toggleModelList = useCallback(async (type: 'llm' | 'stt') => {
    const isVisible = type === 'llm' ? isLlmListVisible : isSttListVisible;
    const setVisible = type === 'llm' ? setIsLlmListVisible : setIsSttListVisible;

    if (!isVisible) {
      setSaving(true);
      await refreshModelData();
      setSaving(false);
    }

    setVisible(!isVisible);
  }, [isLlmListVisible, isSttListVisible, refreshModelData]);

  const handleSaveKey = useCallback(async (provider: string) => {
    const input = document.getElementById(`key-input-${provider}`) as HTMLInputElement;
    if (!input) return;
    const key = input.value;

    if (provider === 'ollama') {
      setSaving(true);
      const ensureResult = await window.api.settingsView.ensureOllamaReady();
      if (!ensureResult.success) {
        alert(`Failed to setup Ollama: ${ensureResult.error}`);
        setSaving(false);
        return;
      }

      const result = await window.api.settingsView.validateKey({ provider, key: 'local' });

      if (result.success) {
        await refreshModelData();
        await refreshOllamaStatus();
      } else {
        alert(`Failed to connect to Ollama: ${result.error}`);
      }
      setSaving(false);
      return;
    }

    if (provider === 'whisper') {
      setSaving(true);
      const result = await window.api.settingsView.validateKey({ provider, key: 'local' });

      if (result.success) {
        await refreshModelData();
      } else {
        alert(`Failed to enable Whisper: ${result.error}`);
      }
      setSaving(false);
      return;
    }

    setSaving(true);
    const result = await window.api.settingsView.validateKey({ provider, key });

    if (result.success) {
      await refreshModelData();
    } else {
      alert(`Failed to save ${provider} key: ${result.error}`);
      input.value = apiKeys[provider] || '';
    }
    setSaving(false);
  }, [apiKeys, refreshModelData, refreshOllamaStatus]);

  const handleClearKey = useCallback(async (provider: string) => {
    console.log(`[SettingsView] handleClearKey: ${provider}`);
    setSaving(true);
    await window.api.settingsView.removeApiKey(provider);
    setApiKeys(prev => ({ ...prev, [provider]: '' }));
    await refreshModelData();
    setSaving(false);
  }, [refreshModelData]);

  const handleOllamaShutdown = useCallback(async () => {
    console.log('[SettingsView] Shutting down Ollama service...');

    if (!window.api) return;

    try {
      setOllamaStatus(prev => ({ ...prev, running: false }));

      const result = await window.api.settingsView.shutdownOllama(false);

      if (result.success) {
        console.log('[SettingsView] Ollama shut down successfully');
        await refreshOllamaStatus();
      } else {
        console.error('[SettingsView] Failed to shutdown Ollama:', result.error);
        await refreshOllamaStatus();
      }
    } catch (error) {
      console.error('[SettingsView] Error during Ollama shutdown:', error);
      await refreshOllamaStatus();
    }
  }, [refreshOllamaStatus]);

  const openShortcutEditor = useCallback(() => {
    window.api.settingsView.openShortcutSettingsWindow();
  }, []);

  const handleMoveLeft = useCallback(() => {
    console.log('Move Left clicked');
    window.api.settingsView.moveWindowStep('left');
  }, []);

  const handleMoveRight = useCallback(() => {
    console.log('Move Right clicked');
    window.api.settingsView.moveWindowStep('right');
  }, []);

  const handleToggleInvisibility = useCallback(async () => {
    console.log('Toggle Invisibility clicked');
    const newStatus = await window.api.settingsView.toggleContentProtection();
    setIsContentProtectionOn(newStatus);
  }, []);

  const handleQuit = useCallback(async () => {
    console.log('Quit clicked');

    const stopSessionFn = window.api?.settingsView?.stopInterviewSession;
    if (stopSessionFn) {
      try {
        const result = await stopSessionFn();
        console.log('[SettingsView] stopInterviewSession result:', result);
        if (!result?.success && !result?.skipped) {
          console.warn('[SettingsView] Failed to stop interview session before quit:', result?.error);
        }
      } catch (error) {
        console.error('[SettingsView] Error when stopping interview session before quit:', error);
      }
    }

    if (window.api?.settingsView?.quitApplication) {
      window.api.settingsView.quitApplication();
    } else {
      window.api?.common?.quitApplication?.();
    }
  }, []);

  const togglePresets = useCallback(() => {
    setShowPresets(prev => !prev);
  }, []);

  const handlePresetSelect = useCallback((preset: Preset) => {
    setSelectedPreset(preset);
    console.log('Selected preset:', preset);
  }, []);

  const handleMouseEnter = useCallback(() => {
    window.api.settingsView.cancelHideSettingsWindow();
    updateScrollHeight();
  }, [updateScrollHeight]);

  const handleMouseLeave = useCallback(() => {
    window.api.settingsView.hideSettingsWindow();
  }, []);

  // Set up IPC listeners
  useEffect(() => {
    if (!window.api) return;

    const userStateListener = (event: any, userState: any) => {
      console.log('[SettingsView] Received user-state-changed:', userState);
      if (userState && userState.isLoggedIn) {
        setFirebaseUser(userState);
      } else {
        setFirebaseUser(null);
      }
      loadAutoUpdateSetting();
      loadInitialData();
    };

    const presetsUpdatedListener = async () => {
      console.log('[SettingsView] Received presets-updated, refreshing presets');
      try {
        const presetsData = await window.api.settingsView.getPresets();
        setPresets(presetsData || []);

        const userPresets = (presetsData || []).filter((p: Preset) => p.is_default === 0);
        if (selectedPreset && !userPresets.find((p: Preset) => p.id === selectedPreset.id)) {
          setSelectedPreset(userPresets.length > 0 ? userPresets[0] : null);
        }
      } catch (error) {
        console.error('[SettingsView] Failed to refresh presets:', error);
      }
    };

    const shortcutListener = (event: any, keybinds: Record<string, string>) => {
      console.log('[SettingsView] Received updated shortcuts:', keybinds);
      setShortcuts(keybinds);
    };

    window.api.settingsView.onUserStateChanged(userStateListener);
    window.api.settingsView.onPresetsUpdated(presetsUpdatedListener);
    window.api.settingsView.onShortcutsUpdated(shortcutListener);

    return () => {
      window.api.settingsView.removeOnUserStateChanged(userStateListener);
      window.api.settingsView.removeOnPresetsUpdated(presetsUpdatedListener);
      window.api.settingsView.removeOnShortcutsUpdated(shortcutListener);
    };
  }, [loadAutoUpdateSetting, loadInitialData, selectedPreset]);

  // Window resize
  useEffect(() => {
    const resizeHandler = () => {
      updateScrollHeight();
    };
    
    window.addEventListener('resize', resizeHandler);
    setTimeout(() => updateScrollHeight(), 100);

    return () => {
      window.removeEventListener('resize', resizeHandler);
    };
  }, [updateScrollHeight]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const installingModelsList = Object.keys(installingModels);
      if (installingModelsList.length > 0) {
        installingModelsList.forEach(modelName => {
          window.api.settingsView.cancelOllamaInstallation(modelName);
        });
      }
    };
  }, [installingModels]);

  // Load initial data
  useEffect(() => {
    loadInitialData();
    loadAutoUpdateSetting();
  }, [loadInitialData, loadAutoUpdateSetting]);

  const getMainShortcuts = useCallback(() => {
    return [
      { name: 'Show / Hide', accelerator: shortcuts.toggleVisibility },
      { name: 'Ask Anything', accelerator: shortcuts.nextStep },
      { name: 'Scroll Up Response', accelerator: shortcuts.scrollUp },
      { name: 'Scroll Down Response', accelerator: shortcuts.scrollDown },
    ];
  }, [shortcuts]);

  const renderShortcutKeys = useCallback((accelerator?: string) => {
    if (!accelerator) return <span>N/A</span>;

    const keyMap: Record<string, string> = {
      'Cmd': '⌘', 'Command': '⌘', 'Ctrl': '⌃', 'Alt': '⌥', 'Shift': '⇧', 'Enter': '↵',
      'Up': '↑', 'Down': '↓', 'Left': '←', 'Right': '→'
    };

    if (accelerator.includes('↕')) {
      const keys = accelerator.replace('↕', '').split('+');
      keys.push('↕');
      return <>{keys.map((key, idx) => <span key={idx} className="shortcut-key">{keyMap[key] || key}</span>)}</>;
    }

    const keys = accelerator.split('+');
    return <>{keys.map((key, idx) => <span key={idx} className="shortcut-key">{keyMap[key] || key}</span>)}</>;
  }, []);

  const getModelName = useCallback((type: 'llm' | 'stt', id: string | null) => {
    if (!id) return 'Not Set';
    const models = type === 'llm' ? availableLlmModels : availableSttModels;
    const model = models.find(m => m.id === id);
    return model ? model.name : id;
  }, [availableLlmModels, availableSttModels]);

  if (isLoading) {
    return (
      <div className="settings-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  const loggedIn = !!firebaseUser;

  return (
    <div
      ref={containerRef}
      className="settings-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="header-section">
        <div>
          <h1 className="app-title">幕语AI</h1>
          <div className="account-info">
            {firebaseUser
              ? `Account: ${firebaseUser.email || 'Logged In'}`
              : `Account: Not Logged In`
            }
          </div>
        </div>
      </div>

      <div className="buttons-section" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '6px', marginTop: '6px' }}>
        <button className="settings-button full-width" onClick={openShortcutEditor}>
          Edit Shortcuts
        </button>
      </div>

      <div className="shortcuts-section">
        {getMainShortcuts().map((shortcut, idx) => (
          <div key={idx} className="shortcut-item">
            <span className="shortcut-name">{shortcut.name}</span>
            <div className="shortcut-keys">
              {renderShortcutKeys(shortcut.accelerator)}
            </div>
          </div>
        ))}
      </div>

      <div className="preset-section">
        <div className="preset-header">
          <span className="preset-title">
            My Presets
            <span className="preset-count">({presets.filter(p => p.is_default === 0).length})</span>
          </span>
          <span className="preset-toggle" onClick={togglePresets}>
            {showPresets ? '▼' : '▶'}
          </span>
        </div>

        <div className={`preset-list ${showPresets ? '' : 'hidden'}`}>
          {presets.filter(p => p.is_default === 0).length === 0 ? (
            <div className="no-presets-message">
              No custom presets yet.<br />
            </div>
          ) : (
            presets.filter(p => p.is_default === 0).map(preset => (
              <div
                key={preset.id}
                className={`preset-item ${selectedPreset?.id === preset.id ? 'selected' : ''}`}
                onClick={() => handlePresetSelect(preset)}
              >
                <span className="preset-name">{preset.title}</span>
                {selectedPreset?.id === preset.id && <span className="preset-status">Selected</span>}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="buttons-section">
        <button 
          className="settings-button full-width" 
          onClick={handleToggleAutoUpdate} 
          disabled={autoUpdateLoading}
        >
          <span>Automatic Updates: {autoUpdateEnabled ? 'On' : 'Off'}</span>
        </button>

        <div className="move-buttons">
          <button className="settings-button half-width" onClick={handleMoveLeft}>
            <span>← Move</span>
          </button>
          <button className="settings-button half-width" onClick={handleMoveRight}>
            <span>Move →</span>
          </button>
        </div>

        <button className="settings-button full-width" onClick={handleToggleInvisibility}>
          <span>{isContentProtectionOn ? 'Disable Invisibility' : 'Enable Invisibility'}</span>
        </button>

        <div className="bottom-buttons">
          <button className="settings-button half-width danger" onClick={handleQuit}>
            <span>结束面试</span>
          </button>
        </div>
      </div>
    </div>
  );
}

