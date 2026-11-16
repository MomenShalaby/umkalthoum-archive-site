// Publishes the site: pushes this project to the public site repo's `main` branch and the built
// pages to its `gh-pages` branch, which GitHub Pages serves (no GitHub Actions needed).
// Usage: npm run publish-site      (after `php artisan archive:export` refreshed data/archive.json)
//
// The site lives in its own public repo so the Laravel app and the scraper data stay private
// (GitHub Pages on a private repo needs a paid plan). Each publish replaces what the repo holds.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OWNER = process.env.PAGES_OWNER || 'MomenShalaby';
const REPO = process.env.PAGES_REPO || 'umkalthoum-archive-site';
const remote = `https://github.com/${OWNER}/${REPO}.git`;
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const out = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', ...opts }).trim();
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

const SKIP = new Set(['node_modules', 'dist', '.astro', '.git']);
const clear = (dir) => { for (const n of fs.readdirSync(dir)) if (n !== '.git') fs.rmSync(path.join(dir, n), { recursive: true, force: true }); };

/** Clone the site repo, let `fill` put files in it, and push them to `branch` if anything changed. */
function push(branch, { orphan = false, force = false }, fill) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'uk-site-'));
  try {
    run('git', ['clone', '--quiet', remote, work]);
    if (orphan) run('git', ['switch', '--quiet', '--orphan', branch], { cwd: work });
    clear(work);
    fill(work);
    run('git', ['add', '-A'], { cwd: work });
    if (!out('git', ['status', '--porcelain'], { cwd: work })) return console.log(`${branch}: nothing changed.`);
    run('git', ['commit', '--quiet', '-m', `Update site ${stamp}`], { cwd: work });
    run('git', ['push', '--quiet', ...(force ? ['--force'] : []), 'origin', `HEAD:${branch}`], { cwd: work });
    console.log(`${branch}: pushed.`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// Set here, not on the command line: Git Bash on Windows rewrites a leading "/" in env values.
const env = { ...process.env, SITE_BASE: `/${REPO}/` };
console.log(`Building for https://${OWNER.toLowerCase()}.github.io/${REPO}/`);
run('npx', ['astro', 'build'], { env, shell: true });
run('node', ['scripts/check-site.mjs'], { env });

push('main', {}, (work) => fs.cpSync('.', work, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) }));
push('gh-pages', { orphan: true, force: true }, (work) => {
  fs.cpSync('dist', work, { recursive: true });
  fs.writeFileSync(path.join(work, '.nojekyll'), ''); // serve _astro/ as is
});
