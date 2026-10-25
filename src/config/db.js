// ============================================================
// D-CONNECT MongoDB Connection via Mongoose
// ============================================================

const mongoose = require('mongoose');

async function connectDB(uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dconnect_db') {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });
    console.log(`[DB] Ket noi MongoDB thanh cong: ${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}`);
    return mongoose.connection;
  } catch (err) {
    console.error('[DB] Loi ket noi MongoDB:', err.message);
    throw err;
  }
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[DB] Da ngat ket noi MongoDB.');
  }
}

module.exports = { connectDB, disconnectDB, mongoose };
