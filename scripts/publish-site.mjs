// Copies this project (without node_modules/dist) into the public site repo and pushes it;
// the workflow in .github/workflows/deploy.yml then builds and publishes it to GitHub Pages.
// Usage: npm run publish-site      (after `php artisan archive:export` refreshed data/archive.json)
//
// The site lives in its own public repo so the Laravel app and the scraper data stay private
// (GitHub Pages on a private repo needs a paid plan). Each publish replaces that repo's contents.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OWNER = process.env.PAGES_OWNER || 'MomenShalaby';
const REPO = process.env.PAGES_REPO || 'umkalthoum-archive-site';
const remote = `https://github.com/${OWNER}/${REPO}.git`;
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const out = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', ...opts }).trim();

const SKIP = new Set(['node_modules', 'dist', '.astro', '.git']);
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'uk-site-'));
try {
  run('git', ['clone', '--quiet', remote, work]);
  for (const name of fs.readdirSync(work)) if (name !== '.git') fs.rmSync(path.join(work, name), { recursive: true, force: true });
  fs.cpSync('.', work, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) });
  run('git', ['add', '-A'], { cwd: work });

  if (!out('git', ['status', '--porcelain'], { cwd: work })) {
    console.log('Nothing changed since the last publish.');
  } else {
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    run('git', ['commit', '--quiet', '-m', `Update site ${stamp}`], { cwd: work });
    run('git', ['push', '--quiet', 'origin', 'HEAD:main'], { cwd: work });
    console.log(`Pushed. The workflow deploys it to https://${OWNER.toLowerCase()}.github.io/${REPO}/`);
  }
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
