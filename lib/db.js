// Koneksi ke Postgres (Neon). Saat Anda menghubungkan Neon dari Vercel
// (Storage / Marketplace), variabel DATABASE_URL terisi otomatis di project.
const { neon } = require('@neondatabase/serverless');

let _sql;
function client() {
  if (!_sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL belum di-set');
    _sql = neon(url);
  }
  return _sql;
}

// Query berparameter: query('SELECT * FROM t WHERE id = $1', [5]) -> array baris
async function query(text, params = []) {
  return client().query(text, params);
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id              SERIAL PRIMARY KEY,
     username        VARCHAR(50)  UNIQUE NOT NULL,
     password_hash   VARCHAR(100) NOT NULL,
     full_name       VARCHAR(100) NOT NULL,
     department      VARCHAR(80)  NOT NULL DEFAULT 'Umum',
     role            VARCHAR(20)  NOT NULL DEFAULT 'tester' CHECK (role IN ('supervisor','tester')),
     failed_attempts INT          NOT NULL DEFAULT 0,
     locked_until    TIMESTAMPTZ,
     created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS testcases (
     id               SERIAL PRIMARY KEY,
     module           VARCHAR(30) NOT NULL CHECK (module IN ('ivr','grapari-indihome','grapari-mobile')),
     test_date        DATE        NOT NULL,
     result           VARCHAR(20) NOT NULL DEFAULT 'Pending',
     severity         VARCHAR(20) NOT NULL DEFAULT 'Minor',
     description      TEXT,
     propose          TEXT,
     service_provider VARCHAR(50),
     phone            VARCHAR(50),
     layanan          TEXT,
     tier             VARCHAR(50),
     menu_category    TEXT,
     detail           TEXT,
     step             TEXT,
     capability       TEXT,
     evidence_type    VARCHAR(10),
     evidence_name    VARCHAR(255),
     evidence_data    TEXT,
     created_by       VARCHAR(50),
     department       VARCHAR(80),
     created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_testcases_module_date ON testcases (module, test_date DESC, id DESC)`,
];

async function tablesExist() {
  const r = await query(`SELECT to_regclass('public.users') AS u, to_regclass('public.testcases') AS t`);
  return !!(r[0] && r[0].u && r[0].t);
}

// Membuat tabel bila belum ada. Murah: kalau tabel sudah ada, hanya 1 query cek.
let _ready;
function ensureSchema() {
  if (!_ready) {
    _ready = (async () => {
      if (await tablesExist()) return;
      try {
        for (const stmt of SCHEMA) await query(stmt);
      } catch (err) {
        // Dua instance yang start bersamaan bisa saling bentrok saat CREATE; cek ulang.
        if (!(await tablesExist())) throw err;
      }
    })().catch((err) => { _ready = null; throw err; });
  }
  return _ready;
}

// Kolom yang dikirim ke frontend. evidence_data (base64 besar) SENGAJA tidak ikut,
// diambil terpisah lewat /api/testcases/:id/evidence.
const LIST_COLUMNS = `id, module, to_char(test_date, 'YYYY-MM-DD') AS test_date, result, severity,
  description, propose, service_provider, phone, layanan, tier, menu_category, detail, step,
  capability, evidence_type, evidence_name, created_by, department`;

const s = (v) => (v == null ? '' : v);

// snake_case (database) -> camelCase (dipakai app.js)
function toClient(row) {
  return {
    id: row.id,
    module: row.module,
    date: row.test_date,
    result: row.result,
    severity: row.severity,
    desc: s(row.description),
    propose: s(row.propose),
    serviceProvider: s(row.service_provider),
    phone: s(row.phone),
    layanan: s(row.layanan),
    tier: s(row.tier),
    menuCategory: s(row.menu_category),
    detail: s(row.detail),
    step: s(row.step),
    capability: s(row.capability),
    createdBy: s(row.created_by),
    department: s(row.department),
    evidence: row.evidence_type
      ? { type: row.evidence_type, name: s(row.evidence_name), stored: true }
      : null,
  };
}

module.exports = { query, ensureSchema, toClient, LIST_COLUMNS, SCHEMA };
