// Szybki test balansu (Node): node asset_src/balance_test.mjs
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = v; }, removeItem(k) { delete this._s[k]; } };
const G = await import('../src/core/game.js');
const { simulate } = await import('../src/core/combat.js');
const F = await import('../src/core/formulas.js');
const { DUNGEONS } = await import('../src/data/enemies.js');
const { CLASS_ORDER } = await import('../src/data/classes.js');

// 1) Świeża postać: pierwsze przygody i arena
for (const cls of CLASS_ORDER) {
  G.wipe(); G.newPlayer({ name: 'New' + cls, cls, look: 0, hue: 0, aura: 0 });
  let w = 0, ev = 0;
  for (let i = 0; i < 40; i++) { const o = G.P.quest.offers[i % 3]; const s = simulate(F.playerFighter(G.P), G.questEnemy(o)); if (s.winner === 0) w++; ev += s.events.length; }
  // arena: rywal = kopia innej świeżej postaci (świat bez botów)
  let aw = 0; const rival = F.playerFighter({ ...G.P, name: 'Rywal' });
  for (let i = 0; i < 30; i++) if (simulate(F.playerFighter(G.P), { ...rival, hp: rival.maxHp }).winner === 0) aw++;
  console.log(`${cls.padEnd(9)} start: quest win ${Math.round(w / 40 * 100)}% ev ${Math.round(ev / 40)} | arena (lustro) win ${Math.round(aw / 30 * 100)}% | power ${G.power()}`);
}
// 2) Bossowie lochów na poziomie bossa (ekwipunek niezwykły/rzadki)
for (const cls of CLASS_ORDER) {
  G.wipe(); G.newPlayer({ name: 'Boss' + cls, cls, look: 0, hue: 0, aura: 0 });
  const P = G.P; const out = [];
  for (const d of [0, 3, 6, 9]) {
    const L = DUNGEONS[d].reqLvl + 10;
    while (P.lvl < L) { P.exp = F.expNext(P.lvl); G.addExp(0); }
    for (const s of ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'ring', 'amulet']) { const it = F.genItem({ lvl: L, rarity: s === 'weapon' ? 2 : 1, cls, slot: s }); it.up = Math.floor(L / 15); P.equip[s] = it; }
    let bw = 0, fw = 0, ev = 0;
    for (let i = 0; i < 40; i++) {
      const sb = simulate(F.playerFighter(P), G.dungeonEnemy(d, 10).B); if (sb.winner === 0) bw++; ev += sb.events.length;
      if (simulate(F.playerFighter(P), G.dungeonEnemy(d, 9).B).winner === 0) fw++;
    }
    out.push(`d${d}@L${L}: floor9 ${Math.round(fw / 40 * 100)}% boss ${Math.round(bw / 40 * 100)}% ev ${Math.round(ev / 40)}`);
  }
  console.log(cls.padEnd(9), out.join(' | '));
}
G.wipe(); G.newPlayer({ name: 'Flow', cls: 'mage', look: 0, hue: 0, aura: 0 });
G.startQuest(0); G.P.quest.active.end = Date.now() - 1;
const q = G.questBattle();
console.log('first quest win', q.win, JSON.stringify(q.rew), 'lvl', G.P.lvl, 'events', q.sim.events.length);
const wb = G.wbAttack(); console.log('wb dmg', wb?.rew.dmg, 'events', wb?.sim.events.length);
const ch = G.challengeBattle(0); console.log('challenge', ch?.title, ch?.win);
const db = G.dungeonBattle(0); console.log('dungeon f1', db?.win, db?.sim.events.length);
