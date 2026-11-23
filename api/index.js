// Vercel runs the game's server here: every /api/... request is sent to this one function
// (see vercel.json), and the game's pages and pictures are served straight from public/.
// The server is started once (see server/boot.js) and then answers every request.
const boot = require('../server/boot.js');

let app = null;
const starting = boot().then((a) => { app = a; });

module.exports = async (req, res) => {
  if (!app) await starting;
  return app(req, res);
};
