// Run: node tests/paths.test.js — the site is served from a sub-path (/root-to-rise-app/),
// so no page may use root-absolute links, and config.js must never contain a secret key.
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const files = [...fs.readdirSync(root).filter(f => f.endsWith('.html')), 'admin/index.html',
  ...fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)];
let passed = 0;
for (const f of files) {
  const s = fs.readFileSync(path.join(root, f), 'utf8');
  const bad = s.match(/(?:href|src|action)=["']\/(?!\/)[^"']*/g) || [];
  assert.deepStrictEqual(bad, [], f + ' has root-absolute paths: ' + bad.join(', '));
  assert.ok(!/location\.origin\s*\+\s*["']\//.test(s), f + ' builds URLs from location.origin (breaks on sub-path)');
  passed++;
}
const cfg = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
assert.ok(!/service_role|sb_secret_/.test(cfg.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), 'config.js must not contain a service_role/secret key');
const jwt = cfg.match(/eyJ[\w-]+\.([\w-]+)\./);
if (jwt) assert.notStrictEqual(JSON.parse(Buffer.from(jwt[1], 'base64').toString()).role, 'service_role');
console.log('✓', passed, 'files use sub-path-safe links; config.js has no secret key');
