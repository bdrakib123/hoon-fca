"use strict";

const utils = require('../../..')?.utils || null; // defensive; actual utils available via require('../..') in runtime
const formatID = require('../value/formatID');
const { _formatAttachment } = require('./formatAttachment');

function getAdminTextMessageType(type) {
    switch (type) {
        case 'unpin_messages_v2': return 'log:unpin-message';
        case 'pin_messages_v2': return 'log:pin-message';
        case "change_thread_theme": return "log:thread-color";
        case "change_thread_icon":
        case 'change_thread_quick_reaction': return "log:thread-icon";
        case "change_thread_nickname": return "log:user-nickname";
        case "change_thread_admins": return "log:thread-admins";
        case "group_poll": return "log:thread-poll";
        case "change_thread_approval_mode": return "log:thread-approval-mode";
        case "messenger_call_log":
        case "participant_joined_group_call": return "log:thread-call";
        default: return type;
    }
}

function parseMentionsFromAsMap(dataObj) {
    const arr = [];
    try {
        for (const key of Object.keys(dataObj)) {
            const entry = dataObj[key];
            if (!entry || !entry.asMap || !entry.asMap.data) continue;
            const mapData = entry.asMap.data;
            for (const idx of Object.keys(mapData)) {
                const mentionEntry = mapData[idx];
                if (!mentionEntry || !mentionEntry.asMap || !mentionEntry.asMap.data) continue;
                const mentionData = mentionEntry.asMap.data;
                const id = mentionData.id?.asLong || mentionData.id?.asString;
                const offset = parseInt(mentionData.offset?.asLong || mentionData.offset?.asString || '0', 10);
                const length = parseInt(mentionData.length?.asLong || mentionData.length?.asString || '0', 10);
                if (id) arr.push({ i: String(id), o: offset, l: length });
            }
        }
    } catch (e) {
        // swallow but return what we have
    }
    return arr;
}

function formatDeltaMessage(m) {
    try {
        const md = (m && m.delta && m.delta.messageMetadata) ? m.delta.messageMetadata : (m && m.messageMetadata) ? m.messageMetadata : null;
        if (!md) {
            // Not the shape we expect; return null so caller can handle gracefully.
            return null;
        }

        const body = m.delta?.body || "";
        let mdata = [];

        // Method A: new FB format: messageMetadata.data.data -> asMap wrappers (2025+)
        if (md?.data && md.data.data) {
            try {
                const parsed = parseMentionsFromAsMap(md.data.data);
                if (parsed.length) mdata = parsed;
            } catch (e) {
                // ignore parse error and fall through to other strategies
            }
        }

        // Method 1: data.prng (old format - stringified JSON array)
        if (mdata.length === 0 && m.delta?.data?.prng) {
            try {
                const parsed = JSON.parse(m.delta.data.prng);
                if (Array.isArray(parsed)) {
                    mdata = parsed.map(item => ({
                        i: String(item.i || item.id || item.user_id || ''),
                        o: item.o ?? item.offset ?? 0,
                        l: item.l ?? item.length ?? 0
                    }));
                }
            } catch (e) {}
        }

        // Method 2: data.mentions (stringified JSON)
        if (mdata.length === 0 && m.delta?.data?.mentions) {
            try {
                const parsed = JSON.parse(m.delta.data.mentions);
                if (Array.isArray(parsed)) {
                    mdata = parsed.map(mention => ({
                        i: String(mention.i || mention.id || mention.user_id || ''),
                        o: mention.o ?? mention.offset ?? 0,
                        l: mention.l ?? mention.length ?? 0
                    }));
                }
            } catch (e) {}
        }

        // Method 3: messageMetadata.ranges (GraphQL format)
        if (mdata.length === 0 && md?.ranges && Array.isArray(md.ranges)) {
            try {
                mdata = md.ranges.map(r => ({
                    i: String(r.entity?.id || r.mentionID || r.id || r.mention_id || ''),
                    o: r.offset ?? 0,
                    l: r.length ?? 0
                }));
            } catch (e) {}
        }

        // Method 4: delta.mentions directly (array format)
        if (mdata.length === 0 && m.delta?.mentions) {
            try {
                if (Array.isArray(m.delta.mentions)) {
                    mdata = m.delta.mentions.map(mention => ({
                        i: String(mention.id || mention.i || mention.user_id || mention.userId || ''),
                        o: mention.o ?? mention.offset ?? 0,
                        l: mention.l ?? mention.length ?? 0
                    }));
                }
            } catch (e) {}
        }

        const mentions = {};
        for (const mention of mdata) {
            try {
                const key = String(mention.i || '');
                const offset = Number(mention.o || 0);
                const len = Number(mention.l || 0);
                if (body && key && !Number.isNaN(offset) && !Number.isNaN(len)) {
                    mentions[key] = body.substring(offset, offset + len);
                }
            } catch (e) {}
        }

        const messageReply = m.delta.messageReply ? {
            messageID: m.delta.messageReply.messageID,
            senderID: formatID(String(
    m.delta.messageReply.senderID ??
    m.delta.messageReply.senderId ??
    m.delta.messageReply.senderFbId ??
    m.delta.messageReply.actorFbId ??
    ""
)),
            body: m.delta.messageReply.body,
            attachments: m.delta.messageReply.attachments,
            timestamp: m.delta.messageReply.timestamp,
            isReply: true
        } : null;

        // Safe actor and thread extraction with fallbacks
        // -------- Robust Facebook ID Detection --------

const actor =
    md.actorFbId ??
    md.actorFbid ??
    md.actorID ??
    md.actorId ??
    md.actor ??
    md.senderFbId ??
    md.senderID ??
    md.senderId ??
    md.sender_id ??
    md.userFbId ??
    md.userID ??
    md.userId ??
    m.delta?.senderFbId ??
    m.delta?.senderID ??
    m.delta?.senderId ??
    m.delta?.actorFbId ??
    null;

const threadKey = md.threadKey || {};

const threadFbId =
    threadKey.threadFbId ??
    threadKey.thread_fbid ??
    threadKey.threadID ??
    threadKey.threadId ??
    threadKey.id ??
    null;

const otherUserFbId =
    threadKey.otherUserFbId ??
    threadKey.other_user_fbid ??
    threadKey.otherUserId ??
    threadKey.otherUserID ??
    null;

const senderID = actor != null
    ? formatID(String(actor))
    : formatID(
        String(
            threadKey.otherUserFbId ??
            threadKey.other_user_fbid ??
            ""
        )
    ) || null;

const threadID =
    threadFbId != null
        ? formatID(String(threadFbId))
        : otherUserFbId != null
            ? formatID(String(otherUserFbId))
            : senderID;


        return {
            type: "message",
            senderID: senderID,
            body: body,
            threadID: threadID,
            messageID: md.messageId || md.message_id || md.mid || null,
            offlineThreadingId: md.offlineThreadingId || md.offline_threading_id || null,
            attachments: (m.delta.attachments || []).map(v => {
                try { return _formatAttachment(v); } catch (e) { return v; }
            }),
            mentions: mentions,
            timestamp: md.timestamp || md.timestamp_ms || null,
            isGroup: !!(threadFbId),
            participantIDs:
    m.delta.participants ||
    md.participants ||
    md.participantIDs ||
    [],
            messageReply: messageReply
        };
    } catch (err) {
        // If anything unexpected happens, return null so caller doesn't throw
        return null;
    }
}

