// Klasy postaci, umiejętności i talenty
export const STATS = ['str', 'dex', 'int', 'con', 'lck'];
export const STAT_NAMES = { str: 'Siła', dex: 'Zręczność', int: 'Inteligencja', con: 'Wytrzymałość', lck: 'Szczęście' };
export const STAT_SHORT = { str: 'SIŁ', dex: 'ZRĘ', int: 'INT', con: 'WYT', lck: 'SZC' };
export const STAT_HINT = {
  str: 'Obrażenia Wojownika i Paladyna',
  dex: 'Obrażenia Łucznika i Zabójcy, szansa na unik',
  int: 'Obrażenia Maga, odporność na magię',
  con: 'Punkty życia',
  lck: 'Szansa na trafienie krytyczne',
};

export const CLASSES = {
  warrior: {
    id: 'warrior', name: 'Wojownik', main: 'str', hpMul: 1.25, armorMul: 1.2, dodge: 0, crit: 0,
    color: 0xff6a3d, vfx: 'slash', looks: ['warrior_a', 'warrior_b'],
    desc: 'Twardy jak kowadło. Dużo życia, potężne ciosy i upór, który nie pozwala mu paść.',
    base: { str: 14, dex: 8, int: 5, con: 12, lck: 6 },
    weapon: ['sword', 'axe', 'hammer'],
  },
  mage: {
    id: 'mage', name: 'Mag', main: 'int', hpMul: 1.0, armorMul: 0.9, dodge: 0, crit: 3, pierce: 0.5,
    color: 0x5fb8ff, vfx: 'magic', looks: ['mage_a', 'mage_b'],
    desc: 'Mistrz żywiołów. Jego zaklęcia ignorują połowę pancerza. Ogień, lód i błyskawice.',
    base: { str: 5, dex: 7, int: 15, con: 9, lck: 8 },
    weapon: ['staff', 'wand', 'book'],
  },
  archer: {
    id: 'archer', name: 'Łucznik', main: 'dex', hpMul: 1.05, armorMul: 0.95, dodge: 4, crit: 6,
    color: 0x7bdc5a, vfx: 'arrow', looks: ['archer_a', 'archer_b'],
    desc: 'Precyzja i dystans. Częste krytyki i grad strzał.',
    base: { str: 7, dex: 15, int: 6, con: 10, lck: 9 },
    weapon: ['bow', 'crossbow'],
  },
  assassin: {
    id: 'assassin', name: 'Zabójca', main: 'dex', hpMul: 0.9, armorMul: 0.85, dodge: 8, crit: 8, critDmg: 0.3,
    color: 0xb36bff, vfx: 'shadow', looks: ['assassin_a', 'assassin_b'],
    desc: 'Szybki cień. Najwyższa szansa na unik i zabójcze trafienia krytyczne.',
    base: { str: 6, dex: 14, int: 6, con: 9, lck: 12 },
    weapon: ['dagger'],
  },
  paladin: {
    id: 'paladin', name: 'Paladyn', main: 'str', hpMul: 1.22, armorMul: 1.25, dodge: 0, crit: 0, block: 8,
    color: 0xffd34d, vfx: 'holy', looks: ['paladin_a', 'paladin_b'],
    desc: 'Święty obrońca. Blokuje ciosy, leczy się i karze wrogów światłem.',
    base: { str: 12, dex: 6, int: 8, con: 14, lck: 6 },
    weapon: ['mace', 'hammer', 'sword'],
  },
};
export const CLASS_ORDER = ['warrior', 'mage', 'archer', 'assassin', 'paladin'];

