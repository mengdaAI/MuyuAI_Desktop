import React from 'react';
import { createRoot } from 'react-dom/client';
import { TranscriptView } from './TranscriptView';

class TranscriptViewElement extends HTMLElement {
  private root: any = null;

  connectedCallback() {
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    this.appendChild(container);

    this.root = createRoot(container);
    this.root.render(React.createElement(TranscriptView));
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

if (!customElements.get('transcript-view-react')) {
  customElements.define('transcript-view-react', TranscriptViewElement);
}

