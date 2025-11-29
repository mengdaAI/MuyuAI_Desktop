import React from 'react';
import { createRoot } from 'react-dom/client';
import { SummaryView } from './SummaryView';

class SummaryViewElement extends HTMLElement {
  private root: any = null;
  private summaryViewRef: React.RefObject<{ resetAnalysis: () => void; getSummaryText: () => string }> = React.createRef();

  connectedCallback() {
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    this.appendChild(container);

    this.root = createRoot(container);
    
    const isVisible = this.hasAttribute('is-visible') 
      ? this.getAttribute('is-visible') === 'true' 
      : true;
    const hasCompletedRecording = this.hasAttribute('has-completed-recording')
      ? this.getAttribute('has-completed-recording') === 'true'
      : false;

    this.root.render(
      React.createElement(SummaryView, {
        ref: this.summaryViewRef,
        isVisible,
        hasCompletedRecording
      })
    );
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  // Expose methods
  resetAnalysis() {
    if (this.summaryViewRef.current) {
      this.summaryViewRef.current.resetAnalysis();
    }
  }

  getSummaryText() {
    if (this.summaryViewRef.current) {
      return this.summaryViewRef.current.getSummaryText();
    }
    return '';
  }

  static get observedAttributes() {
    return ['is-visible', 'has-completed-recording'];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (this.root) {
      const isVisible = this.hasAttribute('is-visible') 
        ? this.getAttribute('is-visible') === 'true' 
        : true;
      const hasCompletedRecording = this.hasAttribute('has-completed-recording')
        ? this.getAttribute('has-completed-recording') === 'true'
        : false;

      this.root.render(
        React.createElement(SummaryView, {
          ref: this.summaryViewRef,
          isVisible,
          hasCompletedRecording
        })
      );
    }
  }
}

if (!customElements.get('summary-view-react')) {
  customElements.define('summary-view-react', SummaryViewElement);
}

