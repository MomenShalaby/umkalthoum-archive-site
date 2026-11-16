import { url } from '../lib/url.js';
import { normalize, songs as songsLabel, recordings as recordingsLabel, lineMatching } from '../lib/arabic.js';

let indexPromise;
const loadIndex = () => (indexPromise ??= fetch(url('/search-index.json')).then((r) => r.json()));

const el = (tag, attrs = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) node.append(kid);
  return node;
};

const portrait = (p) => (p.photo
  ? el('img', { class: 'portrait portrait-sm', src: url(`/${p.photo}`), alt: '', loading: 'lazy' })
  : el('span', { class: 'portrait portrait-sm is-initial', 'aria-hidden': 'true' }, p.initial));

function songRow(s, q) {
  const snippet = lineMatching(s.lyrics, q);
  return el('li', {},
    el('a', { class: 'song-row is-plain', href: url(`/songs/${s.slug}/`) },
      el('span', {},
        el('span', { class: 'song-title' }, s.title),
        s.credits ? el('span', { class: 'song-by' }, s.credits) : null,
        snippet ? el('span', { class: 'song-snippet' }, `«${snippet}»`) : null),
      el('span', { class: 'song-count', title: 'عدد التسجيلات' }, String(s.count))));
}

const factList = (items, base) => el('ul', { class: 'facts', style: 'list-style:none;padding:0;grid-template-columns:1fr' },
  items.map((x) => el('li', {}, el('a', { href: url(`/${base}/${x.slug}/`) }, x.name), ' ', el('span', { class: 'meta-line' }, String(x.count)))));

/** Fills #search-results from ?q= using the build-time index (search-index.json). */
export async function initSearch() {
  const root = document.getElementById('search-results');
  if (!root) return;
  const q = (new URLSearchParams(location.search).get('q') || '').trim();
  document.querySelectorAll('.search input[name=q]').forEach((i) => { i.value = q; });
  document.title = `${q ? `بحث: ${q}` : 'بحث'} — ${document.title.split(' — ').pop()}`;

  const h1 = el('h1', { style: 'font-size:clamp(2rem,5vw,3rem);color:var(--teal)' }, q ? `نتائج «${q}»` : 'بحث');
  root.replaceChildren(h1);
  if (!q) {
    root.append(el('p', { class: 'empty' }, 'اكتب اسم أغنية أو مكان تسجيل أو ملحّنًا أو شاعرًا في خانة البحث. التشكيل واختلاف الهمزات لا يؤثران على النتيجة.'));
    return;
  }

  const index = await loadIndex();
  const n = normalize(q);
  const has = (hay) => hay && hay.includes(n);

  const people = index.people.filter((p) => has(p.search));
  const songs = index.songs
    .filter((s) => has(s.search) || has(s.lyricsSearch) || has(s.lyricistSearch) || has(s.composerSearch))
    .sort((a, b) => b.count - a.count);
  const venues = index.venues.filter((v) => has(v.search));
  const collections = index.collections.filter((c) => has(c.search));

  if (!people.length && !songs.length && !venues.length && !collections.length) {
    root.append(el('p', { class: 'empty' }, el('strong', {}, `لا نتائج لـ«${q}».`), ' جرّب كلمة أقصر، أو جزءًا من الاسم، أو ', el('a', { href: url('/') }, 'تصفّح كل الأغاني'), '.'));
    return;
  }
  if (people.length) {
    root.append(el('h2', {}, 'ملحّنون وشعراء'), el('ul', { class: 'partners' },
      people.map((p) => el('li', {}, el('a', { href: url(`/people/${p.slug}/`) }, portrait(p), el('span', {}, p.name)), ' ', el('span', { class: 'meta-line' }, p.role)))));
  }
  if (songs.length) root.append(el('h2', {}, 'أغانٍ'), el('ol', { class: 'songs' }, songs.map((s) => songRow(s, q))));
  if (venues.length) root.append(el('h2', {}, 'أماكن'), factList(venues, 'venues'));
  if (collections.length) root.append(el('h2', {}, 'مجموعات'), factList(collections, 'collections'));
}

export { songsLabel, recordingsLabel };
