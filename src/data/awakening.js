// Przebudzenia: 6 progów (100–150), klasowe umiejętności i Próby z bossami
export const AWAKEN_LEVELS = [100, 110, 120, 130, 140, 150];
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
export const TRIAL_ATTEMPTS = 3; // ataków dziennie
export const TRIAL_MAX_ACTIONS = 30; // walka z bossem Próby trwa maks. 15 tur na stronę (potem boss odpycha bohatera)
// wzorcowy bohater, do którego kalibrowana jest pula PŻ: pełne talenty, epicki ekwipunek +8
export const TRIAL_REF_GEAR = { rarity: 3, up: 8 };
// parametry bossa Próby: PŻ w pojedynczej walce praktycznie nie do zbicia; obrażenia dobrane tak, by wzorcowy bohater
// zwykle dotrwał do limitu tur w fazie I, a w fazie IV często padał
export const TRIAL_BOSS = { hpMul: 400, dmgMul: 3.0 };

// fx – efekty stosowane do walczącego (formulas.applyAwakening + combat.js)
export const AWAKENINGS = {
  warrior: [
    { name: 'Krew Berserkera', desc: 'Poniżej 50% PŻ zadajesz +25% obrażeń.', fx: { lowHp: { thr: 0.5, mul: 1.25 } } },
    { name: 'Trzęsienie Ziemi', desc: 'Co 6. tura: uderzenie za 300%, które ogłusza wroga.', fx: { periodic: { every: 6, name: 'Trzęsienie Ziemi', hits: [{ mul: 3, stun: true, vfx: 'bossSmash' }] } } },
    { name: 'Żelazna Skóra', desc: 'Otrzymujesz o 12% mniej obrażeń.', fx: { dmgTaken: 0.88 } },
    { name: 'Rzeźnik', desc: '+8% kradzieży życia i +20% obrażeń krytycznych.', fx: { leechPct: 8, critDmgPct: 20 } },
    { name: 'Gniew Tytana', desc: 'Na starcie walki: +35% obrażeń przez 4 tury.', fx: { openBuff: { turns: 4, mul: 1.35 } } },
    { name: 'Niezniszczalny', desc: 'Nieugięty przywraca 35% PŻ zamiast 1.', fx: { undyingHeal: 0.35 } },
  ],
  mage: [
    { name: 'Płonąca Dusza', desc: 'Twoje podpalenia zadają +60% obrażeń.', fx: { dotMul: 1.6 } },
    { name: 'Zamieć', desc: 'Co 6. tura: 4 lodowe odłamki po 85%, ostatni ogłusza.', fx: { periodic: { every: 6, name: 'Zamieć', hits: [{ mul: 0.85, vfx: 'chain' }, { mul: 0.85, vfx: 'chain' }, { mul: 0.85, vfx: 'chain' }, { mul: 0.85, vfx: 'chain', stun: true }] } } },
    { name: 'Bariera Arkanów', desc: 'Na starcie walki: magiczna tarcza za 35% PŻ.', fx: { shield: 0.35 } },
    { name: 'Mistrz Żywiołów', desc: '+10% szansy na trafienie krytyczne.', fx: { critPct: 10 } },
    { name: 'Czarna Dziura', desc: 'Co 8. tura: 550% obrażeń, ignoruje 40% pancerza.', fx: { periodic: { every: 8, name: 'Czarna Dziura', hits: [{ mul: 5.5, pierce: 0.4, vfx: 'meteor' }] } } },
    { name: 'Arcymag', desc: 'Umiejętności zadają +30% obrażeń.', fx: { skillPct: 30 } },
  ],
  archer: [
    { name: 'Strzała Przebijająca', desc: 'Twoje ataki ignorują 25% pancerza.', fx: { pierce: 0.25 } },
    { name: 'Deszcz Strzał', desc: 'Co 6. tura: 6 strzał po 50%.', fx: { periodic: { every: 6, name: 'Deszcz Strzał', hits: Array.from({ length: 6 }, () => ({ mul: 0.5, vfx: 'volley' })) } } },
    { name: 'Wiatr Uników', desc: '+7% szansy na unik.', fx: { dodgePct: 7 } },
    { name: 'Śmiertelny Cel', desc: '+40% obrażeń krytycznych.', fx: { critDmgPct: 40 } },
    { name: 'Strzała Feniksa', desc: 'Co 8. tura: 450% obrażeń i podpalenie.', fx: { periodic: { every: 8, name: 'Strzała Feniksa', hits: [{ mul: 4.5, burn: 0.2, vfx: 'fireball' }] } } },
    { name: 'Legenda Łuku', desc: 'Pierwszy strzał w walce: pewny krytyk za 300%.', fx: { firstCrit: 3 } },
  ],
  assassin: [
    { name: 'Jad Bazyliszka', desc: 'Twoje trucizny zadają +60% obrażeń.', fx: { dotMul: 1.6 } },
    { name: 'Taniec Ostrzy', desc: 'Co 6. tura: 5 cięć po 45%.', fx: { periodic: { every: 6, name: 'Taniec Ostrzy', hits: Array.from({ length: 5 }, () => ({ mul: 0.45, vfx: 'shadow' })) } } },
    { name: 'Zasłona Dymna', desc: '+8% szansy na unik.', fx: { dodgePct: 8 } },
    { name: 'Pijawka', desc: '+7% kradzieży życia.', fx: { leechPct: 7 } },
    { name: 'Cień Śmierci', desc: 'Egzekucja działa już poniżej 45% PŻ wroga.', fx: { execThr: 0.45 } },
    { name: 'Mistrz Cienia', desc: 'Po każdym uniku Twój następny atak jest krytykiem.', fx: { dodgeCrit: true } },
  ],
  paladin: [
    { name: 'Aura Światła', desc: 'Odnawiasz 2% PŻ co turę.', fx: { regenPct: 2 } },
    { name: 'Młot Sprawiedliwości', desc: 'Co 6. tura: 280% obrażeń i ogłuszenie.', fx: { periodic: { every: 6, name: 'Młot Sprawiedliwości', hits: [{ mul: 2.8, stun: true, vfx: 'smite' }] } } },
    { name: 'Święta Zbroja', desc: '+8% szansy na blok.', fx: { blockPct: 8 } },
    { name: 'Męczennik', desc: 'Twoje leczenie jest o 60% silniejsze.', fx: { healMul: 1.6 } },
    { name: 'Sąd Ostateczny', desc: 'Co 8. tura: 420% obrażeń, ignoruje 50% pancerza.', fx: { periodic: { every: 8, name: 'Sąd Ostateczny', hits: [{ mul: 4.2, pierce: 0.5, vfx: 'wrath' }] } } },
    { name: 'Awatar', desc: 'Raz na walkę po śmierci wstajesz z 40% PŻ.', fx: { revive: 0.4 } },
  ],
};

