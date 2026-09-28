const { query, toClient, LIST_COLUMNS } = require('../../lib/db');
const { MODULES, normalize } = require('../../lib/testcase');
const { route, send } = require('../../lib/http');

module.exports = route({
  // GET /api/testcases?module=ivr
  GET: async (req, res) => {
    const module_ = req.query.module || 'ivr';
    if (!MODULES.includes(module_)) return send(res, 400, { error: 'Modul tidak valid' });

    const rows = await query(
      `SELECT ${LIST_COLUMNS} FROM testcases WHERE module = $1
        ORDER BY test_date DESC, id DESC LIMIT 5000`,
      [module_]
    );
    return send(res, 200, rows.map(toClient));
  },

  // POST /api/testcases
  POST: async (req, res, session) => {
    const { data, evidence, error } = normalize(req.body);
    if (error) return send(res, 400, { error });

    const ev = evidence.set || {};
    const rows = await query(
      `INSERT INTO testcases (
         module, test_date, result, severity, description, propose, step, detail, capability,
         service_provider, phone, layanan, tier, menu_category,
         evidence_type, evidence_name, evidence_data, created_by, department
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING id`,
      [
        data.module, data.date, data.result, data.severity, data.description, data.propose,
        data.step, data.detail, data.capability, data.service_provider, data.phone,
        data.layanan, data.tier, data.menu_category,
        ev.type || null, ev.name || null, ev.data || null,
        session.username, session.department,
      ]
    );
    return send(res, 201, { id: rows[0].id, message: 'Test case tersimpan' });
  },
});
