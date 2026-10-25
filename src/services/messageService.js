// ============================================================
// D-CONNECT Message Service
// Luu tin nhan MongoDB, phan trang lich su va dong bo reconnect
// ============================================================

const crypto = require('crypto');
const Message = require('../models/Message');
const { HISTORY_PAGE_SIZE } = require('../config/constants');
const { validateMessageText } = require('../validators/inputValidator');

function formatTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatMessageDoc(doc) {
  return {
    messageId: doc.messageId,
    roomId: doc.roomId,
    senderId: doc.senderId,
    senderName: doc.senderName,
    avatarColor: doc.avatarColor,
    text: doc.text,
    clientTempId: doc.clientTempId || null,
    time: formatTime(doc.createdAt),
    createdAt: doc.createdAt
  };
}

/**
 * Luu tin nhan moi vao MongoDB co chong gui trung (deduplication)
 */
async function saveMessage({ roomId, senderId, senderName, avatarColor, text, clientTempId }) {
  const validation = validateMessageText(text);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Chong trung tin nhan neu client retry cung mot clientTempId trong vong 60s
  if (clientTempId) {
    const sixtySecAgo = new Date(Date.now() - 60000);
    const existing = await Message.findOne({
      roomId,
      senderId,
      clientTempId,
      createdAt: { $gte: sixtySecAgo }
    });
    if (existing) {
      return formatMessageDoc(existing);
    }
  }

  const messageId = `msg_${crypto.randomUUID()}`;
  const doc = await Message.create({
    messageId,
    roomId,
    senderId,
    senderName,
    avatarColor,
    text: validation.value,
    clientTempId: clientTempId || null
  });

  return formatMessageDoc(doc);
}

/**
 * Lay lich su tin nhan co phan trang (cursor-based pagination)
 * @param {string} roomId
 * @param {{ before?: string|Date, limit?: number }} options
 */
async function getPaginatedHistory(roomId, options = {}) {
  const limit = Math.min(Math.max(1, parseInt(options.limit, 10) || HISTORY_PAGE_SIZE), 100);
  const query = { roomId };

  if (options.before) {
    const beforeDate = new Date(options.before);
    if (!isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }

  // Lay them 1 ban ghi de xac dinh xem con tin nhan cu hon khong
  const docs = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = docs.length > limit;
  if (hasMore) {
    docs.pop(); // Bo ban ghi du phong
  }

  // Dao nguoc thu tu de hien thi theo thoi gian tang dan (tin cu o tren, tin moi o duoi)
  docs.reverse();

  const formatted = docs.map(formatMessageDoc);
  const nextCursor = hasMore && formatted.length > 0 ? formatted[0].createdAt : null;

  return {
    messages: formatted,
    hasMore,
    nextCursor
  };
}

/**
 * Lay cac tin nhan bi bo lo ke tu lan cuoi client nhan duoc (phuc vu reconnect)
 */
async function getMissedMessages(roomId, lastMessageAt) {
  if (!lastMessageAt) return [];

  const lastDate = new Date(lastMessageAt);
  if (isNaN(lastDate.getTime())) return [];

  const docs = await Message.find({
    roomId,
    createdAt: { $gt: lastDate }
  })
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();

  return docs.map(formatMessageDoc);
}

module.exports = {
  formatTime,
  formatMessageDoc,
  saveMessage,
  getPaginatedHistory,
  getMissedMessages
};
