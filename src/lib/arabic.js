// Port of App\Support\Arabic and App\Support\Lyrics. Also imported by the browser scripts (search, filters).

/** Strip diacritics, unify hamza/ya/ta-marbuta, Arabic digits to ASCII, punctuation to spaces. */
export function normalize(s) {
  return String(s ?? '')
    .replace(/ /g, ' ')
    .replace(/[ً-ٰٟـ‎‏]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ىةؤئ]/g, (c) => ({ 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي' })[c])
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))
    .replace(/[-–—_/\\|()[\]{}"'،,.:؛;!؟?*~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Arabic number agreement: 1, 2, 3-10, 11+ take different forms. */
function plural(n, one, two, few, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

export const recordings = (n) => plural(n, 'تسجيل واحد', 'تسجيلان', 'تسجيلات', 'تسجيلًا');
export const songs = (n) => plural(n, 'أغنية واحدة', 'أغنيتان', 'أغانٍ', 'أغنية');

/** 1950 => "الخمسينيات". */
export function decade(d) {
  return (
    {
      1900: 'العقد الأول من القرن', 1910: 'العقد الثاني من القرن', 1920: 'العشرينيات', 1930: 'الثلاثينيات',
      1940: 'الأربعينيات', 1950: 'الخمسينيات', 1960: 'الستينيات', 1970: 'السبعينيات',
    }[d] ?? `${d}s`
  );
}

/** "3:07:15" or "47:02" from seconds; null when unknown. */
export function duration(seconds) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Stanzas of verses; each verse is one line, or two halves (split at " | "). */
export function stanzas(text) {
  if (!text) return [];
  const verse = (line) => {
    const i = line.indexOf('|');
    return i < 0 ? [line.trim()] : [line.slice(0, i).trim(), line.slice(i + 1).trim()];
  };
  return text.split('\n\n').map((stanza) => stanza.split('\n').map(verse));
}

/** The first line containing the term, ignoring hamza forms and diacritics; halves joined by "…". */
export function lineMatching(text, term) {
  const needle = normalize(term);
  if (!text || !needle) return null;
  for (const line of text.split('\n')) {
    if (line && normalize(line).includes(needle)) return line.replace(' | ', ' … ');
  }
  return null;
}
