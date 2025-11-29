import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useIpcListener, useMarkdownLibraries } from '../../hooks';

interface StructuredData {
  summary: string[];
  topic: {
    header: string;
    bullets: string[];
  };
  actions: string[];
  followUps?: string[];
}

interface SummaryViewProps {
  isVisible?: boolean;
  hasCompletedRecording?: boolean;
  onRequestClick?: (text: string) => void;
}

export const SummaryView = React.forwardRef<{ resetAnalysis: () => void; getSummaryText: () => string }, SummaryViewProps>(
  ({ isVisible = true, hasCompletedRecording = false, onRequestClick }, ref) => {
    const [structuredData, setStructuredData] = useState<StructuredData>({
      summary: [],
      topic: { header: '', bullets: [] },
      actions: [],
      followUps: [],
    });

    const { isLibrariesLoaded, marked, hljs, DOMPurify, renderMarkdown } = useMarkdownLibraries();
    const containerRef = useRef<HTMLDivElement>(null);

    const resetAnalysis = useCallback(() => {
      setStructuredData({
        summary: [],
        topic: { header: '', bullets: [] },
        actions: [],
        followUps: [],
      });
    }, []);

    const getSummaryText = useCallback(() => {
      const data = structuredData;
      const sections: string[] = [];

      if (data.summary && data.summary.length > 0) {
        sections.push(`Current Summary:\n${data.summary.map(s => `• ${s}`).join('\n')}`);
      }

      if (data.topic && data.topic.header && data.topic.bullets.length > 0) {
        sections.push(`\n${data.topic.header}:\n${data.topic.bullets.map(b => `• ${b}`).join('\n')}`);
      }

      if (data.actions && data.actions.length > 0) {
        sections.push(`\nActions:\n${data.actions.map(a => `▸ ${a}`).join('\n')}`);
      }

      if (data.followUps && data.followUps.length > 0) {
        sections.push(`\nFollow-Ups:\n${data.followUps.map(f => `▸ ${f}`).join('\n')}`);
      }

      return sections.join('\n\n').trim();
    }, [structuredData]);

    // Expose methods via ref
    React.useImperativeHandle(ref, () => ({
      resetAnalysis,
      getSummaryText
    }));

    const handleMarkdownClick = useCallback(async (requestText: string) => {
      console.log('🔥 Analysis request clicked:', requestText);

      if (onRequestClick) {
        onRequestClick(requestText);
        return;
      }

      if (window.api) {
        try {
          const result = await window.api.summaryView.sendQuestionFromSummary(requestText);

          if (result.success) {
            console.log('✅ Question sent to AskView successfully');
          } else {
            console.error('❌ Failed to send question to AskView:', result.error);
          }
        } catch (error) {
          console.error('❌ Error in handleMarkdownClick:', error);
        }
      }
    }, [onRequestClick]);

    const handleSummaryUpdate = useCallback((event: any, data: StructuredData) => {
      setStructuredData(data);
    }, []);

    useIpcListener('summaryView:onSummaryUpdate', handleSummaryUpdate);

    // Render Markdown content
    useEffect(() => {
      if (!isLibrariesLoaded || !containerRef.current) return;

      const markdownElements = containerRef.current.querySelectorAll('[data-markdown-id]');
      markdownElements.forEach((element: Element) => {
        const originalText = element.getAttribute('data-original-text');
        if (!originalText) return;

        try {
          let parsedHTML = renderMarkdown(originalText);

          if (DOMPurify) {
            parsedHTML = DOMPurify.sanitize(parsedHTML);

            // Check if DOMPurify removed unsafe content
            if ((DOMPurify as any).removed && (DOMPurify as any).removed.length > 0) {
              console.warn('Unsafe content detected in insights, showing plain text');
              element.textContent = '⚠️ ' + originalText;
              return;
            }
          }

          element.innerHTML = parsedHTML;
        } catch (error) {
          console.error('Error rendering markdown for element:', error);
          element.textContent = originalText;
        }
      });
    }, [isLibrariesLoaded, structuredData, renderMarkdown, DOMPurify]);

    if (!isVisible) {
      return <div className="hidden"></div>;
    }

    const data = structuredData;
    const hasAnyContent = data.summary.length > 0 || data.topic.bullets.length > 0 || data.actions.length > 0;

    return (
      <div 
        className="overflow-y-auto p-3 pr-4 pb-4 relative z-[1] min-h-[150px] max-h-[600px] flex-1" 
        ref={containerRef}
        style={{ scrollbarWidth: 'thin' }}
      >
        {!hasAnyContent ? (
          <div className="flex items-center justify-center h-[100px] text-white/60 text-sm italic">
            No insights yet...
          </div>
        ) : (
          <>
            <div className="text-white/80 text-lg font-medium my-3 mt-0 block font-sans">
              Current Summary
            </div>
            {data.summary.length > 0 ? (
              data.summary.slice(0, 5).map((bullet, index) => (
                <div
                  key={`summary-${index}`}
                  className="text-white text-xs leading-[1.4] my-1 px-2 py-1.5 rounded bg-transparent cursor-pointer break-words transition-all hover:bg-white/10 hover:translate-x-0.5"
                  data-markdown-id={`summary-${index}`}
                  data-original-text={bullet}
                  onClick={() => handleMarkdownClick(bullet)}
                >
                  {bullet}
                </div>
              ))
            ) : (
              <div className="text-white text-sm leading-tight my-1 px-2 py-1.5 rounded bg-transparent cursor-default break-words">
                No content yet...
              </div>
            )}

            {data.topic.header && (
              <>
                <div className="text-white/80 text-lg font-medium my-3 block font-sans">
                  {data.topic.header}
                </div>
                {data.topic.bullets.slice(0, 3).map((bullet, index) => (
                  <div
                    key={`topic-${index}`}
                    className="text-white text-xs leading-[1.4] my-1 px-2 py-1.5 rounded bg-transparent cursor-pointer break-words transition-all hover:bg-white/10 hover:translate-x-0.5"
                    data-markdown-id={`topic-${index}`}
                    data-original-text={bullet}
                    onClick={() => handleMarkdownClick(bullet)}
                  >
                    {bullet}
                  </div>
                ))}
              </>
            )}

            {data.actions.length > 0 && (
              <>
                <div className="text-white/80 text-lg font-medium my-3 block font-sans">
                  Actions
                </div>
                {data.actions.slice(0, 5).map((action, index) => (
                  <div
                    key={`action-${index}`}
                    className="text-white text-xs leading-[1.4] my-1 px-2 py-1.5 rounded bg-transparent cursor-pointer break-words transition-all hover:bg-white/10 hover:translate-x-0.5"
                    data-markdown-id={`action-${index}`}
                    data-original-text={action}
                    onClick={() => handleMarkdownClick(action)}
                  >
                    {action}
                  </div>
                ))}
              </>
            )}

            {hasCompletedRecording && data.followUps && data.followUps.length > 0 && (
              <>
                <div className="text-white/80 text-lg font-medium my-3 block font-sans">
                  Follow-Ups
                </div>
                {data.followUps.map((followUp, index) => (
                  <div
                    key={`followup-${index}`}
                    className="text-white text-xs leading-[1.4] my-1 px-2 py-1.5 rounded bg-transparent cursor-pointer break-words transition-all hover:bg-white/10 hover:translate-x-0.5"
                    data-markdown-id={`followup-${index}`}
                    data-original-text={followUp}
                    onClick={() => handleMarkdownClick(followUp)}
                  >
                    {followUp}
                  </div>
                ))}
              </>
            )}
          </>
        )}
        
        {/* Custom scrollbar and markdown styles */}
        <style>{`
          .insights-container::-webkit-scrollbar {
            width: 8px;
          }
          .insights-container::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
            border-radius: 4px;
          }
          .insights-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
          }
          .insights-container::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
          }
          
          .insights-container pre {
            background: rgba(0, 0, 0, 0.4) !important;
            border-radius: 8px !important;
            padding: 12px !important;
            margin: 8px 0 !important;
            overflow-x: auto !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
          }
          
          .insights-container code {
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace !important;
            font-size: 11px !important;
          }
          
          .insights-container p code {
            background: rgba(255, 255, 255, 0.1) !important;
            padding: 2px 4px !important;
            border-radius: 3px !important;
            color: #ffd700 !important;
          }
          
          .hljs-keyword { color: #ff79c6 !important; }
          .hljs-string { color: #f1fa8c !important; }
          .hljs-comment { color: #6272a4 !important; }
          .hljs-number { color: #bd93f9 !important; }
          .hljs-function { color: #50fa7b !important; }
          .hljs-variable { color: #8be9fd !important; }
          .hljs-built_in { color: #ffb86c !important; }
          .hljs-title { color: #50fa7b !important; }
          .hljs-attr { color: #50fa7b !important; }
          .hljs-tag { color: #ff79c6 !important; }
        `}</style>
      </div>
    );
  }
);

SummaryView.displayName = 'SummaryView';

