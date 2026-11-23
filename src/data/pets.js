// Pety – towarzysze dający wyłącznie bonusy pasywne (nie walczą). Widoczni obok bohatera.
// Bonus rośnie z poziomem peta: × (1 + 0,2·(poziom−1)); poziom 1–10 za duplikaty z jaj.
export const PET_MAX_LVL = 10;
export const PET_DUP_CRYSTALS = 25; // duplikat peta na maks. poziomie
export const PET_EGG_COST = 250;
export const PETS = [
  { id: 'slime', name: 'Szlamek Skarbnik', img: 'slime', rarity: 1, weight: 22, bonus: { goldPct: 6 }, desc: 'Połyka każdą monetę… i oddaje z procentem.' },
  { id: 'fox', name: 'Ognik', img: 'fox', rarity: 1, weight: 22, bonus: { expPct: 5 }, desc: 'Płonący ogon oświetla ścieżki do wiedzy.' },
  { id: 'owl', name: 'Sówka Mędrca', img: 'owl', rarity: 2, weight: 16, bonus: { findPct: 6 }, desc: 'Wypatrzy skarb nawet w najciemniejszym lochu.' },
  { id: 'golem', name: 'Golemik', img: 'golem', rarity: 2, weight: 16, bonus: { hpPct: 4 }, desc: 'Mały, kamienny i zawsze zasłania przed ciosem.' },
  { id: 'cat', name: 'Kot Cienia', img: 'cat', rarity: 3, weight: 9, bonus: { dodgePct: 1.5, critPct: 1.5 }, desc: 'Przechodzi przez cienie – i uczy tego swojego pana.' },
  { id: 'dragon', name: 'Smoczek', img: 'dragon', rarity: 3, weight: 9, bonus: { dmgPct: 4 }, desc: 'Jeszcze mały, ale już zieje… dymem.' },
  { id: 'phoenix', name: 'Pisklę Feniksa', img: 'phoenix', rarity: 4, weight: 4.5, bonus: { regenPct: 0.8, idlePct: 12 }, desc: 'Ciepło jego piór leczy rany i pilnuje obozu.' },
  { id: 'unicorn', name: 'Kryształowy Jednorożec', img: 'unicorn', rarity: 5, weight: 1.5, bonus: { hpPct: 3, dmgPct: 3, goldPct: 6, expPct: 6 }, desc: 'Mityczny towarzysz – błogosławi każdą przygodę.' },
];
export const PET_BY_ID = Object.fromEntries(PETS.map((p) => [p.id, p]));
export const BONUS_NAMES = {
  goldPct: '% złota', expPct: '% EXP', findPct: '% lepszych łupów', hpPct: '% PŻ', dodgePct: '% uniku', critPct: '% krytyka',
  dmgPct: '% obrażeń', regenPct: '% PŻ co turę', idlePct: '% nagród Idle',
};
export const petMul = (lvl) => 1 + 0.2 * (Math.max(1, Math.min(PET_MAX_LVL, lvl || 1)) - 1);
export function petBonus(id, lvl) {
  const p = PET_BY_ID[id];
  if (!p) return {};
  const m = petMul(lvl);
  return Object.fromEntries(Object.entries(p.bonus).map(([k, v]) => [k, Math.round(v * m * 10) / 10]));
}
export const petBonusText = (id, lvl) => Object.entries(petBonus(id, lvl)).map(([k, v]) => `+${v}${BONUS_NAMES[k] || k}`).join(', ');
