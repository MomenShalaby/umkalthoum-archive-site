// Checks that every recording's archive.org link still answers (and supports Range, which seeking needs).
// Usage: npm run check-links   (exits 1 when a link is dead, so it can run in CI before a deploy)
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync(new URL('../data/archive.json', import.meta.url), 'utf8'));
const todo = data.recordings.map((r) => ({ id: r.id, url: r.src }));
const bad = [];
let done = 0;

async function check({ id, url }) {
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-0' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    await res.body?.cancel();
    const ranged = res.status === 206 || res.headers.get('accept-ranges') === 'bytes';
    if (!res.ok) bad.push(`${id}: HTTP ${res.status} ${url}`);
    else if (!ranged) bad.push(`${id}: no Range support (seeking will fail) ${url}`);
  } catch (e) {
    bad.push(`${id}: ${e.message} ${url}`);
  }
  if (++done % 25 === 0) console.log(`${done}/${todo.length}`);
}

const workers = Array.from({ length: 4 }, async () => {
  for (let job = todo.shift(); job; job = todo.shift()) await check(job);
});
await Promise.all(workers);

console.log(bad.length ? `\n${bad.length} problem(s):\n${bad.join('\n')}` : `\nAll ${done} links answer with Range support.`);
process.exitCode = bad.length ? 1 : 0;
