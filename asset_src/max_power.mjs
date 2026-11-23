// Maksymalna realna siła postaci na poziomie L (mityczny ekwipunek +10, pełne talenty, pet mityczny 10 poz., 6 Przebudzeń)
// → dopasowanie krzywej limitu używanej przez serwer (fho_max_power) i klienta (maxPowerFor)
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = v; }, removeItem(k) { delete this._s[k]; } };
const F = await import('../src/core/formulas.js');
const { TALENTS, TALENT_MAX, STATS, CLASS_ORDER } = await import('../src/data/classes.js');
const { SLOTS } = await import('../src/data/items.js');
const { rng } = await import('../src/core/util.js');
const rows = [];
for (const L of [1, 5, 10, 20, 50, 100, 150, 200, 300, 500, 1000, 2000]) {
  let best = 0;
  for (const cls of CLASS_ORDER) {
    for (let seed = 0; seed < 6; seed++) {
      const rnd = rng('maxp' + cls + L + seed);
      const pts = (L - 1) * 4;
      const alloc = Object.fromEntries(STATS.map((s) => [s, 0]));
      alloc[F.levelCap ? 'con' : 'con'] += pts / 4; alloc.lck += pts / 4;
      const main = { warrior: 'str', mage: 'int', archer: 'dex', assassin: 'dex', paladin: 'str' }[cls];
      alloc[main] += pts / 2;
      const equip = {};
      for (const s of SLOTS) { const it = F.genItem({ lvl: L, rarity: 5, cls, slot: s, rnd }); it.up = 10; equip[s] = it; }
      const p = { cls, lvl: L, awak: L >= 150 ? 6 : 0, alloc, talents: Object.fromEntries(TALENTS.map((t) => [t.id, TALENT_MAX])), equip, pets: { active: 'unicorn', owned: { unicorn: 10 } }, guildBonus: 15 };
      best = Math.max(best, F.playerPower(p));
    }
  }
  rows.push([L, best]);
}
for (const [L, p] of rows) console.log(String(L).padStart(5), String(p).padStart(12), '  limit 3×:', Math.round(p * 3), '  formuła:', Math.round(3000 + 260 * Math.pow(L, 1.85)));
