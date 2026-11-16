/**
 * Persistent audio player.
 *
 * The <audio> element lives in JS, not in the page, so Turbo page visits never touch it.
 * Rows on any page start playback with `[data-play]` inside a `[data-track]` item; the queue is
 * every `[data-track]` inside the nearest `[data-queue]` container, in page order.
 */

import { loadLyrics } from '../lib/lyrics.js';

const KEY = 'uk-player.v1';
const SKIP = 10;

const read = () => {
    try {
        return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch {
        return {};
    }
};
const write = (patch) => {
    try {
        localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch }));
    } catch {
        /* storage unavailable (private window): the player still works, it just forgets */
    }
};

export function registerPlayer(Alpine) {
    const audio = new Audio();
    audio.preload = 'metadata';

    const player = {
        queue: [],
        index: -1,
        current: null,
        playing: false,
        time: 0,
        duration: 0,
        volume: 1,
        failed: false,

        // The expanded "now playing" view: a lyrics tab and the queue.
        expanded: false,
        tab: 'lyrics',
        lyrics: { status: 'idle', text: '', label: '' }, // status: idle | loading | found | none | error

        init() {
            const saved = read();
            this.volume = typeof saved.volume === 'number' ? saved.volume : 1;
            audio.volume = this.volume;

            if (saved.track) {
                // Come back where the listener left off, paused.
                this.queue = [saved.track];
                this.index = 0;
                this.current = saved.track;
                this.duration = saved.track.duration || 0;
                this.time = saved.time || 0;
                audio.src = saved.track.src;
                audio.addEventListener('loadedmetadata', () => { audio.currentTime = this.time; }, { once: true });
                this.mediaSession();
            }

            audio.addEventListener('play', () => { this.playing = true; this.failed = false; this.changed(); });
            audio.addEventListener('pause', () => { this.playing = false; write({ time: audio.currentTime }); this.changed(); });
            audio.addEventListener('ended', () => this.next(true));
            audio.addEventListener('loadedmetadata', () => { if (isFinite(audio.duration)) this.duration = audio.duration; });
            audio.addEventListener('error', () => { this.failed = true; this.playing = false; this.changed(); });
            let last = 0;
            audio.addEventListener('timeupdate', () => {
                this.time = audio.currentTime;
                if (Date.now() - last > 3000) { last = Date.now(); write({ time: audio.currentTime }); }
            });

            document.addEventListener('click', (e) => this.onClick(e));
            document.addEventListener('keydown', (e) => this.onKey(e));
            document.addEventListener('turbo:load', () => this.changed());
            document.addEventListener('turbo:render', () => this.changed());
            this.changed();
        },

        // ---- starting playback from the page ------------------------------------------------
        onClick(e) {
            const btn = e.target.closest('[data-play], [data-play-all]');
            if (!btn) return;
            e.preventDefault();
            const scope = btn.closest('[data-queue]') || document;
            const items = [...scope.querySelectorAll('[data-track]')];
            const queue = items.map((el) => JSON.parse(el.dataset.track));
            if (!queue.length) return;

            const row = btn.closest('[data-track]');
            // A button outside any row (page-level "listen") names its track with data-track-id.
            const id = row ? JSON.parse(row.dataset.track).id : btn.dataset.trackId ? Number(btn.dataset.trackId) : queue[0].id;
            if (this.current && this.current.id === id) return this.toggle();
            this.load(queue, Math.max(0, queue.findIndex((t) => t.id === id)));
        },

        load(queue, index) {
            this.queue = queue;
            this.index = index;
            this.current = queue[index];
            this.time = 0;
            this.duration = this.current.duration || 0;
            this.failed = false;
            audio.src = this.current.src;
            write({ track: this.current, time: 0 });
            this.refreshLyrics();
            this.mediaSession();
            audio.play().catch(() => { this.playing = false; });
        },

        // ---- transport ---------------------------------------------------------------------
        toggle() {
            if (!this.current) return;
            if (audio.paused) audio.play().catch(() => {}); else audio.pause();
        },
        skip(seconds) {
            if (!this.current) return;
            this.seek(audio.currentTime + seconds);
        },
        seek(seconds) {
            const max = isFinite(audio.duration) ? audio.duration : this.duration;
            audio.currentTime = Math.min(Math.max(0, seconds), max || 0);
            this.time = audio.currentTime;
        },
        seekFraction(f) {
            this.seek((this.duration || 0) * f);
        },
        next(auto = false) {
            if (this.index < this.queue.length - 1) return this.load(this.queue, this.index + 1);
            if (auto) { this.playing = false; this.changed(); }
        },
        previous() {
            // Like most players: first press restarts, a second quick press goes back.
            if (audio.currentTime > 3 || this.index <= 0) return this.seek(0);
            this.load(this.queue, this.index - 1);
        },
        setVolume(v) {
            this.volume = Math.min(1, Math.max(0, v));
            audio.volume = this.volume;
            write({ volume: this.volume });
        },

        // ---- expanded view and lyrics ------------------------------------------------------
        open() {
            if (!this.current) return;
            this.expanded = true;
            document.body.classList.add('np-open');
            this.refreshLyrics();
        },
        close() {
            this.expanded = false;
            document.body.classList.remove('np-open');
        },
        setTab(tab) {
            this.tab = tab;
            if (tab === 'lyrics') this.refreshLyrics();
        },
        /** Start playing another item of the current queue. */
        jump(i) {
            if (i === this.index) return this.toggle();
            this.load(this.queue, i);
        },
        /** Fetch lyrics for the current track, only while someone could be looking at them. */
        async refreshLyrics() {
            const track = this.current;
            if (!track || !this.expanded) return;
            this.lyrics = { status: 'loading', text: '', label: '' };
            try {
                const found = await loadLyrics(track);
                if (track !== this.current) return; // skipped to another track meanwhile
                this.lyrics = found ? { status: 'found', ...found } : { status: 'none', text: '', label: '' };
            } catch {
                if (track === this.current) this.lyrics = { status: 'error', text: '', label: '' };
            }
        },

        // ---- derived values for the template ----------------------------------------------
        get fraction() {
            return this.duration ? Math.min(1, this.time / this.duration) : 0;
        },
        get canPrev() { return this.index > 0; },
        get canNext() { return this.index < this.queue.length - 1; },
        format(s) {
            s = Math.max(0, Math.floor(s || 0));
            const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
            const mm = h ? String(m).padStart(2, '0') : m;
            return (h ? `${h}:` : '') + `${mm}:${String(r).padStart(2, '0')}`;
        },

        // ---- keyboard ----------------------------------------------------------------------
        onKey(e) {
            if (e.ctrlKey || e.metaKey || e.altKey || !this.current) return;
            if (e.key === 'Escape' && this.expanded) return this.close();
            if (e.target.closest('input, textarea, select, [contenteditable], button, a')) {
                // Space on a focused button/link already means "activate" there.
                if (!(e.key === 'ArrowLeft' || e.key === 'ArrowRight') || e.target.closest('input, textarea, select')) return;
            }
            switch (e.key) {
                case ' ': e.preventDefault(); this.toggle(); break;
                case 'ArrowRight': e.preventDefault(); this.skip(SKIP); break;
                case 'ArrowLeft': e.preventDefault(); this.skip(-SKIP); break;
                case 'n': case 'N': this.next(); break;
                case 'p': case 'P': this.previous(); break;
            }
        },

        // ---- page and OS integration -------------------------------------------------------
        /** Mark the playing row on whatever page is showing. */
        changed() {
            const id = this.current?.id;
            document.querySelectorAll('[data-track]').forEach((el) => {
                const mine = id != null && JSON.parse(el.dataset.track).id === id;
                el.classList.toggle('is-current', mine);
                el.classList.toggle('is-playing', mine && this.playing);
            });
            document.body.classList.toggle('has-player', !!this.current);
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused';
        },

        mediaSession() {
            if (!('mediaSession' in navigator) || !this.current) return;
            const t = this.current;
            navigator.mediaSession.metadata = new MediaMetadata({
                title: t.title,
                artist: 'أم كلثوم',
                album: t.meta,
                artwork: t.cover ? [{ src: t.cover, sizes: '512x512' }] : [],
            });
            const set = (a, fn) => { try { navigator.mediaSession.setActionHandler(a, fn); } catch { /* unsupported action */ } };
            set('play', () => this.toggle());
            set('pause', () => this.toggle());
            set('previoustrack', () => this.previous());
            set('nexttrack', () => this.next());
            set('seekbackward', () => this.skip(-SKIP));
            set('seekforward', () => this.skip(SKIP));
            set('seekto', (d) => this.seek(d.seekTime));
        },
    };

    Alpine.store('player', player);
}
