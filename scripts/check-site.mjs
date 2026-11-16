// Checks the built site in dist/: every internal link and asset exists, and no page leaked "undefined".
// Usage: npm run build && npm run check-site
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
if (!fs.existsSync(dist)) {
  console.error('dist/ not found; run `npm run build` first.');
  process.exit(1);
}

const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) pages.push(p);
  }
})(dist);

// With SITE_BASE=/repo/ every link starts with /repo; dist/ itself has no such folder.
const base = (process.env.SITE_BASE || '/').replace(/\/$/, '');

const exists = (url) => {
  if (base && url !== base && !url.startsWith(`${base}/`)) return false;
  const clean = decodeURIComponent(url.slice(base.length).split('#')[0].split('?')[0]);
  if (!clean || clean === '/') return true;
  const f = path.join(dist, clean);
  return fs.existsSync(f) && (fs.statSync(f).isFile() || fs.existsSync(path.join(f, 'index.html')));
};

const problems = [];
let links = 0;
for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(dist, file);
  if (/>\s*undefined\s*<|\[object Object\]|NaN%|="undefined"/.test(html)) problems.push(`${rel}: leaked "undefined"/NaN`);
  for (const [, attr, url] of html.matchAll(/\b(href|src)="(\/[^"]*)"/g)) {
    if (url.startsWith('//')) continue;
    links++;
    if (!exists(url)) problems.push(`${rel}: broken ${attr} ${url}`);
  }
}

console.log(`${pages.length} pages, ${links} internal links checked.`);
if (problems.length) {
  const uniq = [...new Set(problems)];
  console.log(`${uniq.length} problem(s):\n${uniq.slice(0, 40).join('\n')}`);
  process.exit(1);
}
console.log('No broken links.');
