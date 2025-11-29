import React from 'react';
import { createRoot } from 'react-dom/client';
import { MainView } from './MainView';

class MainViewElement extends HTMLElement {
  private root: any = null;

  connectedCallback() {
    // Create root container
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    this.appendChild(container);

    // Mount React component
    this.root = createRoot(container);
    this.root.render(React.createElement(MainView));
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}

// Register custom element
if (!customElements.get('main-view')) {
  customElements.define('main-view', MainViewElement);
}

