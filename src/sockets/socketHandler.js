// ============================================================
// D-CONNECT Socket.IO Handler
// Quan ly ket noi, phong chat, broadcast theo phong va phan quyen
// ============================================================

const { RATE_LIMITS } = require('../config/constants');
const rateLimiter = require('../utils/rateLimiter');
const clientService = require('../services/clientService');
const roomService = require('../services/roomService');
const messageService = require('../services/messageService');

// Map quan ly tat ca cac socket dang online: Map<socketId, { socketId, clientId, displayName, avatarColor, roomId, joinAt }>
const onlineSockets = new Map();

/**
 * Lay danh sach tat ca ten hien thi dang online tren server
 */
function getAllOnlineUsernames() {
  const names = [];
  for (const info of onlineSockets.values()) {
    if (info.displayName) names.push(info.displayName);
  }
  return names;
}

/**
 * Lay danh sach nguoi dung dang truc tuyen trong mot phong cu the
 */
function getRoomOnlineUsers(roomId) {
  if (!roomId) return [];
  const uniqueUsers = new Map();
  for (const info of onlineSockets.values()) {
    if (info.roomId === roomId) {
      if (!uniqueUsers.has(info.clientId)) {
        uniqueUsers.set(info.clientId, {
          clientId: info.clientId,
          displayName: info.displayName,
          avatarColor: info.avatarColor,
          joinAt: info.joinAt
        });
      }
    }
  }
  return [...uniqueUsers.values()];
}

/**
 * Thiet lap cac su kien Socket.IO
 */
