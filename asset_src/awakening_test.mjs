// Test Przebudzeń i kalibracji Prób (Node): node asset_src/awakening_test.mjs
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = v; }, removeItem(k) { delete this._s[k]; } };
const G = await import('../src/core/game.js');
const F = await import('../src/core/formulas.js');
const { simulate } = await import('../src/core/combat.js');
const { CLASS_ORDER, TALENTS, TALENT_MAX } = await import('../src/data/classes.js');
const { SLOTS } = await import('../src/data/items.js');
const { AWAKEN_LEVELS, TRIALS, AWAKENINGS } = await import('../src/data/awakening.js');
let fails = 0;
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); fails++; process.exitCode = 1; } };

// profile ekwipunku: [rzadkość broni, rzadkość reszty, ulepszenie]
const GEAR = { avg: (L) => [2, 1, Math.floor(L / 15)], good: () => [3, 3, 8], max: () => [4, 4, 10] };
function setup(cls, k, prof) {
  G.wipe(); G.newPlayer({ name: `T${cls}${k}${prof}`, cls, look: 0, hue: 0, aura: 0 });
  const P = G.P;
  P.awak = k;
  const L = AWAKEN_LEVELS[k];
  while (P.lvl < L) { P.exp = F.expNext(P.lvl); G.addExp(0); }
  for (const t of TALENTS) P.talents[t.id] = TALENT_MAX;
  const [rw, ro, up] = GEAR[prof](L);
  for (const s of SLOTS) { const it = F.genItem({ lvl: L, rarity: s === 'weapon' ? rw : ro, cls, slot: s }); it.up = up; P.equip[s] = it; }
  P.trial = null;
  return P;
}
function runTrial(P, k) {
  const t = G.ensureTrial();
  const maxHp = t.maxHp;
  let attacks = 0, losses = 0, evs = 0, maxEv = 0, last = null;
  while (P.awak === k && attacks < 300) {
    if (G.trialAttemptsLeft() <= 0) P.trial.attempts = 0; // kolejny dzień
    const spec = G.trialAttack();
    attacks++;
    if (!(spec.sim.winner === 0 && !spec.sim.timeout)) losses++; // boss nie zginął w tej walce
    evs += spec.sim.events.length; maxEv = Math.max(maxEv, spec.sim.events.length);
    last = spec;
  }
  return { days: Math.ceil(attacks / 3), attacks, lossPct: Math.round((losses / attacks) * 100), avgEv: Math.round(evs / attacks), maxEv, maxHp, last };
}

