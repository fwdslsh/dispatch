/**
 * @typedef {Object} RunSessionLiveEntry
 * @property {string} runSessionId
 * @property {string} kind
 * @property {number} nextSequenceNumber
 * @property {any} [proc]
 * @property {boolean} initializing
 * @property {Promise<any>} eventQueue
 */

/**
 * @typedef {Object} SessionEventPayload
 * @property {string} channel
 * @property {string} type
 * @property {any} payload
 */

export {};
