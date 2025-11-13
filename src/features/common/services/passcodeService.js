const fetch = require('node-fetch');

const loggerPrefix = '[PasscodeService]';

class PasscodeService {
    constructor() {
        this.isVerified = false;
        this.apiEndpoint = (process.env.INTERVIEW_PASSCODE_API || '').trim();
        this.requirePasscode = process.env.INTERVIEW_PASSCODE_REQUIRED !== 'false';
    }

    isPasscodeRequired() {
        return this.requirePasscode && !this.isVerified;
    }

    getStatus() {
        const required = this.isPasscodeRequired();
        return {
            required,
            verified: this.isVerified || !required,
        };
    }

    reset() {
        this.isVerified = false;
    }

    async verify(input) {
        if (!this.requirePasscode) {
            this.isVerified = true;
            return { success: true, skip: true, message: 'Passcode requirement disabled' };
        }

        const candidate = (input || '').trim();
        if (!candidate) {
            return { success: false, error: '请输入面试口令' };
        }

        if (!/^[A-Za-z0-9]{8}$/.test(candidate)) {
            return { success: false, error: '口令需为 8 位字母或数字组合' };
        }

        if (this.apiEndpoint) {
            const result = await this.verifyViaApi(candidate);
            if (!result.success) {
                return result;
            }
        } else {
            await this.mockVerify(candidate);
        }

        this.isVerified = true;
        console.log(`${loggerPrefix} Passcode verified successfully.`);
        return { success: true };
    }

    async verifyViaApi(passcode) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ passcode }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok || data?.success === false) {
                return {
                    success: false,
                    error: data?.message || '口令验证失败，请重试',
                };
            }

            return { success: true };
        } catch (error) {
            console.error(`${loggerPrefix} API verification error:`, error);
            return {
                success: false,
                error: '无法连接验证服务，请稍后重试',
            };
        }
    }

    async mockVerify(passcode) {
        console.log(`${loggerPrefix} No API endpoint configured. Mock-verifying passcode "${passcode}".`);
        await new Promise(resolve => setTimeout(resolve, 300));
        return { success: true };
    }
}

module.exports = new PasscodeService();
