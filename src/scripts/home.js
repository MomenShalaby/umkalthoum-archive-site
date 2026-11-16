import { songs as songsLabel, recordings as recordingsLabel } from '../lib/arabic.js';

/**
 * Filters, sorting and the year chart on the home page. The song list is rendered once at build time;
 * this only hides, reorders and recolours it, and keeps the choices in the address (?composer=…&sort=…)
 * so a filtered list can be linked to.
 */
export function initHome() {
  const root = document.getElementById('home');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';

  const list = root.querySelector('ol.songs');
  const rows = [...list.children].map((el) => ({
    el,
    composer: el.dataset.composer,
    lyricist: el.dataset.lyricist,
    years: el.dataset.years ? el.dataset.years.split(',').map(Number) : [],
    lyrics: el.dataset.lyrics === '1',
    count: Number(el.dataset.count),
    title: el.dataset.title,
  }));
  for (const r of rows) r.first = r.years.length ? Math.min(...r.years) : Infinity;

  const form = root.querySelector('form.filters');
  const bars = [...root.querySelectorAll('.year[data-year]')];
  const sortLinks = [...root.querySelectorAll('[data-sort]')];
  const $ = (sel) => root.querySelector(sel);

  const readUrl = () => {
    const q = new URLSearchParams(location.search);
    const decade = Number(q.get('decade')) ? Math.floor(Number(q.get('decade')) / 10) * 10 : 0;
    return {
      composer: q.get('composer') || '',
      lyricist: q.get('lyricist') || '',
      decade,
      year: decade ? 0 : Number(q.get('year')) || 0,
      lyrics: q.get('lyrics') === '1',
      sort: ['title', 'year'].includes(q.get('sort')) ? q.get('sort') : 'count',
    };
  };

  let state = readUrl();

  const writeUrl = (replace = false) => {
    const q = new URLSearchParams();
    if (state.composer) q.set('composer', state.composer);
    if (state.lyricist) q.set('lyricist', state.lyricist);
    if (state.decade) q.set('decade', state.decade);
    if (state.year) q.set('year', state.year);
    if (state.lyrics) q.set('lyrics', '1');
    if (state.sort !== 'count') q.set('sort', state.sort);
    const url = location.pathname + (q.size ? `?${q}` : '');
    history[replace ? 'replaceState' : 'pushState'](history.state, '', url);
  };

  const render = () => {
    const credited = (r) => (!state.composer || r.composer === state.composer) && (!state.lyricist || r.lyricist === state.lyricist);
    const inYears = (r) => {
      if (state.year) return r.years.includes(state.year);
      if (state.decade) return r.years.some((y) => y >= state.decade && y < state.decade + 10);
      return true;
    };
    const shown = rows.filter((r) => credited(r) && inYears(r) && (!state.lyrics || r.lyrics));

    const by = {
      count: (a, b) => b.count - a.count || a.title.localeCompare(b.title),
      title: (a, b) => a.title.localeCompare(b.title),
      // Songs with no known year sort last; Infinity - Infinity would be NaN, so compare explicitly.
      year: (a, b) => (a.first === b.first ? 0 : a.first < b.first ? -1 : 1) || a.title.localeCompare(b.title),
    }[state.sort];
    // Reordering moves the existing elements, so nothing is rebuilt.
    const order = [...rows].sort(by);
    const frag = document.createDocumentFragment();
    for (const r of order) {
      r.el.hidden = !shown.includes(r);
      frag.append(r.el);
    }
    list.append(frag);

    // The chart follows the composer and lyricist choices, showing when those songs were recorded.
    const perYear = new Map();
    for (const r of rows.filter(credited)) for (const y of r.years) perYear.set(y, (perYear.get(y) ?? 0) + 1);
    const max = Math.max(1, ...perYear.values());
    for (const bar of bars) {
      const y = Number(bar.dataset.year);
      const n = perYear.get(y) ?? 0;
      bar.style.setProperty('--h', `${Math.round((n / max) * 100)}%`);
      bar.classList.toggle('is-empty', !n);
      bar.classList.toggle('is-active', state.year === y);
      const label = n ? `${y}: ${recordingsLabel(n)}` : `${y}`;
      bar.title = label;
      bar.setAttribute('aria-label', label);
    }

    const filtered = state.composer || state.lyricist || state.decade || state.year || state.lyrics;
    $('[data-count]').textContent = songsLabel(shown.length);
    root.querySelectorAll('[data-clear]').forEach((a) => { a.hidden = !filtered; a.href = state.sort === 'count' ? location.pathname : `${location.pathname}?sort=${state.sort}`; });
    $('[data-empty]').hidden = shown.length > 0;
    list.hidden = shown.length === 0;

    $('[data-note-all]').hidden = !!state.year;
    $('[data-note-year]').hidden = !state.year;
    $('[data-clear-year]').hidden = !state.year;
    $('[data-year-label]').textContent = state.year || '';

    form.elements.composer.value = state.composer;
    form.elements.lyricist.value = state.lyricist;
    form.elements.decade.value = state.decade || '';
    if (form.elements.lyrics) form.elements.lyrics.checked = state.lyrics;
    for (const a of sortLinks) a.toggleAttribute('aria-current', a.dataset.sort === state.sort);
  };

  const update = (patch, { replace = false } = {}) => {
    state = { ...state, ...patch };
    // A decade picked in the form replaces a year picked on the chart, and the other way round.
    if (patch.decade) state.year = 0;
    if (patch.year) state.decade = 0;
    writeUrl(replace);
    render();
  };

  form.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'lyrics') update({ lyrics: t.checked });
    else if (t.name === 'decade') update({ decade: Number(t.value) || 0 });
    else update({ [t.name]: t.value });
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  root.querySelector('.years-bars').addEventListener('click', (e) => {
    const bar = e.target.closest('.year[data-year]');
    if (!bar) return;
    e.preventDefault();
    const y = Number(bar.dataset.year);
    update({ year: state.year === y ? 0 : y });
  });
  root.querySelector('[data-clear-year]').addEventListener('click', (e) => { e.preventDefault(); update({ year: 0 }); });
  root.querySelectorAll('[data-clear]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    update({ composer: '', lyricist: '', decade: 0, year: 0, lyrics: false });
  }));
  sortLinks.forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); update({ sort: a.dataset.sort }); }));

  window.addEventListener('popstate', () => {
    if (!document.getElementById('home')) return;
    state = readUrl();
    render();
  });

  render();
}
