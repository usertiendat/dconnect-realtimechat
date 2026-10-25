// ============================================================
// D-CONNECT Server - Nền tảng nhắn tin thời gian thực nâng cao
// Stack: Node.js + Express.js + Socket.IO + MongoDB (Mongoose)
// Port: 3000 | Brand: Xanh dương #0E7490 + Cyan #06B6D4
// Môn học: Lập Trình Mạng — Đề tài TCP Socket
// ============================================================

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const { connectDB, disconnectDB } = require('./src/config/db');
const { ensurePublicRoom } = require('./src/services/roomService');
const {
  createExpressSessionMiddleware,
  socketAuthMiddleware
} = require('./src/middleware/sessionMiddleware');
const {
  setupSocketIO,
  getAllOnlineUsernames
} = require('./src/sockets/socketHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// Middleware co ban
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express Session Middleware: Dam bao moi request deu duoc cap Client_XXXX va Session Cookie
app.use(createExpressSessionMiddleware(getAllOnlineUsernames));

// Serve static files tu thu muc public
app.use(express.static(path.join(__dirname, 'public')));

// API lay thong tin Session va Client hien tai
app.get('/api/session', (req, res) => {
  if (!req.client) {
    return res.status(500).json({ success: false, error: 'Không thể cấp danh tính Client.' });
  }

  res.json({
    success: true,
    client: {
      clientId: req.client.clientId,
      displayName: req.client.displayName,
      avatarColor: req.client.avatarColor
    }
  });
});

// API kiem tra trang thai he thong
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    onlineCount: getAllOnlineUsernames().length
  });
});

// Route chinh -> Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route chat
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Socket.IO Session Authentication Middleware
io.use(socketAuthMiddleware);

// Khoi tao cac su kien Socket.IO
setupSocketIO(io);

// Khoi dong server
async function startServer() {
  try {
    // 1. Ket noi MongoDB
    await connectDB();

    // 2. Khoi tao phong chung mac dinh
    await ensurePublicRoom();

    // 3. Lang nghe cong TCP
    server.listen(PORT, () => {
      console.log('==============================================');
      console.log('  D-CONNECT Server đang chạy');
      console.log(`  URL: http://localhost:${PORT}`);
      console.log(`  TCP Port: ${PORT} (Socket.IO / WebSocket trên TCP)`);
      console.log('  Database: MongoDB (Mongoose)');
      console.log('==============================================');
    });
  } catch (err) {
    console.error('Khong the khoi dong server:', err.message);
    process.exit(1);
  }
}

// Xu ly dong server nhe nhang (Graceful Shutdown)
process.on('SIGINT', async () => {
  console.log('\n[SERVER] Đang đóng server...');
  await disconnectDB();
  server.close(() => {
    console.log('[SERVER] Đã đóng server hoàn tất.');
    process.exit(0);
  });
});

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io, startServer };
