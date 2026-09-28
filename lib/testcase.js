// Validasi & normalisasi input test case dari frontend (camelCase).
const MODULES = ['ivr', 'grapari-indihome', 'grapari-mobile'];
const RESULTS = ['Passed', 'Failed', 'Pending'];
const MAX_EVIDENCE_CHARS = 4_000_000; // batas body Vercel = 4,5 MB

const str = (v, max) => (v == null ? '' : String(v).trim().slice(0, max));

function normSeverity(v) {
  const t = String(v || '');
  if (t.includes('Critical')) return 'Critical';
  if (t.includes('Major')) return 'Major';
  return 'Minor';
}

function validDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Evidence:
 *  - undefined / objek tanpa data (hanya penanda 'stored') -> { keep: true }   (jangan diubah)
 *  - null                                                  -> { remove: true } (hapus)
 *  - { type, name, data }                                  -> { set: {...} }   (ganti)
 */
function normEvidence(ev) {
  if (ev === undefined) return { keep: true };
  if (ev === null) return { remove: true };
  if (typeof ev !== 'object' || !ev.data) return { keep: true };

  const type = ev.type === 'video' ? 'video' : ev.type === 'image' ? 'image' : null;
  if (!type) return { error: 'Tipe evidence harus image atau video' };
  const data = String(ev.data);
  if (!data.startsWith(`data:${type}/`)) return { error: 'Format data evidence tidak valid' };
  if (data.length > MAX_EVIDENCE_CHARS) {
    return { error: 'Ukuran evidence terlalu besar (maks ±3 MB setelah kompresi)' };
  }
  return { set: { type, name: str(ev.name, 255), data } };
}

function normalize(body) {
  const b = body || {};
  if (!MODULES.includes(b.module)) return { error: 'Modul tidak valid' };
  if (!validDate(b.date)) return { error: 'Tanggal harus berformat YYYY-MM-DD' };

  const evidence = normEvidence(b.evidence);
  if (evidence.error) return { error: evidence.error };

  return {
    data: {
      module: b.module,
      date: b.date,
      result: RESULTS.includes(b.result) ? b.result : 'Pending',
      severity: normSeverity(b.severity),
      description: str(b.desc, 5000),
      propose: str(b.propose, 5000),
      step: str(b.step, 5000),
      detail: str(b.detail, 5000),
      capability: str(b.capability, 500),
      service_provider: str(b.serviceProvider, 50),
      phone: str(b.phone, 50),
      layanan: str(b.layanan, 300),
      tier: str(b.tier, 50),
      menu_category: str(b.menuCategory, 500),
    },
    evidence,
  };
}

module.exports = { MODULES, normalize };
