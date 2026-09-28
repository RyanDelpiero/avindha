const { query } = require('../../lib/db');
const { clearSessionCookie } = require('../../lib/auth');
const { route, send } = require('../../lib/http');

module.exports = route({
  GET: async (req, res, session) => {
    // Cek ulang ke database: akun yang sudah dihapus / role yang diubah langsung berlaku
    const rows = await query('SELECT username, full_name, role, department FROM users WHERE id = $1', [session.sub]);
    if (!rows[0]) {
      clearSessionCookie(res);
      return send(res, 401, { error: 'Akun tidak ditemukan' });
    }
    const u = rows[0];
    return send(res, 200, { username: u.username, name: u.full_name, role: u.role, department: u.department });
  },
});