// Umiejętności: lvl odblokowania. Mechanika realizowana w combat.js po id.
export const SKILLS = {
  warrior: [
    { id: 'w_power', lvl: 1, name: 'Potężny Cios', desc: 'Co 4. tura: cios za 220% obrażeń.' },
    { id: 'w_shout', lvl: 10, name: 'Okrzyk Bojowy', desc: 'Start walki: +20% obrażeń na 3 tury.' },
    { id: 'w_whirl', lvl: 25, name: 'Wir Ostrzy', desc: 'Co 5. tura: 3 cięcia po 75%.' },
    { id: 'w_undying', lvl: 50, name: 'Nieugięty', desc: 'Raz na walkę przeżywa śmiertelny cios z 1 PŻ.' },
  ],
  mage: [
    { id: 'm_fireball', lvl: 1, name: 'Kula Ognia', desc: 'Co 3. tura: 200% obrażeń + podpalenie.' },
    { id: 'm_iceshield', lvl: 10, name: 'Lodowa Tarcza', desc: 'Start walki: tarcza 20% PŻ.' },
    { id: 'm_chain', lvl: 25, name: 'Łańcuch Błyskawic', desc: 'Co 5. tura: 3 wyładowania po 80%.' },
    { id: 'm_meteor', lvl: 50, name: 'Meteor', desc: 'Co 7. tura: 400% obrażeń.' },
  ],
  archer: [
    { id: 'a_aimed', lvl: 1, name: 'Celny Strzał', desc: 'Co 4. tura: pewne trafienie krytyczne.' },
    { id: 'a_volley', lvl: 10, name: 'Grad Strzał', desc: 'Co 5. tura: 4 strzały po 55%.' },
    { id: 'a_poison', lvl: 25, name: 'Zatruta Strzała', desc: 'Trafienia mają 25% szans na truciznę.' },
    { id: 'a_hawk', lvl: 50, name: 'Oko Sokoła', desc: 'Stałe +12% szansy na krytyk.' },
  ],
  assassin: [
    { id: 's_backstab', lvl: 1, name: 'Cios w Plecy', desc: 'Pierwszy atak: 250% obrażeń.' },
    { id: 's_shadow', lvl: 10, name: 'Krok Cienia', desc: 'Co 4. tura: unika następnego ataku.' },
    { id: 's_venom', lvl: 25, name: 'Jad', desc: 'Krytyki nakładają silną truciznę.' },
    { id: 's_execute', lvl: 50, name: 'Egzekucja', desc: 'Wróg poniżej 30% PŻ: 300% obrażeń.' },
  ],
  paladin: [
    { id: 'p_smite', lvl: 1, name: 'Święte Uderzenie', desc: 'Co 4. tura: 180% obrażeń i leczenie 10% PŻ.' },
    { id: 'p_aegis', lvl: 10, name: 'Boska Tarcza', desc: 'Co 5. tura: blokuje kolejny cios.' },
    { id: 'p_heal', lvl: 25, name: 'Uzdrowienie', desc: 'Raz na walkę poniżej 40% PŻ: leczy 30% PŻ.' },
    { id: 'p_wrath', lvl: 50, name: 'Gniew Niebios', desc: 'Co 7. tura: 350% obrażeń świętych.' },
  ],
};

// Prosty system talentów: 3 gałęzie × 5 talentów × maks. 3 rangi
export const TALENTS = [
  { branch: 'Atak', id: 't_dmg', name: 'Ostrość', per: 4, unit: '% obrażeń', key: 'dmgPct' },
  { branch: 'Atak', id: 't_crit', name: 'Celność', per: 2, unit: '% krytyka', key: 'critPct' },
  { branch: 'Atak', id: 't_critdmg', name: 'Brutalność', per: 10, unit: '% obr. kryt.', key: 'critDmgPct' },
  { branch: 'Atak', id: 't_skill', name: 'Mistrzostwo', per: 8, unit: '% obr. umiejętności', key: 'skillPct' },
  { branch: 'Atak', id: 't_first', name: 'Inicjatywa', per: 10, unit: '% szans na pierwszy ruch', key: 'initPct' },
  { branch: 'Obrona', id: 't_hp', name: 'Krzepa', per: 5, unit: '% PŻ', key: 'hpPct' },
  { branch: 'Obrona', id: 't_armor', name: 'Skóra Trolla', per: 6, unit: '% pancerza', key: 'armorPct' },
  { branch: 'Obrona', id: 't_dodge', name: 'Zwinność', per: 2, unit: '% uniku', key: 'dodgePct' },
  { branch: 'Obrona', id: 't_leech', name: 'Wampiryzm', per: 2, unit: '% kradzieży życia', key: 'leechPct' },
  { branch: 'Obrona', id: 't_regen', name: 'Odnowa', per: 1, unit: '% PŻ co turę', key: 'regenPct' },
  { branch: 'Fortuna', id: 't_gold', name: 'Chciwość', per: 6, unit: '% złota', key: 'goldPct' },
  { branch: 'Fortuna', id: 't_exp', name: 'Mądrość', per: 6, unit: '% EXP', key: 'expPct' },
  { branch: 'Fortuna', id: 't_find', name: 'Węch Skarbów', per: 5, unit: '% lepszych łupów', key: 'findPct' },
  { branch: 'Fortuna', id: 't_idle', name: 'Leniuch', per: 10, unit: '% nagród Idle', key: 'idlePct' },
  { branch: 'Fortuna', id: 't_speed', name: 'Skrót', per: 5, unit: '% krótsze przygody', key: 'speedPct' },
];
export const TALENT_MAX = 3;
export const talentPointsFor = (lvl) => Math.max(0, Math.floor((lvl - 2) / 2));

