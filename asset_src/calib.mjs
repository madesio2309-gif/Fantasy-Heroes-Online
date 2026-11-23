globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = v; }, removeItem(k) { delete this._s[k]; } };
const G = await import('../src/core/game.js');
const F = await import('../src/core/formulas.js');
const { CLASS_ORDER } = await import('../src/data/classes.js');
const out = {};
for (const cls of CLASS_ORDER) {
  G.wipe(); G.newPlayer({ name: 'Cal' + cls, cls, look: 0, hue: 0, aura: 0 });
  const P = G.P;
  for (const L of [1, 5, 10, 20, 30, 50, 70, 100]) {
    while (P.lvl < L) { P.exp = F.expNext(P.lvl); G.addExp(0); }
    for (const s of ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'ring', 'amulet']) { const it = F.genItem({ lvl: L, rarity: s === 'weapon' ? 2 : 1, cls, slot: s }); it.up = Math.floor(L / 15); P.equip[s] = it; }
    const s = F.calcStats(P);
    (out[L] ||= []).push({ cls, hp: s.hp, dmg: Math.round((s.dmgMin + s.dmgMax) / 2), armor: s.armor, pow: F.powerOf(s) });
  }
}
for (const L in out) {
  const a = out[L];
  const avg = (k) => Math.round(a.reduce((x, y) => x + y[k], 0) / a.length);
  const r = F.refStats(+L, 1);
  console.log(`L${L}: hp ${avg('hp')} (ref ${r.hp}) dmg ${avg('dmg')} (ref ${Math.round(r.dmg)}) armor ${avg('armor')} (ref ${r.armor}) | ` + a.map((x) => `${x.cls[0]}:${x.pow}`).join(' '));
}
