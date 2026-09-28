const { getSession } = require('./auth');
const { ensureSchema } = require('./db');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/**
 * Bungkus handler per-method:
 *   module.exports = route({ GET: fn, POST: fn }, { auth: true });
 * - pastikan tabel ada
 * - (auth:true) wajib login -> fn(req, res, session)
 * - error tak terduga dicatat di log server, klien hanya dapat pesan umum
 */
function route(methods, { auth = true } = {}) {
  return async (req, res) => {
    try {
      const fn = methods[req.method];
      if (!fn) {
        res.setHeader('Allow', Object.keys(methods).join(', '));
        return send(res, 405, { error: 'Method tidak diizinkan' });
      }
      await ensureSchema();
      let session = null;
      if (auth) {
        session = getSession(req);
        if (!session) return send(res, 401, { error: 'Silakan login terlebih dahulu' });
      }
      return await fn(req, res, session);
    } catch (err) {
      console.error(err);
      return send(res, 500, { error: 'Terjadi kesalahan pada server' });
    }
  };
}

const isSupervisor = (session) => session && session.role === 'supervisor';

module.exports = { send, route, isSupervisor };
