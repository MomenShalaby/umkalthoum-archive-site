// Finds, for each song, the closest Umm Kulthum entry on LRCLIB (https://lrclib.net, an open lyrics database)
// and writes data/lyrics-map.json: { songSlug: { id, track, artist, score } }.
//
// Only the entry id is stored. The player fetches the text from LRCLIB when a listener opens the lyrics, so the
// lyrics themselves are not kept in this repo. The match is best effort (live recordings differ from the studio
// versions LRCLIB mostly holds), which the player says on screen.
//
// Usage: npm run find-lyrics            (re-runs resume: responses are cached in data/.lrclib-cache.json)
//        npm run find-lyrics -- --cached-only (write the map from the cache alone, no requests)
//        npm run find-lyrics -- --force (ignore the cache)
// Fix a wrong or missing match by hand in data/lyrics-overrides.json: { "slug": 12345 }  or  { "slug": null } for none.
import fs from 'node:fs';
import path from 'node:path';
import { normalize } from '../src/lib/arabic.js';

const dir = path.resolve('data');
const archive = JSON.parse(fs.readFileSync(path.join(dir, 'archive.json'), 'utf8'));
const cachePath = path.join(dir, '.lrclib-cache.json');
const overridesPath = path.join(dir, 'lyrics-overrides.json');
const force = process.argv.includes('--force');
const cachedOnly = process.argv.includes('--cached-only'); // build the map from saved responses, no network
const cache = !force && fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HEADERS = { 'User-Agent': 'umkalthoum-archive-static/1.0 (open-source archive site)' };

async function search(q) {
  if (cache[q]) return cache[q];
  if (cachedOnly) return [];
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(700);
    try {
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
      const body = await res.json().catch(() => null);
      if (res.ok && Array.isArray(body)) {
        // Keep only what scoring needs, so the cache stays small.
        cache[q] = body.filter((x) => x.plainLyrics).map((x) => ({ id: x.id, trackName: x.trackName, artistName: x.artistName, albumName: x.albumName }));
        return cache[q];
      }
    } catch { /* retry */ }
    await sleep(3000 * (attempt + 1));
  }
  return [];
}

const IS_KULTHUM = /كلثوم|كلسوم|kulthum|kalthoum|kalsoum|koulthoum|kolthoum|kalthum|kulsum|kultum|oum k|om k|umm k|um k/i;
const tokens = (s) => normalize(s).split(' ').map((t) => t.replace(/^ال/, '')).filter((t) => t.length > 1);
const ARABIC = /[؀-ۿ]/;
const jaccard = (a, b) => {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
};
// Consonant skeleton: "Arouh Lemeen" and the transliterated slug "aroh-lamin" both become "rhlmn".
const skeleton = (s) => s.toLowerCase().replace(/[^a-z]/g, '').replace(/[aeiouyhw]/g, '').replace(/(.)\1+/g, '$1');
const bigrams = (s) => { const out = []; for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2)); return out; };
const dice = (a, b) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a), B = bigrams(b);
  if (!A.length || !B.length) return 0;
  const m = new Map();
  for (const x of A) m.set(x, (m.get(x) ?? 0) + 1);
  let hit = 0;
  for (const x of B) if (m.get(x) > 0) { hit++; m.set(x, m.get(x) - 1); }
  return (2 * hit) / (A.length + B.length);
};

function score(song, c) {
  if (!IS_KULTHUM.test(`${c.artistName} ${c.trackName} ${c.albumName ?? ''}`)) return 0;
  const name = c.trackName ?? '';
  const arabic = name.replace(/[^؀-ۿ\s]/g, ' ');
  const latin = name.replace(/[؀-ۿ]/g, ' ').replace(/\(.*?\)/g, ' ');
  const a = ARABIC.test(name) ? jaccard(tokens(song.title), tokens(arabic)) : 0;
  const l = /[a-z]/i.test(latin) ? dice(skeleton(song.slug), skeleton(latin.replace(/umm?\s*kulthum|oum\s*kalthoum|om\s*kalsoum/gi, ''))) : 0;
  return Math.max(a, l * 0.9); // transliteration is a weaker signal than the Arabic title
}

const words = (slug) => slug.split('-').filter((w) => !/^\d+$/.test(w)).join(' ');
const queriesFor = (song) => [
  `${song.title} أم كلثوم`,
  song.title,
  `${words(song.slug)} Umm Kulthum`,
  `${words(song.slug)} Oum Kalthoum`,
];

const THRESHOLD = 0.6;
const map = {};
let n = 0, found = 0;
for (const song of archive.songs) {
  n++;
  if (Object.hasOwn(overrides, song.slug)) {
    if (overrides[song.slug]) { map[song.slug] = { id: overrides[song.slug], manual: true }; found++; }
    continue;
  }
  let best = null;
  for (const q of queriesFor(song)) {
    for (const c of await search(q)) {
      const s = score(song, c);
      if (s >= THRESHOLD && (!best || s > best.score)) best = { id: c.id, track: c.trackName, artist: c.artistName, score: Math.round(s * 100) / 100 };
    }
    if (best && best.score >= 0.95) break; // clear match: skip the remaining queries
  }
  if (best) { map[song.slug] = best; found++; }
  if (n % 10 === 0) {
    fs.writeFileSync(cachePath, JSON.stringify(cache));
    console.log(`${n}/${archive.songs.length} songs, ${found} matched`);
  }
}

fs.writeFileSync(cachePath, JSON.stringify(cache));
fs.writeFileSync(path.join(dir, 'lyrics-map.json'), JSON.stringify(map, null, 1));
console.log(`Done: ${found} of ${archive.songs.length} songs matched -> data/lyrics-map.json`);
