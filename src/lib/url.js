// Every link on the site goes through url() so the site can live under a sub-path (GitHub Pages project sites
// are served from /<repo>/). The base comes from SITE_BASE at build time; see astro.config.mjs.
const base = String(import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '');

/** url('/songs/x/') => '/songs/x/' at the root, '/<repo>/songs/x/' under a sub-path. */
export const url = (path) => base + path;
