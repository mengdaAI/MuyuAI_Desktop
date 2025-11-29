import React from 'react';
import { createRoot } from 'react-dom/client';
import { ScreenshotView } from './ScreenshotView';

class ScreenshotViewElement extends HTMLElement {
  private root: any = null;

  connectedCallback() {
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    this.appendChild(container);

    this.root = createRoot(container);
    this.root.render(React.createElement(ScreenshotView));
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

if (!customElements.get('screenshot-view-react')) {
  customElements.define('screenshot-view-react', ScreenshotViewElement);
}

