// Lyrics for the player, fetched in the browser from LRCLIB (https://lrclib.net), an open lyrics database that
// allows cross-origin requests. Nothing is stored on this site: scripts/find-lyrics.mjs only records which LRCLIB
// entry is closest to each song, and a song without one falls back to a title search here.
import { normalize } from './arabic.js';

const API = 'https://lrclib.net/api';
const IS_KULTHUM = /كلثوم|كلسوم|kulthum|kalthoum|kalsoum|koulthoum|kolthoum|kalthum|kulsum|kultum|oum k|om k|umm k|um k/i;
const cache = new Map(); // song slug -> Promise<result>

const tokens = (s) => normalize(s).split(' ').map((t) => t.replace(/^ال/, '')).filter((t) => t.length > 1);
const overlap = (a, b) => {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
};

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
  return res.json();
}

/** The closest Umm Kulthum entry for a title, or null. */
async function searchByTitle(title) {
  const results = await getJson(`${API}/search?q=${encodeURIComponent(`${title} أم كلثوم`)}`);
  let best = null;
  for (const r of results ?? []) {
    if (!r.plainLyrics || !IS_KULTHUM.test(`${r.artistName} ${r.trackName} ${r.albumName ?? ''}`)) continue;
    const score = overlap(tokens(title), tokens(String(r.trackName).replace(/[^؀-ۿ\s]/g, ' ')));
    if (score >= 0.6 && (!best || score > best.score)) best = { entry: r, score };
  }
  return best?.entry ?? null;
}

/**
 * Lyrics for a player track ({ song, title, lyricsId }).
 * Resolves to { text, label } or null when nothing was found; rejects when LRCLIB cannot be reached.
 */
export function loadLyrics(track) {
  const key = track.song || track.title;
  if (!cache.has(key)) {
    const p = (async () => {
      const entry = track.lyricsId ? await getJson(`${API}/get/${track.lyricsId}`) : await searchByTitle(track.title);
      const text = entry?.plainLyrics?.trim();
      return text ? { text, label: [entry.trackName, entry.artistName].filter(Boolean).join(' — ') } : null;
    })();
    // A failed request must not be cached, or "try again" would never retry.
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key);
}
