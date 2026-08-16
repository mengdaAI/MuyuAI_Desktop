const authService = require('./authService');
const syncRepository = require('../../listen/stt/repositories/sync.repository');
const interviewReviewApi = require('../../listen/interviewReviewApi');

const RETRY_DELAYS_SECONDS = [2, 5, 15, 60, 300];

class TranscriptSyncService {
    constructor() {
        this.timer = null;
        this.isSyncing = false;
        this.started = false;
    }

    start() {
        if (this.started) return;
        this.started = true;
        this.schedule(0);
        this.timer = setInterval(() => this.flush(), 30000);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.started = false;
    }

    schedule(delayMs = 0) {
        setTimeout(() => this.flush(), delayMs);
    }

    async flush({ timeoutMs = 0 } = {}) {
        if (this.isSyncing) return { synced: 0, pending: true };
        if (!authService.getInterviewAuthState?.()?.token) {
            return { synced: 0, skipped: true };
        }

        this.isSyncing = true;
        const run = this._flushPending();
        run.then(
            () => {
                this.isSyncing = false;
            },
            () => {
                this.isSyncing = false;
            },
        );

        if (!timeoutMs) return run;
        return Promise.race([
            run,
            new Promise(resolve => setTimeout(() => resolve({ timedOut: true }), timeoutMs)),
        ]);
    }

    async _flushPending() {
        let synced = 0;
        const items = syncRepository.getPending(20);

        for (const item of items) {
            try {
                await interviewReviewApi.recordTurn({
                    sessionId: item.remote_session_id,
                    turn: item.payload,
                }, {
                    idempotencyKey: `${item.remote_session_id}:${item.client_turn_id}`,
                });
                syncRepository.markSynced(item.id, item.session_id, item.client_turn_id);
                synced += 1;
            } catch (error) {
                const status = error?.status;
                const message = error?.message || String(error);
                if (status === 400 || status === 403 || status === 404 || status === 422) {
                    syncRepository.markFailed(item.id, message);
                } else {
                    const attempt = Math.min((item.attempts || 0), RETRY_DELAYS_SECONDS.length - 1);
                    const nextRetryAt = Math.floor(Date.now() / 1000) + RETRY_DELAYS_SECONDS[attempt];
                    syncRepository.markRetry(item.id, message, nextRetryAt);
                }
            }
        }

        if (items.length === 20) {
            this.schedule(0);
        }
        return { synced, processed: items.length };
    }
}

module.exports = new TranscriptSyncService();
