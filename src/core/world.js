// Wspólny świat gry: ligi areny i harmonogram bossa światowego (bez botów – grają wyłącznie prawdziwi gracze)
import { weekIndex, weekEnd, clamp } from './util.js';

// ——— Ligi areny ———
export const LEAGUES = [
  { name: 'Brąz', min: 0, color: '#c07a45', reward: 20 },
  { name: 'Srebro', min: 1100, color: '#c9d1d9', reward: 40 },
  { name: 'Złoto', min: 1300, color: '#ffc93c', reward: 80 },
  { name: 'Platyna', min: 1550, color: '#6fe0d6', reward: 120 },
  { name: 'Diament', min: 1800, color: '#7fb2ff', reward: 180 },
  { name: 'Mistrz', min: 2100, color: '#d48cff', reward: 260 },
];
export const leagueOf = (rating) => { let l = 0; LEAGUES.forEach((x, i) => { if (rating >= x.min) l = i; }); return l; };

// ——— Boss światowy (tygodniowy; pula PŻ zależy od aktywnych graczy – patrz game.wbMaxHp) ———
export function worldBossInfo(t = Date.now()) {
  const w = weekIndex(t);
  const bossIdx = (w % 10 + 10) % 10;
  const wkEnd = weekEnd(t);
  const wkStart = wkEnd - 7 * 86400000;
  const frac = clamp((t - wkStart) / (7 * 86400000), 0, 1);
  return { week: w, bossIdx, frac, ends: wkEnd };
}
