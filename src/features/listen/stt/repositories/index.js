const repository = require('./sqlite.repository');
const authService = require('../../../common/services/authService');

const sttRepositoryAdapter = {
    addTranscript: ({ sessionId, speaker, text, clientTurnId, timestamp }) => {
        const uid = authService.getCurrentUserId();
        return repository.addTranscript({ uid, sessionId, speaker, text, clientTurnId, timestamp });
    },
    addTranscriptAndQueue: ({ sessionId, remoteSessionId, clientTurnId, speaker, remoteSpeaker, text, timestamp, sequence }) => {
        const uid = authService.getCurrentUserId();
        return repository.addTranscriptAndQueue({
            uid,
            sessionId,
            remoteSessionId,
            clientTurnId,
            speaker,
            remoteSpeaker,
            text,
            timestamp,
            sequence,
        });
    },
    getAllTranscriptsBySessionId: (sessionId) => {
        return repository.getAllTranscriptsBySessionId(sessionId);
    }
};

module.exports = sttRepositoryAdapter; 
