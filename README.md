# Umm Kulthum archive: static site

The same archive as the Laravel app, built into plain HTML with [Astro](https://astro.build) so it can be hosted anywhere
(GitHub Pages, Cloudflare Pages, Netlify). No PHP or database at run time.

- Pages are generated from `data/archive.json`, which the Laravel app writes (see below).
- Audio is not hosted here: every recording plays straight from its archive.org link.
- The song filters, the year chart and the search run in the browser (`src/scripts/home.js`, `search.js`).

```
npm install
npm run dev            # http://localhost:4321
npm run build          # writes dist/
npm run preview
npm run check-links    # HEAD-checks every archive.org audio link
```

## Updating the data

The catalogue is curated in the Laravel app (name fixes, merged songs, profiles, lyrics), then exported:

```
# in ../umkalthoum-archive (the scraper): resolve new recordings without downloading mp3s
node src/cli.mjs --no-download

# in the Laravel app (repo root)
php artisan archive:import      # reads the scraper's state.db; includes recordings that are only links
php artisan archive:tidy        # applies config/credits.php and config/people.php
php artisan archive:export      # writes static/data/archive.json and copies portraits and covers

# here
npm run build
```

`archive:export` also copies portraits to `public/images/people/` and covers to `public/covers/`.

## Credits and venues

Songs the blog gives no lyricist or composer simply show none; nothing is guessed. Spelling fixes live in the
Laravel app's `config/credits.php` (`people`, `songs`, `venues`, `unknown_venues`), then `archive:tidy` and
`archive:export` again. Bios in `config/people.php` are unchecked drafts.

## Hosting

Every link goes through `src/lib/url.js`, so the site works at a domain root or under a sub-path (`SITE_BASE=/name/`).

**GitHub Pages** (live at https://momenshalaby.github.io/umkalthoum-archive-site/). This folder is also its own public
repo, `MomenShalaby/umkalthoum-archive-site`; the Laravel app and scraper data stay in the private repo (Pages on a
private repo needs a paid plan). `.github/workflows/deploy.yml` builds with `SITE_BASE=/<repo>/`, checks links and
publishes on every push to `main`. From the private repo, `npm run publish-site` copies this folder into the site
repo and pushes it, which triggers that workflow.

**Cloudflare Pages / Netlify**: root directory `static`, build command `npm run build`, output `dist`.

Before deploying: `npm run check-site` (broken links) and `npm run check-links` (dead audio).

## Layout

- `src/lib/archive.js`: loads the JSON and derives what pages need (counts, pairs, partners).
- `src/lib/arabic.js`: Arabic normalisation, plural forms, durations, lyric stanzas (port of the PHP helpers).
- `src/pages/`: one file per route; `[slug]` / `[id]` pages are generated from the data.
- `src/scripts/`: Turbo + Alpine, the persistent player (`player.js`), home filters, search.
- Merged songs keep their old address as a redirect (`astro.config.mjs`).
