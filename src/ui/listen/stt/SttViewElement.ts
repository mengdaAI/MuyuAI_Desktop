import React from 'react';
import { createRoot } from 'react-dom/client';
import { SttView } from './SttView';

class SttViewElement extends HTMLElement {
  private root: any = null;
  private sttViewRef: React.RefObject<{ resetTranscript: () => void }> = React.createRef();

  connectedCallback() {
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    this.appendChild(container);

    this.root = createRoot(container);
    
    const isVisible = this.hasAttribute('is-visible') 
      ? this.getAttribute('is-visible') === 'true' 
      : true;

    const handleMessagesUpdated = (messages: any[]) => {
      this.dispatchEvent(new CustomEvent('stt-messages-updated', {
        detail: { messages },
        bubbles: true
      }));
    };

    this.root.render(
      React.createElement(SttView, {
        ref: this.sttViewRef,
        isVisible,
        onMessagesUpdated: handleMessagesUpdated
      })
    );
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  // Expose resetTranscript method
  resetTranscript() {
    if (this.sttViewRef.current) {
      this.sttViewRef.current.resetTranscript();
    }
  }

  static get observedAttributes() {
    return ['is-visible'];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'is-visible' && this.root) {
      const isVisible = newValue === 'true';
      const handleMessagesUpdated = (messages: any[]) => {
        this.dispatchEvent(new CustomEvent('stt-messages-updated', {
          detail: { messages },
          bubbles: true
        }));
      };

      this.root.render(
        React.createElement(SttView, {
          ref: this.sttViewRef,
          isVisible,
          onMessagesUpdated: handleMessagesUpdated
        })
      );
    }
  }
}

if (!customElements.get('stt-view-react')) {
  customElements.define('stt-view-react', SttViewElement);
}

