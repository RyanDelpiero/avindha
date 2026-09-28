// Membuat tabel di database. Aman dijalankan berulang kali.
// Pakai:  npm run setup-db      (butuh .env.local berisi DATABASE_URL)
const { ensureSchema } = require('../lib/db');

ensureSchema()
  .then(() => console.log('Tabel users & testcases siap.'))
  .catch((err) => {
    console.error('Gagal menyiapkan database:', err.message);
    process.exit(1);
  });
