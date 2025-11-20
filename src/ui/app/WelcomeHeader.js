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
            padding: 40px 32px 36px;
            border-radius: 28px;
            background: linear-gradient(140deg, rgba(30, 13, 51, 0.93), rgba(72, 20, 88, 0.88));
            box-shadow:
                inset 0 0 0 1px rgba(255, 255, 255, 0.15),
                inset 0 0 40px rgba(255, 255, 255, 0.08),
                0 25px 55px rgba(12, 3, 32, 0.65);
            display: flex;
            flex-direction: column;
            gap: 28px;
            -webkit-app-region: no-drag;
            position: relative;
            overflow: hidden;
        }

        .container::before,
        .container::after {
            content: '';
            position: absolute;
            inset: 0;
            z-index: 0;
            pointer-events: none;
        }

        .container::before {
            background: radial-gradient(circle at 20% -10%, rgba(255, 160, 243, 0.12), transparent 60%);
        }

        .container::after {
            background: radial-gradient(circle at 90% 20%, rgba(147, 93, 255, 0.28), transparent 45%);
        }

        .close-button {
            -webkit-app-region: no-drag;
            position: absolute;
            top: 18px;
            right: 18px;
            width: 30px;
            height: 30px;
            border: 1px solid rgba(255, 255, 255, 0.25);
            border-radius: 50%;
            background: rgba(18, 9, 37, 0.6);
            color: rgba(255, 255, 255, 0.9);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s ease;
            font-size: 16px;
            z-index: 1;
        }
        .close-button:hover {
            background: rgba(255, 255, 255, 0.18);
        }

        .drag-area {
            -webkit-app-region: drag;
            cursor: move;
            display: flex;
            flex-direction: column;
            gap: 14px;
            z-index: 1;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo-mark {
            width: 36px;
            height: 36px;
            border-radius: 12px;
            background: linear-gradient(135deg, #f0deff, #b486ff);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #3f2070;
            font-weight: 700;
            font-size: 20px;
        }

        .logo-mark::after {
            content: 'M';
            letter-spacing: -0.05em;
        }

        .title {
            margin: 0;
            color: #ffffff;
            font-size: 26px;
            font-weight: 700;
            letter-spacing: 0.02em;
        }

        .subtitle {
            margin: 0;
            color: rgba(233, 224, 255, 0.92);
            font-size: 15px;
            line-height: 26px;
        }

        .subtitle-link {
            border: none;
            background: none;
            padding: 0 0 0 6px;
            margin: 0;
            color: #c399ff;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            -webkit-app-region: no-drag;
        }

        .subtitle-link:hover {
            text-decoration: underline;
        }

        .passcode-form {
            -webkit-app-region: no-drag;
            display: flex;
            flex-direction: column;
            gap: 18px;
            padding: 0;
        }

        .passcode-form.success {
            --passcode-glow: rgba(116, 255, 203, 0.6);
        }

        .passcode-form.success .passcode-input {
            border-color: var(--passcode-glow);
            box-shadow:
                0 8px 24px rgba(80, 221, 183, 0.45),
                0 0 0 2px rgba(116, 255, 203, 0.35),
                inset 0 0 20px rgba(96, 255, 210, 0.2);
        }

        .passcode-input {
            width: 100%;
            padding: 16px 18px;
            border-radius: 18px;
            border: 1px solid rgba(194, 147, 255, 0.95);
            background: linear-gradient(135deg, rgba(94, 42, 131, 0.75), rgba(162, 95, 226, 0.65));
            color: #fef8ff;
            font-size: 18px;
            letter-spacing: 0.3em;
            text-transform: uppercase;
            box-sizing: border-box;
            text-align: center;
            box-shadow:
                0 5px 18px rgba(93, 42, 151, 0.5),
                0 0 0 1px rgba(255, 255, 255, 0.15),
                inset 0 0 20px rgba(255, 255, 255, 0.1);
        }

        .passcode-input::placeholder {
            color: rgba(255, 255, 255, 0.45);
            letter-spacing: normal;
        }

        .passcode-input:focus {
            outline: none;
            border-color: rgba(255, 255, 255, 0.75);
            box-shadow:
                0 10px 24px rgba(105, 64, 165, 0.65),
                0 0 0 2px rgba(255, 255, 255, 0.2);
        }

        .passcode-input:disabled {
            opacity: 0.6;
        }

        .button-shell {
            padding: 4px;
            border-radius: 999px;
            background: linear-gradient(110deg, rgba(255, 255, 255, 0.4), rgba(166, 169, 196, 0.15));
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
        }

        .passcode-button {
            width: 100%;
            padding: 16px;
            border-radius: 999px;
            border: none;
            background: linear-gradient(180deg, rgba(248, 248, 255, 0.96), rgba(172, 167, 190, 0.92));
            color: #2e1b44;
            font-size: 16px;
            font-weight: 700;
            letter-spacing: 0.18em;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            text-transform: uppercase;
        }

        .passcode-button:disabled {
            cursor: not-allowed;
            opacity: 0.75;
        }

        .passcode-button:not(:disabled):hover {
            transform: translateY(-1px);
            box-shadow: 0 12px 20px rgba(21, 8, 32, 0.45);
        }

        .passcode-error {
            min-height: 18px;
            color: #ff9c9c;
            font-size: 13px;
            text-align: center;
        }

        .passcode-success {
            width: 100%;
            padding: 13px 15px;
            border-radius: 16px;
            background: rgba(18, 61, 42, 0.8);
            border: 1px solid rgba(116, 255, 203, 0.55);
            color: #98ffd7;
            font-size: 14px;
            line-height: 21px;
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
            this.passcodeError = '请输入完整的8位字母数字面试码';
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
                this.passcodeError = result?.error || '面试码验证失败，请重试';
            }
        } catch (error) {
            this.passcodeError = error?.message || '面试码验证失败，请稍后再试';
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
                    <div class="brand">
                        <div class="logo-mark"></div>
                        <p class="title">幕语提词器</p>
                    </div>
                    <p class="subtitle">
                        请在工作台创建面试，获得8位字母数字面试码后下方输入。验证成功后将开启面试。
                        <button type="button" class="subtitle-link" @click=${this.openCreateInterview}>创建面试 ></button>
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
                    <div class="button-shell">
                        <button class="passcode-button" type="submit" ?disabled=${buttonDisabled}>
                            ${this.isVerifyingPasscode ? '核验中…' : '开始面试'}
                        </button>
                    </div>
                    <div class="passcode-error">${this.passcodeError}</div>
                </form>
                ${!this.passcodeGateActive && this.passcodeVerified
                    ? html`<div class="passcode-success">面试码验证成功，正在载入…</div>`
                    : null}
            </div>
        `;
    }

    openCreateInterview() {
        window.api?.common?.openExternal?.('https://muyu.mengdaai.com/');
    }
}

customElements.define('welcome-header', WelcomeHeader);
