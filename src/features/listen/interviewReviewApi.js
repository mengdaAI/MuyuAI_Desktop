const config = require('../common/config/config');
const authService = require('../common/services/authService');
const { API_PATHS } = require('../common/config/constants');

const fetchImpl = global.fetch || require('node-fetch');

function buildEndpoint(path) {
    const baseUrl = (config.get('apiUrl') || '').trim().replace(/\/$/, '');
    if (!baseUrl) {
        throw new Error('Interview review API base URL is not configured.');
    }
    return `${baseUrl}${path}`;
}

function buildHeaders() {
    const headers = {
        'Content-Type': 'application/json',
    };
    const interviewAuth = authService.getInterviewAuthState?.();
    if (interviewAuth?.token) {
        headers.Authorization = `Bearer ${interviewAuth.token}`;
    }
    return headers;
}

async function recordTurn({ sessionId, turn }) {
    if (!sessionId || !turn?.text?.trim()) {
        return { success: false, skipped: true };
    }

    const response = await fetchImpl(buildEndpoint(API_PATHS.INTERVIEW_REVIEW_TURNS), {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ sessionId, turn }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.message || data?.error || `Record interview review turn failed (${response.status})`);
    }
    return data;
}

async function generatePersistedReview(sessionId) {
    if (!sessionId) {
        return { success: false, skipped: true };
    }

    const path = `${API_PATHS.INTERVIEW_REVIEW_GENERATE_PERSIST}/${encodeURIComponent(sessionId)}/persist`;
    const response = await fetchImpl(buildEndpoint(path), {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({}),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.message || data?.error || `Generate interview review failed (${response.status})`);
    }
    return data;
}

module.exports = {
    recordTurn,
    generatePersistedReview,
};
