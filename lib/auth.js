const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'avindha_session';
const MAX_AGE = 60 * 60 * 12; // 12 jam

// Gagal tertutup: tanpa SESSION_SECRET yang kuat, aplikasi menolak jalan
// (bukan memakai nilai default yang bisa ditebak orang).
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET belum di-set atau kurang dari 32 karakter');
  }
  return s;
}

const isSecure = () => !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'development';

function cookieString(value, maxAge) {
  return [
    `${COOKIE_NAME}=${value}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
    isSecure() ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

function setSessionCookie(res, payload) {
  const token = jwt.sign(payload, secret(), { expiresIn: MAX_AGE });
  res.setHeader('Set-Cookie', cookieString(token, MAX_AGE));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', cookieString('', 0));
}

function readToken(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === COOKIE_NAME) return part.slice(i + 1).trim();
  }
  return null;
}

function getSession(req) {
  const token = readToken(req);
  if (!token) return null;
  try {
    return jwt.verify(token, secret());
  } catch (err) {
    if (/SESSION_SECRET/.test(err.message)) throw err; // salah konfigurasi -> jangan ditelan
    return null; // token kedaluwarsa / dipalsukan
  }
}

module.exports = { setSessionCookie, clearSessionCookie, getSession };
