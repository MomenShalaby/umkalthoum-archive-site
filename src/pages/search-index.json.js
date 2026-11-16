import { people, songs, venues, collections, recordings } from '../lib/archive.js';
import { normalize } from '../lib/arabic.js';

// Everything the search page matches against, normalised once at build time.
export function GET() {
  const count = (col, id) => recordings.filter((r) => r[col]?.id === id).length;
  const body = {
    people: people.filter((p) => p.slug).map((p) => ({
      slug: p.slug, name: p.name, search: p.search, role: p.roleLabel, photo: p.photo, initial: p.initial,
    })),
    songs: songs.map((s) => ({
      slug: s.slug, title: s.title, search: s.search, count: s.recordingsCount, lyrics: s.lyrics, lyricsSearch: s.lyricsSearch,
      lyricistSearch: s.lyricist?.search ?? null, composerSearch: s.composer?.search ?? null,
      credits: [s.lyricist ? `كلمات ${s.lyricist.name}` : null, s.composer ? `ألحان ${s.composer.name}` : null].filter(Boolean).join('، '),
    })),
    venues: venues.map((v) => ({ slug: v.slug, name: v.name, search: normalize(v.name), count: count('venue', v.id) })).filter((v) => v.count),
    collections: collections.map((c) => ({ slug: c.slug, name: c.name, search: normalize(c.name), count: count('collection', c.id) })).filter((c) => c.count),
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}
