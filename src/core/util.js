// Deterministyczny RNG (mulberry32) + pomocnicze
export function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
export function rng(seed) {
  let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
  const f = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = (min, max) => Math.floor(f() * (max - min + 1)) + min;
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.range = (min, max) => min + f() * (max - min);
  f.chance = (p) => f() < p;
  return f;
}
export const R = rng(Date.now() ^ (Math.random() * 1e9));

export const DAY_MS = 86400000;
export function dayKey(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
export function dayIndex(t = Date.now()) {
  const d = new Date(t);
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / DAY_MS);
}
// tydzień zaczyna się w poniedziałek
export function weekIndex(t = Date.now()) {
  return Math.floor((dayIndex(t) + 3) / 7);
}
export function weekEnd(t = Date.now()) {
  const wi = weekIndex(t);
  const startDay = wi * 7 - 3 + 7; // pierwszy dzień następnego tygodnia (UTC day index)
  const d = new Date(startDay * DAY_MS);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime();
}
export function nextMidnight(t = Date.now()) {
  const d = new Date(t); d.setHours(24, 0, 0, 0); return d.getTime();
}
export function fmtTime(ms) {
  ms = Math.max(0, ms);
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}g ${String(m).padStart(2, '0')}m`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
export function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + ' mld';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + ' mln';
  if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + ' tys.';
  return n.toLocaleString('pl-PL');
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
