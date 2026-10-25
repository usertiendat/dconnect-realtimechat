// ============================================================
// D-CONNECT Session Middleware
// Xu ly Cookie va danh tinh Client cho ca Express va Socket.IO
// ============================================================

const { parseCookie, stringifySetCookie } = require('cookie');
const { SESSION_COOKIE_NAME, SESSION_EXPIRY_MS } = require('../config/constants');
const { createClient, getClientBySession } = require('../services/clientService');

/**
 * Phan tich chuoi cookie header thanh object key-value
 */
function parseCookieHeader(headerStr) {
  if (!headerStr || typeof headerStr !== 'string') return {};
  try {
    return parseCookie(headerStr);
  } catch {
    return {};
  }
}

/**
 * Tao header Set-Cookie an toan cho session
 */
function buildSessionCookie(token) {
  const isProd = process.env.NODE_ENV === 'production';
  return stringifySetCookie({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_EXPIRY_MS / 1000),
    secure: isProd
  });
}

/**
 * Express Middleware: Dam bao moi request HTTP deu co Client Identity va Session Cookie
 * @param {() => string[]} getOnlineNamesCallback
 */
function createExpressSessionMiddleware(getOnlineNamesCallback = () => []) {
  return async function expressSessionMiddleware(req, res, next) {
    try {
      const cookies = parseCookieHeader(req.headers.cookie);
      const token = cookies[SESSION_COOKIE_NAME];

      let client = null;
      if (token) {
        client = await getClientBySession(token);
      }

      if (!client) {
        // Chua co session hoac session da het han -> tu dong cap Client moi
        const onlineNames = getOnlineNamesCallback();
        const { client: newClient, sessionToken } = await createClient(onlineNames);
        res.setHeader('Set-Cookie', buildSessionCookie(sessionToken));
        req.client = newClient;
        req.sessionToken = sessionToken;
      } else {
        req.client = client;
        req.sessionToken = token;
      }

      next();
    } catch (err) {
      console.error('[Session Middleware] Loi:', err.message);
      next(err);
    }
  };
}

/**
 * Socket.IO Middleware: Xac thuc phien Client qua Handshake Cookie
 */
async function socketAuthMiddleware(socket, next) {
  try {
    const rawCookie = socket.handshake.headers.cookie || socket.handshake.headers.Cookie;
    const cookies = parseCookieHeader(rawCookie);
    let token = cookies[SESSION_COOKIE_NAME];

    if (!token && socket.handshake.auth && socket.handshake.auth.sessionToken) {
      token = socket.handshake.auth.sessionToken;
    }

    if (!token) {
      return next(new Error('AUTH_NO_SESSION_COOKIE'));
    }

    const client = await getClientBySession(token);
    if (!client) {
      return next(new Error('AUTH_SESSION_INVALID_OR_EXPIRED'));
    }

    // Gan du lieu Client co tham quyen vao Socket
    socket.clientData = {
      clientId: client.clientId,
      displayName: client.displayName,
      avatarColor: client.avatarColor,
      sessionToken: token
    };

    next();
  } catch (err) {
    console.error('[Socket Auth Middleware] Loi xac thuc:', err.message);
    next(new Error('AUTH_SERVER_ERROR'));
  }
}

module.exports = {
  parseCookieHeader,
  buildSessionCookie,
  createExpressSessionMiddleware,
  socketAuthMiddleware
};
