import { defineConfig } from 'astro/config';
import fs from 'node:fs';

// SITE_BASE is the sub-path the site is served from: '/' (default) on its own domain, '/<repo>/' on a
// GitHub Pages project site. Every link goes through src/lib/url.js, which reads it.
const base = process.env.SITE_BASE || '/';
const prefix = base.replace(/\/$/, '');

// Songs merged into another one keep their old address as a redirect (static pages with a meta refresh).
const data = JSON.parse(fs.readFileSync(new URL('./data/archive.json', import.meta.url), 'utf8'));
const redirects = Object.fromEntries(Object.entries(data.redirects ?? {}).map(([from, to]) => [`/songs/${from}`, `${prefix}/songs/${to}/`]));

export default defineConfig({
  base,
  trailingSlash: 'always',
  build: { format: 'directory' },
  redirects,
});
