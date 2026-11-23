// Baza przedmiotów: 110 szablonów + 12 legendarnych
export const SLOTS = ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'ring', 'amulet'];
export const SLOT_NAMES = { weapon: 'Broń', helmet: 'Hełm', armor: 'Zbroja', gloves: 'Rękawice', boots: 'Buty', ring: 'Pierścień', amulet: 'Amulet' };
export const RARITIES = [
  { id: 0, name: 'Zwykły', color: '#b9b2a4', mul: 1.0, extra: 0 },
  { id: 1, name: 'Niezwykły', color: '#5fcf5a', mul: 1.22, extra: 1 },
  { id: 2, name: 'Rzadki', color: '#4f9bff', mul: 1.5, extra: 2 },
  { id: 3, name: 'Epicki', color: '#b46cff', mul: 1.88, extra: 3 },
  { id: 4, name: 'Legendarny', color: '#ff9f1c', mul: 2.4, extra: 4 },
];
export const WEAPON_TYPE_NAMES = { sword: 'Miecz', axe: 'Topór', hammer: 'Młot', staff: 'Kostur', wand: 'Różdżka', book: 'Księga', bow: 'Łuk', crossbow: 'Kusza', dagger: 'Sztylet', mace: 'Buzdygan' };

// [slot, typ, nazwa, ikona, minPoziom]
const RAW = [
  ['weapon', 'sword', 'Zardzewiały Miecz', 'weapons_00', 1], ['weapon', 'sword', 'Miecz Najemnika', 'weapons_00', 8],
  ['weapon', 'sword', 'Rycerski Długi Miecz', 'weapons_00', 20], ['weapon', 'sword', 'Płonący Dwuręczniak', 'weapons_01', 35],
  ['weapon', 'sword', 'Ostrze Wulkanu', 'weapons_01', 55], ['weapon', 'sword', 'Miecz Promienia', 'weapons_15', 75],
  ['weapon', 'axe', 'Siekiera Drwala', 'weapons_02', 1], ['weapon', 'axe', 'Topór Bitewny', 'weapons_02', 12],
  ['weapon', 'axe', 'Topór Berserkera', 'weapons_02', 30], ['weapon', 'axe', 'Rozłupywacz Gór', 'weapons_02', 60],
  ['weapon', 'hammer', 'Drewniany Młot', 'weapons_03', 1], ['weapon', 'hammer', 'Młot Kowala', 'weapons_03', 15],
  ['weapon', 'hammer', 'Młot Burzy', 'weapons_03', 40], ['weapon', 'hammer', 'Młot Tytana', 'weapons_03', 70],
  ['weapon', 'staff', 'Kij Pielgrzyma', 'weapons_04', 1], ['weapon', 'staff', 'Kostur Druida', 'weapons_04', 10],
  ['weapon', 'staff', 'Laska Arkanów', 'weapons_05', 25], ['weapon', 'staff', 'Kostur Gwiezdny', 'weapons_05', 50],
  ['weapon', 'staff', 'Laska Pustki', 'weapons_05', 80],
  ['weapon', 'wand', 'Różdżka Ucznia', 'weapons_06', 1], ['weapon', 'wand', 'Różdżka Gwiazd', 'weapons_06', 20],
  ['weapon', 'wand', 'Różdżka Komety', 'weapons_06', 55],
  ['weapon', 'book', 'Zeszyt Zaklęć', 'weapons_07', 5], ['weapon', 'book', 'Grimuar Run', 'weapons_07', 30],
  ['weapon', 'book', 'Księga Zakazana', 'weapons_07', 65],
  ['weapon', 'bow', 'Łuk Myśliwego', 'weapons_08', 1], ['weapon', 'bow', 'Długi Łuk', 'weapons_08', 12],
  ['weapon', 'bow', 'Elfi Łuk', 'weapons_10', 30], ['weapon', 'bow', 'Łuk Wiatru', 'weapons_10', 55],
  ['weapon', 'bow', 'Łuk Feniksa', 'weapons_10', 80],
  ['weapon', 'crossbow', 'Kusza Strażnika', 'weapons_09', 8], ['weapon', 'crossbow', 'Kusza Oblężnicza', 'weapons_09', 40],
  ['weapon', 'dagger', 'Nóż Kuchenny', 'weapons_11', 1], ['weapon', 'dagger', 'Zakrzywiony Sztylet', 'weapons_11', 10],
  ['weapon', 'dagger', 'Bliźniacze Ostrza', 'weapons_12', 25], ['weapon', 'dagger', 'Zatruty Kieł', 'weapons_13', 45],
  ['weapon', 'dagger', 'Szpony Nocy', 'weapons_12', 70],
  ['weapon', 'mace', 'Maczuga Pielgrzyma', 'weapons_14', 1], ['weapon', 'mace', 'Buzdygan Świątynny', 'weapons_14', 20],
  ['weapon', 'mace', 'Święta Gwiazda Zaranna', 'weapons_14', 50],

  ['helmet', '', 'Skórzana Czapka', 'armor_00', 1], ['helmet', '', 'Spiczasty Kapelusz', 'armor_03', 1],
  ['helmet', '', 'Rogaty Hełm', 'armor_02', 8], ['helmet', '', 'Czapka Zwiadowcy', 'armor_00', 10],
  ['helmet', '', 'Hełm Rycerza', 'armor_01', 15], ['helmet', '', 'Kaptur Łowcy', 'armor_00', 20],
  ['helmet', '', 'Kapelusz Arcymaga', 'armor_03', 30], ['helmet', '', 'Hełm Wodza', 'armor_02', 35],
  ['helmet', '', 'Przyłbica Gwardii', 'armor_01', 40], ['helmet', '', 'Korona Mędrca', 'armor_03', 60],
  ['helmet', '', 'Hełm Jarla', 'armor_02', 65], ['helmet', '', 'Hełm Wiecznej Straży', 'armor_01', 80],

  ['armor', '', 'Skórzana Kurta', 'armor_04', 1], ['armor', '', 'Szata Nowicjusza', 'armor_06', 1],
  ['armor', '', 'Kurta Łowcy', 'armor_04', 12], ['armor', '', 'Pancerz Płytowy', 'armor_05', 15],
  ['armor', '', 'Kirys Paladyna', 'armor_07', 20], ['armor', '', 'Szata Arkanisty', 'armor_06', 25],
  ['armor', '', 'Zbroja Gwardzisty', 'armor_05', 35], ['armor', '', 'Kaftan Cienia', 'armor_04', 40],
  ['armor', '', 'Kirys Słońca', 'armor_07', 50], ['armor', '', 'Szata Gwiazd', 'armor_06', 55],
  ['armor', '', 'Zbroja Smoczej Łuski', 'armor_05', 70], ['armor', '', 'Pancerz Niebios', 'armor_07', 85],

  ['gloves', '', 'Skórzane Rękawice', 'armor_08', 1], ['gloves', '', 'Rękawice Łucznika', 'armor_08', 5],
  ['gloves', '', 'Stalowe Rękawice', 'armor_09', 10], ['gloves', '', 'Rękawice Złodzieja', 'armor_08', 15],
  ['gloves', '', 'Zaklęte Rękawice', 'armor_10', 20], ['gloves', '', 'Kolczaste Rękawice', 'armor_11', 25],
  ['gloves', '', 'Rękawice Kowala', 'armor_09', 35], ['gloves', '', 'Rękawice Burzy', 'armor_10', 50],
  ['gloves', '', 'Pięści Demona', 'armor_11', 65], ['gloves', '', 'Rękawice Gwiezdne', 'armor_10', 80],
  ['gloves', '', 'Rękawice Tytana', 'armor_09', 90],

  ['boots', '', 'Skórzane Buty', 'armor_12', 1], ['boots', '', 'Kalosze Bagienne', 'armor_12', 5],
  ['boots', '', 'Buty Wędrowca', 'armor_12', 10], ['boots', '', 'Stalowe Trzewiki', 'armor_13', 15],
  ['boots', '', 'Buty Cienia', 'armor_15', 25], ['boots', '', 'Skrzydlate Buty', 'armor_14', 30],
  ['boots', '', 'Trzewiki Gwardii', 'armor_13', 40], ['boots', '', 'Kroki Nocy', 'armor_15', 55],
  ['boots', '', 'Buty Hermesa', 'armor_14', 60], ['boots', '', 'Buty Siedmiomilowe', 'armor_14', 80],
  ['boots', '', 'Trzewiki Tytana', 'armor_13', 90],

  ['ring', '', 'Złota Obrączka', 'jewelry_00', 1], ['ring', '', 'Sygnet Kupca', 'jewelry_00', 5],
  ['ring', '', 'Pierścień Rubinowy', 'jewelry_01', 10], ['ring', '', 'Pierścień Szafirowy', 'jewelry_02', 10],
  ['ring', '', 'Pierścień Szmaragdowy', 'jewelry_03', 10], ['ring', '', 'Pierścień Czaszki', 'jewelry_04', 25],
  ['ring', '', 'Pierścień Księżyca', 'jewelry_06', 35], ['ring', '', 'Pierścień Smoka', 'jewelry_05', 45],
  ['ring', '', 'Pierścień Ognia', 'jewelry_01', 50], ['ring', '', 'Pierścień Mrozu', 'jewelry_02', 50],
  ['ring', '', 'Pierścień Życia', 'jewelry_03', 60], ['ring', '', 'Pierścień Tęczy', 'jewelry_07', 70],

  ['amulet', '', 'Drewniany Totem', 'jewelry_08', 1], ['amulet', '', 'Ząb Rekina', 'jewelry_13', 5],
  ['amulet', '', 'Srebrny Wisior', 'jewelry_09', 8], ['amulet', '', 'Talizman Szczęścia', 'jewelry_09', 15],
  ['amulet', '', 'Rubinowe Serce', 'jewelry_10', 20], ['amulet', '', 'Amulet Półksiężyca', 'jewelry_14', 25],
  ['amulet', '', 'Oko Proroka', 'jewelry_11', 30], ['amulet', '', 'Amulet Słońca', 'jewelry_12', 40],
  ['amulet', '', 'Medalion Świtu', 'jewelry_12', 50], ['amulet', '', 'Serce Smoka', 'jewelry_10', 60],
  ['amulet', '', 'Pióro Feniksa', 'jewelry_15', 70], ['amulet', '', 'Oko Pustki', 'jewelry_11', 80],
];