function formatDeltaEvent(m) {
    let logMessageType;
    let logMessageData;

    switch (m.class) {
        case "AdminTextMessage":
            logMessageData = m.untypedData;
            logMessageType = getAdminTextMessageType(m.type);
            break;
        case "ThreadName":
            logMessageType = "log:thread-name";
            logMessageData = { name: m.name };
            break;
        case "ParticipantsAddedToGroupThread":
            logMessageType = "log:subscribe";
            logMessageData = { addedParticipants: m.addedParticipants };
            break;
        case "ParticipantLeftGroupThread":
            logMessageType = "log:unsubscribe";
            logMessageData = { leftParticipantFbId: m.leftParticipantFbId };
            break;
        default:
            logMessageType = m.class;
            logMessageData = m;
    }

    return {
        type: "event",
        threadID: formatID(String((m.messageMetadata && (m.messageMetadata.threadKey.threadFbId || m.messageMetadata.threadKey.otherUserFbId)) || "")),
        messageID: (m.messageMetadata && (m.messageMetadata.messageId || m.messageMetadata.message_id)) ? String(m.messageMetadata.messageId || m.messageMetadata.message_id) : null,
        logMessageType,
        logMessageData,
        logMessageBody: m.messageMetadata && m.messageMetadata.adminText,
        timestamp: m.messageMetadata && (m.messageMetadata.timestamp || null),
        author: m.messageMetadata &&
(
    m.messageMetadata.actorFbId ??
    m.messageMetadata.actorId ??
    m.messageMetadata.senderFbId ??
    m.messageMetadata.senderId
),
        participantIDs: m.participants || []
    };
}

function formatDeltaReadReceipt(delta) {
    return {
        reader: String((delta.threadKey && (delta.threadKey.otherUserFbId || delta.actorFbId)) || ""),
        time: delta.actionTimestampMs || delta.timestamp || null,
        threadID: formatID(String((delta.threadKey && (delta.threadKey.otherUserFbId || delta.threadKey.threadFbId)) || "")),
        type: "read_receipt"
    };
}

module.exports = {
    formatDeltaMessage,
    formatDeltaEvent,
    formatDeltaReadReceipt,
    getAdminTextMessageType
};
