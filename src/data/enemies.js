// 30 przeciwników i 10 bossów
// arch: mnożniki hp / dmg / armor / dodge / crit
const A = {
  brute: { hp: 1.3, dmg: 1.0, armor: 1.2, dodge: 2, crit: 3 },
  fast: { hp: 0.85, dmg: 1.05, armor: 0.7, dodge: 12, crit: 8 },
  caster: { hp: 0.8, dmg: 1.25, armor: 0.6, dodge: 4, crit: 6 },
  tank: { hp: 1.55, dmg: 0.85, armor: 1.6, dodge: 0, crit: 2 },
  normal: { hp: 1.0, dmg: 1.0, armor: 1.0, dodge: 5, crit: 5 },
};
const E = [
  ['Szlamik Królewicz', 'normal', 1, 'Galaretowaty pretendent do tronu.'],
  ['Szczur z Nożem', 'fast', 1, 'Ukradł nóż z kuchni karczmy.'],
  ['Goblin Złodziejaszek', 'fast', 2, 'Ma worek pełen cudzych skarpet.'],
  ['Wściekły Muchomor', 'caster', 3, 'Nie jedz go. Serio.'],
  ['Szary Wilk', 'fast', 4, 'Wyje do każdego księżyca.'],
  ['Szkielet Wojownik', 'brute', 5, 'Kości ma, ale serca brak.'],
  ['Włochaty Pająk', 'fast', 6, 'Osiem nóg, zero manier.'],
  ['Bandyta z Pałką', 'brute', 7, 'Pieniądze albo guz!'],
  ['Żabolud z Bagien', 'normal', 9, 'Rechocze groźnie.'],
  ['Wampirzy Nietoperz', 'fast', 11, 'Gryzie i ucieka.'],
  ['Kobold Górnik', 'tank', 13, 'Świeczka na hełmie to jego duma.'],
  ['Żywy Strach na Wróble', 'caster', 15, 'Wrony już się go nie boją. Ty powinieneś.'],
  ['Ork Wojak', 'brute', 17, 'Mało mówi, dużo bije.'],
  ['Dzik Kłowacz', 'tank', 19, 'Szarżuje bez ostrzeżenia.'],
  ['Czerwony Chochlik', 'caster', 21, 'Widły ma ostrzejsze niż dowcip.'],
  ['Zombie Chłop', 'tank', 23, 'Wciąż szuka swojej krowy.'],
  ['Ork Berserker', 'brute', 26, 'Dwa topory, zero cierpliwości.'],
  ['Mroczna Wiedźma', 'caster', 29, 'Klątwy rzuca hurtowo.'],
  ['Kamienny Golem', 'tank', 32, 'Twardy orzech do zgryzienia.'],
  ['Harpia', 'fast', 35, 'Pióra wszędzie.'],
  ['Wilkołak', 'brute', 38, 'Pełnia to jego pora.'],
  ['Pustynny Skorpion', 'fast', 42, 'Ogon jak sztylet.'],
  ['Mumia', 'tank', 46, 'Bandaże z epoki faraonów.'],
  ['Ognista Salamandra', 'caster', 50, 'Gorący temperament.'],
  ['Lodowy Troll', 'brute', 55, 'Zimny jak jego maczuga.'],
  ['Kultysta Nekromanta', 'caster', 60, 'Kolekcjonuje czaszki.'],
  ['Minotaur', 'brute', 66, 'Zgubił się w labiryncie. Znowu.'],
  ['Upiorny Widmowiec', 'fast', 72, 'Przenika ściany i pancerze.'],
  ['Gargulec', 'tank', 79, 'Kamienny strażnik dachów.'],
  ['Piaskowy Czerw', 'brute', 86, 'Wyłania się spod wydm.'],
];
// UWAGA: indeksy obrazów = kolejność na arkuszach (e00..e31); e29 i e30/e31 to zapas
const IMG_MAP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29];
export const ENEMIES = E.map((e, i) => ({ id: i, name: e[0], arch: e[1], minLvl: e[2], desc: e[3], img: 'e' + String(IMG_MAP[i]).padStart(2, '0'), ...A[e[1]] }));
export const EXTRA_ENEMIES = [
  { id: 30, name: 'Kryształowy Żywiołak', arch: 'caster', minLvl: 92, desc: 'Lśni i razi.', img: 'e30', ...A.caster },
  { id: 31, name: 'Rycerz Cienia', arch: 'brute', minLvl: 96, desc: 'Czerwone ostrze w ciemności.', img: 'e31', ...A.brute },
];
export const ALL_ENEMIES = [...ENEMIES, ...EXTRA_ENEMIES];

