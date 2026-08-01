"use strict";

/**
 * Strips "fbid:" or "id:" prefixes from a Facebook ID string safely.
 * @param {any} id The ID to format.
 * @returns {string|any} The formatted ID or original value if null/undefined.
 */
function formatID(id) {
    if (id === undefined || id === null) return id;
    const s = String(id);
    // Remove only leading "id:" or "fbid:" (case-insensitive)
    return s.replace(/^(?:fb)?id[:.]/i, "");
}

module.exports = formatID;