// Wygląd: przesunięcie odcienia stroju (względne). LOOK_HUE = dominujący odcień stroju danego wariantu.
export const OUTFIT_HUES = [
  { name: 'Oryginał', hue: 0 }, { name: 'Odcień I', hue: 0.14 }, { name: 'Odcień II', hue: 0.28 },
  { name: 'Odcień III', hue: 0.42 }, { name: 'Odcień IV', hue: 0.56 }, { name: 'Odcień V', hue: 0.7 },
  { name: 'Odcień VI', hue: 0.84 }, { name: 'Odcień VII', hue: 0.92 },
];
export const LOOK_HUE = {
  warrior_a: 0.0, warrior_b: 0.02, mage_a: 0.62, mage_b: 0.78, archer_a: 0.33, archer_b: 0.48,
  assassin_a: 0.98, assassin_b: 0.78, paladin_a: 0.6, paladin_b: 0.12,
};
export function outfitSwatch(cls, look, i) {
  const base = LOOK_HUE[CLASSES[cls].looks[look]] ?? 0;
  return `hsl(${Math.round(((base + OUTFIT_HUES[i].hue) % 1) * 360)}, 68%, 48%)`;
}
export const AURA_COLORS = [
  { name: 'Złota', c: '#ffcf4a' }, { name: 'Lodowa', c: '#6fd6ff' }, { name: 'Leśna', c: '#79e06b' },
  { name: 'Ognista', c: '#ff6a3d' }, { name: 'Mroczna', c: '#b36bff' }, { name: 'Różana', c: '#ff7fc8' },
];

// Kosmetyczne skórki (shader): tint, nasycenie, kontur, efekt
export const SKINS = {
  default: { name: 'Klasyczna', desc: 'Domyślny wygląd.', tint: [1, 1, 1], sat: 1, glow: null, cost: 0, src: 'free' },
  golden: { name: 'Złoty Bohater', desc: 'Lśniąca złota powłoka.', tint: [1.18, 1.02, 0.7], sat: 0.85, glow: '#ffd75e', cost: 400, src: 'shop' },
  shadow: { name: 'Cień Nocy', desc: 'Mroczna sylwetka z fioletową poświatą.', tint: [0.62, 0.55, 0.85], sat: 0.6, glow: '#a46bff', cost: 400, src: 'shop' },
  frost: { name: 'Lodowy Strażnik', desc: 'Skuty lodem, chłodny blask.', tint: [0.8, 1.0, 1.25], sat: 0.55, glow: '#7fe3ff', cost: 350, src: 'shop' },
  infernal: { name: 'Piekielny Czempion', desc: 'Nagroda sezonu PvP (Złoto+).', tint: [1.25, 0.75, 0.55], sat: 1.15, glow: '#ff5a2a', cost: 0, src: 'season' },
  royal: { name: 'Królewski', desc: 'Za pokonanie Lisza (loch 4).', tint: [1.05, 0.95, 1.15], sat: 1.1, glow: '#ffe38a', cost: 0, src: 'dungeon' },
  cosmic: { name: 'Kosmiczny', desc: 'Za pokonanie Tytana Pustki (loch 10).', tint: [0.85, 0.75, 1.25], sat: 1.25, glow: '#c38bff', cost: 0, src: 'dungeon' },
  event: { name: 'Łowca Smoków', desc: 'Nagroda wydarzenia tygodniowego.', tint: [1.1, 0.9, 0.8], sat: 1.2, glow: '#ff9c3d', cost: 0, src: 'event' },
  awakened: { name: 'Przebudzony', desc: 'Za ukończenie wszystkich 6 Przebudzeń.', tint: [1.05, 1.0, 1.2], sat: 1.15, glow: '#9fe8ff', cost: 0, src: 'awaken' },
  abyss: { name: 'Wędrowiec Otchłani', desc: 'Za zdobycie 500. piętra Otchłani.', tint: [0.9, 0.72, 1.18], sat: 1.2, glow: '#d14dff', cost: 0, src: 'abyss' },
  abyssLord: { name: 'Władca Otchłani', desc: 'Za zdobycie 2000. piętra Otchłani.', tint: [1.2, 0.62, 0.78], sat: 1.3, glow: '#ff3d6e', cost: 0, src: 'abyss' },
  vip: { name: 'Królewski VIP', desc: 'Dostępna na czas aktywnego VIP-a.', tint: [1.16, 1.0, 0.74], sat: 1.12, glow: '#ffd36b', cost: 0, src: 'vip' },
};
