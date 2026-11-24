// Testy aktualizacji 1.8: poziomy bez limitu, Otchłań, Skrzynia Mityczna, pety, koło fortuny, eventy, moderacja, profile innych graczy
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
const G = await import('../src/core/game.js');
const F = await import('../src/core/formulas.js');
const { MYTHIC, RARITIES, SLOTS } = await import('../src/data/items.js');
const { PETS, PET_MAX_LVL, PET_DUP_CRYSTALS, petBonus } = await import('../src/data/pets.js');
const { cleanText, hasProfanity } = await import('../src/data/moderation.js');
const { itemsFromRow, petFromRow, fighterFromRow } = await import('../src/net/online.js');
const { AWAKEN_LEVELS } = await import('../src/data/awakening.js');
let fails = 0;
const assert = (c, m) => { if (c) console.log('ok  ', m); else { console.error('FAIL:', m); fails++; process.exitCode = 1; } };
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const N = G.Net.Net;
const fresh = (cls = 'warrior') => { G.wipe(); G.newPlayer({ name: 'Test ' + cls, cls, look: 0, hue: 0, aura: 0 }); return G.P; };
const toLevel = (P, L) => { while (P.lvl < L) { P.exp = F.expNext(P.lvl); G.addExp(0); } };

// ——— 1) brak maksymalnego poziomu ———
{
  const P = fresh();
  assert(F.levelCap(P) === 100, 'bez Przebudzeń limit 100');
  P.awak = AWAKEN_LEVELS.length;
  assert(F.levelCap(P) === Infinity && F.MAX_LVL === Infinity, 'po wszystkich Przebudzeniach poziomy bez limitu');
  toLevel(P, 151);
  G.addExp(F.expNext(151) * 3);
  assert(P.lvl > 152 && !G.expBlocked(), `po 150 poziomie EXP dalej daje poziomy (poz. ${P.lvl})`);
  const e = [150, 500, 2000].map(F.expNext);
  assert(e.every((x) => Number.isFinite(x) && x > 0) && e[0] < e[1] && e[1] < e[2], 'expNext rośnie i jest skończone dla wysokich poziomów');
  const it = F.genItem({ lvl: 1500, rarity: 4, cls: 'warrior' });
  assert(it.lvl === 1500, 'przedmioty generują się na poziomach > 150');
}

// ——— 2) Otchłań ———
{
  const P = fresh();
  assert(!G.abyssUnlocked() && G.abyssBattle() === null, 'Otchłań zamknięta przed 100 poziomem');
  toLevel(P, 100);
  assert(G.abyssUnlocked() && P.abyss.keys === G.ABYSS_KEYS && P.abyss.floor === 0, 'od 100 poziomu Otchłań otwarta, 15 kluczy');
  assert(G.abyssSpec(10).boss && !G.abyssSpec(11).boss && G.abyssSpec(2000).L === 1000, 'co 10. piętro boss, piętro 2000 = poziom 1000');
  assert(G.abyssRewards(500).some((r) => r.includes('Wędrowiec')) && G.abyssRewards(2000).some((r) => r.includes('Władca')), 'skórki za 500. i 2000. piętro');
  assert(G.nextAbyssMilestone(1).floor === 10 && G.nextAbyssMilestone(2001) === null, 'kolejny kamień milowy Otchłani');
  for (const s of SLOTS) { const x = F.genItem({ lvl: 110, rarity: 4, cls: 'warrior', slot: s }); x.up = 10; P.equip[s] = x; }
  const before = P.abyss.keys;
  const b = G.abyssBattle();
  assert(b && b.kind === 'abyss' && P.abyss.keys === before - 1, 'walka w Otchłani zużywa klucz');
  assert(!b.win || (P.abyss.floor === 1 && P.abyss.best === 1), 'wygrana przesuwa na kolejne piętro');
  P.abyss.floor = 2000;
  assert(G.abyssBattle() === null, 'po 2000 piętrach Otchłań zakończona');
  P.abyss.floor = 5; P.abyss.keys = 0;
  assert(G.abyssBattle() === null, 'bez kluczy brak walki');
}

