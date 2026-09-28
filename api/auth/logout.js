const { clearSessionCookie } = require('../../lib/auth');
const { route, send } = require('../../lib/http');

module.exports = route({
  POST: async (req, res) => {
    clearSessionCookie(res);
    return send(res, 200, { message: 'Logged out' });
  },
}, { auth: false });
