// ============================================================
// D-CONNECT Constants & Config Settings
// ============================================================

module.exports = {
  // Phong chat mac dinh
  DEFAULT_PUBLIC_ROOM_ID: 'general',
  DEFAULT_PUBLIC_ROOM_NAME: 'Phòng chung',

  // Ma phong rieng
  PRIVATE_ROOM_CODE_LENGTH: 6,
  // Bang ky tu an toan, khong chua O, 0, I, 1 de tranh nham lan
  PRIVATE_ROOM_CHARSET: '23456789ABCDEFGHJKLMNPQRSTUVWXYZ',

  // Gioi han do dai
  USERNAME_MIN_LENGTH: 2,
  USERNAME_MAX_LENGTH: 20,
  MESSAGE_MAX_LENGTH: 1000,
  HISTORY_PAGE_SIZE: 30,

  // Session
  SESSION_COOKIE_NAME: 'dconnect_session',
  SESSION_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000, // 7 ngay

  // Palette avatar tone teal/cyan D-CONNECT
  AVATAR_PALETTE: [
    'linear-gradient(135deg, #0E7490, #06B6D4)',
    'linear-gradient(135deg, #0F766E, #22D3EE)',
    'linear-gradient(135deg, #155E75, #0891B2)',
    'linear-gradient(135deg, #0284C7, #06B6D4)',
    'linear-gradient(135deg, #0E7490, #22D3EE)'
  ],

  // Rate Limiting configs
  RATE_LIMITS: {
    MESSAGE: { maxCount: 5, windowMs: 2000 },       // Toi da 5 tin / 2s
    TYPING: { maxCount: 3, windowMs: 2000 },        // Toi da 3 lan emit typing / 2s
    RENAME: { maxCount: 3, windowMs: 10000 },       // Toi da 3 lan doi ten / 10s
    ROOM_JOIN: { maxCount: 5, windowMs: 60000 }     // Toi da 5 lan thu ma phong sai / 1 phut
  }
};
