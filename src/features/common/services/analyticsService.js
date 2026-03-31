const { app } = require('electron');
const Store = require('electron-store');
const fetch = require('node-fetch');
const { randomUUID } = require('crypto');
const { API_PATHS } = require('../config/constants');
const authService = require('./authService');

const loggerPrefix = '[AnalyticsService]';
const store = new Store({
    name: 'pickle-glass-settings',
});

class AnalyticsService {
    constructor() {
        const domain = (process.env.MUYU_API_DOMAIN || '').trim().replace(/\/$/, '');
        this.analyticsEventsEndpoint = `${domain}${API_PATHS.ANALYTICS_EVENTS}`;
    }

    getOrCreateInstallId() {
        const existingInstallId = store.get('analytics.installId');
        if (typeof existingInstallId === 'string' && existingInstallId.trim()) {
            return existingInstallId;
        }

        const installId = randomUUID();
        store.set('analytics.installId', installId);
        return installId;
    }

    buildAppOpenedEvent() {
        const currentUser = authService.getCurrentUser?.() || {};
        const { token } = authService.getInterviewAuthState?.() || {};

        return {
            endpoint: this.analyticsEventsEndpoint,
            token,
            payload: {
                events: [
                    {
                        event: 'desktop_app_opened',
                        occurredAt: new Date().toISOString(),
                        installId: this.getOrCreateInstallId(),
                        userId: currentUser?.isLoggedIn ? currentUser.uid : null,
                        userMode: currentUser?.mode || 'local',
                        version: app.getVersion(),
                        platform: process.platform,
                    }
                ]
            }
        };
    }

    async trackAppOpened() {
        if (!this.analyticsEventsEndpoint) {
            console.warn(`${loggerPrefix} Analytics endpoint missing, skipping app_opened event.`);
            return { success: false, error: 'Analytics endpoint not configured' };
        }

        const { endpoint, token, payload } = this.buildAppOpenedEvent();
        const headers = {
            'Content-Type': 'application/json',
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                console.warn(`${loggerPrefix} desktop_app_opened failed:`, data);
                return {
                    success: false,
                    error: data?.message || data?.error || 'Failed to report desktop_app_opened',
                };
            }

            return { success: true, data };
        } catch (error) {
            console.warn(`${loggerPrefix} desktop_app_opened error:`, error);
            return {
                success: false,
                error: error?.message || 'Failed to report desktop_app_opened',
            };
        }
    }
}

module.exports = new AnalyticsService();
