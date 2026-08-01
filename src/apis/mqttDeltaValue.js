"use strict";

const utils = require('../utils');
const e2ee = require('../security/e2ee');


function parseDelta(defaultFuncs, api, ctx, globalCallback, v) {
  if (v.delta.class == "NewMessage") {

    // Robust pageID filter: only skip if pageID exists and queue differs (both normalized)
    if (typeof ctx.globalOptions.pageID !== 'undefined' && String(ctx.globalOptions.pageID) !== String(v.queue || '')) return;
    (function resolveAttachmentUrl(i) {
      if (!v.delta.attachments || i == v.delta.attachments.length || utils.getType(v.delta.attachments) !== "Array") {
        var fmtMsg;
        try {
          fmtMsg = utils.formatDeltaMessage(v);
        } catch (err) {
          utils.error("parseDelta", "formatDeltaMessage error:", err && err.message ? err.message : err);
          return;
        }
        if (fmtMsg) {
            try {
              if (e2ee.isEnabled(ctx) && !!v.delta.threadKey && !!v.delta.threadKey.threadFbId) {
                const dec = e2ee.decrypt(ctx, fmtMsg.threadID, fmtMsg.body);
                if (dec !== null) fmtMsg.body = dec;
              }
            } catch (e) {
              utils.error("parseDelta", "e2ee.decrypt error:", e && e.message ? e.message : e);
            }
            if (ctx.globalOptions.autoMarkDelivery) {
                api.markAsDelivered(fmtMsg.threadID, fmtMsg.messageID);
            }
            // Normalize type comparison for selfListen
            if (!ctx.globalOptions.selfListen && String(fmtMsg.senderID) === String(ctx.userID)) {
                return;
            }
            return globalCallback(null, fmtMsg);
        }
      } else {
         var attachment = v.delta.attachments[i];
         if (attachment && attachment.mercury && attachment.mercury.attach_type == "photo") {
          api.resolvePhotoUrl(attachment.fbid, (err, url) => {
            if (!err) attachment.mercury.metadata.url = url;
            return resolveAttachmentUrl(i + 1);
          });
         } else {
            return resolveAttachmentUrl(i + 1);
         }
      }
    })(0);
  }

  if (v.delta.class == "ClientPayload") {
    // Guard decode: payloads may be large buffers or typed arrays; ensure we don't throw to whole handler
    var clientPayload;
    try {
      clientPayload = utils.decodeClientPayload(v.delta.payload);
    } catch (err) {
      utils.error("parseDelta", "decodeClientPayload failed:", err && err.message ? err.message : err);
      return; // Can't decode: nothing we can do for this ClientPayload
    }

    if (clientPayload && clientPayload.deltas) {
      for (var i in clientPayload.deltas) {
        var delta = clientPayload.deltas[i];

        if (delta.deltaMessageReaction && !!ctx.globalOptions.listenEvents) {
            const reactionEvent = {
              type: "message_reaction",
              threadID: String((delta.deltaMessageReaction.threadKey && (delta.deltaMessageReaction.threadKey.threadFbId || delta.deltaMessageReaction.threadKey.otherUserFbId)) || ""),
              messageID: delta.deltaMessageReaction.messageId,
              reaction: delta.deltaMessageReaction.reaction,
              senderID: String(delta.deltaMessageReaction.userId),
              userID: String(delta.deltaMessageReaction.userId)
            };

            // Use continue to process remaining deltas (do not return from parseDelta)
            if (!ctx.globalOptions.selfListen && String(reactionEvent.senderID) === String(ctx.userID)) {
              continue;
            }

            globalCallback(null, reactionEvent);
            continue;
        } else if (delta.deltaRecallMessageData && !!ctx.globalOptions.listenEvents) {
            globalCallback(null, {
              type: "message_unsend",
              threadID: String((delta.deltaRecallMessageData.threadKey && (delta.deltaRecallMessageData.threadKey.threadFbId || delta.deltaRecallMessageData.threadKey.otherUserFbId)) || ""),
              messageID: delta.deltaRecallMessageData.messageID,
              senderID: String(delta.deltaRecallMessageData.senderID),
              deletionTimestamp: delta.deltaRecallMessageData.deletionTimestamp,
              timestamp: delta.deltaRecallMessageData.timestamp
            });
            continue;
        } else if (delta.deltaMessageReply) {
          var mdata = delta.deltaMessageReply.message?.data?.prng ? JSON.parse(delta.deltaMessageReply.message.data.prng) : [];
          var mentions = {};
          if (mdata) {
            mdata.forEach(m => mentions[m.i] = (delta.deltaMessageReply.message.body || "").substring(m.o, m.o + m.l));
          }

          var callbackToReturn = {
            type: "message_reply",
            threadID: String((delta.deltaMessageReply.message.messageMetadata.threadKey.threadFbId || delta.deltaMessageReply.message.messageMetadata.threadKey.otherUserFbId) || ""),
            messageID: delta.deltaMessageReply.message.messageMetadata.messageId,
            senderID: String(delta.deltaMessageReply.message.messageMetadata.actorFbId),
            attachments: (delta.deltaMessageReply.message.attachments || []).map(att => {
              try {
                var mercury = att.mercuryJSON ? JSON.parse(att.mercuryJSON) : {};
                Object.assign(att, mercury);
                return utils._formatAttachment(att);
              } catch (ex) {
                return { ...att, error: ex, type: "unknown" };
              }
            }),
            body: (delta.deltaMessageReply.message.body || ""),
            isGroup: !!(delta.deltaMessageReply.message.messageMetadata.threadKey && delta.deltaMessageReply.message.messageMetadata.threadKey.threadFbId),
            mentions: mentions,
            timestamp: delta.deltaMessageReply.message.messageMetadata.timestamp,
            participantIDs: (
              delta.deltaMessageReply.message.participants ||
              delta.deltaMessageReply.message.participantIDs ||
              []
            ).map(e => String(e))
          };
          try {
            if (e2ee.isEnabled(ctx) && callbackToReturn.isGroup) {
              const dec = e2ee.decrypt(ctx, callbackToReturn.threadID, callbackToReturn.body);
              if (dec !== null) callbackToReturn.body = dec;
            }
          } catch (e) {
            utils.error("parseDelta", "e2ee.decrypt reply error:", e && e.message ? e.message : e);
          }

          if (delta.deltaMessageReply.repliedToMessage) {
            var rmentions = {};
            var rmdata = delta.deltaMessageReply.repliedToMessage?.data?.prng ? JSON.parse(delta.deltaMessageReply.repliedToMessage.data.prng) : [];
            if (rmdata) {
                rmdata.forEach(m => rmentions[m.i] = (delta.deltaMessageReply.repliedToMessage.body || "").substring(m.o, m.o + m.l));
            }

            callbackToReturn.messageReply = {
              threadID: String((delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey.threadFbId || delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey.otherUserFbId) || ""),
              messageID: delta.deltaMessageReply.repliedToMessage.messageMetadata.messageId,
              senderID: String(delta.deltaMessageReply.repliedToMessage.messageMetadata.actorFbId),
              attachments: (delta.deltaMessageReply.repliedToMessage.attachments || []).map(att => {
                 try {
                    var mercury = att.mercuryJSON ? JSON.parse(att.mercuryJSON) : {};
                    Object.assign(att, mercury);
                    return utils._formatAttachment(att);
                  } catch (ex) {
                    return { ...att, error: ex, type: "unknown" };
                  }
              }),
              body: delta.deltaMessageReply.repliedToMessage.body || "",
              isGroup: !!(delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey && delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey.threadFbId),
              mentions: rmentions,
              timestamp: delta.deltaMessageReply.repliedToMessage.messageMetadata.timestamp,
              participantIDs: (
                delta.deltaMessageReply.repliedToMessage.participants ||
                delta.deltaMessageReply.repliedToMessage.participantIDs ||
                []
              ).map(e => String(e))
            };
            try {
              if (e2ee.isEnabled(ctx) && callbackToReturn.messageReply.isGroup) {
                const dec2 = e2ee.decrypt(ctx, callbackToReturn.messageReply.threadID, callbackToReturn.messageReply.body);
                if (dec2 !== null) callbackToReturn.messageReply.body = dec2;
              }
            } catch (e) {
              utils.error("parseDelta", "e2ee.decrypt repliedToMessage error:", e && e.message ? e.message : e);
            }
          }
          if (ctx.globalOptions.autoMarkDelivery) api.markAsDelivered(callbackToReturn.threadID, callbackToReturn.messageID);
          if (!ctx.globalOptions.selfListen && String(callbackToReturn.senderID) === String(ctx.userID)) continue;
          globalCallback(null, callbackToReturn);
          continue;
        }
      }
      return;
    }
  }

  if (v.delta.class !== "NewMessage" && !ctx.globalOptions.listenEvents) return;
  switch (v.delta.class) {
    case "ReadReceipt":
      var fmtMsg;
      try {
        fmtMsg = utils.formatDeltaReadReceipt(v.delta);
      } catch (err) {
        utils.error("parseDelta", "formatDeltaReadReceipt error:", err && err.message ? err.message : err);
        return;
      }
      if (fmtMsg) globalCallback(null, fmtMsg);
      break;
    case "AdminTextMessage":
      switch (v.delta.type) {
        case "instant_game_dynamic_custom_update":
        case "accept_pending_thread":
        case "confirm_friend_request":
        case "shared_album_delete":
        case "shared_album_addition":
        case "pin_messages_v2":
        case "unpin_messages_v2":
        case "change_thread_theme":
        case "change_thread_nickname":
        case "change_thread_icon":
        case "change_thread_quick_reaction":
        case "change_thread_admins":
        case "group_poll":
        case "joinable_group_link_mode_change":
        case "magic_words":
        case "change_thread_approval_mode":
        case "messenger_call_log":
        case "participant_joined_group_call":
        case "rtc_call_log":
        case "update_vote":
          var fmtEvent;
          try {
            fmtEvent = utils.formatDeltaEvent(v.delta);
          } catch (err) {
            utils.error("parseDelta", "formatDeltaEvent error:", err && err.message ? err.message : err);
            return;
          }
          if (fmtEvent) globalCallback(null, fmtEvent);
          break;
      }
      break;
    case "ThreadName":
    case "ParticipantsAddedToGroupThread":
    case "ParticipantLeftGroupThread":
      var fmtEvent2;
      try {
        fmtEvent2 = utils.formatDeltaEvent(v.delta);
      } catch (err) {
        utils.error("parseDelta", "formatDeltaEvent error:", err && err.message ? err.message : err);
        return;
      }
      if (!ctx.globalOptions.selfListen && fmtEvent2 && fmtEvent2.author && String(fmtEvent2.author) === String(ctx.userID)) return;
      if (!ctx.loggedIn) return;
      if (fmtEvent2) globalCallback(null, fmtEvent2);
      break;
    case "ForcedFetch":
      if (!v.delta.threadKey) return;
      var mid = v.delta.messageId;
      var tid = v.delta.threadKey.threadFbId;
      if (mid && tid) {
        var form = {
          av: ctx.globalOptions.pageID,
          queries: JSON.stringify({
            o0: {
              doc_id: "2848441488556444",
              query_params: {
                thread_and_message_id: {
                  thread_id: tid.toString(),
                  message_id: mid
                }
              }
            }
          })
        };
        defaultFuncs.post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form)
          .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
          .then(resData => {
            if (resData[resData.length - 1].error_results > 0) throw resData[0].o0.errors;
            if (resData[resData.length - 1].successful_results === 0) throw { error: "forcedFetch: no successful_results" };
            var fetchData = resData[0].o0.data.message;
            if (utils.getType(fetchData) === "Object") {
              if (fetchData.__typename === "UserMessage" && fetchData.extensible_attachment) {
                var event = {
                  type: "message",
                  senderID: utils.formatID(fetchData.message_sender.id),
                  body: fetchData.message.text || "",
                  threadID: utils.formatID(tid.toString()),
                  messageID: fetchData.message_id,
                  attachments: [{
                    type: "share",
                    ID: fetchData.extensible_attachment.legacy_attachment_id,
                    url: fetchData.extensible_attachment.story_attachment.url,
                    title: fetchData.extensible_attachment.story_attachment.title_with_entities.text,
                    description: fetchData.extensible_attachment.story_attachment.description ? fetchData.extensible_attachment.story_attachment.description.text : "",
                    source: fetchData.extensible_attachment.story_attachment.source,
                    image: ((fetchData.extensible_attachment.story_attachment.media || {}).image || {}).uri,
                    width: ((fetchData.extensible_attachment.story_attachment.media || {}).image || {}).width,
                    height: ((fetchData.extensible_attachment.story_attachment.media || {}).image || {}).height,
                    playable: ((fetchData.extensible_attachment.story_attachment.media || {}).is_playable || false),
                    duration: ((fetchData.extensible_attachment.story_attachment.media || {}).playable_duration_in_ms || 0)
                  }],
                  mentions: {},
                  timestamp: parseInt(fetchData.timestamp_precise),
                  isGroup: fetchData.message_sender.id !== tid.toString()
                };
                try {
                  if (e2ee.isEnabled(ctx) && event.isGroup) {
                    const dec = e2ee.decrypt(ctx, event.threadID, event.body);
                    if (dec !== null) event.body = dec;
                  }
                } catch (_) {}
                globalCallback(null, event);
              }
            }
          })
          .catch(err => { utils.error("parseDelta", "forcedFetch graphql error:", err && err.message ? err.message : err); });
      }
      break;
  }
}

module.exports = {
    parseDelta
};
