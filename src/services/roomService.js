// ============================================================
// D-CONNECT Room & Permission Service
// Quan ly phong chat chung & phong chat rieng 6 ky tu bao mat
// ============================================================

const crypto = require('crypto');
const Room = require('../models/Room');
const {
  DEFAULT_PUBLIC_ROOM_ID,
  DEFAULT_PUBLIC_ROOM_NAME,
  PRIVATE_ROOM_CODE_LENGTH,
  PRIVATE_ROOM_CHARSET
} = require('../config/constants');
const { validateRoomCode } = require('../validators/inputValidator');

/**
 * Khoi tao phong chung neu chua ton tai trong database
 */
async function ensurePublicRoom() {
  let room = await Room.findOne({ roomId: DEFAULT_PUBLIC_ROOM_ID });
  if (!room) {
    room = await Room.create({
      roomId: DEFAULT_PUBLIC_ROOM_ID,
      type: 'public',
      name: DEFAULT_PUBLIC_ROOM_NAME,
      code: null,
      createdBy: 'system',
      members: [],
      isActive: true
    });
    console.log('[ROOM] Da khoi tao phong chung mac dinh (general)');
  }
  return room;
}

/**
 * Sinh ma phong rieng gom dung 6 ky tu an toan va duy nhat trong database
 */
async function generateUniqueRoomCode() {
  const charsetLen = PRIVATE_ROOM_CHARSET.length;

  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < PRIVATE_ROOM_CODE_LENGTH; i++) {
      const idx = crypto.randomInt(0, charsetLen);
      code += PRIVATE_ROOM_CHARSET[idx];
    }

    const existing = await Room.findOne({ code });
    if (!existing) {
      return code;
    }
  }

  throw new Error('Khong the sinh ma phong duy nhat sau nhieu lan thu.');
}

/**
 * Tao phong chat rieng moi voi ma 6 ky tu
 */
async function createPrivateRoom(creatorClientId, customName = null) {
  const code = await generateUniqueRoomCode();
  const roomId = `room_${crypto.randomUUID()}`;
  const name = customName && typeof customName === 'string' && customName.trim().length > 0
    ? customName.trim().slice(0, 50)
    : `Phòng riêng #${code}`;

  const room = await Room.create({
    roomId,
    type: 'private',
    name,
    code,
    createdBy: creatorClientId,
    members: [creatorClientId],
    isActive: true
  });

  return room;
}

/**
 * Tham gia phong chat (chung hoac rieng)
 */
async function joinRoom(clientId, { roomId, code }) {
  // 1. Tham gia phong chung
  if (roomId === DEFAULT_PUBLIC_ROOM_ID || (!code && (!roomId || roomId === 'general'))) {
    const pubRoom = await ensurePublicRoom();
    if (!pubRoom.members.includes(clientId)) {
      pubRoom.members.push(clientId);
      await pubRoom.save();
    }
    return { success: true, room: pubRoom };
  }

  // 2. Tham gia phong rieng bang ma
  if (code) {
    const validCode = validateRoomCode(code);
    if (!validCode.valid) {
      return { success: false, error: validCode.error };
    }

    const room = await Room.findOne({
      code: validCode.value,
      type: 'private',
      isActive: true
    });

    if (!room) {
      return { success: false, error: 'Mã phòng không tồn tại hoặc phòng đã bị đóng.' };
    }

    // Them thanh vien neu chua co
    if (!room.members.includes(clientId)) {
      room.members.push(clientId);
      await room.save();
    }

    return { success: true, room };
  }

  // 3. Tham gia lai phong bang roomId (kiem tra quyen thanh vien truoc do)
  if (roomId) {
    const room = await Room.findOne({ roomId, isActive: true });
    if (!room) {
      return { success: false, error: 'Phòng không tồn tại.' };
    }

    if (room.type === 'private' && !room.members.includes(clientId)) {
      return { success: false, error: 'Bạn không có quyền truy cập vào phòng riêng này.' };
    }

    return { success: true, room };
  }

  return { success: false, error: 'Yêu cầu tham gia phòng không hợp lệ.' };
}

/**
 * Kiem tra quyen truy cap cua Client vao mot phong
 * Phong chung luon cho phep, phong rieng bat buoc co trong members
 */
async function checkRoomPermission(clientId, roomId) {
  if (roomId === DEFAULT_PUBLIC_ROOM_ID) {
    return true;
  }

  const room = await Room.findOne({ roomId, isActive: true });
  if (!room) return false;

  return room.members.includes(clientId);
}

/**
 * Lay thong tin phong
 */
async function getRoomById(roomId) {
  return Room.findOne({ roomId, isActive: true });
}

module.exports = {
  ensurePublicRoom,
  generateUniqueRoomCode,
  createPrivateRoom,
  joinRoom,
  checkRoomPermission,
  getRoomById
};