// ——— 3) Skrzynia Mityczna: 500 💎, min. legendarny, 20% mityczny ———
{
  const P = fresh('mage');
  assert(G.MYTHIC_CHEST_COST === 500 && G.MYTHIC_CHANCE === 0.2, 'Skrzynia Mityczna: 500 💎, 20% szansy na mityczny');
  P.crystals = 499;
  assert(G.buyMythicChest() === null && P.crystals === 499, 'za mało kryształów – brak zakupu');
  const n = 3000; let myth = 0, low = 0;
  P.crystals = n * G.MYTHIC_CHEST_COST;
  for (let i = 0; i < n; i++) { const it = G.buyMythicChest(); if (it.rarity === MYTHIC) myth++; if (it.rarity < 4) low++; }
  const pct = (myth / n) * 100;
  assert(P.crystals === 0 && low === 0, 'każda skrzynia kosztuje 500 💎 i daje co najmniej legendarny');
  assert(pct > 17 && pct < 23, `szansa na mityczny ≈ 20% (${pct.toFixed(1)}%)`);
  assert(P.bag.length === n && P.stats.mythics === myth, 'legendarne/mityczne nie są sprzedawane automatycznie, licznik mitycznych');
  const m = P.bag.find((x) => x.rarity === MYTHIC);
  const l = F.genItem({ lvl: m.lvl, rarity: 4, cls: 'mage', slot: m.slot });
  assert(RARITIES[MYTHIC].name === 'Mityczny' && m.rarity === MYTHIC, 'rzadkość „Mityczny” istnieje');
  assert(Object.values(m.stats).reduce((a, b) => a + b, 0) > Object.values(l.stats).reduce((a, b) => a + b, 0), 'mityczny ma więcej statystyk niż legendarny');
}

// ——— 4) Pety ———
{
  const P = fresh('archer');
  assert(P.pets.eggs === 1 && !P.pets.active, 'nowa postać dostaje 1 jajo');
  const s0 = F.calcStats(P);
  const r1 = G.hatchEgg(seq([0]));
  assert(r1.isNew && r1.pet.id === PETS[0].id && P.pets.active === PETS[0].id, 'wyklucie: nowy pet staje się aktywny');
  const s1 = F.calcStats(P);
  assert(JSON.stringify(s0) !== JSON.stringify(s1), 'aktywny pet zmienia statystyki (bonus pasywny)');
  assert(G.hatchEgg() === null, 'bez jaj nie da się wykluć');
  P.pets.eggs = 20;
  const r2 = G.hatchEgg(seq([0]));
  assert(r2.up && P.pets.owned[PETS[0].id] === 2, 'duplikat podnosi poziom peta');
  P.pets.owned[PETS[0].id] = PET_MAX_LVL;
  const cr = P.crystals;
  const r3 = G.hatchEgg(seq([0]));
  assert(r3.cr === PET_DUP_CRYSTALS && P.crystals === cr + PET_DUP_CRYSTALS, 'duplikat peta na maks. poziomie → kryształy');
  const last = G.hatchEgg(seq([0.99999]));
  assert(last.pet.id === PETS[PETS.length - 1].id, 'najrzadszy pet na końcu tabeli losowania');
  const b1 = Object.values(petBonus(PETS[0].id, 1))[0], b10 = Object.values(petBonus(PETS[0].id, 10))[0];
  assert(b10 > b1, 'bonus peta rośnie z poziomem');
  G.setActivePet('nieistnieje');
  assert(P.pets.active === PETS[0].id, 'nie można ustawić nieposiadanego peta');
  P.crystals = 250;
  assert(G.buyEgg() && P.crystals === 0, 'jajo w sklepie za 250 💎');
}

