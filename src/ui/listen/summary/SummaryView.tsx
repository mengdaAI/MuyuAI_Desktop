import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useIpcListener, useMarkdownLibraries } from '../../hooks';
import './SummaryView.css';

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
      return <div style={{ display: 'none' }}></div>;
    }

    const data = structuredData;
    const hasAnyContent = data.summary.length > 0 || data.topic.bullets.length > 0 || data.actions.length > 0;

    return (
      <div className="insights-container" ref={containerRef}>
        {!hasAnyContent ? (
          <div className="empty-state">No insights yet...</div>
        ) : (
          <>
            <insights-title>Current Summary</insights-title>
            {data.summary.length > 0 ? (
              data.summary.slice(0, 5).map((bullet, index) => (
                <div
                  key={`summary-${index}`}
                  className="markdown-content"
                  data-markdown-id={`summary-${index}`}
                  data-original-text={bullet}
                  onClick={() => handleMarkdownClick(bullet)}
                >
                  {bullet}
                </div>
              ))
            ) : (
              <div className="request-item">No content yet...</div>
            )}

            {data.topic.header && (
              <>
                <insights-title>{data.topic.header}</insights-title>
                {data.topic.bullets.slice(0, 3).map((bullet, index) => (
                  <div
                    key={`topic-${index}`}
                    className="markdown-content"
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
                <insights-title>Actions</insights-title>
                {data.actions.slice(0, 5).map((action, index) => (
                  <div
                    key={`action-${index}`}
                    className="markdown-content"
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
                <insights-title>Follow-Ups</insights-title>
                {data.followUps.map((followUp, index) => (
                  <div
                    key={`followup-${index}`}
                    className="markdown-content"
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
      </div>
    );
  }
);

SummaryView.displayName = 'SummaryView';

