import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMarkdownLibraries } from '../hooks/useMarkdownLibraries';
import { useStreamingMarkdownRenderer } from '../hooks/useStreamingMarkdown';
import './AskView.css';

export function AskView() {
  const [currentResponse, setCurrentResponse] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTextInput, setShowTextInput] = useState(true);
  
  const responseContainerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  
  const { marked, hljs, DOMPurify, isLoaded } = useMarkdownLibraries();

  // Use streaming markdown renderer
  useStreamingMarkdownRenderer({
    content: currentResponse,
    isStreaming,
    isLoading,
    containerRef: responseContainerRef,
    hljs,
  });

  const focusTextInput = useCallback(() => {
    requestAnimationFrame(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    });
  }, []);

  const handleCloseIfNoContent = useCallback(() => {
    if (!currentResponse && !isLoading && !isStreaming) {
      window.api?.askView.closeAskWindow();
    }
  }, [currentResponse, isLoading, isStreaming]);

  const handleEscKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCloseIfNoContent();
    }
  }, [handleCloseIfNoContent]);

  const handleScroll = useCallback((direction: 'up' | 'down') => {
    if (responseContainerRef.current) {
      const scrollAmount = 100;
      if (direction === 'up') {
        responseContainerRef.current.scrollTop -= scrollAmount;
      } else {
        responseContainerRef.current.scrollTop += scrollAmount;
      }
    }
  }, []);

  const handleSendText = useCallback(async (overridingText = '') => {
    const text = (overridingText || textInputRef.current?.value || '').trim();
    
    if (textInputRef.current) {
      textInputRef.current.value = '';
    }

    if (window.api) {
      try {
        await window.api.askView.sendMessage(text);
      } catch (error) {
        console.error('Error sending text:', error);
      }
    }
  }, []);

  const handleTextKeydown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Fix for IME composition issue: Ignore Enter key presses while composing.
    if (e.nativeEvent.isComposing) {
      return;
    }

    const isPlainEnter = e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey;
    const isModifierEnter = e.key === 'Enter' && (e.metaKey || e.ctrlKey);

    if (isPlainEnter || isModifierEnter) {
      e.preventDefault();
      handleSendText();
    }
  }, [handleSendText]);

  // Set up IPC listeners
  useEffect(() => {
    console.log('📱 AskView connectedCallback - Set up IPC event listeners');
    
    document.addEventListener('keydown', handleEscKey);

    if (!window.api) return;

    const handleShowTextInput = () => {
      console.log('Show text input signal received');
      setShowTextInput(true);
      focusTextInput();
    };

    const handleScrollUp = () => handleScroll('up');
    const handleScrollDown = () => handleScroll('down');
    
    const handleAskStateUpdate = (event: any, newState: {
      currentResponse: string;
      currentQuestion: string;
      isLoading: boolean;
      isStreaming: boolean;
      showTextInput: boolean;
    }) => {
      setCurrentResponse(newState.currentResponse);
      setCurrentQuestion(newState.currentQuestion);
      setIsLoading(newState.isLoading);
      setIsStreaming(newState.isStreaming);
      
      const wasHidden = !showTextInput;
      setShowTextInput(newState.showTextInput);

      if (newState.showTextInput) {
        if (wasHidden) {
          setTimeout(focusTextInput, 0);
        } else {
          focusTextInput();
        }
      }
    };

    window.api.askView.onShowTextInput(handleShowTextInput);
    window.api.askView.onScrollResponseUp(handleScrollUp);
    window.api.askView.onScrollResponseDown(handleScrollDown);
    window.api.askView.onAskStateUpdate(handleAskStateUpdate);

    console.log('AskView: IPC event listeners registered');

    return () => {
      console.log('📱 AskView disconnectedCallback - Remove IPC event listeners');
      document.removeEventListener('keydown', handleEscKey);

      if (window.api) {
        window.api.askView.removeOnAskStateUpdate(handleAskStateUpdate);
        window.api.askView.removeOnShowTextInput(handleShowTextInput);
        window.api.askView.removeOnScrollResponseUp(handleScrollUp);
        window.api.askView.removeOnScrollResponseDown(handleScrollDown);
        console.log('✅ AskView: IPC event listener removal needed');
      }
    };
  }, [handleEscKey, handleScroll, focusTextInput, showTextInput]);

  // Focus input when showTextInput changes
  useEffect(() => {
    if (showTextInput) {
      focusTextInput();
    }
  }, [showTextInput, focusTextInput]);

  return (
    <div className="ask-container">
      {/* Text Input Container (Always at top) */}
      <div className="text-input-container">
        <input
          ref={textInputRef}
          type="text"
          id="textInput"
          placeholder="输入你想问的任何问题"
          onKeyDown={handleTextKeydown}
        />
      </div>

      {/* Response Container (Always visible below input) */}
      <div 
        ref={responseContainerRef}
        className="response-container" 
        id="responseContainer"
      >
        {/* Content is dynamically generated by useStreamingMarkdownRenderer */}
      </div>
    </div>
  );
}