// ——— 5) Koło fortuny i eventy administratora ———
{
  const P = fresh('assassin');
  const sat = new Date(2026, 10, 28, 12).getTime(), wed = new Date(2026, 10, 25, 12).getTime();
  assert(G.wheelActive(sat) && !G.wheelActive(wed), 'koło działa w weekend, nie w tygodniu (bez eventu)');
  assert(G.wheelOpensIn(wed) > 0 && G.wheelOpensIn(wed) <= 3 * 86400000, 'odliczanie do sobotniego otwarcia');
  assert(G.wheelClosesIn(sat) > 0 && G.wheelClosesIn(sat) <= 2 * 86400000, 'odliczanie do końca weekendu');
  const now = Date.now();
  N.live = [{ id: 7, kind: 'wheel', starts_at: new Date(now - 60000).toISOString(), ends_at: new Date(now + 3600000).toISOString() }];
  assert(G.liveActive('wheel') && G.wheelActive(), 'event „Szczęśliwe Koło” otwiera koło poza weekendem');
  const st = G.wheelState();
  assert(st.active && st.freeReady, 'koło aktywne, darmowe żetony do odebrania');
  assert(G.claimWheelFree() === 5 && G.claimWheelFree() === 0, 'w czasie eventu 5 darmowych żetonów raz dziennie');
  assert(G.wheelToken(1) === 2, 'event podwaja żetony za aktywność');
  const t0 = G.wheelState().tokens;
  const r = G.spinWheel(seq([0]));
  assert(r && r.prize.id === 'gold' && G.wheelState().tokens === t0 - 1, 'obrót zużywa żeton i przyznaje nagrodę');
  assert(G.wheelPick(seq([0.99999])) === G.WHEEL_PRIZES.length - 1, 'ostatni segment (Skrzynia Mityczna) osiągalny');
  const counts = {}; const R2 = (() => { let s = 12345; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); })();
  for (let i = 0; i < 20000; i++) { const k = G.WHEEL_PRIZES[G.wheelPick(R2)].id; counts[k] = (counts[k] || 0) + 1; }
  assert(counts.gold > counts.cr15 && counts.cr15 > counts.mythic && counts.mythic > 0, 'wagi nagród koła działają (złoto najczęściej, mityczna najrzadziej)');
  G.P.wheel.tokens = 0;
  assert(G.spinWheel() === null, 'bez żetonów brak obrotu');
  N.live = [{ id: 8, kind: 'xp2', starts_at: new Date(now - 1000).toISOString(), ends_at: new Date(now + 3600000).toISOString() },
    { id: 9, kind: 'gold2', starts_at: new Date(now - 1000).toISOString(), ends_at: new Date(now + 3600000).toISOString() }];
  const g0 = P.gold; const added = G.addGold(100);
  assert(added === 200 && P.gold === g0 + 200, 'event „Złota Gorączka” podwaja złoto');
  const e0 = G.addExp(10);
  assert(e0 === 20, 'event „Podwójne EXP” podwaja doświadczenie');
  N.live = [{ id: 10, kind: 'xp2', starts_at: new Date(now - 7200000).toISOString(), ends_at: new Date(now - 3600000).toISOString() }];
  assert(!G.liveActive('xp2') && G.addExp(10) === 10, 'zakończony event nie działa');
  N.live = [];
  assert(!G.wheelActive(wed), 'po evencie koło znów tylko w weekend');
}

// ——— 6) Moderacja czatu ———
{
  assert(cleanText('ty kurwa') === 'ty k****', 'wulgaryzm zamaskowany');
  assert(cleanText('KuRw@ mać') === 'K**** mać', 'wielkie litery i @ wykrywane');
  assert(hasProfanity('ch0j') === false && hasProfanity('chuj') && hasProfanity('j3bać') , 'podmiany znaków wykrywane (3→e), bez nadgorliwości');
  assert(cleanText('Witaj w gildii, pedagog i hultaj!') === 'Witaj w gildii, pedagog i hultaj!', 'zwykłe słowa bez zmian');
  const P = fresh();
  G.toggleMute('u-1', 'Zły');
  assert(G.isMuted('u-1') && !G.isMuted('u-2'), 'wyciszenie gracza');
  G.toggleMute('u-1', 'Zły');
  assert(!G.isMuted('u-1'), 'zdjęcie wyciszenia');
}

// ——— 7) Profil innego gracza: ekwipunek i pet z serwera są oczyszczane ———
{
  const P = fresh('paladin');
  const it = F.genItem({ lvl: 40, rarity: 3, cls: 'paladin', slot: 'weapon' }); P.equip.weapon = it;
  const prof = G.netProfile();
  assert(prof.equip.weapon && prof.equip.weapon.n === it.name && 'pet' in prof && 'abyss' in prof, 'profil wysyła ekwipunek, peta i Otchłań');
  const items = itemsFromRow({ id: 'x', equip: prof.equip });
  assert(items.weapon.name === it.name && items.weapon.rarity === 3 && items.weapon.preview, 'ekwipunek innego gracza odtworzony');
  const evil = itemsFromRow({ id: 'y', equip: { weapon: { t: 'zzz', n: 'kurwa'.repeat(20), i: 'http://evil/x.png', r: 99, l: 1e12, u: 999, s: { str: 1e15, hax: 5 }, d: -5 } } });
  const w = evil.weapon;
  assert(w.name.length <= 40 && !/kurwa/.test(w.name) && w.icon === 'weapons_00' && w.rarity === RARITIES.length - 1 && w.lvl === 100000 && w.up === 10 && w.stats.str === 1e7 && !('hax' in w.stats) && w.dmg === 0, 'złośliwy ekwipunek przycięty i oczyszczony');
  assert(petFromRow({ pet: { id: 'dragon', lvl: 99 } }).lvl === PET_MAX_LVL && petFromRow({ pet: { id: 'hack' } }) === null, 'pet z serwera sprawdzony');
  const fr = fighterFromRow({ name: 'Cheater', lvl: 50, cls: 'warrior', fighter: { maxHp: 4e9, dmgMin: 9e7, dmgMax: 9e7, armor: 1e8 } });
  assert(F.fighterPower(fr) <= F.maxPowerFor(50) * 1.001, 'siła oszukanego profilu przycięta do limitu poziomu');
}

console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystkie testy aktualizacji 1.8 OK');
