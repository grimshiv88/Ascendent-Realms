// Vercel runs the game's server here: every /api/... request is sent to this one function
// (see vercel.json), and the game's pages and pictures are served straight from public/.
module.exports = require('../server/index.js');