function setupSocketIO(io) {
  io.on('connection', async (socket) => {
    const { clientId, displayName, avatarColor } = socket.clientData;
    socket.currentRoomId = null;

    console.log(`[+] Socket ket noi: ${socket.id} | Client: ${displayName} (${clientId})`);

    // Luu thong tin socket
    const socketInfo = {
      socketId: socket.id,
      clientId,
      displayName,
      avatarColor,
      roomId: null,
      joinAt: messageService.formatTime()
    };
    onlineSockets.set(socket.id, socketInfo);

    // Gui thong tin danh tinh hien tai cho client
    socket.emit('session-info', {
      clientId,
      displayName,
      avatarColor
    });

    // -------------------------------------------------------------
    // 1. THAM GIA PHÒNG CHAT (Chung hoac Rieng)
    // -------------------------------------------------------------
    socket.on('join-room', async (payload, callback) => {
      const ack = typeof callback === 'function' ? callback : () => {};
      try {
        const { roomId, code } = payload || {};

        // Chống brute-force nếu thử tham gia bằng mã phòng riêng
        if (code) {
          const check = rateLimiter.check(
            `join:${socket.handshake.address}:${clientId}`,
            RATE_LIMITS.ROOM_JOIN.maxCount,
            RATE_LIMITS.ROOM_JOIN.windowMs
          );
          if (!check.allowed) {
            return ack({
              success: false,
              error: `Bạn đã thử mã phòng sai quá nhiều lần. Vui lòng chờ ${Math.ceil(check.retryAfterMs / 1000)} giây.`
            });
          }
        }

        const result = await roomService.joinRoom(clientId, { roomId, code });
        if (!result.success) {
          return ack({ success: false, error: result.error });
        }

        const room = result.room;

        // Nếu client đang ở phòng cũ, rời phòng cũ trước
        if (socket.currentRoomId && socket.currentRoomId !== room.roomId) {
          const oldRoomId = socket.currentRoomId;
          socket.leave(oldRoomId);
          socket.to(oldRoomId).emit('user-left', {
            senderId: clientId,
            username: socketInfo.displayName,
            time: messageService.formatTime(),
            message: `${socketInfo.displayName} đã chuyển sang phòng khác.`
          });
          io.to(oldRoomId).emit('update-user-list', getRoomOnlineUsers(oldRoomId));
        }

        // Gia nhập phòng mới
        socket.currentRoomId = room.roomId;
        socketInfo.roomId = room.roomId;
        socket.join(room.roomId);

        // Lấy lịch sử 30 tin nhắn gần nhất
        const historyData = await messageService.getPaginatedHistory(room.roomId, { limit: 30 });

        // Thông báo cho các thành viên khác trong phòng mới
        socket.to(room.roomId).emit('user-joined', {
          senderId: clientId,
          username: socketInfo.displayName,
          time: messageService.formatTime(),
          message: `${socketInfo.displayName} đã tham gia phòng chat`
        });

        // Cập nhật danh sách online cho tất cả thành viên trong phòng
        io.to(room.roomId).emit('update-user-list', getRoomOnlineUsers(room.roomId));

        // Trả về acknowledgement cho client
        ack({
          success: true,
          room: {
            roomId: room.roomId,
            name: room.name,
            type: room.type,
            code: room.code
          },
          history: historyData
        });
      } catch (err) {
        console.error('[Socket join-room] Loi:', err.message);
        ack({ success: false, error: 'Không thể tham gia phòng chat.' });
      }
    });

    // -------------------------------------------------------------
    // 2. TẠO PHÒNG CHAT RIÊNG (Sinh mã 6 ký tự)
    // -------------------------------------------------------------
    socket.on('create-room', async (payload, callback) => {
      const ack = typeof callback === 'function' ? callback : () => {};
      try {
        const { customName } = payload || {};
        const room = await roomService.createPrivateRoom(clientId, customName);

        // Tự động cho người tạo gia nhập phòng vừa tạo
        if (socket.currentRoomId) {
          const oldRoomId = socket.currentRoomId;
          socket.leave(oldRoomId);
          io.to(oldRoomId).emit('update-user-list', getRoomOnlineUsers(oldRoomId));
        }

        socket.currentRoomId = room.roomId;
        socketInfo.roomId = room.roomId;
        socket.join(room.roomId);

        io.to(room.roomId).emit('update-user-list', getRoomOnlineUsers(room.roomId));

        ack({
          success: true,
          room: {
            roomId: room.roomId,
            name: room.name,
            type: room.type,
            code: room.code
          }
        });
      } catch (err) {
        console.error('[Socket create-room] Loi:', err.message);
        ack({ success: false, error: 'Không thể tạo phòng riêng.' });
      }
    });

    // -------------------------------------------------------------
    // 3. RỜI PHÒNG HIỆN TẠI
    // -------------------------------------------------------------
    socket.on('leave-room', (callback) => {
      const ack = typeof callback === 'function' ? callback : () => {};
      const currentRoomId = socket.currentRoomId;
      if (!currentRoomId) {
        return ack({ success: true });
      }

      socket.leave(currentRoomId);
      socket.currentRoomId = null;
      socketInfo.roomId = null;

      socket.to(currentRoomId).emit('user-left', {
        senderId: clientId,
        username: socketInfo.displayName,
        time: messageService.formatTime(),
        message: `${socketInfo.displayName} đã rời khỏi phòng chat`
      });

      io.to(currentRoomId).emit('update-user-list', getRoomOnlineUsers(currentRoomId));
      ack({ success: true });
    });

    // -------------------------------------------------------------
    // 4. GỬI TIN NHẮN (Kiểm tra quyền, Rate limit, Lưu MongoDB & Ack)
    // -------------------------------------------------------------
    socket.on('send-message', async (payload, callback) => {
      const ack = typeof callback === 'function' ? callback : () => {};
      try {
        const roomId = socket.currentRoomId;
        if (!roomId) {
          return ack({ success: false, error: 'Bạn chưa tham gia phòng chat nào.' });
        }

        const textRaw = typeof payload === 'object' ? payload.text : payload;
        const clientTempId = typeof payload === 'object' ? payload.clientTempId : null;

        // 1. Kiểm tra quyền truy cập vào phòng
        const hasPermission = await roomService.checkRoomPermission(clientId, roomId);
        if (!hasPermission) {
          return ack({ success: false, error: 'Bạn không có quyền gửi tin nhắn trong phòng này.' });
        }

        // 2. Chống spam tin nhắn (Rate limit)
        const rateCheck = rateLimiter.check(
          `msg:${clientId}`,
          RATE_LIMITS.MESSAGE.maxCount,
          RATE_LIMITS.MESSAGE.windowMs
        );
        if (!rateCheck.allowed) {
          return ack({
            success: false,
            error: 'Bạn gửi tin nhắn quá nhanh. Vui lòng chậm lại một chút.'
          });
        }

        // 3. Lưu tin nhắn vào MongoDB
        const savedMsg = await messageService.saveMessage({
          roomId,
          senderId: clientId,
          senderName: socketInfo.displayName,
          avatarColor: socketInfo.avatarColor,
          text: textRaw,
          clientTempId
        });

        // 4. Phát sóng tin nhắn tới các thành viên TRONG PHÒNG ĐÓ
        io.to(roomId).emit('receive-message', savedMsg);

        // Tắt trạng thái đang gõ phím của người gửi
        socket.to(roomId).emit('user-stop-typing', {
          senderId: clientId,
          username: socketInfo.displayName
        });

        // 5. Trả về acknowledgement thành công
        ack({ success: true, message: savedMsg });
      } catch (err) {
        console.error('[Socket send-message] Loi:', err.message);
        ack({ success: false, error: err.message || 'Lỗi khi gửi tin nhắn.' });
      }
    });

    // -------------------------------------------------------------
    // 5. TẢI LỊCH SỬ TIN NHẮN PHÂN TRANG (Cursor-based)
    // -------------------------------------------------------------
    socket.on('get-history', async (payload, callback) => {
      const ack = typeof callback === 'function' ? callback : () => {};
      try {
        const { roomId, before, limit } = payload || {};
        const targetRoom = roomId || socket.currentRoomId;

        if (!targetRoom) {
          return ack({ success: false, error: 'Phòng không xác định.' });
        }

        // Kiểm tra quyền
        const hasPermission = await roomService.checkRoomPermission(clientId, targetRoom);
        if (!hasPermission) {
          return ack({ success: false, error: 'Bạn không có quyền xem lịch sử phòng này.' });
        }

        const history = await messageService.getPaginatedHistory(targetRoom, { before, limit });
        ack({ success: true, ...history });
      } catch (err) {
        console.error('[Socket get-history] Loi:', err.message);
        ack({ success: false, error: 'Lỗi tải lịch sử tin nhắn.' });
      }
    });

    // -------------------------------------------------------------
    // 6. ĐỒNG BỘ KHI KẾT NỐI LẠI (Reconnect Sync)
    // -------------------------------------------------------------
    socket.on('sync-state', async (payload, callback) => {
      const ack = typeof callback === 'function' ? callback : () => {};
      try {
        const { roomId, lastMessageAt } = payload || {};
        if (!roomId) {
          return ack({ success: false, error: 'Chưa có phòng để đồng bộ.' });
        }

        // Kiểm tra quyền
        const hasPermission = await roomService.checkRoomPermission(clientId, roomId);
        if (!hasPermission) {
          return ack({ success: false, error: 'Phiên phòng không hợp lệ.' });
        }

        // Gia nhập lại Socket.IO channel
        socket.currentRoomId = roomId;
        socketInfo.roomId = roomId;
        socket.join(roomId);

        // Lấy các tin nhắn bị bỏ lỡ
        const missedMessages = await messageService.getMissedMessages(roomId, lastMessageAt);

        // Cập nhật danh sách online
        io.to(roomId).emit('update-user-list', getRoomOnlineUsers(roomId));

        ack({
          success: true,
          missedMessages,
          userList: getRoomOnlineUsers(roomId)
        });
      } catch (err) {
        console.error('[Socket sync-state] Loi:', err.message);
        ack({ success: false, error: 'Không thể đồng bộ trạng thái.' });
      }
    });

    // -------------------------------------------------------------
    // 7. ĐỔI TÊN CLIENT
    // -------------------------------------------------------------
    socket.on('rename-client', async (payload, callback) => {
      const ack = typeof callback === 'function' ? callback : () => {};
      try {
        const { newName } = payload || {};

        // Rate limit đổi tên
        const check = rateLimiter.check(
          `rename:${clientId}`,
          RATE_LIMITS.RENAME.maxCount,
          RATE_LIMITS.RENAME.windowMs
        );
        if (!check.allowed) {
          return ack({
            success: false,
            error: `Bạn đổi tên quá nhanh. Vui lòng đợi ${Math.ceil(check.retryAfterMs / 1000)} giây.`
          });
        }

        const oldName = socketInfo.displayName;
        const res = await clientService.renameClient(clientId, newName, getAllOnlineUsernames());

        if (!res.success) {
          return ack({ success: false, error: res.error });
        }

        // Cập nhật bộ nhớ cho tất cả các socket thuộc client này
        for (const info of onlineSockets.values()) {
          if (info.clientId === clientId) {
            info.displayName = res.client.displayName;
          }
        }
        socket.clientData.displayName = res.client.displayName;

        // Nếu đang ở trong phòng, thông báo cho các thành viên
        if (socket.currentRoomId) {
          io.to(socket.currentRoomId).emit('user-renamed', {
            clientId,
            oldName,
            newName: res.client.displayName,
            time: messageService.formatTime(),
            message: `"${oldName}" đã đổi tên thành "${res.client.displayName}"`
          });
          io.to(socket.currentRoomId).emit('update-user-list', getRoomOnlineUsers(socket.currentRoomId));
        }

        ack({ success: true, newName: res.client.displayName });
      } catch (err) {
        console.error('[Socket rename-client] Loi:', err.message);
        ack({ success: false, error: 'Lỗi khi đổi tên.' });
      }
    });

    // -------------------------------------------------------------
    // 8. TRẠNG THÁI ĐANG GÕ PHÍM (Typing indicator theo phòng)
    // -------------------------------------------------------------
    socket.on('typing-start', () => {
      const roomId = socket.currentRoomId;
      if (!roomId) return;

      const check = rateLimiter.check(
        `typing:${clientId}`,
        RATE_LIMITS.TYPING.maxCount,
        RATE_LIMITS.TYPING.windowMs
      );
      if (!check.allowed) return;

      socket.to(roomId).emit('user-typing', {
        senderId: clientId,
        username: socketInfo.displayName
      });
    });

    socket.on('typing-stop', () => {
      const roomId = socket.currentRoomId;
      if (!roomId) return;

      socket.to(roomId).emit('user-stop-typing', {
        senderId: clientId,
        username: socketInfo.displayName
      });
    });

    // -------------------------------------------------------------
    // 9. XỬ LÝ NGẮT KẾT NỐI (Disconnect)
    // -------------------------------------------------------------
    socket.on('disconnect', (reason) => {
      console.log(`[-] Socket ngat ket noi: ${socket.id} (${socketInfo.displayName}) [${reason}]`);
      onlineSockets.delete(socket.id);

      const roomId = socket.currentRoomId;
      if (roomId) {
        // Tắt typing nếu có
        socket.to(roomId).emit('user-stop-typing', {
          senderId: clientId,
          username: socketInfo.displayName
        });

        // Kiểm tra xem Client này có còn socket nào khác đang mở tab không
        const isStillInRoom = [...onlineSockets.values()].some(
          (s) => s.clientId === clientId && s.roomId === roomId
        );

        if (!isStillInRoom) {
          socket.to(roomId).emit('user-left', {
            senderId: clientId,
            username: socketInfo.displayName,
            time: messageService.formatTime(),
            message: `${socketInfo.displayName} đã rời khỏi phòng chat`
          });
          io.to(roomId).emit('update-user-list', getRoomOnlineUsers(roomId));
        }
      }
    });
  });
}

module.exports = {
  setupSocketIO,
  getAllOnlineUsernames,
  getRoomOnlineUsers
};
