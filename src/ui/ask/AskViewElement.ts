import React from 'react';
import { createRoot } from 'react-dom/client';
import { AskView } from './AskView';

class AskViewElement extends HTMLElement {
  private root: any = null;

  connectedCallback() {
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    container.className = 'ask-view-host';
    this.appendChild(container);

    this.root = createRoot(container);
    this.root.render(React.createElement(AskView));
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

if (!customElements.get('ask-view')) {
  customElements.define('ask-view', AskViewElement);
}

