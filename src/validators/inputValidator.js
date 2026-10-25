// ============================================================
// D-CONNECT Input Validator & Sanitizer
// ============================================================

const {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  MESSAGE_MAX_LENGTH,
  PRIVATE_ROOM_CODE_LENGTH,
  PRIVATE_ROOM_CHARSET,
  AVATAR_PALETTE
} = require('../config/constants');

/**
 * XSS HTML Escaping an toan
 */
function sanitizeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate ten hien thi
 * Ho tro chu cai tieng Viet, tieng Anh, chu so, dau gach duoi, dau gach ngang va khoang trang
 */
function validateUsername(rawName) {
  if (typeof rawName !== 'string') {
    return { valid: false, error: 'Tên người dùng phải là chuỗi ký tự.' };
  }

  // Chuan hoa khoang trang thua o giua va hai dau
  const normalized = rawName.trim().replace(/\s+/g, ' ');

  if (normalized.length < USERNAME_MIN_LENGTH || normalized.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Tên phải từ ${USERNAME_MIN_LENGTH} đến ${USERNAME_MAX_LENGTH} ký tự.`
    };
  }

  // Khong cho phep the HTML hoac ky tu dac biet nguy hiem
  const allowedPattern = /^[\p{L}\p{N}_\- ]+$/u;
  if (!allowedPattern.test(normalized)) {
    return {
      valid: false,
      error: 'Tên chỉ được chứa chữ cái, chữ số, khoảng trắng, gạch dưới (_) hoặc gạch ngang (-).'
    };
  }

  return { valid: true, value: normalized };
}

/**
 * Validate noi dung tin nhan
 */
function validateMessageText(rawText) {
  if (typeof rawText !== 'string') {
    return { valid: false, error: 'Nội dung tin nhắn không hợp lệ.' };
  }

  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Nội dung tin nhắn không được để trống.' };
  }

  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return {
      valid: false,
      error: `Tin nhắn quá dài (tối đa ${MESSAGE_MAX_LENGTH} ký tự).`
    };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validate ma phong rieng (6 ky tu chu hoac so, khong phan biet hoa thuong khi nhap)
 */
function validateRoomCode(rawCode) {
  if (typeof rawCode !== 'string') {
    return { valid: false, error: 'Mã phòng phải là chuỗi ký tự.' };
  }

  const normalized = rawCode.trim().toUpperCase();

  if (normalized.length !== PRIVATE_ROOM_CODE_LENGTH) {
    return {
      valid: false,
      error: `Mã phòng phải gồm đúng ${PRIVATE_ROOM_CODE_LENGTH} ký tự.`
    };
  }

  // Kiem tra tung ky tu phai thuoc charset hop le
  for (const ch of normalized) {
    if (!PRIVATE_ROOM_CHARSET.includes(ch)) {
      return {
        valid: false,
        error: `Mã phòng chứa ký tự không hợp lệ: "${ch}".`
      };
    }
  }

  return { valid: true, value: normalized };
}

/**
 * Validate mau avatar thuoc palette hoac fallback ve mau hop le
 */
function validateAvatarColor(color) {
  if (typeof color === 'string' && AVATAR_PALETTE.includes(color)) {
    return color;
  }
  return AVATAR_PALETTE[0];
}

module.exports = {
  sanitizeHtml,
  validateUsername,
  validateMessageText,
  validateRoomCode,
  validateAvatarColor
};
