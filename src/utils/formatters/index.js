"use strict";

const stream = require("stream");
const formatID = require('./value/formatID');
const formatDate = require('./value/formatDate');
const formatCookie = require('./value/formatCookie');
const { _formatAttachment, formatAttachment } = require('./data/formatAttachment');
const { formatDeltaMessage, formatDeltaEvent, formatDeltaReadReceipt, getAdminTextMessageType } = require('./data/formatDelta');

function isReadableStream(obj) {
    return obj instanceof stream.Stream && typeof obj._read == "function" && typeof obj._readableState == "object";
}

function decodeClientPayload(payload) {
    /*
    Robust decode for client payloads:
    - Accept Buffer, Uint8Array, Array-like of char codes
    - Use Buffer.from(...).toString() for binary/typed arrays
    - Fall back to String.fromCharCode for small arrays if needed
    */
    try {
        if (!payload) return null;
        if (Buffer.isBuffer(payload)) {
            return JSON.parse(payload.toString());
        }
        if (payload instanceof Uint8Array || (typeof payload === 'object' && payload.buffer && payload.byteLength !== undefined)) {
            // TypedArray
            return JSON.parse(Buffer.from(payload).toString());
        }
        if (Array.isArray(payload)) {
            // Array of char codes
            try {
                // When arrays are large, avoid apply()
                if (payload.length > 65536) {
                    return JSON.parse(Buffer.from(payload).toString());
                }
                return JSON.parse(String.fromCharCode.apply(null, payload));
            } catch (e) {
                return JSON.parse(Buffer.from(payload).toString());
            }
        }
        // Other fallback: coerce to string
        return JSON.parse(String(payload));
    } catch (err) {
        // Re-throw so caller can handle/log
        throw err;
    }
}

function formatMessage(m) {
    const originalMessage = m.message ? m.message : m;
    const obj = {
        type: "message",
        senderName: originalMessage.sender_name,
        senderID: formatID(originalMessage.sender_fbid.toString()),
        participantNames: originalMessage.group_thread_info?.participant_names || [originalMessage.sender_name.split(" ")[0]],
        participantIDs: originalMessage.group_thread_info?.participant_ids.map(v => formatID(v.toString())) || [formatID(originalMessage.sender_fbid)],
        body: originalMessage.body || "",
        threadID: formatID((originalMessage.thread_fbid || originalMessage.other_user_fbid).toString()),
        threadName: originalMessage.group_thread_info?.name || originalMessage.sender_name,
        location: originalMessage.coordinates || null,
        messageID: originalMessage.mid?.toString() || originalMessage.message_id,
        attachments: formatAttachment(originalMessage.attachments, originalMessage.attachmentIds, originalMessage.attachment_map, originalMessage.share_map),
        timestamp: originalMessage.timestamp,
        tags: originalMessage.tags,
        reactions: originalMessage.reactions || [],
        isUnread: originalMessage.is_unread
    };
    if (m.type === "pages_messaging") obj.pageID = m.realtime_viewer_fbid.toString();
    obj.isGroup = obj.participantIDs.length > 2;
    return obj;
}

/* rest of file left unchanged below (exports etc.) */

function formatEvent(m) {
    const originalMessage = m.message ? m.message : m;
    let logMessageType = originalMessage.log_message_type;
    let logMessageData;
    if (logMessageType === "log:generic-admin-text") {
        logMessageData = originalMessage.log_message_data.untypedData;
        logMessageType = getAdminTextMessageType(originalMessage.log_message_data.message_type);
    } else {
        logMessageData = originalMessage.log_message_data;
    }
    return {
        ...formatMessage(originalMessage),
        type: "event",
        logMessageType,
        logMessageData,
        logMessageBody: originalMessage.log_message_body
    };
}

function formatHistoryMessage(m) {
    return m.action_type === "ma-type:log-message" ? formatEvent(m) : formatMessage(m);
}

function formatTyp(event) {
    return {
        isTyping: !!event.st,
        from: event.from.toString(),
        threadID: formatID((event.to || event.thread_fbid || event.from).toString()),
        fromMobile: event.hasOwnProperty("from_mobile") ? event.from_mobile : true,
        userID: (event.realtime_viewer_fbid || event.from).toString(),
        type: "typ"
    };
}

function formatReadReceipt(event) {
    return {
        reader: event.reader.toString(),
        time: event.time,
        threadID: formatID((event.thread_fbid || event.reader).toString()),
        type: "read_receipt"
    };
}

function formatRead(event) {
    return {
        threadID: formatID(((event.chat_ids && event.chat_ids[0]) || (event.thread_fbids && event.thread_fbids[0])).toString()),
        time: event.timestamp,
        type: "read"
    };
}

function formatThread(data) {
    return {
        threadID: formatID(data.thread_fbid.toString()),
        participants: data.participants.map(formatID),
        participantIDs: data.participants.map(formatID),
        name: data.name,
        nicknames: data.custom_nickname,
        snippet: data.snippet,
        snippetAttachments: data.snippet_attachments,
        snippetSender: formatID((data.snippet_sender || "").toString()),
        unreadCount: data.unread_count,
        messageCount: data.message_count,
        imageSrc: data.image_src,
        timestamp: data.timestamp,
        serverTimestamp: data.server_timestamp,
        muteUntil: data.mute_until,
        isCanonicalUser: data.is_canonical_user,
        isCanonical: data.is_canonical,
        isSubscribed: data.is_subscribed,
        folder: data.folder,
        isArchived: data.is_archived,
        recipientsLoadable: data.recipients_loadable,
        hasEmailParticipant: data.has_email_participant,
        readOnly: data.read_only,
        canReply: data.can_reply,
        cannotReplyReason: data.cannot_reply_reason,
        lastMessageTimestamp: data.last_message_timestamp,
        lastReadTimestamp: data.last_read_timestamp,
        lastMessageType: data.last_message_type,
        emoji: data.custom_like_icon,
        color: data.custom_color,
        adminIDs: data.admin_ids,
        threadType: data.thread_type
    };
}

module.exports = {

  isReadableStream,

  getExtension,

  _formatAttachment,

  formatAttachment,

  formatDeltaMessage,

  formatID,

  formatMessage,

  formatEvent,

  formatHistoryMessage,

  getAdminTextMessageType,

  formatDeltaEvent,

  formatTyp,

  formatDeltaReadReceipt,

  formatReadReceipt,

  formatRead,

  formatDate,

  formatCookie,

  formatThread,

  formatProxyPresence,

  formatPresence,

  decodeClientPayload,
};
