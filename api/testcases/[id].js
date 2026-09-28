const { query } = require('../../lib/db');
const { normalize } = require('../../lib/testcase');
const { route, send, isSupervisor } = require('../../lib/http');

// Ambil record + cek hak akses: pemilik record atau supervisor
async function loadOwned(req, res, session) {
  const id = Number(req.query.id);
  if (!Number.isInteger(id) || id <= 0) {
    send(res, 400, { error: 'ID tidak valid' });
    return null;
  }
  const rows = await query('SELECT id, created_by FROM testcases WHERE id = $1', [id]);
  if (!rows[0]) {
    send(res, 404, { error: 'Data tidak ditemukan' });
    return null;
  }
  if (!isSupervisor(session) && rows[0].created_by !== session.username) {
    send(res, 403, { error: 'Anda hanya dapat mengubah/menghapus data yang Anda buat sendiri' });
    return null;
  }
  return id;
}

module.exports = route({
  // PUT /api/testcases/:id
  PUT: async (req, res, session) => {
    const id = await loadOwned(req, res, session);
    if (id === null) return;

    const { data, evidence, error } = normalize(req.body);
    if (error) return send(res, 400, { error });

    const params = [
      id, data.date, data.result, data.severity, data.description, data.propose, data.step,
      data.detail, data.capability, data.service_provider, data.phone, data.layanan, data.tier,
      data.menu_category,
    ];
    let evidenceSql = '';
    if (evidence.set) {
      params.push(evidence.set.type, evidence.set.name, evidence.set.data);
      evidenceSql = ', evidence_type = $15, evidence_name = $16, evidence_data = $17';
    } else if (evidence.remove) {
      evidenceSql = ', evidence_type = NULL, evidence_name = NULL, evidence_data = NULL';
    } // keep: evidence tidak disentuh

    await query(
      `UPDATE testcases SET
         test_date = $2, result = $3, severity = $4, description = $5, propose = $6, step = $7,
         detail = $8, capability = $9, service_provider = $10, phone = $11, layanan = $12,
         tier = $13, menu_category = $14, updated_at = now() ${evidenceSql}
       WHERE id = $1`,
      params
    );
    return send(res, 200, { message: 'Test case diperbarui' });
  },

  // DELETE /api/testcases/:id
  DELETE: async (req, res, session) => {
    const id = await loadOwned(req, res, session);
    if (id === null) return;
    await query('DELETE FROM testcases WHERE id = $1', [id]);
    return send(res, 200, { message: 'Test case dihapus' });
  },
});