export const TEMPLATES = RAW.map((r, i) => ({ tid: 't' + i, slot: r[0], type: r[1], name: r[2], icon: r[3], lvl: r[4] }));

// Legendarne: unikalne efekty
export const LEGENDARIES = [
  { tid: 'L0', slot: 'weapon', type: 'sword', name: 'Ostrze Świtu', icon: 'weapons_15', special: { critDmgPct: 15 }, fx: '+15% obrażeń krytycznych' },
  { tid: 'L1', slot: 'weapon', type: 'staff', name: 'Kostur Arcymaga Zenona', icon: 'weapons_05', special: { skillPct: 18 }, fx: '+18% obrażeń umiejętności' },
  { tid: 'L2', slot: 'weapon', type: 'bow', name: 'Łuk Wiecznego Wiatru', icon: 'weapons_10', special: { critPct: 6 }, fx: '+6% szansy na krytyk' },
  { tid: 'L3', slot: 'weapon', type: 'dagger', name: 'Kły Bliźniaczych Cieni', icon: 'weapons_12', special: { dodgePct: 5 }, fx: '+5% uniku' },
  { tid: 'L4', slot: 'weapon', type: 'hammer', name: 'Młot Niebiańskiego Gromu', icon: 'weapons_03', special: { dmgPct: 10 }, fx: '+10% obrażeń' },
  { tid: 'L5', slot: 'weapon', type: 'mace', name: 'Berło Świętego Płomienia', icon: 'weapons_14', special: { leechPct: 4 }, fx: '4% kradzieży życia' },
  { tid: 'L6', slot: 'helmet', type: '', name: 'Korona Króla Szlamu', icon: 'armor_02', special: { hpPct: 10 }, fx: '+10% PŻ' },
  { tid: 'L7', slot: 'armor', type: '', name: 'Pancerz Smoczego Serca', icon: 'armor_07', special: { armorPct: 14 }, fx: '+14% pancerza' },
  { tid: 'L8', slot: 'gloves', type: '', name: 'Rękawice Midasa', icon: 'armor_10', special: { goldPct: 25 }, fx: '+25% złota' },
  { tid: 'L9', slot: 'boots', type: '', name: 'Buty Siedmiu Mil', icon: 'armor_14', special: { speedPct: 15 }, fx: '15% krótsze przygody' },
  { tid: 'L10', slot: 'ring', type: '', name: 'Pierścień Wieczności', icon: 'jewelry_07', special: { expPct: 12 }, fx: '+12% EXP' },
  { tid: 'L11', slot: 'amulet', type: '', name: 'Amulet Feniksa', icon: 'jewelry_15', special: { regenPct: 2 }, fx: 'Odnawia 2% PŻ co turę' },
];

export const ALL_TEMPLATES = [...TEMPLATES, ...LEGENDARIES];
export const TEMPLATE_BY_ID = Object.fromEntries(ALL_TEMPLATES.map((t) => [t.tid, t]));
