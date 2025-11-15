import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';

export class WelcomeHeader extends LitElement {
    static styles = css`
        :host {
            display: block;
            font-family:
                'Inter',
                -apple-system,
                BlinkMacSystemFont,
                'Segoe UI',
                Roboto,
                sans-serif;
        }

        .container {
            width: 100%;
            box-sizing: border-box;
            padding: 28px 20px 30px;
            border-radius: 18px;
            background: rgba(0, 0, 0, 0.72);
            box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.5) inset;
            display: flex;
            flex-direction: column;
            gap: 18px;
            -webkit-app-region: no-drag;
        }

        .close-button {
            -webkit-app-region: no-drag;
            position: absolute;
            top: 16px;
            right: 16px;
            width: 20px;
            height: 20px;
            border: none;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.12);
            color: rgba(255, 255, 255, 0.75);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s ease;
        }
        .close-button:hover {
            background: rgba(255, 255, 255, 0.22);
        }

        .drag-area {
            -webkit-app-region: drag;
            cursor: move;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .title {
            margin: 0;
            color: #ffffff;
            font-size: 18px;
            font-weight: 700;
        }

        .subtitle {
            margin: 0;
            color: rgba(255, 255, 255, 0.82);
            font-size: 13px;
            line-height: 20px;
        }

        .passcode-form {
            -webkit-app-region: no-drag;
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 18px 16px;
            border-radius: 14px;
            background: rgba(12, 12, 12, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.28);
        }

        .passcode-form.success {
            border-color: rgba(116, 255, 203, 0.6);
        }

        .passcode-input {
            width: 100%;
            padding: 12px 16px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.35);
            background: transparent;
            color: #fff;
            font-size: 16px;
            letter-spacing: 0.24em;
            text-transform: uppercase;
            box-sizing: border-box;
        }

        .passcode-input::placeholder {
            color: rgba(255, 255, 255, 0.32);
            letter-spacing: normal;
        }

        .passcode-input:focus {
            outline: none;
            border-color: rgba(255, 255, 255, 0.75);
        }

        .passcode-button {
            margin-top: 4px;
            padding: 12px;
            border-radius: 999px;
            border: none;
            background: rgba(255, 255, 255, 0.92);
            color: #0f0f0f;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.15s ease, background 0.15s ease;
        }

        .passcode-button:disabled {
            opacity: 0.55;
            cursor: not-allowed;
        }

        .passcode-button:not(:disabled):hover {
            transform: translateY(-1px);
            background: rgba(255, 255, 255, 0.98);
        }

        .passcode-error {
            min-height: 16px;
            color: #ff8a8a;
            font-size: 12px;
        }

        .passcode-success {
            width: 100%;
            padding: 13px 15px;
            border-radius: 12px;
            background: rgba(6, 53, 34, 0.85);
            border: 1px solid rgba(116, 255, 203, 0.55);
            color: #74ffcb;
            font-size: 13px;
            line-height: 19px;
            box-sizing: border-box;
        }

        .footer {
            margin-top: 6px;
            text-align: center;
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
        }

        .footer-link {
            color: #ffffff;
            text-decoration: underline;
            cursor: pointer;
            -webkit-app-region: no-drag;
        }
    `;

    static properties = {
        passcodeRequired: { type: Boolean, attribute: 'passcode-required' },
        passcodeVerified: { type: Boolean, attribute: 'passcode-verified' },
        passcodeValue: { type: String, state: true },
        passcodeError: { type: String, state: true },
        isVerifyingPasscode: { type: Boolean, state: true },
    };

    constructor() {
        super();
        this.passcodeRequired = false;
        this.passcodeVerified = false;
        this.passcodeValue = '';
        this.passcodeError = '';
        this.isVerifyingPasscode = false;
        this.handlePasscodeSubmit = this.handlePasscodeSubmit.bind(this);
        this.handlePasscodeInput = this.handlePasscodeInput.bind(this);
        this.handleClose = this.handleClose.bind(this);
    }

    updated(changed) {
        super.updated(changed);
        this.dispatchEvent(new CustomEvent('content-changed', { bubbles: true, composed: true }));
    }

    handleClose() {
        window.api?.common?.quitApplication();
    }

    get passcodeGateActive() {
        return this.passcodeRequired && !this.passcodeVerified;
    }

    async handlePasscodeSubmit(event) {
        event.preventDefault();

        if (!this.passcodeGateActive) {
            this.dispatchEvent(new CustomEvent('passcode-verified', { bubbles: true, composed: true }));
            return;
        }

        const code = (this.passcodeValue || '').trim();
        if (!/^[A-Za-z0-9]{8}$/.test(code)) {
            this.passcodeError = 'Enter the 8-character interview passcode';
            return;
        }

        if (!window.api?.passcode) {
            this.passcodeRequired = false;
            this.passcodeVerified = true;
            this.dispatchEvent(new CustomEvent('passcode-verified', { bubbles: true, composed: true }));
            return;
        }

        this.isVerifyingPasscode = true;
        this.passcodeError = '';
        try {
            const result = await window.api.passcode.verify(code);
            if (result?.success) {
                this.passcodeValue = '';
                this.passcodeRequired = false;
                this.passcodeVerified = true;
                this.dispatchEvent(new CustomEvent('passcode-verified', { bubbles: true, composed: true }));
            } else {
                this.passcodeError = result?.error || 'Passcode verification failed';
            }
        } catch (error) {
            this.passcodeError = error?.message || 'Passcode verification failed';
        } finally {
            this.isVerifyingPasscode = false;
        }
    }

    handlePasscodeInput(event) {
        const sanitized = (event.target.value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
        this.passcodeValue = sanitized;
        if (event.target.value !== sanitized) {
            event.target.value = sanitized;
        }
        this.passcodeError = '';
    }

    render() {
        const buttonDisabled = !this.passcodeGateActive || this.passcodeValue.length !== 8 || this.isVerifyingPasscode;

        return html`
            <div class="container">
                <button class="close-button" @click=${this.handleClose}>×</button>
                <div class="drag-area">
                    <p class="title">Enter Interview Passcode</p>
                    <p class="subtitle">
                        Input the 8-character alphanumeric code you received. Once verified, the main header bar
                        will open automatically.
                    </p>
                </div>
                <form class="passcode-form ${this.passcodeVerified ? 'success' : ''}" @submit=${this.handlePasscodeSubmit}>
                    <input
                        class="passcode-input"
                        maxlength="8"
                        placeholder="XXXXXXXX"
                        .value=${this.passcodeValue}
                        @input=${this.handlePasscodeInput}
                        autocomplete="off"
                        autocapitalize="characters"
                        spellcheck="false"
                        ?disabled=${!this.passcodeGateActive}
                    />
                    <button class="passcode-button" type="submit" ?disabled=${buttonDisabled}>
                        ${this.isVerifyingPasscode ? 'Verifying…' : '开始面试'}
                    </button>
                    <div class="passcode-error">${this.passcodeError}</div>
                </form>
                ${!this.passcodeGateActive && this.passcodeVerified
                    ? html`<div class="passcode-success">Passcode verified. Loading header bar…</div>`
                    : null}
            </div>
        `;
    }

    openPrivacyPolicy() {
        window.api?.common?.openExternal?.('https://pickle.com/privacy-policy');
    }
}

customElements.define('welcome-header', WelcomeHeader);
