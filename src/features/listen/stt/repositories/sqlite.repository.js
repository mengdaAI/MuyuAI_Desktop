const sqliteClient = require('../../../common/services/sqliteClient');

function addTranscript({ uid, sessionId, speaker, text, clientTurnId, timestamp }) {
    // uid is ignored in the SQLite implementation
    const db = sqliteClient.getDb();
    const transcriptId = require('crypto').randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const startAt = timestamp ? Math.floor(timestamp / 1000) : now;
    const query = `INSERT INTO transcripts (id, session_id, start_at, speaker, text, created_at, client_turn_id) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    try {
        db.prepare(query).run(transcriptId, sessionId, startAt, speaker, text, now, clientTurnId || null);
        return { id: transcriptId };
    } catch (err) {
        console.error('Error adding transcript:', err);
        throw err;
    }
}

function addTranscriptAndQueue({ uid, sessionId, remoteSessionId, clientTurnId, speaker, remoteSpeaker, text, timestamp, sequence }) {
    const db = sqliteClient.getDb();
    const transcriptId = require('crypto').randomUUID();
    const outboxId = require('crypto').randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const startAt = timestamp ? Math.floor(timestamp / 1000) : now;
    const transaction = db.transaction(() => {
        const existing = db.prepare(`
            SELECT id FROM transcripts WHERE session_id = ? AND client_turn_id = ? LIMIT 1
        `).get(sessionId, clientTurnId);
        if (!existing) {
            db.prepare(`
                INSERT INTO transcripts
                (id, session_id, start_at, speaker, text, created_at, sync_state, client_turn_id)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
            `).run(transcriptId, sessionId, startAt, speaker, text, now, clientTurnId);
        }
        db.prepare(`
            INSERT OR IGNORE INTO transcript_sync_outbox
            (id, session_id, remote_session_id, client_turn_id, payload, status, attempts, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)
        `).run(
            outboxId,
            sessionId,
            remoteSessionId,
            clientTurnId,
            JSON.stringify({
                id: clientTurnId,
                speaker: remoteSpeaker || speaker,
                text,
                timestamp: timestamp || Date.now(),
                ...(typeof sequence === 'number' ? { sequence } : {}),
            }),
            now,
            now,
        );
        return { id: existing?.id || transcriptId, outboxId };
    });
    return transaction();
}

function getAllTranscriptsBySessionId(sessionId) {
    const db = sqliteClient.getDb();
    const query = "SELECT * FROM transcripts WHERE session_id = ? ORDER BY start_at ASC";
    return db.prepare(query).all(sessionId);
}

module.exports = {
    addTranscript,
    addTranscriptAndQueue,
    getAllTranscriptsBySessionId,
}; 