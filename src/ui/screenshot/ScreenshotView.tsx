import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useIpcListener, useStreamingMarkdown } from '../hooks';
import './ScreenshotView.css';

export function ScreenshotView() {
  const [currentResponse, setCurrentResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const responseContainerRef = useRef<HTMLDivElement>(null);

  const { renderStreamingMarkdown, resetStreamingParser } = useStreamingMarkdown(
    responseContainerRef,
    currentResponse,
    isStreaming,
    isLoading,
    window.hljs,
    typeof window.hljs !== 'undefined'
  );

  const handleStateUpdate = useCallback((event: any, state: any) => {
    if (state.isLoading !== undefined) setIsLoading(state.isLoading);
    if (state.isStreaming !== undefined) setIsStreaming(state.isStreaming);
    if (state.currentResponse !== undefined) setCurrentResponse(state.currentResponse);
  }, []);

  const handleStreamError = useCallback((event: any, payload: { error: string }) => {
    console.error('Screenshot analysis error:', payload.error);
    setIsLoading(false);
    setIsStreaming(false);
    setCurrentResponse(`Error: ${payload.error}`);
  }, []);

  useIpcListener('screenshotView:onStateUpdate', handleStateUpdate);
  useIpcListener('screenshotView:onStreamError', handleStreamError);

  // Render content
  useEffect(() => {
    const responseContainer = responseContainerRef.current;
    if (!responseContainer) return;

    if (isLoading) {
      responseContainer.innerHTML = `
        <div class="loading-dots">
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
        </div>`;
      resetStreamingParser();
      return;
    }

    if (!currentResponse) {
      responseContainer.innerHTML = `<div class="empty-state">正在分析截屏...</div>`;
      resetStreamingParser();
      return;
    }

    renderStreamingMarkdown();
  }, [isLoading, currentResponse, isStreaming, renderStreamingMarkdown, resetStreamingParser]);

  return (
    <div className="screenshot-container">
      <div className="response-container" id="responseContainer" ref={responseContainerRef}>
        <div className="empty-state">正在分析截屏...</div>
      </div>
    </div>
  );
}

