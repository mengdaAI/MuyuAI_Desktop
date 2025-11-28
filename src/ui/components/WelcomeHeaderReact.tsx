import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { createRoot } from 'react-dom/client';
import { StartupScreen } from './StartupScreen';

// 扩展 Window 接口
declare global {
    interface Window {
        api?: {
            passcode?: {
                verify: (code: string) => Promise<{ success: boolean; error?: string }>;
            };
            common?: {
                quitApplication: () => Promise<void>;
                openExternal: (url: string) => Promise<void>;
            };
        };
    }
}

export interface WelcomeHeaderReactRef {
    passcodeRequired: boolean;
    passcodeVerified: boolean;
    passcodeValue: string;
    passcodeError: string;
    isVerifyingPasscode: boolean;
    addEventListener: (event: string, callback: (e: CustomEvent) => void) => void;
    removeEventListener: (event: string, callback: (e: CustomEvent) => void) => void;
    dispatchEvent: (event: CustomEvent) => boolean;
}

interface WelcomeHeaderReactProps {
    passcodeRequired?: boolean;
    passcodeVerified?: boolean;
}

const WelcomeHeaderReactComponent = forwardRef(
    ({ passcodeRequired: initialPasscodeRequired = false, passcodeVerified: initialPasscodeVerified = false }: WelcomeHeaderReactProps, ref: any) => {
        const [passcodeValue, setPasscodeValue] = useState('');
        const [passcodeError, setPasscodeError] = useState('');
        const [isVerifyingPasscode, setIsVerifyingPasscode] = useState(false);
        const [passcodeRequired, setPasscodeRequired] = useState(initialPasscodeRequired);
        const [passcodeVerified, setPasscodeVerified] = useState(initialPasscodeVerified);
        const eventListenersRef = useRef(new Map<string, Set<(e: CustomEvent) => void>>());

        // 暴露属性和方法给外部（Web Component 兼容）
        useImperativeHandle(ref as any, () => {
            const refObj: WelcomeHeaderReactRef = {
                get passcodeRequired() {
                    return passcodeRequired;
                },
                set passcodeRequired(value: boolean) {
                    setPasscodeRequired(value);
                },
                get passcodeVerified() {
                    return passcodeVerified;
                },
                set passcodeVerified(value: boolean) {
                    setPasscodeVerified(value);
                },
                get passcodeValue() {
                    return passcodeValue;
                },
                get passcodeError() {
                    return passcodeError;
                },
                get isVerifyingPasscode() {
                    return isVerifyingPasscode;
                },
                addEventListener(event: string, callback: (e: CustomEvent) => void) {
                    if (!eventListenersRef.current.has(event)) {
                        eventListenersRef.current.set(event, new Set());
                    }
                    eventListenersRef.current.get(event)!.add(callback);
                },
                removeEventListener(event: string, callback: (e: CustomEvent) => void) {
                    const listeners = eventListenersRef.current.get(event);
                    if (listeners) {
                        listeners.delete(callback);
                    }
                },
                dispatchEvent(event: CustomEvent) {
                    const listeners = eventListenersRef.current.get(event.type);
                    if (listeners) {
                        listeners.forEach((callback) => callback(event));
                    }
                    return true;
                },
            };
            return refObj;
        }, [passcodeRequired, passcodeVerified, passcodeValue, passcodeError, isVerifyingPasscode]);

        // 监听外部属性变化
        useEffect(() => {
            setPasscodeRequired(initialPasscodeRequired);
        }, [initialPasscodeRequired]);

        useEffect(() => {
            setPasscodeVerified(initialPasscodeVerified);
        }, [initialPasscodeVerified]);

        const passcodeGateActive = passcodeRequired && !passcodeVerified;

        const handlePasscodeInput = (value: string) => {
            // 只允许字母数字，转大写，最多8位
            const sanitized = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
            setPasscodeValue(sanitized);
            setPasscodeError('');
        };

        const handlePasscodeSubmit = async () => {
            if (!passcodeGateActive) {
                const event = new CustomEvent('passcode-verified', { bubbles: true, composed: true });
                eventListenersRef.current.get('passcode-verified')?.forEach((callback) => callback(event));
                return;
            }

            const code = (passcodeValue || '').trim();
            if (!/^[A-Za-z0-9]{8}$/.test(code)) {
                setPasscodeError('请输入完整的8位字母数字面试码');
                return;
            }

            if (!window.api?.passcode) {
                setPasscodeRequired(false);
                setPasscodeVerified(true);
                const event = new CustomEvent('passcode-verified', { bubbles: true, composed: true });
                eventListenersRef.current.get('passcode-verified')?.forEach((callback) => callback(event));
                return;
            }

            setIsVerifyingPasscode(true);
            setPasscodeError('');
            try {
                const result = await window.api.passcode.verify(code);
                if (result?.success) {
                    setPasscodeValue('');
                    setPasscodeRequired(false);
                    setPasscodeVerified(true);
                    const event = new CustomEvent('passcode-verified', { bubbles: true, composed: true });
                    eventListenersRef.current.get('passcode-verified')?.forEach((callback) => callback(event));
                } else {
                    setPasscodeError(result?.error || '面试码验证失败，请重试');
                }
            } catch (error: any) {
                setPasscodeError(error?.message || '面试码验证失败，请稍后再试');
            } finally {
                setIsVerifyingPasscode(false);
            }
        };

        const handleClose = () => {
            window.api?.common?.quitApplication();
        };

        const handleCreateInterview = () => {
            window.api?.common?.openExternal?.('https://muyu.mengdaai.com/');
        };

        // 发送 content-changed 事件（当组件更新时）
        useEffect(() => {
            const event = new CustomEvent('content-changed', { bubbles: true, composed: true });
            eventListenersRef.current.get('content-changed')?.forEach((callback) => callback(event));
        }, [passcodeValue, passcodeError, passcodeVerified, isVerifyingPasscode]);

        return (
            <StartupScreen
                interviewCode={passcodeValue}
                onInterviewCodeChange={handlePasscodeInput}
                onStartInterview={handlePasscodeSubmit}
                onClose={handleClose}
                onCreateInterview={handleCreateInterview}
                passcodeError={passcodeError}
                passcodeVerified={passcodeVerified}
                isVerifyingPasscode={isVerifyingPasscode}
                passcodeRequired={passcodeRequired}
            />
        );
    }
);

