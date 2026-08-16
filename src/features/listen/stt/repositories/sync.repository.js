const sqliteClient = require('../../../common/services/sqliteClient');

function addPending({
    id,
    sessionId,
    remoteSessionId,
    clientTurnId,
    payload,
    createdAt,
}) {
    const db = sqliteClient.getDb();
    const now = createdAt || Math.floor(Date.now() / 1000);
    const result = db.prepare(`
        INSERT OR IGNORE INTO transcript_sync_outbox
        (id, session_id, remote_session_id, client_turn_id, payload, status, attempts, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)
    `).run(
        id,
        sessionId,
        remoteSessionId,
        clientTurnId,
        JSON.stringify(payload),
        now,
        now,
    );
    return { changes: result.changes };
}

function getPending(limit = 20) {
    const db = sqliteClient.getDb();
    const now = Math.floor(Date.now() / 1000);
    const rows = db.prepare(`
        SELECT *
        FROM transcript_sync_outbox
        WHERE status IN ('pending', 'retrying')
          AND (next_retry_at IS NULL OR next_retry_at <= ?)
        ORDER BY created_at ASC
        LIMIT ?
    `).all(now, Math.max(1, Math.min(limit, 100)));

    return rows.map(row => ({
        ...row,
        payload: JSON.parse(row.payload),
    }));
}

function markSynced(id, sessionId, clientTurnId) {
    const db = sqliteClient.getDb();
    const now = Math.floor(Date.now() / 1000);
    const transaction = db.transaction(() => {
        db.prepare(`
            UPDATE transcript_sync_outbox
            SET status = 'synced', synced_at = ?, updated_at = ?, last_error = NULL
            WHERE id = ?
        `).run(now, now, id);
        db.prepare(`
            UPDATE transcripts
            SET sync_state = 'synced'
            WHERE session_id = ? AND client_turn_id = ?
        `).run(sessionId, clientTurnId);
    });
    transaction();
}

function markRetry(id, errorMessage, nextRetryAt) {
    const db = sqliteClient.getDb();
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
        UPDATE transcript_sync_outbox
        SET status = 'retrying', attempts = attempts + 1, next_retry_at = ?, last_error = ?, updated_at = ?
        WHERE id = ?
    `).run(nextRetryAt, errorMessage, now, id);
}

function markFailed(id, errorMessage) {
    const db = sqliteClient.getDb();
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`
        UPDATE transcript_sync_outbox
        SET status = 'failed', attempts = attempts + 1, last_error = ?, updated_at = ?
        WHERE id = ?
    `).run(errorMessage, now, id);
}

module.exports = {
    addPending,
    getPending,
    markSynced,
    markRetry,
    markFailed,
};
