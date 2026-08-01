"use strict";

/**
 * Safely extracts senderID from multiple possible delta message structures.
 * Maintains backward compatibility with old and new Facebook API versions.
 * 
 * @param {Object} delta - The delta object from MQTT message
 * @param {Object} messageMetadata - Optional pre-extracted metadata
 * @returns {string|null} - Formatted sender ID or null if not found
 */
function extractSenderID(delta, messageMetadata) {
    const md = messageMetadata || delta?.messageMetadata || delta?.metadata || {};
    
    // Primary source: messageMetadata.actorFbId (most common)
    if (md.actorFbId) {
        return String(md.actorFbId).replace(/(fb)?id[:.]/, "");
    }
    
    // Fallback 1: messageMetadata.actor (alternative field)
    if (md.actor) {
        return String(md.actor).replace(/(fb)?id[:.]/, "");
    }
    
    // Fallback 2: senderFbId (older API versions)
    if (md.senderFbId) {
        return String(md.senderFbId).replace(/(fb)?id[:.]/, "");
    }
    
    // Fallback 3: sender (alternative)
    if (md.sender) {
        return String(md.sender).replace(/(fb)?id[:.]/, "");
    }
    
    // Fallback 4: delta.senderID (direct field)
    if (delta?.senderID) {
        return String(delta.senderID).replace(/(fb)?id[:.]/, "");
    }
    
    // Fallback 5: delta.from (rare cases)
    if (delta?.from) {
        return String(delta.from).replace(/(fb)?id[:.]/, "");
    }
    
    // Fallback 6: messageMetadata.userId (GraphQL format)
    if (md.userId) {
        return String(md.userId).replace(/(fb)?id[:.]/, "");
    }
    
    // Fallback 7: delta.sourceID or initiatorID (group actions)
    if (delta?.sourceID) {
        return String(delta.sourceID).replace(/(fb)?id[:.]/, "");
    }
    if (delta?.initiatorID) {
        return String(delta.initiatorID).replace(/(fb)?id[:.]/, "");
    }
    
    // No valid sender ID found
    return null;
}

module.exports = {
    extractSenderID
};
