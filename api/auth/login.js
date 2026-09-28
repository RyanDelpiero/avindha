const bcrypt = require('bcryptjs');
const { query } = require('../../lib/db');
const { setSessionCookie } = require('../../lib/auth');
const { route, send } = require('../../lib/http');

const MAX_ATTEMPTS = 5;   // gagal berturut-turut sebelum akun dikunci
const LOCK_MINUTES = 15;
// Hash palsu: username tak dikenal tetap memakan waktu yang sama (cegah tebak-username via timing)
const DUMMY_HASH = bcrypt.hashSync('bukan-password-asli', 10);

module.exports = route({
  POST: async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return send(res, 400, { error: 'Username dan password wajib diisi' });
    }

    const rows = await query('SELECT * FROM users WHERE username = $1', [
      String(username).trim().toLowerCase(),
    ]);
    let user = rows[0];

    if (user && user.locked_until) {
      const until = new Date(user.locked_until);
      if (until > new Date()) {
        const mins = Math.ceil((until - new Date()) / 60000);
        return send(res, 429, {
          error: `Terlalu banyak percobaan gagal. Akun dikunci sementara, coba lagi dalam ${mins} menit.`,
        });
      }
      // masa kunci sudah lewat -> mulai hitung dari nol
      await query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);
      user = { ...user, failed_attempts: 0, locked_until: null };
    }

    const ok = await bcrypt.compare(String(password), user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) {
      if (user) {
        await query(
          `UPDATE users
              SET failed_attempts = failed_attempts + 1,
                  locked_until = CASE WHEN failed_attempts + 1 >= $2
                                      THEN now() + make_interval(mins => $3::int)
                                      ELSE NULL END
            WHERE id = $1`,
          [user.id, MAX_ATTEMPTS, LOCK_MINUTES]
        );
      }
      return send(res, 401, { error: 'Username atau password salah' });
    }

    if (user.failed_attempts) {
      await query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);
    }

    setSessionCookie(res, {
      sub: user.id,
      username: user.username,
      name: user.full_name,
      role: user.role,
      department: user.department,
    });
    return send(res, 200, {
      username: user.username,
      name: user.full_name,
      role: user.role,
      department: user.department,
    });
  },
}, { auth: false });
