// Loads the game server where require() can't load the shared game rules (public/js/data/*.mjs,
// written as browser modules). On Vercel, Node may refuse require() of such files, so each one is
// loaded first with import() and handed to require() ready-made; then the server is loaded.
const fs = require('node:fs');
const path = require('node:path');

const DATA = path.join(__dirname, '..', 'public', 'js', 'data');

async function boot() {
  for (const file of fs.readdirSync(DATA).filter((f) => f.endsWith('.mjs'))) {
    const filename = path.join(DATA, file);
    if (require.cache[filename]) continue;
    const exports = await import(require('node:url').pathToFileURL(filename).href);
    require.cache[filename] = { id: filename, filename, loaded: true, exports, children: [], paths: [] };
  }
  return require('./index.js');
}

module.exports = boot;