export const BOSSES = [
  { id: 0, name: 'Król Szlam I', img: 'b01', title: 'Władca Galarety', bg: 'forest', ...A.tank, quote: 'Pokłoń się przed moją lepkością!' },
  { id: 1, name: 'Wódz Goblinów Grabarz', img: 'b02', title: 'Jeździec Dzika', bg: 'forest', ...A.brute, quote: 'Twój worek złota będzie mój!' },
  { id: 2, name: 'Prastary Ent', img: 'b03', title: 'Strażnik Puszczy', bg: 'swamp', ...A.tank, quote: 'Kto depcze moje korzenie?!' },
  { id: 3, name: 'Lisz Mortanis', img: 'b04', title: 'Król Nieumarłych', bg: 'dungeon', ...A.caster, quote: 'Śmierć to dopiero początek.' },
  { id: 4, name: 'Hydra Trzech Humorów', img: 'b05', title: 'Postrach Bagien', bg: 'swamp', ...A.brute, quote: 'Trzy głowy, trzy złe humory.' },
  { id: 5, name: 'Sfinks Faraon', img: 'b06', title: 'Pan Piasków', bg: 'desert', ...A.caster, quote: 'Odpowiedz na zagadkę… albo giń.' },
  { id: 6, name: 'Mroźny Gigant Ymir', img: 'b07', title: 'Lodowy Kolos', bg: 'volcano', ...A.tank, quote: 'Zamrożę ci uśmiech.' },
  { id: 7, name: 'Lord Demonów Azgor', img: 'b08', title: 'Książę Otchłani', bg: 'volcano', ...A.brute, quote: 'Twoja dusza pachnie smakowicie.' },
  { id: 8, name: 'Wulkaniczny Smok Ignar', img: 'b09', title: 'Ogień Gór', bg: 'volcano', ...A.brute, quote: 'Spłoń, mały bohaterze!' },
  { id: 9, name: 'Tytan Pustki', img: 'b10', title: 'Koniec Gwiazd', bg: 'dungeon', ...A.caster, quote: 'Wszystko wraca do pustki.' },
];

export const DUNGEONS = [
  { id: 0, name: 'Galaretowe Jaskinie', bg: 'forest', reqLvl: 1, pool: [0, 1, 2, 3, 4] },
  { id: 1, name: 'Obóz Goblinów', bg: 'forest', reqLvl: 8, pool: [2, 4, 5, 6, 7] },
  { id: 2, name: 'Szepczący Las', bg: 'swamp', reqLvl: 16, pool: [6, 8, 9, 10, 11] },
  { id: 3, name: 'Krypta Lisza', bg: 'dungeon', reqLvl: 25, pool: [5, 12, 14, 15, 16] },
  { id: 4, name: 'Mglisty Moczar', bg: 'swamp', reqLvl: 34, pool: [8, 13, 17, 18, 19] },
  { id: 5, name: 'Grobowiec Faraona', bg: 'desert', reqLvl: 43, pool: [20, 21, 22, 23, 29] },
  { id: 6, name: 'Lodowa Przełęcz', bg: 'volcano', reqLvl: 52, pool: [18, 24, 25, 26, 20] },
  { id: 7, name: 'Wrota Otchłani', bg: 'volcano', reqLvl: 62, pool: [14, 23, 25, 27, 26] },
  { id: 8, name: 'Gniazdo Smoka', bg: 'volcano', reqLvl: 72, pool: [23, 26, 28, 29, 30] },
  { id: 9, name: 'Serce Pustki', bg: 'dungeon', reqLvl: 82, pool: [27, 28, 29, 30, 31] },
];

export const LOCATIONS = {
  forest: 'Zaczarowany Las', swamp: 'Mglisty Moczar', volcano: 'Wulkaniczna Przełęcz',
  desert: 'Pustynne Ruiny', dungeon: 'Podziemia', arena: 'Arena', guildhall: 'Sala Gildii', hub: 'Rynek Miasteczka',
};
