import fs from 'node:fs';
import path from 'node:path';
import { normalize } from './arabic.js';
import { url } from './url.js';

// The catalogue exported by `php artisan archive:export`; everything below is derived from it at build time.
// Resolved from the project root: this module is bundled during the build, so import.meta.url moves.
const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'archive.json'), 'utf8'));

export const SITE_NAME = 'أرشيف أم كلثوم';

const byId = (list) => new Map(list.map((x) => [x.id, x]));
// song slug -> LRCLIB entry, written by scripts/find-lyrics.mjs (optional: songs without one search by title)
const lyricsMapPath = path.join(process.cwd(), 'data', 'lyrics-map.json');
const lyricsMap = fs.existsSync(lyricsMapPath) ? JSON.parse(fs.readFileSync(lyricsMapPath, 'utf8')) : {};

const personById = byId(raw.people);
const venueById = byId(raw.venues);
const collectionById = byId(raw.collections);

const TYPE_LABEL = { concert: 'حفل', studio: 'استوديو', rehearsal: 'بروفة' };

export const people = raw.people.map((p) => ({
  ...p,
  search: normalize(p.name),
  photoUrl: p.photo ? url(`/${p.photo.replace(/^\//, '')}`) : null,
  roleLabel: p.lyricist && p.composer ? 'شاعر وملحّن' : p.composer ? 'ملحّن' : 'شاعر',
  life: p.born || p.died ? `${p.born || '?'}–${p.died || ''}` : null,
  initial: p.name.replace(/^ال/, '').charAt(0),
}));
const personMap = byId(people);

export const venues = raw.venues;
export const collections = raw.collections;

export const songs = raw.songs.map((s) => ({
  ...s,
  lyricist: personMap.get(s.lyricistId) ?? null,
  composer: personMap.get(s.composerId) ?? null,
  search: normalize(s.title),
  lyricsSearch: s.lyrics ? normalize(s.lyrics) : null,
  recordings: [],
}));
const songMap = byId(songs);

export const recordings = raw.recordings.map((r) => {
  const rec = {
    ...r,
    song: songMap.get(r.songId),
    venue: venueById.get(r.venueId) ?? null,
    collection: collectionById.get(r.collectionId) ?? null,
    coverUrl: r.cover ? url(`/covers/${r.cover}`) : null,
    coverCredit: r.cover ? raw.covers[r.cover] ?? null : null,
    typeLabel: TYPE_LABEL[r.type] ?? r.type,
    // The source's own wording for the date when there is one.
    when: r.dateRaw || r.date || (r.year ? String(r.year) : 'تاريخ غير معروف'),
  };
  rec.song.recordings.push(rec); // the export is already in chronological order
  return rec;
});
const recordingMap = byId(recordings);

for (const s of songs) s.recordingsCount = s.recordings.length;

/** What the browser player needs for one recording. */
export const toTrack = (r) => ({
  id: r.id,
  title: r.song.title,
  song: r.song.slug,
  lyricsId: lyricsMap[r.song.slug]?.id ?? null,
  meta: [r.part, r.when, r.venue?.name].filter(Boolean).join(' — '),
  src: r.src,
  cover: r.coverUrl,
  href: url(`/recordings/${r.id}/`),
  duration: r.duration,
});

const byCountThenTitle = (a, b) => b.recordingsCount - a.recordingsCount || a.search.localeCompare(b.search);
export const songsByCount = [...songs].sort(byCountThenTitle);

export const redirects = raw.redirects;
export const covers = raw.covers;
export const song = (id) => songMap.get(id);
export const recording = (id) => recordingMap.get(id);
export const person = (id) => personMap.get(id);
export const generatedAt = raw.generatedAt;

export const years = recordings.map((r) => r.year).filter(Boolean);
export const span = years.length ? [Math.min(...years), Math.max(...years)] : [1930, 1975];

export const totals = {
  recordings: recordings.length,
  songs: songs.length,
  hours: Math.round(recordings.reduce((n, r) => n + (r.duration || 0), 0) / 3600),
};

/** People who composed (or wrote) at least one recorded song, with counts, most songs first. */
export function peopleFor(role) {
  const key = role === 'composer' ? 'composer' : 'lyricist';
  const stats = new Map();
  for (const s of songs) {
    const p = s[key];
    if (!p) continue;
    const st = stats.get(p.id) ?? { person: p, songs: 0, recordings: 0 };
    st.songs++;
    st.recordings += s.recordingsCount;
    stats.set(p.id, st);
  }
  return [...stats.values()].sort((a, b) => b.songs - a.songs || b.recordings - a.recordings);
}

/** Lyricist and composer who made two or more recorded songs together, most songs first. */
export function pairs() {
  const m = new Map();
  for (const s of songs) {
    if (!s.lyricist || !s.composer) continue;
    const k = `${s.lyricist.id}:${s.composer.id}`;
    const x = m.get(k) ?? { lyricist: s.lyricist, composer: s.composer, songs: 0, recordings: 0 };
    x.songs++;
    x.recordings += s.recordingsCount;
    m.set(k, x);
  }
  return [...m.values()].filter((x) => x.songs >= 2).sort((a, b) => b.songs - a.songs || b.recordings - a.recordings).slice(0, 10);
}

/** Everything about one person's page: songs credited in either role, recordings, partners. */
export function profile(p) {
  const mine = songsByCount.filter((s) => s.lyricistId === p.id || s.composerId === p.id);
  const recs = recordings.filter((r) => mine.includes(r.song));
  const partners = new Map();
  for (const s of mine) {
    for (const o of [s.lyricist, s.composer]) {
      if (!o || o.id === p.id) continue;
      const x = partners.get(o.id) ?? { person: o, songs: 0 };
      x.songs++;
      partners.set(o.id, x);
    }
  }
  const ys = recs.map((r) => r.year).filter(Boolean);
  return {
    songs: mine,
    recordings: recs,
    // "Play all" plays the first recording of each song, in the order the songs are listed.
    queue: mine.map((s) => s.recordings[0]).filter(Boolean),
    active: ys.length ? [Math.min(...ys), Math.max(...ys)] : null,
    partners: [...partners.values()].sort((a, b) => b.songs - a.songs),
  };
}

export const yearsOf = (s) => s.recordings.map((r) => r.year).filter(Boolean);