// Próby: boss (indeks z BOSSES), docelowa liczba dni przy 3 atakach dziennie, nagrody
export const TRIALS = [
  { name: 'Próba Zagadek', boss: 5, title: 'Sfinks Przeznaczenia', days: 3, glow: '#ffd75e', cr: 100 },
  { name: 'Próba Śmierci', boss: 3, title: 'Lisz Wieczny', days: 3, glow: '#8aff7a', cr: 120 },
  { name: 'Próba Mrozu', boss: 6, title: 'Ymir Pradawny', days: 4, glow: '#7fe3ff', cr: 140 },
  { name: 'Próba Otchłani', boss: 7, title: 'Azgor Nieskończony', days: 4, glow: '#ff5a2a', cr: 160 },
  { name: 'Próba Ognia', boss: 8, title: 'Ignar Pierwotny', days: 5, glow: '#ff9c3d', cr: 180 },
  { name: 'Próba Pustki', boss: 9, title: 'Serce Pustki', days: 5, glow: '#c38bff', cr: 250 },
];
// fazy bossa (od ilu % PŻ) – każda kolejna mocniej bije
export const TRIAL_PHASES = [
  { from: 1.0, name: 'Faza I', dmg: 1.0 },
  { from: 0.75, name: 'Faza II – Gniew', dmg: 1.15 },
  { from: 0.5, name: 'Faza III – Furia', dmg: 1.3 },
  { from: 0.25, name: 'Faza IV – Ostatni Bastion', dmg: 1.45 },
];
export const phaseOf = (frac) => { let p = 0; TRIAL_PHASES.forEach((x, i) => { if (frac <= x.from) p = i; }); return p; };
