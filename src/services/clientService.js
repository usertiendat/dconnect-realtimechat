// ============================================================
// D-CONNECT Client & Session Service
// Quan ly danh tinh Client khong can dang ky/dang nhap
// ============================================================

const crypto = require('crypto');
const Client = require('../models/Client');
const Session = require('../models/Session');
const { AVATAR_PALETTE, SESSION_EXPIRY_MS } = require('../config/constants');
const { validateUsername } = require('../validators/inputValidator');

/**
 * Chon mau avatar ngau nhien tu palette thuong hieu D-CONNECT
 */
function getRandomAvatarColor() {
  return AVATAR_PALETTE[crypto.randomInt(0, AVATAR_PALETTE.length)];
}

/**
 * Sinh ten mac dinh dang Client_XXXX (XXXX gom 4 chu so: 0000 -> 9999)
 * Tranh xung dot voi danh sach online hien tai
 */
function generateDefaultName(existingOnlineNames = []) {
  const onlineLowerSet = new Set(
    existingOnlineNames.map((n) => (typeof n === 'string' ? n.toLowerCase() : ''))
  );

  for (let attempt = 0; attempt < 50; attempt++) {
    const num = crypto.randomInt(0, 10000);
    const code = String(num).padStart(4, '0');
    const candidate = `Client_${code}`;

    if (!onlineLowerSet.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  // Truong hop dac biet neu thu nhieu lan van trung (rat hiem voi 10,000 so)
  const timestampSuffix = String(Date.now() % 10000).padStart(4, '0');
  return `Client_${timestampSuffix}`;
}

/**
 * Tao Client moi va Session token tuong ung
 */
async function createClient(existingOnlineNames = []) {
  const clientId = crypto.randomUUID();
  const displayName = generateDefaultName(existingOnlineNames);
  const avatarColor = getRandomAvatarColor();

  const client = await Client.create({
    clientId,
    displayName,
    avatarColor,
    lastSeenAt: new Date()
  });

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);

  await Session.create({
    sessionToken,
    clientId,
    expiresAt
  });

  return { client, sessionToken };
}

/**
 * Lay thong tin Client tu Session token
 */
async function getClientBySession(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string') return null;

  const session = await Session.findOne({
    sessionToken,
    expiresAt: { $gt: new Date() }
  });

  if (!session) return null;

  const client = await Client.findOne({ clientId: session.clientId });
  if (client) {
    // Cap nhat lastSeenAt
    client.lastSeenAt = new Date();
    await client.save().catch(() => {});
  }

  return client;
}

/**
 * Doi ten hien thi cho Client
 */
async function renameClient(clientId, rawNewName, existingOnlineNames = []) {
  const validation = validateUsername(rawNewName);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const newName = validation.value;

  // Kiem tra xem co trung voi client khac dang online khong
  const isDuplicate = existingOnlineNames.some(
    (n) => typeof n === 'string' && n.toLowerCase() === newName.toLowerCase()
  );

  if (isDuplicate) {
    return {
      success: false,
      error: `Tên "${newName}" đang được sử dụng bởi một thành viên trực tuyến khác.`
    };
  }

  const client = await Client.findOneAndUpdate(
    { clientId },
    { displayName: newName, lastSeenAt: new Date() },
    { returnDocument: 'after' }
  );

  if (!client) {
    return { success: false, error: 'Không tìm thấy danh tính Client.' };
  }

  return { success: true, client };
}

module.exports = {
  getRandomAvatarColor,
  generateDefaultName,
  createClient,
  getClientBySession,
  renameClient
};
