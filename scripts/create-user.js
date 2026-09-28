// Membuat (atau reset password) akun login.
//
// Pakai:
//   npm run create-user -- <username> "<Nama Lengkap>" <supervisor|tester> "<Departemen>" [--reset]
// Contoh:
//   npm run create-user -- admin "Admin Assurance" supervisor "IT"
//   npm run create-user -- budi "Budi QA" tester "Customer Care"
//
// Password diminta saat script berjalan (tidak tampil di layar).
const readline = require('node:readline');
const bcrypt = require('bcryptjs');
const { query, ensureSchema } = require('../lib/db');

function askHidden(prompt) {
  if (process.env.AVINDHA_PASSWORD) return Promise.resolve(process.env.AVINDHA_PASSWORD);
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let muted = false;
    rl._writeToOutput = (s) => rl.output.write(muted ? '*' : s);
    rl.question(prompt, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
    muted = true;
  });
}

(async () => {
  const args = process.argv.slice(2).filter((a) => a !== '--reset');
  const reset = process.argv.includes('--reset');
  const [usernameRaw, fullName, roleRaw = 'tester', department = 'Umum'] = args;

  if (!usernameRaw || !fullName) {
    console.error('Pemakaian: npm run create-user -- <username> "<Nama Lengkap>" <supervisor|tester> "<Departemen>" [--reset]');
    process.exit(1);
  }
  const username = usernameRaw.trim().toLowerCase();
  const role = roleRaw.toLowerCase();
  if (!['supervisor', 'tester'].includes(role)) {
    console.error('Role harus "supervisor" atau "tester"');
    process.exit(1);
  }

  const password = await askHidden('Password (min 8 karakter): ');
  if (password.length < 8) {
    console.error('Password terlalu pendek (min 8 karakter).');
    process.exit(1);
  }
  const hash = bcrypt.hashSync(password, 10);

  await ensureSchema();
  const existing = await query('SELECT id FROM users WHERE username = $1', [username]);

  if (existing[0]) {
    if (!reset) {
      console.error(`User "${username}" sudah ada. Tambahkan --reset untuk mengganti password/role-nya.`);
      process.exit(1);
    }
    await query(
      `UPDATE users SET password_hash=$2, full_name=$3, role=$4, department=$5,
              failed_attempts=0, locked_until=NULL WHERE username=$1`,
      [username, hash, fullName, role, department]
    );
    console.log(`User "${username}" diperbarui (${role}, ${department}).`);
  } else {
    await query(
      'INSERT INTO users (username, password_hash, full_name, role, department) VALUES ($1,$2,$3,$4,$5)',
      [username, hash, fullName, role, department]
    );
    console.log(`User "${username}" dibuat (${role}, ${department}).`);
  }
})().catch((err) => {
  console.error('Gagal:', err.message);
  process.exit(1);
});