WelcomeHeaderReactComponent.displayName = 'WelcomeHeaderReact';

// 创建 Web Component 兼容的包装器
export function createWelcomeHeaderWebComponent() {
    class WelcomeHeaderWebComponent extends HTMLElement {
        private root: ReturnType<typeof createRoot> | null = null;
        private reactRef: { current: WelcomeHeaderReactRef | null };
        private _passcodeRequired: boolean = false;
        private _passcodeVerified: boolean = false;

        constructor() {
            super();
            this.reactRef = { current: null };
        }

        static get observedAttributes() {
            return ['passcode-required', 'passcode-verified'];
        }

        connectedCallback() {
            if (!this.root) {
                this.root = createRoot(this);
                this.render();
            }
        }

        disconnectedCallback() {
            if (this.root) {
                this.root.unmount();
                this.root = null;
            }
        }

        attributeChangedCallback(name: string, oldValue: string, newValue: string) {
            if (oldValue === newValue) return;

            if (name === 'passcode-required') {
                this._passcodeRequired = newValue !== null && newValue !== 'false';
                if (this.reactRef.current) {
                    this.reactRef.current.passcodeRequired = this._passcodeRequired;
                }
            } else if (name === 'passcode-verified') {
                this._passcodeVerified = newValue !== null && newValue !== 'false';
                if (this.reactRef.current) {
                    this.reactRef.current.passcodeVerified = this._passcodeVerified;
                }
            }

            if (this.root) {
                this.render();
            }
        }

        get passcodeRequired() {
            return this._passcodeRequired;
        }

        set passcodeRequired(value: boolean) {
            this._passcodeRequired = value;
            if (value) {
                this.setAttribute('passcode-required', '');
            } else {
                this.removeAttribute('passcode-required');
            }
            if (this.reactRef.current) {
                this.reactRef.current.passcodeRequired = value;
            }
        }

        get passcodeVerified() {
            return this._passcodeVerified;
        }

        set passcodeVerified(value: boolean) {
            this._passcodeVerified = value;
            if (value) {
                this.setAttribute('passcode-verified', '');
            } else {
                this.removeAttribute('passcode-verified');
            }
            if (this.reactRef.current) {
                this.reactRef.current.passcodeVerified = value;
            }
        }

        addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
            super.addEventListener(type, listener, options);
            if (this.reactRef.current && typeof listener === 'function') {
                this.reactRef.current.addEventListener(type, listener as (e: CustomEvent) => void);
            }
        }

        removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
            super.removeEventListener(type, listener, options);
            if (this.reactRef.current && typeof listener === 'function') {
                this.reactRef.current.removeEventListener(type, listener as (e: CustomEvent) => void);
            }
        }

        dispatchEvent(event: CustomEvent) {
            const result = super.dispatchEvent(event);
            if (this.reactRef.current) {
                this.reactRef.current.dispatchEvent(event);
            }
            return result;
        }

        private render() {
            if (!this.root) return;
            this.root.render(
                React.createElement(WelcomeHeaderReactComponent, {
                    ref: this.reactRef,
                    passcodeRequired: this._passcodeRequired,
                    passcodeVerified: this._passcodeVerified,
                })
            );
        }
    }

    return WelcomeHeaderWebComponent;
}

// 自动注册 Web Component（如果还没有注册）
if (typeof window !== 'undefined' && !customElements.get('welcome-header-react')) {
    const WelcomeHeaderWebComponent = createWelcomeHeaderWebComponent();
    customElements.define('welcome-header-react', WelcomeHeaderWebComponent);
}