// 1) blokada EXP na progu i odblokowanie po Przebudzeniu
{
  const P = setup('warrior', 0, 'avg');
  assert(P.lvl === 100 && G.expBlocked(), 'poziom 100 bez Przebudzenia = próg');
  G.addExp(F.expNext(100) * 50);
  assert(P.lvl === 100 && P.exp === F.expNext(100), 'EXP zatrzymuje się na pełnym pasku (lvl ' + P.lvl + ', exp ' + P.exp + ')');
  assert(G.trialUnlocked() && G.nextAwakening() === 0, 'Próba I odblokowana na 100 poziomie');
  const r = runTrial(P, 0);
  assert(P.awak === 1 && r.last.rew.awakened && r.last.rew.awakened.roman === 'I', 'pokonanie bossa daje Przebudzenie I');
  assert(P.lvl === 101, 'zgromadzone EXP przechodzi na poziom 101 po Przebudzeniu (lvl ' + P.lvl + ')');
  assert(F.levelCap(P) === 110 && !G.expBlocked(), 'limit poziomu rośnie do 110');
  assert(r.last.rew.items.length === 1 && r.last.rew.items[0].rarity === 4 && r.last.rew.cr === TRIALS[0].cr, 'nagroda: legendarny łup + kryształy');
  assert(P.trial === null && G.nextAwakening() === 1 && !G.trialUnlocked(), 'Próba II zablokowana do 110 poziomu');
}
// 2) dzienny limit ataków
{
  const P = setup('mage', 1, 'good');
  G.ensureTrial();
  for (let i = 0; i < 3; i++) assert(G.trialAttack(), 'atak ' + (i + 1) + '/3 dozwolony');
  assert(G.trialAttemptsLeft() === 0 && G.trialAttack() === null, 'czwarty atak tego samego dnia zablokowany');
  P.trial.day = 'wczoraj';
  assert(G.trialAttemptsLeft() === 3, 'ataki odnawiają się następnego dnia');
}
// 3) umiejętności przebudzenia działają w walce (okresowe ciosy pojawiają się w zdarzeniach)
for (const cls of CLASS_ORDER) {
  const name = AWAKENINGS[cls][1].name;
  let seen = 0, P;
  for (let i = 0; i < 6; i++) {
    P = setup(cls, 2, 'good'); // świeży losowy zestaw na każdą walkę
    if (simulate(F.playerFighter(P), G.trialBossFighter(2, 0)).events.some((e) => e.skill === name)) seen++;
  }
  assert(seen >= 4, `${cls}: „${name}” używane w walce (${seen}/6)`);
  const f = F.playerFighter(P);
  assert(f.aw && f.aw.periodic.length === 1, `${cls}: efekty przebudzenia nałożone na walczącego`);
}
// 4) kalibracja: kilka dni na każdą Próbę dla każdej klasy
const rows = [];
for (const cls of CLASS_ORDER) {
  for (let k = 0; k < AWAKEN_LEVELS.length; k++) {
    const res = {};
    for (const prof of ['avg', 'max']) res[prof] = runTrial(setup(cls, k, prof), k);
    // ekwipunek jest losowany – „dobry” profil oceniamy medianą z 3 niezależnych zestawów
    const goods = [0, 1, 2].map(() => runTrial(setup(cls, k, 'good'), k)).sort((a, b) => a.days - b.days);
    res.good = goods[1];
    const T = TRIALS[k];
    rows.push(`${cls.padEnd(8)} ${String(AWAKEN_LEVELS[k]).padEnd(4)} cel ${T.days}d | śr ${res.avg.days}d  dobry ${res.good.days}d  max ${res.max.days}d | zdarzenia śr ${res.good.avgEv} max ${res.good.maxEv} | PŻ ${Math.round(res.good.maxHp).toLocaleString('pl-PL')}`);
    assert(res.good.days >= T.days - 1 && res.good.days <= T.days + 2, `${cls} Próba ${k + 1}: dobry ekwipunek ${res.good.days} dni (cel ${T.days})`);
    assert(res.avg.days >= T.days, `${cls} Próba ${k + 1}: przeciętny ekwipunek ≥ ${T.days} dni (${res.avg.days})`);
    assert(res.max.days >= 2, `${cls} Próba ${k + 1}: nawet maksymalny ekwipunek ≥ 2 dni (${res.max.days})`);
    assert(res.max.lossPct === 100, `${cls} Próba ${k + 1}: boss nigdy nie ginie w pojedynczej walce (${res.max.lossPct}%)`);
    assert(res.good.avgEv <= 70, `${cls} Próba ${k + 1}: walka nie jest za długa (${res.good.avgEv} zdarzeń)`);
  }
}
console.log(rows.join('\n'));
// 5) komplet Przebudzeń → skórka i poziom 150
{
  const P = setup('paladin', 5, 'max');
  const r = runTrial(P, 5);
  assert(P.awak === 6 && P.skinsOwned.includes('awakened') && r.last.rew.skin === 'awakened', 'VI Przebudzenie daje skórkę „Przebudzony”');
  assert(P.lvl === 150 && !G.expBlocked() && G.nextAwakening() === null, 'poziom 150 i brak dalszych Prób');
}
console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystkie testy Przebudzeń OK');
