// Run: node scripts/clean-project.cjs
// Only removes known generated outputs. Source, tests and environment files stay intact.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const frontend = path.join(root, 'frontend');
if (!fs.existsSync(path.join(frontend, 'package.json')) || !fs.existsSync(path.join(frontend, 'index.html'))) {
  throw new Error('Jalankan dari proyek yang memiliki frontend/package.json dan frontend/index.html.');
}
const names = ['dist', 'qa-final', 'undefined', ...fs.readdirSync(frontend).filter(name => /^qa-browser-[A-Za-z0-9_-]+$/.test(name))];
for (const name of names) {
  const target = path.join(frontend, name);
  if (fs.existsSync(target)) {
    fs.rmSync(target, {recursive: true, force: true});
    console.log(`Dihapus: frontend/${name}`);
  }
}
console.log('Selesai. npm run build akan membuat ulang frontend/dist untuk deployment.');
