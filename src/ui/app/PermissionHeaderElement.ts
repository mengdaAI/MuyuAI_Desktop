import React from 'react';
import { createRoot } from 'react-dom/client';
import { PermissionHeader } from './PermissionHeader';

class PermissionHeaderElement extends HTMLElement {
  private root: any = null;
  private _continueCallback: (() => void) | null = null;

  get continueCallback() {
    return this._continueCallback;
  }

  set continueCallback(callback: (() => void) | null) {
    this._continueCallback = callback;
    this.render();
  }

  connectedCallback() {
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    this.appendChild(container);

    this.root = createRoot(container);
    this.render();
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  private render() {
    if (!this.root) return;

    this.root.render(
      React.createElement(PermissionHeader, {
        continueCallback: this._continueCallback || undefined,
      })
    );
  }
}

if (!customElements.get('permission-setup')) {
  customElements.define('permission-setup', PermissionHeaderElement);
}

