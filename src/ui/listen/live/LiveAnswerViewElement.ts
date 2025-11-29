import React from 'react';
import { createRoot } from 'react-dom/client';
import { LiveAnswerView } from './LiveAnswerView';

class LiveAnswerViewElement extends HTMLElement {
  private root: any = null;
  private liveAnswerViewRef: React.RefObject<{ getAnswersText: () => string }> = React.createRef();

  connectedCallback() {
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    this.appendChild(container);

    this.root = createRoot(container);
    
    const isVisible = this.hasAttribute('is-visible') 
      ? this.getAttribute('is-visible') === 'true' 
      : true;

    const handleUpdated = (count: number) => {
      this.dispatchEvent(new CustomEvent('live-answer-updated', {
        detail: { count },
        bubbles: true,
        composed: true
      }));
    };

    this.root.render(
      React.createElement(LiveAnswerView, {
        ref: this.liveAnswerViewRef,
        isVisible,
        onUpdated: handleUpdated
      })
    );
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  // Expose getAnswersText method
  getAnswersText() {
    if (this.liveAnswerViewRef.current) {
      return this.liveAnswerViewRef.current.getAnswersText();
    }
    return '';
  }

  static get observedAttributes() {
    return ['is-visible'];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'is-visible' && this.root) {
      const isVisible = newValue === 'true';
      const handleUpdated = (count: number) => {
        this.dispatchEvent(new CustomEvent('live-answer-updated', {
          detail: { count },
          bubbles: true,
          composed: true
        }));
      };

      this.root.render(
        React.createElement(LiveAnswerView, {
          ref: this.liveAnswerViewRef,
          isVisible,
          onUpdated: handleUpdated
        })
      );
    }
  }
}

if (!customElements.get('live-answer-view-react')) {
  customElements.define('live-answer-view-react', LiveAnswerViewElement);
}

