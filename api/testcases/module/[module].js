const { query } = require('../../../lib/db');
const { MODULES } = require('../../../lib/testcase');
const { route, send, isSupervisor } = require('../../../lib/http');

// DELETE /api/testcases/module/:module -> hapus SELURUH data satu modul (khusus supervisor)
module.exports = route({
  DELETE: async (req, res, session) => {
    if (!isSupervisor(session)) {
      return send(res, 403, { error: 'Hanya Supervisor yang boleh menghapus seluruh data modul' });
    }
    if (!MODULES.includes(req.query.module)) return send(res, 400, { error: 'Modul tidak valid' });

    const rows = await query('DELETE FROM testcases WHERE module = $1 RETURNING id', [req.query.module]);
    return send(res, 200, { deleted: rows.length });
  },
});
