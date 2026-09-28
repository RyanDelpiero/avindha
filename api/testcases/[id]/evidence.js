const { query } = require('../../../lib/db');
const { route, send } = require('../../../lib/http');

// GET /api/testcases/:id/evidence -> { type, name, data }
module.exports = route({
  GET: async (req, res) => {
    const id = Number(req.query.id);
    if (!Number.isInteger(id) || id <= 0) return send(res, 400, { error: 'ID tidak valid' });

    const rows = await query(
      'SELECT evidence_type, evidence_name, evidence_data FROM testcases WHERE id = $1',
      [id]
    );
    const r = rows[0];
    if (!r || !r.evidence_data) return send(res, 404, { error: 'Evidence tidak ada' });
    return send(res, 200, { type: r.evidence_type, name: r.evidence_name || '', data: r.evidence_data });
  },
});
