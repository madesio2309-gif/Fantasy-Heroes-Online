// Stan gracza i wszystkie akcje gry
import { CLASSES, STATS, TALENTS, TALENT_MAX, talentPointsFor, SKINS, SKILLS } from '../data/classes.js';
import { RARITIES, SLOTS, MYTHIC } from '../data/items.js';
import { ENEMIES, ALL_ENEMIES, BOSSES, DUNGEONS } from '../data/enemies.js';
import { QUESTS, EVENTS } from '../data/quests.js';
import { PETS, PET_BY_ID, PET_MAX_LVL, PET_DUP_CRYSTALS, PET_EGG_COST } from '../data/pets.js';
import { cleanText } from '../data/moderation.js';
import { R, rng, dayKey, dayIndex, weekIndex, clamp, fmt } from './util.js';
import {
  expNext, questLvlRate, goldBase, calcStats, powerOf, playerPower, playerFighter, enemyFighter, botFighter, fighterPower, scaleFighter, botStats, refPower,
  genItem, rollRarity, upgradeCost, sellPrice, buyPrice, MAX_UP, BAG_SIZE, MAX_LVL, unlockedSkills,
  levelCap, awakenPowerMul, applyAwakening,
} from './formulas.js';
import { AWAKENINGS, AWAKEN_LEVELS, TRIALS, TRIAL_ATTEMPTS, TRIAL_PHASES, TRIAL_MAX_ACTIONS, TRIAL_REF_GEAR, TRIAL_BOSS, ROMAN, phaseOf } from '../data/awakening.js';
import { simulate } from './combat.js';
import { nextStartOf } from './schedule.js';
import * as Net from '../net/online.js';
import { leagueOf, LEAGUES, worldBossInfo } from './world.js';

export const GUEST_SAVE_KEY = 'fho_save_v1';
let SAVE_KEY = GUEST_SAVE_KEY; // każde konto gracza ma własny slot zapisu (ustawiany po zalogowaniu)
const listeners = {};
export const on = (ev, fn) => { (listeners[ev] ||= []).push(fn); };
export const emit = (ev, ...a) => (listeners[ev] || []).forEach((fn) => fn(...a));
const toast = (msg, kind = 'info') => emit('toast', msg, kind);

export let P = null; // aktywny gracz

export const ENERGY_MAX = 100;
const ENERGY_REGEN_MS = 6 * 60000;
export const IDLE_CAP_MS = 12 * 3600000;
export const DUNGEON_KEYS = 10;
export const ARENA_TICKETS = 10;
export const WB_ATTACKS = 5;
export const GB_ATTACKS = 3;
export const GUILD_MAX = 30;

export const WEEK_EVENTS = [
  { id: 'dragon', name: 'Tydzień Smoka', desc: '+50% EXP z przygód. Zbieraj punkty wydarzenia za każdą aktywność!', expMul: 1.5 },
  { id: 'gold', name: 'Złota Gorączka', desc: '+50% złota z przygód i walk. Zbieraj punkty wydarzenia!', goldMul: 1.5 },
  { id: 'loot', name: 'Łowy na Legendy', desc: 'Podwójna szansa na epickie i legendarne łupy. Zbieraj punkty wydarzenia!', lootBoost: 1 },
  { id: 'arena', name: 'Turniej Areny', desc: '+5 biletów areny dziennie i +50% punktów rankingu. Zbieraj punkty wydarzenia!', arena: true },
];
export const EVENT_TIERS = [60, 150, 280, 450, 650];
export const currentEvent = (t = Date.now()) => WEEK_EVENTS[((weekIndex(t) % 4) + 4) % 4];

const MISSION_POOL = [
  { id: 'quests', t: 'Ukończ 3 przygody', goal: 3 },
  { id: 'wins', t: 'Wygraj 5 walk', goal: 5 },
  { id: 'arena', t: 'Stocz 3 walki na arenie', goal: 3 },
  { id: 'dungeon', t: 'Pokonaj 2 piętra lochu', goal: 2 },
  { id: 'upgrade', t: 'Ulepsz dowolny przedmiot', goal: 1 },
  { id: 'wboss', t: 'Zaatakuj bossa światowego', goal: 1 },
  { id: 'idle', t: 'Odbierz nagrody Idle', goal: 1 },
  { id: 'sell', t: 'Sprzedaj 3 przedmioty', goal: 3 },
  { id: 'challenge', t: 'Wygraj wyzwanie dzienne', goal: 1 },
  { id: 'gboss', t: 'Zaatakuj bossa gildii', goal: 1 },
];
export const LOGIN_REWARDS = [
  { t: 'Sakiewka złota', gold: 6 }, { t: '10 kryształów', cr: 10 }, { t: 'Rzadki przedmiot', item: 2 },
  { t: 'Wór złota', gold: 15 }, { t: '20 kryształów', cr: 20 }, { t: 'Epicki przedmiot', item: 3 }, { t: 'Skarb tygodnia: 40 kryształów + skrzynia', cr: 40, item: 3 },
];
export const CHALLENGE_MODS = [
  { id: 'giant', name: 'Gigant', desc: 'Wróg ma podwójne PŻ.', opts: { hpMul: 2 } },
  { id: 'rage', name: 'Szał', desc: 'Wróg zadaje +40% obrażeń.', opts: { dmgMul: 1.4 } },
  { id: 'nododge', name: 'Bez uników', desc: 'Nikt nie może unikać ciosów.', opts: { noDodge: true }, me: { dodge: 0 } },
  { id: 'elite', name: 'Elita', desc: 'Wróg jest o 3 poziomy wyżej.', opts: {}, lvl: 3 },
  { id: 'glass', name: 'Szklane Armaty', desc: 'Obie strony: −50% PŻ, +30% krytyka.', opts: { hpMul: 0.5, crit: 30 }, me: { hpMul: 0.5, crit: 30 } },
];

// ——— Zapis / odczyt ———
export function setSaveSlot(key) { SAVE_KEY = key || GUEST_SAVE_KEY; P = null; }
export const saveSlot = () => SAVE_KEY;
export function hasSave() { return !!localStorage.getItem(SAVE_KEY); }
export function save() { if (P) { P.savedAt = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(P)); emit('saved'); } }
// podmiana całej postaci (import pliku / zapis z serwera) – aktywny gracz wczytuje się ponownie przez load()
export function replaceSave(data) { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); P = null; }
export function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try { P = JSON.parse(raw); } catch (e) { console.error('Uszkodzony zapis', e); return null; }
  // migracja: starsze zapisy bez samouczka
  if (P.tut === undefined) P.tut = P.stats.quests > 0 ? 'done' : 0;
  if (P.awak === undefined) { P.awak = 0; P.trial = null; }
  // migracja: świat bez botów – gildie botów/offline, wiadomości botów i rywale‑boty znikają
  if (P.guild.id !== null && !(typeof P.guild.id === 'string' && P.guild.id.startsWith('net:'))) P.guild = { id: null, joined: 0, own: null, gb: null };
  P.chat = { global: [], guild: [] };
  P.arena.opp = (P.arena.opp || []).filter((id) => id.startsWith('net:'));
  migrate8(P);
  tick(true);
  return P;
}
// aktualizacja 1.8: pety (jajo powitalne), Otchłań, koło fortuny, wyciszeni gracze, statystyki mitycznych
function migrate8(p) {
  if (!p.pets) p.pets = { owned: {}, active: null, eggs: 1 };
  if (!p.abyss) p.abyss = { floor: 0, best: 0, keys: ABYSS_KEYS, day: dayKey() };
  if (p.wheel === undefined) p.wheel = null;
  if (!p.settings) p.settings = {};
  if (!Array.isArray(p.settings.muted)) p.settings.muted = [];
  if (p.stats.mythics === undefined) p.stats.mythics = 0;
  if (p.seenVersion === undefined) p.seenVersion = null;
  return p;
}
export function wipe() { localStorage.removeItem(SAVE_KEY); P = null; }

export function newPlayer({ name, cls, look, hue, aura }) {
  const now = Date.now();
  P = {
    v: 1, name: name.slice(0, 18), cls, look, hue, aura, skin: 'default', skinsOwned: ['default'], created: now,
    lvl: 1, exp: 0, gold: 120, crystals: 30, pts: 0, alloc: Object.fromEntries(STATS.map((s) => [s, 0])), autoStats: true,
    talents: {}, equip: Object.fromEntries(SLOTS.map((s) => [s, null])), bag: [],
    energy: ENERGY_MAX, energyT: now, idleT: now - 20 * 60000,
    quest: { offers: [], active: null, gen: 0, pending: null },
    daily: null, dungeon: { progress: DUNGEONS.map(() => 0), keys: DUNGEON_KEYS, keysDay: dayKey(now), firstClears: [] },
    challenges: null, wb: null, arena: { rating: 1000, season: weekIndex(now), best: 1000, wins: 0, losses: 0, tickets: ARENA_TICKETS, ticketsDay: dayKey(now), opp: [] },
    guild: { id: null, joined: 0, own: null, gb: null }, event: null, shop: null,
    chat: { global: [], guild: [] }, chatT: now,
    stats: { wins: 0, fights: 0, quests: 0, bosses: 0, legendaries: 0, maxDmg: 0 },
    settings: { music: true, sound: true, skip: false },
    login: { day: null, streak: 0, claimed: false },
    seasonRewards: [], log: [], tut: 0, tutAuto: false, awak: 0, trial: null,
  };
  migrate8(P);
  P.seenVersion = 'new';
  // startowy ekwipunek: pełny zwykły zestaw
  for (const s of SLOTS) P.equip[s] = genItem({ lvl: 1, rarity: 0, cls, slot: s });
  tick(true);
  genOffers();
  save();
  return P;
}

// ——— Cykl czasu: regeneracja, resety dzienne i tygodniowe ———
export function tick(silent = false) {
  if (!P) return;
  const now = Date.now();
  // energia
  if (P.energy < ENERGY_MAX) {
    const gain = Math.floor((now - P.energyT) / ENERGY_REGEN_MS);
    if (gain > 0) { P.energy = Math.min(ENERGY_MAX, P.energy + gain); P.energyT += gain * ENERGY_REGEN_MS; }
  } else P.energyT = now;
  const dk = dayKey(now);
  // dzienne misje
  if (!P.daily || P.daily.day !== dk) {
    const r = rng(P.name + dk);
    // arena wymaga prawdziwych rywali – misja tylko, gdy gra ma skonfigurowany serwer
    let pool = MISSION_POOL.filter((m) => (m.id !== 'gboss' || P.guild.id !== null) && (m.id !== 'arena' || Net.getConfig()));
    const picks = [];
    while (picks.length < 5) { const m = r.pick(pool); pool = pool.filter((x) => x !== m); picks.push({ ...m, prog: 0, claimed: false }); }
    P.daily = { day: dk, missions: picks, chest: false, energyBuy: false };
    // logowanie
    const yesterday = dayKey(now - 86400000);
    P.login.streak = P.login.day === yesterday ? P.login.streak + 1 : 1;
    P.login.day = dk; P.login.claimed = false;
  }
  if (P.dungeon.keysDay !== dk) { P.dungeon.keys = DUNGEON_KEYS; P.dungeon.keysDay = dk; }
  if (P.abyss && P.abyss.day !== dk) { P.abyss.keys = ABYSS_KEYS; P.abyss.day = dk; }
  ensureWheel(now);
  if (P.arena.ticketsDay !== dk) { P.arena.tickets = ARENA_TICKETS + (currentEvent().arena ? 5 : 0); P.arena.ticketsDay = dk; }
  if (!P.challenges || P.challenges.day !== dk) genChallenges(dk);
  if (!P.shop || P.shop.day !== dk) genShop(dk);
  const wk = weekIndex(now);
  if (!P.wb || P.wb.week !== wk) P.wb = { week: wk, dmg: 0, attacks: 0, day: dk, claimed: [] };
  if (P.wb.day !== dk) { P.wb.day = dk; P.wb.attacks = 0; }
  if (!P.event || P.event.week !== wk) P.event = { week: wk, points: 0, claimed: [] };
  if (P.guild.id !== null) {
    if (!P.guild.gb || P.guild.gb.week !== wk) P.guild.gb = { week: wk, dmg: 0, attacks: 0, day: dk, claimed: [] };
    if (P.guild.gb.day !== dk) { P.guild.gb.day = dk; P.guild.gb.attacks = 0; }
  }
  // sezon areny
  if (P.arena.season !== wk) {
    const lg = leagueOf(P.arena.best);
    const L = LEAGUES[lg];
    P.seasonRewards.push({ season: P.arena.season, league: lg, cr: L.reward, skin: lg >= 2 });
    P.arena.season = wk;
    P.arena.rating = Math.round(1000 + (P.arena.rating - 1000) * 0.5);
    P.arena.best = P.arena.rating;
    P.arena.opp = [];
  }
  if (!P.quest.offers.length && !P.quest.active) genOffers();
  P.guildBonus = guildBonus();
}

// ——— Postęp ———
// czy zdobywanie poziomów stoi na progu przebudzenia (poziom 100/110/…/140 bez Przebudzenia)
export const expBlocked = () => P.lvl >= levelCap(P) && P.lvl < MAX_LVL;
export function addExp(n) {
  n = Math.round(n * (n > 0 && liveActive('xp2') ? 2 : 1));
  if (P.lvl >= MAX_LVL) return 0;
  const cap = levelCap(P);
  if (P.lvl >= cap) {
    // EXP zbiera się tylko do pełnego paska – reszta przepada aż do Przebudzenia
    const before = P.exp;
    P.exp = Math.min(expNext(P.lvl), P.exp + n);
    return P.exp - before;
  }
  P.exp += n;
  let ups = 0;
  while (P.lvl < cap && P.exp >= expNext(P.lvl)) {
    P.exp -= expNext(P.lvl); P.lvl++; P.pts += 4; ups++;
    const sk = SKILLS[P.cls].find((s) => s.lvl === P.lvl);
    emit('levelup', P.lvl, sk);
  }
  if (P.lvl >= cap && P.lvl < MAX_LVL) P.exp = Math.min(P.exp, expNext(P.lvl));
  if (ups && P.autoStats) autoAllocate();
  if (P.lvl >= MAX_LVL) P.exp = 0;
  return n;
}
export function addGold(n) { n = Math.round(n * (n > 0 && liveActive('gold2') ? 2 : 1)); P.gold += n; return n; }
export function addCrystals(n) { P.crystals += n; return n; }
function eventPoints(n) { if (P.event) P.event.points += n; }
export function track(id, n = 1) {
  if (!P.daily) return;
  for (const m of P.daily.missions) if (m.id === id && !m.claimed) m.prog = Math.min(m.goal, m.prog + n);
}

export function allocate(stat, n = 1) {
  n = Math.min(n, P.pts);
  if (n <= 0) return;
  P.alloc[stat] += n; P.pts -= n; save(); emit('change');
}
export function autoAllocate() {
  const main = CLASSES[P.cls].main;
  while (P.pts > 0) {
    const r = P.pts;
    const k = r % 4 === 0 ? 'con' : r % 4 === 2 ? 'lck' : main;
    P.alloc[k]++; P.pts--;
  }
  save(); emit('change');
}
export function resetStats() {
  if (P.crystals < 20) return toast('Potrzebujesz 20 kryształów.', 'bad');
  P.crystals -= 20;
  let s = 0; for (const k of STATS) { s += P.alloc[k]; P.alloc[k] = 0; }
  P.pts += s; save(); emit('change'); toast('Statystyki zresetowane.');
}
export const talentPointsTotal = () => talentPointsFor(P.lvl);
export const talentPointsUsed = () => Object.values(P.talents).reduce((a, b) => a + b, 0);
export function learnTalent(id) {
  const cur = P.talents[id] || 0;
  if (cur >= TALENT_MAX) return;
  if (talentPointsUsed() >= talentPointsTotal()) return toast('Brak punktów talentów. Zdobywasz 1 co 2 poziomy.', 'bad');
  P.talents[id] = cur + 1; save(); emit('change');
}
export function resetTalents() {
  const cost = 200 + P.lvl * 20;
  if (P.gold < cost) return toast(`Reset kosztuje ${fmt(cost)} złota.`, 'bad');
  P.gold -= cost; P.talents = {}; save(); emit('change'); toast('Talenty zresetowane.');
}

// ——— Ekwipunek ———
export const stats = () => calcStats(P);
export const power = () => playerPower(P);
export function compare(it) {
  const eq = { ...P.equip, [it.slot]: it };
  return Math.round(powerOf(calcStats(P, eq)) * awakenPowerMul(P)) - power();
}
export function addItem(it, silentFull = false) {
  if (it.rarity === 4) { P.stats.legendaries++; }
  if (it.rarity >= MYTHIC) { P.stats.mythics = (P.stats.mythics || 0) + 1; }
  // legendarne i mityczne nigdy nie są sprzedawane automatycznie – plecak może się chwilowo przepełnić
  if (P.bag.length >= BAG_SIZE && it.rarity < 4) {
    const g = sellPrice(it); P.gold += g;
    if (!silentFull) toast(`Plecak pełny! „${it.name}” sprzedano za ${fmt(g)} zł.`, 'bad');
    return false;
  }
  P.bag.push(it); return true;
}
export function equip(uid) {
  const i = P.bag.findIndex((x) => x.uid === uid);
  if (i < 0) return;
  const it = P.bag[i];
  const old = P.equip[it.slot];
  P.bag.splice(i, 1);
  if (old) P.bag.push(old);
  P.equip[it.slot] = it;
  save(); emit('change'); emit('appearance');
}
export function unequip(slot) {
  const it = P.equip[slot];
  if (!it) return;
  if (P.bag.length >= BAG_SIZE) return toast('Plecak jest pełny.', 'bad');
  P.equip[slot] = null; P.bag.push(it); save(); emit('change'); emit('appearance');
}
export function autoEquip() {
  let changed = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (const slot of SLOTS) {
      let best = null, bestD = 0;
      for (const it of P.bag) if (it.slot === slot) { const d = compare(it); if (d > bestD) { bestD = d; best = it; } }
      if (best) { equip(best.uid); changed++; }
    }
  }
  P.tutAuto = true; save();
  toast(changed ? `Założono ${changed} lepszych przedmiotów.` : 'Masz już najlepsze wyposażenie.');
}
export function sell(uid) {
  const i = P.bag.findIndex((x) => x.uid === uid);
  if (i < 0) return;
  const g = sellPrice(P.bag[i]); P.gold += g; P.bag.splice(i, 1);
  track('sell'); save(); emit('change'); emit('sfx', 'coin');
  return g;
}
export function sellJunk() {
  let g = 0, n = 0;
  P.bag = P.bag.filter((it) => {
    if (it.rarity <= 1 && compare(it) <= 0) { g += sellPrice(it); n++; return false; }
    return true;
  });
  P.gold += g; track('sell', n); save(); emit('change');
  if (n) emit('sfx', 'coin');
  toast(n ? `Sprzedano ${n} słabszych przedmiotów za ${fmt(g)} zł.` : 'Brak zbędnych przedmiotów do sprzedania.');
}
export function findItem(uid) {
  for (const s of SLOTS) if (P.equip[s]?.uid === uid) return P.equip[s];
  return P.bag.find((x) => x.uid === uid);
}
export function upgrade(uid) {
  const it = findItem(uid);
  if (!it) return;
  if (it.up >= MAX_UP) return toast('Przedmiot ma maksymalne ulepszenie.', 'bad');
  const c = upgradeCost(it);
  if (P.gold < c) return toast('Za mało złota.', 'bad');
  P.gold -= c; it.up++; track('upgrade'); eventPoints(3);
  save(); emit('change'); emit('sfx', 'levelup'); emit('appearance');
  toast(`${it.name} +${it.up}!`, 'good');
}

// ——— Łupy ———
function lootBoost() { return (currentEvent().lootBoost || 0) + (liveActive('gold2') ? 1 : 0); }
export function rollItem(lvl, minRarity = 0, boost = 0) {
  const st = stats();
  let r = rollRarity(st.findPct, boost + lootBoost());
  r = Math.max(r, minRarity);
  return genItem({ lvl: clamp(lvl + R.int(-1, 1), 1, MAX_LVL), rarity: r, cls: P.cls });
}
function goldMul() { return 1 + stats().goldPct / 100 + ((currentEvent().goldMul || 1) - 1); }
function expMul(isQuest) { return 1 + stats().expPct / 100 + (isQuest ? (currentEvent().expMul || 1) - 1 : 0); }

// ——— Przygody ———
export function genOffers() {
  const r = rng(P.name + dayKey() + ':' + P.quest.gen++);
  const offers = [];
  const L = P.lvl;
  const usedQ = new Set();
  const durations = [r.int(1, 3), r.int(3, 6), r.int(6, 10)];
  for (let i = 0; i < 3; i++) {
    let qi; do { qi = r.int(0, QUESTS.length - 1); } while (usedQ.has(qi)); usedQ.add(qi);
    const q = QUESTS[qi];
    const mins = durations[i];
    const pool = ENEMIES.filter((e) => e.minLvl <= Math.max(1, L + 2));
    const enemy = pool.length > 6 ? r.pick(pool.slice(-12)) : r.pick(pool);
    const rare = r() < 0.12;
    offers.push({
      qi, loc: q.loc, title: q.t, desc: q.d, mins,
      exp: Math.round(expNext(L) * questLvlRate(L) * mins * r.range(0.9, 1.1)),
      gold: Math.round(goldBase(L) * mins * r.range(0.85, 1.2)),
      itemChance: Math.min(0.85, 0.3 + mins * 0.055),
      rare: rare ? (r() < 0.5 ? { cr: r.int(5, 15) } : { epic: true }) : null,
      enemy: enemy.id, elvl: L, diff: r.range(0.58, 0.76) + mins * 0.01 + Math.min(0.1, L * 0.004),
      energy: 6 + mins * 2,
    });
  }
  P.quest.offers = offers;
}
export function rerollOffers() {
  const cost = Math.round(goldBase(P.lvl) * 1.5);
  if (P.gold < cost) return toast(`Nowe zlecenia kosztują ${fmt(cost)} zł.`, 'bad');
  P.gold -= cost; genOffers(); save(); emit('change');
}
export const rerollCost = () => Math.round(goldBase(P.lvl) * 1.5);
export function questDuration(o) { return Math.round(o.mins * 60000 * (1 - stats().speedPct / 100)); }
export function startQuest(i) {
  if (P.quest.active) return;
  const o = P.quest.offers[i];
  if (!o) return;
  if (P.energy < o.energy) return toast('Za mało energii. Odnawia się z czasem (1 / 6 min).', 'bad');
  if (P.energy >= ENERGY_MAX) P.energyT = Date.now();
  P.energy -= o.energy;
  const now = Date.now();
  P.quest.active = { ...o, start: now, end: now + questDuration(o) };
  P.quest.offers = [];
  save(); emit('change');
}
export function questDone() { return P.quest.active && Date.now() >= P.quest.active.end; }
// pierwsza przygoda w samouczku: darmowe przyspieszenie, pewna wygrana i lepsze łupy
export const tutorialQuest = () => P.tut !== 'done' && P.stats.quests === 0;
export function skipQuestCost() {
  if (!P.quest.active) return 0;
  if (tutorialQuest()) return 0;
  return Math.max(1, Math.ceil((P.quest.active.end - Date.now()) / 60000));
}
export function skipQuest() {
  const c = skipQuestCost();
  if (P.crystals < c) return toast('Za mało kryształów.', 'bad');
  P.crystals -= c; P.quest.active.end = Date.now(); save(); emit('change');
}
export function cancelQuest() {
  if (!P.quest.active) return;
  P.energy = Math.min(ENERGY_MAX, P.energy + P.quest.active.energy);
  P.quest.active = null; genOffers(); save(); emit('change');
}
// walka kończąca przygodę → zwraca specyfikację bitwy
export function questEnemy(o) {
  const e = ENEMIES[o.enemy];
  const B = enemyFighter(e, o.elvl, 1);
  return scaleFighter(B, (power() * o.diff) / Math.max(1, fighterPower(B)));
}
export function questBattle() {
  const q = P.quest.active;
  if (!q || !questDone()) return null;
  const e = ENEMIES[q.enemy];
  const tutorial = tutorialQuest();
  const A = playerFighter(P), B = questEnemy(tutorial ? { ...q, diff: 0.4 } : q);
  const sim = simulate(A, B);
  const win = sim.winner === 0;
  P.stats.fights++;
  const rew = { gold: 0, exp: 0, items: [], cr: 0 };
  if (win) {
    P.stats.wins++; P.stats.quests++;
    rew.gold = addGold(q.gold * goldMul() * (tutorial ? 3 : 1));
    rew.exp = addExp(tutorial ? Math.max(q.exp * 4, expNext(P.lvl) * 1.3) : q.exp * expMul(true));
    if (tutorial) {
      // gwarantowane ulepszenia pokazujące porównywanie ekwipunku
      for (const [slot, rar] of [['weapon', 2], ['armor', 1]]) {
        const it = genItem({ lvl: P.lvl + 1, rarity: rar, cls: P.cls, slot });
        addItem(it); rew.items.push(it);
      }
    } else if (R() < q.itemChance) { const it = rollItem(P.lvl); addItem(it); rew.items.push(it); }
    if (q.rare?.cr) rew.cr = addCrystals(q.rare.cr);
    if (q.rare?.epic) { const it = rollItem(P.lvl, 3); addItem(it); rew.items.push(it); }
    track('quests'); track('wins'); eventPoints(10); wheelToken(1);
  } else {
    rew.gold = addGold(q.gold * 0.25);
    rew.exp = addExp(q.exp * 0.25);
  }
  P.quest.active = null;
  genOffers();
  // losowe wydarzenie
  let event = null;
  if (win && R() < 0.4) event = { ...R.pick(EVENTS), gold: q.gold, exp: q.exp };
  save();
  return {
    kind: 'quest', title: q.title, bg: q.loc, A, B, sim, win, rew, event,
    rightImg: `enemies/${e.img}.webp`, rightName: e.name, rightLvl: q.elvl,
  };
}
export function resolveEvent(ev, choice) {
  const fx = choice === 'a' ? ev.a.fx : ev.b.fx;
  let msg = 'Nic się nie wydarzyło.';
  const L = P.lvl;
  switch (fx) {
    case 'buyBox': {
      const c = Math.round(ev.gold * 0.3);
      if (P.gold >= c) { P.gold -= c; const it = rollItem(L, 1, 0.5); addItem(it); msg = `Kupiłeś skrzynkę: ${it.name} (${RARITIES[it.rarity].name})!`; }
      else msg = 'Nie stać cię. Kupiec prycha i odchodzi.';
      break;
    }
    case 'wish': if (P.gold >= 10) { P.gold -= 10; if (R() < 0.35) { addCrystals(5); msg = 'Życzenie spełnione: +5 kryształów!'; } else msg = 'Plusk. Nic. Może następnym razem.'; } break;
    case 'risk': if (R() < 0.55) { const g = addGold(ev.gold * 0.8); msg = `Udało się! +${fmt(g)} złota.`; } else { const g = Math.round(P.gold * 0.05); P.gold -= g; msg = `Smoczątko się obudziło i ugryzło cię w sakiewkę. −${fmt(g)} zł.`; } break;
    case 'safeExp': { const e = addExp(ev.exp * 0.3); msg = `Spokój ducha: +${fmt(e)} EXP.`; break; }
    case 'bard': { const e = addExp(ev.exp * 0.2); const g = addGold(ev.gold * 0.2); msg = `Bard gra balladę o tobie. +${fmt(e)} EXP, +${fmt(g)} zł.`; break; }
    case 'trapChest': if (R() < 0.6) { const it = rollItem(L, 1); addItem(it); msg = `W skrzyni: ${it.name}!`; } else { msg = 'Pułapka! Ale tylko pomalowała cię na różowo. Wstyd, nie ból.'; } break;
    case 'dice': if (R() < 0.5) { const g = addGold(ev.gold * 0.6); msg = `Wygrana w kości! +${fmt(g)} zł.`; } else { const g = Math.min(P.gold, Math.round(ev.gold * 0.3)); P.gold -= g; msg = `Mnich oszukuje. −${fmt(g)} zł.`; } break;
    case 'kitten': { addCrystals(3); const e = addExp(ev.exp * 0.1); msg = `Kotek mruczy z wdzięcznością. +3 kryształy, +${fmt(e)} EXP.`; break; }
    case 'item': if (R() < 0.7) { const it = rollItem(L, 0, 0.3); addItem(it); msg = `Zdobywasz: ${it.name}!`; } else msg = 'To był miecz z kartonu. Ktoś się śmieje w krzakach.'; break;
    default: break;
  }
  save(); emit('change');
  return msg;
}

// ——— Idle ———
export function idleRates() {
  const st = stats();
  const L = P.lvl;
  const m = 1 + st.idlePct / 100;
  return { gold: goldBase(L) * 0.3 * m * goldMul(), exp: expNext(L) * questLvlRate(L) * 0.12 * m * expMul(false) };
}
export function idlePending() {
  const ms = Math.min(IDLE_CAP_MS, Date.now() - P.idleT);
  const r = idleRates();
  const mins = ms / 60000;
  return { ms, gold: Math.floor(r.gold * mins), exp: Math.floor(r.exp * mins), full: ms >= IDLE_CAP_MS, item: mins >= 120 };
}
export function claimIdle() {
  const p = idlePending();
  if (p.gold < 1 && p.exp < 1) return null;
  addGold(p.gold); addExp(p.exp);
  let it = null;
  if (p.item) { it = rollItem(P.lvl); addItem(it); }
  P.idleT = Date.now();
  track('idle'); save(); emit('change'); emit('sfx', 'coin');
  return { ...p, it };
}

// ——— Dzienne ———
export function claimMission(i) {
  const m = P.daily.missions[i];
  if (!m || m.claimed || m.prog < m.goal) return;
  m.claimed = true;
  const g = addGold(goldBase(P.lvl) * 4); const e = addExp(expNext(P.lvl) * 0.08); addCrystals(5);
  eventPoints(8); wheelToken(1);
  save(); emit('change'); emit('sfx', 'coin');
  toast(`Misja ukończona: +${fmt(g)} zł, +${fmt(e)} EXP, +5 kryształów`, 'good');
}
export const allMissionsDone = () => P.daily.missions.every((m) => m.claimed);
export function claimDailyChest() {
  if (P.daily.chest || !allMissionsDone()) return null;
  P.daily.chest = true;
  const it = rollItem(P.lvl, 3, 0.6);
  addItem(it); addCrystals(15);
  save(); emit('change'); emit('sfx', 'levelup');
  return it;
}
export function claimLogin() {
  if (P.login.claimed) return null;
  const idx = (P.login.streak - 1) % 7;
  const rw = LOGIN_REWARDS[idx];
  P.login.claimed = true;
  const out = { t: rw.t, gold: 0, cr: 0, item: null };
  if (rw.gold) out.gold = addGold(goldBase(P.lvl) * rw.gold);
  if (rw.cr) out.cr = addCrystals(rw.cr);
  if (rw.item) { out.item = rollItem(P.lvl, rw.item); addItem(out.item); }
  save(); emit('change'); emit('sfx', 'coin');
  return out;
}
export function buyEnergy() {
  if (P.daily.energyBuy) return toast('Dziś już uzupełniłeś energię.', 'bad');
  if (P.crystals < 20) return toast('Potrzebujesz 20 kryształów.', 'bad');
  P.crystals -= 20; P.energy = ENERGY_MAX; P.daily.energyBuy = true; save(); emit('change');
}

// ——— Lochy ———
export function dungeonUnlocked(d) { return P.lvl >= DUNGEONS[d].reqLvl && (d === 0 || P.dungeon.progress[d - 1] >= 10); }
export function floorSpec(d, f) {
  const D = DUNGEONS[d];
  const boss = f === 10;
  if (boss) { const b = BOSSES[d]; return { boss: true, e: { ...b, arch: 'boss' }, lvl: D.reqLvl + 10, diff: 1.0, img: `bosses/${b.img}.webp`, name: b.name }; }
  const e = ALL_ENEMIES[D.pool[(f - 1) % D.pool.length]];
  return { boss: false, e, lvl: D.reqLvl + f - 1, diff: 0.72 + f * 0.03, img: `enemies/${e.img}.webp`, name: e.name };
}
export function dungeonEnemy(d, f) {
  const s = floorSpec(d, f);
  let B;
  if (s.boss) {
    // bossowie: jednolity profil (bez skrajnych „tanków”), skalowani do przeciętnego gracza na ich poziomie
    B = enemyFighter({ ...s.e, hp: 1, dmg: 1, armor: 1.1, dodge: 3, crit: 7 }, s.lvl, 1, { hpMul: 1.5, boss: true });
    B.bossSkill = BOSSES[d].title;
    scaleFighter(B, (refPower(s.lvl) * 1.05) / Math.max(1, fighterPower(B)));
  } else B = enemyFighter(s.e, s.lvl, s.diff);
  return { s, B };
}
export function dungeonBattle(d) {
  if (!dungeonUnlocked(d)) return null;
  const fl = P.dungeon.progress[d] + 1;
  if (fl > 10) return null;
  if (P.dungeon.keys <= 0) { toast('Brak kluczy do lochów. Jutro dostaniesz nowe!', 'bad'); return null; }
  P.dungeon.keys--;
  const { s, B } = dungeonEnemy(d, fl);
  const A = playerFighter(P);
  const sim = simulate(A, B);
  const win = sim.winner === 0;
  P.stats.fights++;
  const rew = { gold: 0, exp: 0, items: [], cr: 0, skin: null };
  if (win) {
    P.stats.wins++;
    P.dungeon.progress[d] = fl;
    rew.gold = addGold(goldBase(s.lvl) * (s.boss ? 25 : 5) * goldMul());
    rew.exp = addExp(expNext(Math.min(P.lvl, s.lvl)) * (s.boss ? 0.6 : 0.12) * expMul(false));
    if (s.boss) {
      P.stats.bosses++;
      const it = rollItem(s.lvl, 4); addItem(it); rew.items.push(it);
      rew.cr = addCrystals(50);
      if (d === 3 && !P.skinsOwned.includes('royal')) { P.skinsOwned.push('royal'); rew.skin = 'royal'; }
      if (d === 9 && !P.skinsOwned.includes('cosmic')) { P.skinsOwned.push('cosmic'); rew.skin = 'cosmic'; }
    } else if (R() < 0.45) { const it = rollItem(s.lvl, 1); addItem(it); rew.items.push(it); }
    track('dungeon'); track('wins'); eventPoints(8); wheelToken(1);
  } else {
    rew.gold = addGold(goldBase(s.lvl) * 1);
  }
  save();
  return { kind: 'dungeon', title: `${DUNGEONS[d].name} – piętro ${fl}`, bg: s.boss ? BOSSES[d].bg : DUNGEONS[d].bg, A, B, sim, win, rew, rightImg: s.img, rightName: s.name, rightLvl: s.lvl, boss: s.boss };
}
// szybkie zamiatanie ukończonych pięter
export function sweepDungeon(d) {
  const best = P.dungeon.progress[d];
  if (best < 1) return;
  if (P.dungeon.keys <= 0) return toast('Brak kluczy.', 'bad');
  P.dungeon.keys--;
  const s = floorSpec(d, Math.min(9, best));
  const g = addGold(goldBase(s.lvl) * 4 * goldMul());
  const e = addExp(expNext(Math.min(P.lvl, s.lvl)) * 0.1 * expMul(false));
  let txt = `Zamiatanie: +${fmt(g)} zł, +${fmt(e)} EXP`;
  if (R() < 0.4) { const it = rollItem(s.lvl, 1); addItem(it); txt += `, ${it.name}`; }
  track('dungeon'); eventPoints(5);
  save(); emit('change'); emit('sfx', 'coin'); toast(txt, 'good');
}

// ——— Wyzwania dzienne ———
function genChallenges(dk) {
  const r = rng('ch' + dk + P.name);
  const mods = [...CHALLENGE_MODS];
  const list = [];
  for (let i = 0; i < 3; i++) {
    const m = mods.splice(r.int(0, mods.length - 1), 1)[0];
    const pool = ENEMIES.filter((e) => e.minLvl <= P.lvl + 5);
    list.push({ mod: m.id, enemy: r.pick(pool.slice(-10)).id, tier: i, done: false });
  }
  P.challenges = { day: dk, list };
}
export function challengeEnemy(c) {
  const m = CHALLENGE_MODS.find((x) => x.id === c.mod);
  const e = ENEMIES[c.enemy];
  const L = P.lvl + (m.lvl || 0) + c.tier;
  const base = enemyFighter(e, L, 1, m.opts);
  const k = (power() * (0.85 + c.tier * 0.12) * (m.lvl ? 1.08 : 1)) / Math.max(1, fighterPower(base));
  return { B: scaleFighter(base, k), m, e, L };
}
export function challengeBattle(i) {
  const c = P.challenges.list[i];
  if (!c || c.done) return null;
  const { B, m, e, L } = challengeEnemy(c);
  const A = playerFighter(P);
  if (m.me) { if (m.me.dodge === 0) A.dodge = 0; if (m.me.hpMul) { A.maxHp = Math.round(A.maxHp * m.me.hpMul); A.hp = A.maxHp; } if (m.me.crit) A.crit += m.me.crit; }
  const sim = simulate(A, B);
  const win = sim.winner === 0;
  P.stats.fights++;
  const rew = { gold: 0, exp: 0, items: [], cr: 0 };
  if (win) {
    P.stats.wins++; c.done = true;
    rew.cr = addCrystals([8, 12, 20][c.tier]);
    rew.gold = addGold(goldBase(L) * (4 + c.tier * 2) * goldMul());
    rew.exp = addExp(expNext(P.lvl) * 0.06 * (1 + c.tier));
    if (c.tier === 2) { const it = rollItem(L, 2); addItem(it); rew.items.push(it); }
    track('challenge'); track('wins'); eventPoints(8);
  }
  save();
  return { kind: 'challenge', title: `Wyzwanie: ${m.name}`, bg: 'arena', A, B, sim, win, rew, rightImg: `enemies/${e.img}.webp`, rightName: e.name, rightLvl: L };
}

// ——— Boss światowy ———
export function wbAttack() {
  if (P.wb.attacks >= WB_ATTACKS) { toast('Wykorzystałeś dzisiejsze ataki na bossa.', 'bad'); return null; }
  const info = worldBossInfo();
  if (wbProgress() >= 1) { toast('Boss już padł w tym tygodniu! Odbierz nagrody.', 'bad'); return null; }
  P.wb.attacks++;
  const b = BOSSES[info.bossIdx];
  const A = playerFighter(P);
  const B = enemyFighter({ ...b, arch: 'boss', hp: 1, dmg: 1, armor: 1, dodge: 0, crit: 5 }, P.lvl + 3, 1, { hpMul: 50, dmgMul: 0.8, boss: true });
  B.bossSkill = b.title;
  const sim = simulate(A, B);
  const dmg = Math.max(0, Math.round(sim.dmgDealt[0]));
  P.wb.dmg += dmg;
  P.stats.maxDmg = Math.max(P.stats.maxDmg, dmg);
  netCall(Net.pushBossDamage('world', 'world', P.wb.week, P.wb.dmg), 'boss światowy');
  const rew = { gold: addGold(goldBase(P.lvl) * 3 * goldMul()), exp: addExp(expNext(P.lvl) * 0.05), items: [], cr: 0, dmg };
  track('wboss'); eventPoints(10); wheelToken(1);
  save();
  return { kind: 'wboss', title: `Boss Światowy: ${b.name}`, bg: b.bg, A, B, sim, win: true, rew, rightImg: `bosses/${b.img}.webp`, rightName: b.name, rightLvl: P.lvl + 3, boss: true, damageMode: true };
}
export const WB_MILESTONES = [0.25, 0.5, 0.75, 1];
// wkład prawdziwych graczy (bez własnego wpisu – liczony lokalnie)
const netWorldOthers = () => (Net.isOnline() ? Math.max(0, Net.Net.boss.worldTotal - Net.Net.boss.worldOwnServer) : 0);
// pula PŻ = 40× suma siły aktywnych graczy (Ty + gracze online widziani w ostatnich 3 dniach);
// typowy atak zadaje ok. 1,3–4× siły, więc aktywna społeczność pokonuje bossa ok. 5.–6. dnia; offline walczysz sam
const WB_HP_PER_POWER = 40;
const ACTIVE_MS = 3 * 86400000;
export function wbMaxHp() {
  const now = Date.now();
  let sum = power();
  if (Net.isOnline()) for (const p of Net.Net.players) if (!p.updated_at || now - new Date(p.updated_at).getTime() < ACTIVE_MS) sum += Math.max(0, Number(p.power) || 0);
  return Math.max(1, Math.round(sum * WB_HP_PER_POWER));
}
export function wbProgress() { return Math.min(1, (netWorldOthers() + P.wb.dmg) / wbMaxHp()); }
export function wbContributors() {
  const list = [{ name: P.name, cls: P.cls, dmg: P.wb.dmg, me: true }];
  if (Net.isOnline()) list.push(...Net.Net.boss.contributors);
  return list.sort((a, b) => b.dmg - a.dmg);
}
export function wbClaim(k) {
  if (P.wb.claimed.includes(k) || P.wb.dmg <= 0 || wbProgress() < WB_MILESTONES[k]) return;
  P.wb.claimed.push(k);
  const cr = [10, 15, 20, 30][k];
  addCrystals(cr);
  let txt = `+${cr} kryształów`;
  if (k === 3) { const it = rollItem(P.lvl, 3, 0.5); addItem(it); txt += `, ${it.name}`; }
  else { const g = addGold(goldBase(P.lvl) * 6); txt += `, +${fmt(g)} zł`; }
  save(); emit('change'); emit('sfx', 'levelup'); toast('Nagroda bossa: ' + txt, 'good');
}

// ——— Arena ———
// rywal areny = prawdziwy gracz z serwera (id „net:<uuid>”), walka z kopią jego postaci
function opponentInfo(id) {
  if (!id.startsWith('net:')) return null;
  const row = Net.Net.players.find((p) => 'net:' + p.id === id);
  if (!row) return null;
  return { id, name: row.name, cls: row.cls, look: row.look, hue: row.hue, skin: row.skin, lvl: row.lvl, rating: row.rating, online: true, fighter: () => Net.fighterFromRow(row) };
}
// do 3 rywali o podobnej sile; przy małej liczbie graczy (testy) – wszyscy dostępni
export function arenaOpponents() {
  if (P.arena.opp.length) {
    const cur = P.arena.opp.map(opponentInfo);
    if (cur.every(Boolean)) return cur;
  }
  P.arena.opp = [];
  if (!Net.isOnline()) return [];
  const my = power();
  const lvlOk = (l) => Math.abs(l - P.lvl) <= Math.max(6, P.lvl * 0.35);
  const all = Net.Net.players.map((row) => ({ id: 'net:' + row.id, p: Number(row.power) || 0, l: row.lvl }));
  let near = all.filter((x) => lvlOk(x.l));
  if (near.length < 3) near = all;
  near = near.sort((a, b) => Math.abs(a.p - my) - Math.abs(b.p - my)).slice(0, 24);
  const sorted = [...near].sort((a, b) => a.p - b.p);
  if (sorted.length <= 3) P.arena.opp = sorted.map((x) => x.id);
  else {
    const third = Math.floor(sorted.length / 3);
    P.arena.opp = [sorted.slice(0, third), sorted.slice(third, third * 2), sorted.slice(third * 2)].map((part) => R.pick(part).id);
  }
  return P.arena.opp.map(opponentInfo);
}
export function arenaBattle(oppId) {
  if (P.arena.tickets <= 0) { toast('Brak biletów areny. Odnawiają się codziennie.', 'bad'); return null; }
  const o = opponentInfo(oppId);
  if (!o) { toast(Net.isOnline() ? 'Ten rywal jest już niedostępny – odśwież listę.' : 'Arena działa w trybie online.', 'bad'); P.arena.opp = []; return null; }
  const b = o;
  P.arena.tickets--;
  const L = o.lvl;
  const A = playerFighter(P), B = o.fighter();
  const sim = simulate(A, B);
  const win = sim.winner === 0;
  const oppR = o.rating;
  const mul = currentEvent().arena ? 1.5 : 1;
  let dr;
  if (win) dr = Math.round(clamp(20 + (oppR - P.arena.rating) / 25, 8, 40) * mul);
  else dr = -Math.round(clamp(15 + (P.arena.rating - oppR) / 25, 5, 30));
  P.arena.rating = Math.max(0, P.arena.rating + dr);
  P.arena.best = Math.max(P.arena.best, P.arena.rating);
  P.stats.fights++;
  const rew = { gold: 0, exp: 0, items: [], cr: 0, rating: dr };
  if (win) {
    P.arena.wins++; P.stats.wins++;
    rew.gold = addGold(goldBase(P.lvl) * 2.5 * goldMul()); rew.exp = addExp(expNext(P.lvl) * 0.04 * expMul(false));
    track('wins');
  } else { P.arena.losses++; rew.gold = addGold(goldBase(P.lvl) * 0.5); }
  track('arena'); eventPoints(6); wheelToken(1);
  P.arena.opp = [];
  save();
  pushProfileSoon();
  const look = CLASSES[b.cls].looks[b.look];
  return { kind: 'arena', title: `Arena: ${b.name}`, bg: 'arena', A, B, sim, win, rew, rightImg: `heroes/${look}.webp`, rightHero: { cls: b.cls, look: b.look, hue: b.hue, skin: b.skin, lvl: L }, rightName: b.name, rightLvl: L };
}
export function claimSeasonReward() {
  const r = P.seasonRewards.shift();
  if (!r) return null;
  addCrystals(r.cr);
  if (r.skin && !P.skinsOwned.includes('infernal')) P.skinsOwned.push('infernal');
  save(); emit('change');
  return r;
}

// ——— Rankingi ———
export function leaderboard(kind) {
  const rows = [];
  if (Net.isOnline()) {
    const gname = Object.fromEntries(Net.Net.guilds.map((g) => [g.id, g.name]));
    for (const p of Net.Net.players) rows.push({ id: p.id, name: p.name, cls: p.cls, lvl: p.lvl, power: Number(p.power) || 0, rating: p.rating, abyss: Number(p.abyss) || 0, guild: gname[p.guild_id] || '—', online: true });
  }
  rows.push({ name: P.name, cls: P.cls, lvl: P.lvl, power: power(), rating: P.arena.rating, abyss: P.abyss?.floor || 0, guild: guildName() || '—', me: true });
  const key = kind === 'power' ? 'power' : kind === 'arena' ? 'rating' : kind === 'abyss' ? 'abyss' : 'lvl';
  rows.sort((a, b) => b[key] - a[key] || b.power - a.power);
  return rows;
}

// ——— Gildia ———
export const isNetGuild = () => typeof P.guild.id === 'string' && P.guild.id.startsWith('net:');
export const guildNetId = () => (isNetGuild() ? P.guild.id.slice(4) : null);
export function guildName() { return isNetGuild() ? P.guild.netName : null; }
// członkowie gildii (bez gracza) – prawdziwi gracze z serwera
export function guildMembersInfo() {
  if (!isNetGuild()) return [];
  const gid = guildNetId();
  return Net.Net.players.filter((p) => p.guild_id === gid).map((p) => ({ id: p.id, name: p.name, cls: p.cls, lvl: p.lvl, power: Number(p.power) || 0, online: true }));
}
export function guildLevel() {
  if (P.guild.id === null) return 0;
  const m = guildMembersInfo();
  const sum = m.reduce((s, x) => s + x.lvl, 0) + P.lvl;
  const bonusFromBoss = P.guild.gb ? P.guild.gb.claimed.length : 0;
  return Math.max(1, Math.floor(Math.sqrt(sum / 6)) + bonusFromBoss);
}
export function guildBonus() { return P.guild.id === null ? 0 : Math.min(15, guildLevel()); }
export async function joinNetGuild(id) {
  const g = Net.Net.guilds.find((x) => x.id === id);
  if (!g) return toast('Nie znaleziono gildii.', 'bad');
  try {
    await Net.joinGuild(id);
  } catch (e) { return toast('Nie udało się dołączyć: ' + e.message, 'bad'); }
  P.guild = { id: 'net:' + id, netName: g.name, joined: Date.now(), own: null, gb: null };
  P.chat.guild = [];
  tick(); save(); emit('change'); emit('guildChanged');
  toast(`Dołączyłeś do gildii ${g.name}!`, 'good');
}
export function createGuild(name) {
  const cost = 1000;
  if (!Net.isOnline()) return toast('Gildie działają w trybie online – połącz grę z serwerem.', 'bad');
  if (P.gold < cost) return toast(`Założenie gildii kosztuje ${fmt(cost)} złota.`, 'bad');
  name = (name || '').trim().slice(0, 28);
  if (name.length < 3) return toast('Nazwa gildii musi mieć min. 3 znaki.', 'bad');
  return Net.createGuild(name).then((g) => {
    P.gold -= cost;
    P.guild = { id: 'net:' + g.id, netName: g.name, joined: Date.now(), own: null, gb: null };
    P.chat.guild = [];
    tick(); save(); emit('change'); emit('guildChanged'); toast(`Założyłeś gildię ${name}!`, 'good');
  }).catch((e) => toast(/duplicate|unique/i.test(e.message) ? 'Ta nazwa gildii jest już zajęta.' : 'Nie udało się założyć gildii: ' + e.message, 'bad'));
}
export function leaveGuild() {
  if (isNetGuild() && !Net.isOnline()) return toast('Połącz grę z serwerem, aby opuścić gildię.', 'bad');
  if (isNetGuild()) netCall(Net.leaveGuild(), 'opuszczanie gildii');
  P.guild = { id: null, joined: 0, own: null, gb: null }; P.chat.guild = []; save(); emit('change'); emit('guildChanged');
}
export function guildBossInfo() {
  const info = worldBossInfo();
  const b = BOSSES[(info.bossIdx + 4) % 10];
  const m = guildMembersInfo();
  const mp = m.reduce((s, x) => s + x.power, 0) + power();
  const maxHp = Math.round(mp * 34);
  const others = isNetGuild() ? Net.Net.boss.guildOthers : 0;
  const dealt = Math.min(maxHp, others + (P.guild.gb?.dmg || 0));
  return { boss: b, maxHp, dealt, prog: dealt / maxHp, members: m.length + 1 };
}
export function gbAttack() {
  if (P.guild.id === null) return null;
  if (P.guild.gb.attacks >= GB_ATTACKS) { toast('Wykorzystałeś dzisiejsze ataki na bossa gildii.', 'bad'); return null; }
  const gi = guildBossInfo();
  if (gi.prog >= 1) { toast('Boss gildii pokonany! Odbierz nagrody.', 'bad'); return null; }
  P.guild.gb.attacks++;
  const b = gi.boss;
  const A = playerFighter(P);
  const B = enemyFighter({ ...b, arch: 'boss', hp: 1, dmg: 1, armor: 1, dodge: 0, crit: 5 }, P.lvl + 2, 1, { hpMul: 50, dmgMul: 0.75, boss: true });
  B.bossSkill = b.title;
  const sim = simulate(A, B);
  const dmg = Math.max(0, Math.round(sim.dmgDealt[0]));
  P.guild.gb.dmg += dmg;
  if (isNetGuild()) netCall(Net.pushBossDamage('guild', guildNetId(), P.guild.gb.week, P.guild.gb.dmg), 'boss gildii');
  const rew = { gold: addGold(goldBase(P.lvl) * 2 * goldMul()), exp: addExp(expNext(P.lvl) * 0.04), items: [], cr: 0, dmg };
  track('gboss'); eventPoints(10); wheelToken(1);
  save();
  return { kind: 'gboss', title: `Boss Gildii: ${b.name}`, bg: 'guildhall', A, B, sim, win: true, rew, rightImg: `bosses/${b.img}.webp`, rightName: b.name, rightLvl: P.lvl + 2, boss: true, damageMode: true };
}
export const GB_TIERS = [0.25, 0.5, 0.75, 1];
export function gbClaim(k) {
  const gi = guildBossInfo();
  if (!P.guild.gb || P.guild.gb.claimed.includes(k) || gi.prog < GB_TIERS[k]) return;
  if (P.guild.gb.dmg <= 0) return toast('Zaatakuj bossa przynajmniej raz, aby odebrać nagrodę.', 'bad');
  P.guild.gb.claimed.push(k);
  const g = addGold(goldBase(P.lvl) * (4 + k * 3));
  const cr = addCrystals([5, 10, 15, 25][k]);
  let txt = `+${fmt(g)} zł, +${cr} kryształów`;
  if (k === 3) { const it = rollItem(P.lvl, 3); addItem(it); txt += `, ${it.name}`; }
  save(); emit('change'); emit('sfx', 'levelup'); toast('Nagroda gildii: ' + txt, 'good');
}

// ——— Czat (tylko prawdziwi gracze, przez serwer) ———
export function sendChat(channel, text) {
  text = cleanText(text.trim().slice(0, 140));
  if (!text) return;
  if (!Net.isOnline()) return toast('Czat działa w trybie online – połącz grę z serwerem.', 'bad');
  const netChannel = channel === 'guild' ? (isNetGuild() ? 'guild:' + guildNetId() : null) : 'global';
  if (!netChannel) return toast('Najpierw dołącz do gildii.', 'bad');
  // wiadomość wraca przez Realtime – nie dodajemy jej lokalnie, aby uniknąć duplikatów
  Net.sendChat(netChannel, P.name, P.cls, text).catch((e) => toast('Czat: ' + e.message, 'bad'));
}

// ——— Tryb online: profil, odświeżanie świata, czat na żywo ———
export function netProfile() {
  // snapshot bez efektów przebudzenia – odbiorca nakłada je sam na podstawie liczby „awak” (bez wstrzykiwania efektów)
  const f = playerFighter({ ...P, awak: 0 });
  const fighter = { awak: P.awak || 0 };
  for (const k of ['maxHp', 'dmgMin', 'dmgMax', 'armor', 'crit', 'critDmg', 'dodge', 'block', 'resist', 'pierce', 'leech', 'regen', 'skillPct', 'initPct', 'skills']) fighter[k] = f[k];
  // zwięzły zapis ekwipunku do podglądu przez innych graczy
  const equip = {};
  for (const s of SLOTS) {
    const it = P.equip[s];
    if (it) equip[s] = { t: it.tid, n: it.name, i: it.icon, r: it.rarity, l: it.lvl, u: it.up || 0, s: it.stats, d: it.dmg || 0, a: it.armor || 0, y: it.type || '', f: it.fx || '' };
  }
  const pet = P.pets && P.pets.active ? { id: P.pets.active, lvl: P.pets.owned[P.pets.active] || 1 } : null;
  return {
    name: P.name, cls: P.cls, look: P.look, hue: P.hue, skin: P.skin, lvl: P.lvl, power: power(), rating: P.arena.rating,
    guildNetId: guildNetId(), fighter, week: P.wb.week, equip, pet, abyss: P.abyss?.floor || 0,
  };
}
export async function connectOnline(cfg) {
  await Net.connect(cfg, netProfile());
  await syncNetGuild();
  await loadNetChat();
  P.arena.opp = [];
  emit('change');
}
let profileTimer = null;
export function pushProfileSoon() {
  if (!Net.isOnline() || profileTimer) return;
  profileTimer = setTimeout(() => { profileTimer = null; netCall(Net.pushProfile(netProfile(), true), 'profil'); }, 1500);
}
// okresowe odświeżenie (wywoływane co sekundę – samo dławi częstotliwość)
export function netTick() {
  if (!Net.isOnline()) return;
  const now = Date.now();
  if (now - Net.Net.lastProfile > 60000) netCall(Net.pushProfile(netProfile()), 'profil');
  if (now - Net.Net.lastRefresh > 45000) netCall(Net.refresh(P.wb.week, guildNetId()).then(syncNetGuild).then(() => emit('change')), 'odświeżanie');
}
// zgodność stanu gildii z serwerem (np. ktoś usunął gildię)
async function syncNetGuild() {
  if (!isNetGuild()) return;
  const g = Net.Net.guilds.find((x) => x.id === guildNetId());
  if (!g) { P.guild = { id: null, joined: 0, own: null, gb: null }; P.chat.guild = []; save(); toast('Twoja gildia online już nie istnieje.', 'bad'); return; }
  P.guild.netName = g.name;
}
async function loadNetChat() {
  P.chat.global = await Net.loadChat('global');
  if (isNetGuild()) P.chat.guild = await Net.loadChat('guild:' + guildNetId());
  emit('chat');
}
Net.onNet((type, msg) => {
  if (!P) return;
  if (type === 'chatDelete') {
    P.chat.global = P.chat.global.filter((m) => m.id !== msg);
    P.chat.guild = P.chat.guild.filter((m) => m.id !== msg);
    emit('chat');
    return;
  }
  if (type === 'live') { emit('change'); return; }
  if (type !== 'chat') return;
  if (msg.channel === 'global') P.chat.global.push(msg);
  else if (isNetGuild() && msg.channel === 'guild:' + guildNetId()) P.chat.guild.push(msg);
  else return;
  P.chat.global = P.chat.global.slice(-60); P.chat.guild = P.chat.guild.slice(-60);
  emit('chat');
});
on('guildChanged', () => { if (Net.isOnline()) netCall(Net.pushProfile(netProfile(), true).then(() => loadNetChat()), 'gildia'); });
on('levelup', () => pushProfileSoon());
function netCall(promise, label) {
  if (!promise || typeof promise.catch !== 'function') return;
  promise.catch((e) => { console.error(`Online (${label}):`, e); toast(`Błąd trybu online (${label}): ${e.message}`, 'bad'); });
}
export { Net };

// ——— Sklep ———
function genShop(dk, reroll = 0) {
  const r = rng('shop' + dk + P.name + reroll + P.lvl);
  const items = [];
  const slots = ['weapon', 'helmet', 'armor', 'gloves', 'boots', 'ring', 'amulet'];
  for (let i = 0; i < 6; i++) {
    const rar = Math.max(1, rollRarity(stats().findPct, 0.8, r));
    items.push(genItem({ lvl: P.lvl + r.int(0, 2), rarity: Math.min(rar, 3), cls: P.cls, slot: slots[(i + r.int(0, 6)) % 7], rnd: r }));
  }
  P.shop = { day: dk, items, rerolls: reroll };
}
export const shopRerollCost = () => Math.round(goldBase(P.lvl) * 3 * (1 + P.shop.rerolls * 0.5));
export function shopReroll() {
  const c = shopRerollCost();
  if (P.gold < c) return toast('Za mało złota.', 'bad');
  P.gold -= c; genShop(P.shop.day, P.shop.rerolls + 1); save(); emit('change');
}
export function shopBuy(uid) {
  const i = P.shop.items.findIndex((x) => x.uid === uid);
  if (i < 0) return;
  const it = P.shop.items[i];
  const price = buyPrice(it);
  if (P.gold < price) return toast('Za mało złota.', 'bad');
  if (P.bag.length >= BAG_SIZE) return toast('Plecak jest pełny.', 'bad');
  P.gold -= price; P.shop.items.splice(i, 1); P.bag.push(it);
  save(); emit('change'); emit('sfx', 'coin'); toast(`Kupiono: ${it.name}`, 'good');
}
export function buyChest() {
  if (P.crystals < 50) return toast('Potrzebujesz 50 kryształów.', 'bad');
  P.crystals -= 50;
  const it = rollItem(P.lvl, 2, 1.0);
  addItem(it); save(); emit('change'); emit('sfx', 'levelup');
  return it;
}
export function buySkin(id) {
  const s = SKINS[id];
  if (P.skinsOwned.includes(id)) { P.skin = id; save(); emit('change'); emit('appearance'); return; }
  if (s.src !== 'shop') return toast('Tę skórkę zdobywa się w grze: ' + s.desc, 'bad');
  if (P.crystals < s.cost) return toast('Za mało kryształów.', 'bad');
  P.crystals -= s.cost; P.skinsOwned.push(id); P.skin = id;
  save(); emit('change'); emit('appearance'); toast(`Nowa skórka: ${s.name}!`, 'good');
}
export function setAppearance(o) { Object.assign(P, o); save(); emit('change'); emit('appearance'); }

// ——— Wydarzenie tygodniowe ———
export function claimEventTier(k) {
  if (P.event.claimed.includes(k) || P.event.points < EVENT_TIERS[k]) return;
  P.event.claimed.push(k);
  let txt = '';
  switch (k) {
    case 0: txt = `+${fmt(addGold(goldBase(P.lvl) * 10))} zł`; break;
    case 1: txt = `+${addCrystals(20)} kryształów`; break;
    case 2: { const it = rollItem(P.lvl, 3); addItem(it); txt = it.name; break; }
    case 3: txt = `+${addCrystals(40)} kryształów`; break;
    case 4:
      if (!P.skinsOwned.includes('event')) { P.skinsOwned.push('event'); txt = 'Skórka „Łowca Smoków”!'; }
      else { const it = rollItem(P.lvl, 4); addItem(it); txt = it.name; }
      break;
  }
  save(); emit('change'); emit('sfx', 'levelup'); toast('Nagroda wydarzenia: ' + txt, 'good');
}

// ——— Samouczek ———
export function claimTutorialReward() {
  if (P.tut === 'done') return null;
  P.tut = 'done';
  addCrystals(50);
  const it = genItem({ lvl: P.lvl + 1, rarity: 2, cls: P.cls, slot: R.pick(['helmet', 'gloves', 'boots', 'ring', 'amulet']) });
  addItem(it);
  save(); emit('change'); emit('sfx', 'levelup');
  return it;
}

// Wygląd postaci zależny od postępu
export function appearanceTier(p = P) {
  const L = p.lvl;
  return L >= 80 ? 4 : L >= 50 ? 3 : L >= 25 ? 2 : L >= 10 ? 1 : 0;
}

// ——— Przebudzenia i Próby ———
export const TRIAL_CAL_DAYS = TRIALS.map((t) => t.days);
// następne Przebudzenie do zdobycia (indeks 0–5) albo null, gdy wszystkie ukończone
export const nextAwakening = () => ((P.awak || 0) < AWAKEN_LEVELS.length ? P.awak || 0 : null);
export const trialUnlocked = (k = nextAwakening()) => k !== null && P.lvl >= AWAKEN_LEVELS[k];
export const awakeningSkills = (cls = P.cls) => AWAKENINGS[cls].map((s, i) => ({ ...s, lvl: AWAKEN_LEVELS[i], roman: ROMAN[i], owned: i < (P.awak || 0) }));

// boss Próby: ogromna pula PŻ dzielona między wiele walk; w jednej walce liczą się zadane obrażenia.
// Słabszych bohaterów (mniej PŻ niż wzorzec) boss uderza lżej – do 60% – aby Próba nie ciągnęła się tygodniami.
export function trialBossFighter(k, phase = 0, attacker = null, refHp = 0) {
  const B = trialBossBase(k, phase);
  if (attacker && refHp > 0) {
    const soft = clamp(Math.sqrt(attacker.maxHp / refHp), 0.6, 1);
    B.dmgMin = Math.max(1, Math.round(B.dmgMin * soft)); B.dmgMax = Math.max(1, Math.round(B.dmgMax * soft));
  }
  return B;
}
function trialBossBase(k, phase) {
  const T = TRIALS[k];
  const b = BOSSES[T.boss];
  const L = AWAKEN_LEVELS[k] + 3;
  const B = enemyFighter({ ...b, name: T.title, arch: 'boss', hp: 1, dmg: 1, armor: 1.15, dodge: 4, crit: 8 }, L, 1, { hpMul: TRIAL_BOSS.hpMul, dmgMul: TRIAL_BOSS.dmgMul * TRIAL_PHASES[phase].dmg, boss: true });
  B.name = T.title;
  B.bossSkill = T.name;
  return B;
}
// wzorcowy bohater danej klasy na progu Próby (deterministyczny: pełne talenty, auto‑statystyki, epicki ekwipunek +8,
// poprzednie Przebudzenia) – z niego liczymy pulę PŻ, a nie z aktualnego ekwipunku gracza (zdjęcie przedmiotów nic nie daje)
export function trialReferencePlayer(k, cls = P.cls, seed = 0) {
  const L = AWAKEN_LEVELS[k];
  const main = CLASSES[cls].main;
  const pts = (L - 1) * 4; // jak autoAllocate: na 4 punkty 2× główna, 1× kondycja, 1× szczęście
  const alloc = Object.fromEntries(STATS.map((s) => [s, 0]));
  alloc[main] += pts / 2; alloc.con += pts / 4; alloc.lck += pts / 4;
  const rnd = rng(`trial-ref:${cls}:${k}:${seed}`);
  const equip = {};
  for (const s of SLOTS) { const it = genItem({ lvl: L, rarity: TRIAL_REF_GEAR.rarity, cls, slot: s, rnd }); it.up = TRIAL_REF_GEAR.up; equip[s] = it; }
  return { name: 'Wzorzec', cls, lvl: L, awak: k, alloc, talents: Object.fromEntries(TALENTS.map((t) => [t.id, TALENT_MAX])), equip };
}
export const trialReference = (k, cls = P.cls, seed = 0) => playerFighter(trialReferencePlayer(k, cls, seed));
const TRIAL_REF_SEEDS = 4; // kilka wzorców uśrednia szczęście w rzutach przedmiotów
// pula PŻ = docelowa liczba ataków × obrażenia wzorca; każda faza to 25% puli, więc liczymy średnią harmoniczną po fazach
export function calibrateTrial(k, cls = P.cls, samples = 3) {
  const rnd = rng(`trial-cal:${cls}:${k}`);
  const refs = Array.from({ length: TRIAL_REF_SEEDS }, (_, s) => trialReference(k, cls, s));
  let attacksPerPool = 0;
  for (let ph = 0; ph < TRIAL_PHASES.length; ph++) {
    let sum = 0, n = 0;
    for (const ref of refs) for (let i = 0; i < samples; i++) { sum += simulate(ref, trialBossFighter(k, ph), { rnd, maxActions: TRIAL_MAX_ACTIONS }).dmgDealt[0]; n++; }
    attacksPerPool += 0.25 / Math.max(1, sum / n);
  }
  const avg = 1 / attacksPerPool;
  const refHp = Math.round(refs.reduce((s, f) => s + f.maxHp, 0) / refs.length);
  return { avgRef: Math.round(avg), maxHp: Math.round(avg * TRIAL_ATTEMPTS * TRIALS[k].days), refHp };
}
// Bariera Próby: w jednym ataku zalicza się najwyżej 2,5× obrażeń wzorca (nawet najlepszy ekwipunek = min. 2 dni)
export const TRIAL_CAP_MUL = 2.5;
export const trialAttackCap = (t = P.trial) => (t ? Math.round(t.avgRef * TRIAL_CAP_MUL) : 0);
// stan bieżącej Próby (tworzony przy pierwszym wejściu po osiągnięciu progu)
export function ensureTrial() {
  const k = nextAwakening();
  if (k === null || !trialUnlocked(k)) return null;
  if (!P.trial || P.trial.tier !== k) {
    const cal = calibrateTrial(k);
    P.trial = { tier: k, maxHp: cal.maxHp, hp: cal.maxHp, avgRef: cal.avgRef, refHp: cal.refHp, attempts: 0, day: dayKey(), started: Date.now(), log: [] };
    save();
  }
  if (P.trial.day !== dayKey()) { P.trial.day = dayKey(); P.trial.attempts = 0; }
  return P.trial;
}
// ataki odnawiają się o północy (także zanim ensureTrial zdąży zresetować licznik)
export const trialAttemptsLeft = () => (P.trial && P.trial.day === dayKey() ? Math.max(0, TRIAL_ATTEMPTS - P.trial.attempts) : TRIAL_ATTEMPTS);
export function trialPhase() { const t = P.trial; return t ? phaseOf(t.hp / t.maxHp) : 0; }
// szacunek pozostałych dni na podstawie Twoich ostatnich ataków (lub wzorca)
export function trialEtaDays() {
  const t = P.trial;
  if (!t) return null;
  const recent = t.log.slice(-6);
  const avg = recent.length ? recent.reduce((s, x) => s + x.dmg, 0) / recent.length : t.avgRef;
  const left = Math.max(0, t.hp - avg * trialAttemptsLeft());
  return left <= 0 ? 0 : Math.ceil(left / Math.max(1, avg * TRIAL_ATTEMPTS));
}
export function trialAttack() {
  const t = ensureTrial();
  if (!t) { toast('Próba jest jeszcze niedostępna.', 'bad'); return null; }
  if (trialAttemptsLeft() <= 0) { toast(`Wykorzystałeś dzisiejsze ataki (${TRIAL_ATTEMPTS}/${TRIAL_ATTEMPTS}). Wróć jutro!`, 'bad'); return null; }
  t.attempts++;
  const k = t.tier;
  const phase = trialPhase();
  const before = t.hp;
  if (!t.refHp) t.refHp = trialReference(k).maxHp;
  const A = playerFighter(P), B = trialBossFighter(k, phase, A, t.refHp);
  const sim = simulate(A, B, { maxActions: TRIAL_MAX_ACTIONS });
  const raw = Math.max(0, Math.round(sim.dmgDealt[0]));
  const cap = trialAttackCap(t);
  const dmg = Math.min(before, raw, cap);
  t.hp = before - dmg;
  t.log.push({ t: Date.now(), dmg });
  t.log = t.log.slice(-30);
  P.stats.fights++;
  const T = TRIALS[k];
  const rew = { gold: addGold(goldBase(P.lvl) * 4 * goldMul()), exp: 0, items: [], cr: 0, dmg, trialLeft: t.hp, trialMax: t.maxHp, phaseName: TRIAL_PHASES[phaseOf(t.hp / t.maxHp)].name, attemptsLeft: trialAttemptsLeft(), raw, capped: raw > cap && before > cap ? cap : 0 };
  if (t.hp <= 0) {
    // Przebudzenie!
    P.awak = k + 1;
    P.trial = null;
    rew.cr = addCrystals(T.cr);
    const it = genItem({ lvl: AWAKEN_LEVELS[k] + 2, rarity: 4, cls: P.cls });
    addItem(it); rew.items.push(it);
    rew.awakened = { tier: k, roman: ROMAN[k], skill: AWAKENINGS[P.cls][k] };
    if (k === AWAKEN_LEVELS.length - 1 && !P.skinsOwned.includes('awakened')) { P.skinsOwned.push('awakened'); rew.skin = 'awakened'; }
    P.stats.bosses++;
    addExp(0); // zgromadzone EXP od razu przechodzi na kolejny poziom
    emit('awakened', k);
    pushProfileSoon();
  }
  eventPoints(10);
  save();
  return {
    kind: 'trial', title: `${T.name}: ${T.title}`, bg: BOSSES[T.boss].bg, A, B, sim, win: t.hp <= 0 || dmg > 0, rew,
    rightImg: `bosses/${BOSSES[T.boss].img}.webp`, rightName: T.title, rightLvl: AWAKEN_LEVELS[k] + 3, boss: true, damageMode: true,
    trial: { before, max: rew.trialMax, glow: T.glow, phase: TRIAL_PHASES[phase].name, cap },
  };
}
// ——— Eventy uruchamiane przez administratora (live_events z serwera) ———
export function activeLive(t = Date.now()) {
  return (Net.Net.live || []).filter((e) => new Date(e.starts_at).getTime() <= t && t < new Date(e.ends_at).getTime());
}
export const liveActive = (kind, t = Date.now()) => activeLive(t).some((e) => e.kind === kind);

// ——— Otchłań: nieskończony loch (2000 pięter, od 100 poziomu) ———
export const ABYSS_FLOORS = 2000;
export const ABYSS_REQ = 100;
export const ABYSS_KEYS = 15;
export const abyssUnlocked = () => P.lvl >= ABYSS_REQ;
export function abyssSpec(f) {
  const L = ABYSS_REQ + Math.floor(f * 0.45);
  if (f % 10 === 0) {
    const b = BOSSES[(f / 10 - 1) % BOSSES.length];
    return { boss: true, L, e: b, name: b.name, img: `bosses/${b.img}.webp`, diff: 1.1 };
  }
  const e = ALL_ENEMIES[(f * 7 + Math.floor(f / 10) * 3) % ALL_ENEMIES.length];
  return { boss: false, L, e, name: e.name, img: `enemies/${e.img}.webp`, diff: 0.8 + (f % 10) * 0.025 };
}
// przeciwnik skalowany do siły „przeciętnego” gracza na poziomie piętra
export function abyssEnemy(f) {
  const s = abyssSpec(f);
  const B = s.boss
    ? enemyFighter({ ...s.e, arch: 'boss', hp: 1, dmg: 1, armor: 1.1, dodge: 3, crit: 7 }, s.L, 1, { hpMul: 1.5, boss: true })
    : enemyFighter(s.e, s.L, 1);
  if (s.boss) B.bossSkill = s.e.title;
  scaleFighter(B, (refPower(s.L) * s.diff) / Math.max(1, fighterPower(B)));
  return { s, B };
}
export function abyssRewards(f) {
  const r = [];
  if (f % 10 === 0) r.push('5 💎 + epicki łup');
  if (f % 50 === 0) r.push('jajo peta');
  if (f % 100 === 0) r.push(f >= 500 ? 'legendarny łup (35% mityczny) + 50 💎' : 'legendarny łup + 50 💎');
  if (f >= 1000 && f % 250 === 0) r.push('mityczny łup');
  if (f === 500) r.push('skórka „Wędrowiec Otchłani”');
  if (f === ABYSS_FLOORS) r.push('skórka „Władca Otchłani”');
  return r;
}
export function nextAbyssMilestone(from = P.abyss.floor + 1) {
  for (let f = from; f <= ABYSS_FLOORS; f++) if (f % 10 === 0) return { floor: f, rewards: abyssRewards(f) };
  return null;
}
export function abyssBattle() {
  if (!abyssUnlocked()) { toast(`Otchłań otwiera się na ${ABYSS_REQ} poziomie.`, 'bad'); return null; }
  if (P.abyss.floor >= ABYSS_FLOORS) { toast('Zdobyłeś wszystkie piętra Otchłani!', 'good'); return null; }
  if (P.abyss.keys <= 0) { toast(`Brak kluczy Otchłani – jutro dostaniesz ${ABYSS_KEYS} nowych.`, 'bad'); return null; }
  P.abyss.keys--;
  const f = P.abyss.floor + 1;
  const { s, B } = abyssEnemy(f);
  const A = playerFighter(P);
  const sim = simulate(A, B);
  const win = sim.winner === 0;
  P.stats.fights++;
  const rew = { gold: 0, exp: 0, items: [], cr: 0, skin: null, eggs: 0 };
  if (win) {
    P.stats.wins++;
    P.abyss.floor = f;
    P.abyss.best = Math.max(P.abyss.best || 0, f);
    rew.gold = addGold(goldBase(s.L) * (s.boss ? 20 : 4) * goldMul());
    rew.exp = addExp(expNext(Math.min(P.lvl, s.L)) * (s.boss ? 0.4 : 0.08) * expMul(false));
    if (f % 10 === 0) { rew.cr += addCrystals(5); const it = rollItem(s.L, 3); addItem(it); rew.items.push(it); P.stats.bosses++; }
    if (f % 50 === 0) { P.pets.eggs++; rew.eggs++; }
    if (f % 100 === 0) {
      rew.cr += addCrystals(50);
      const it = genItem({ lvl: s.L, rarity: f >= 500 && R() < 0.35 ? MYTHIC : 4, cls: P.cls });
      addItem(it); rew.items.push(it);
    }
    if (f >= 1000 && f % 250 === 0) { const it = genItem({ lvl: s.L, rarity: MYTHIC, cls: P.cls }); addItem(it); rew.items.push(it); }
    if (f === 500 && !P.skinsOwned.includes('abyss')) { P.skinsOwned.push('abyss'); rew.skin = 'abyss'; }
    if (f === ABYSS_FLOORS && !P.skinsOwned.includes('abyssLord')) { P.skinsOwned.push('abyssLord'); rew.skin = 'abyssLord'; }
    track('dungeon'); track('wins'); eventPoints(8); wheelToken(1);
    pushProfileSoon();
  } else {
    rew.gold = addGold(goldBase(s.L));
  }
  save();
  return { kind: 'abyss', title: `Otchłań – piętro ${f}`, bg: 'abyss', A, B, sim, win, rew, rightImg: s.img, rightName: s.name, rightLvl: s.L, boss: s.boss };
}

// ——— Skrzynia Mityczna: 90% legendarny, 10% mityczny ———
export const MYTHIC_CHEST_COST = 2000;
export const MYTHIC_CHANCE = 0.1;
function openMythicChest(rnd = R) {
  const it = genItem({ lvl: P.lvl, rarity: rnd() < MYTHIC_CHANCE ? MYTHIC : 4, cls: P.cls });
  addItem(it);
  return it;
}
export function buyMythicChest() {
  if (P.crystals < MYTHIC_CHEST_COST) { toast(`Skrzynia Mityczna kosztuje ${fmt(MYTHIC_CHEST_COST)} kryształów.`, 'bad'); return null; }
  P.crystals -= MYTHIC_CHEST_COST;
  const it = openMythicChest();
  save(); emit('change'); emit('sfx', 'chest');
  return it;
}

// ——— Pety (bonusy pasywne) ———
export function buyEgg() {
  if (P.crystals < PET_EGG_COST) { toast(`Jajo peta kosztuje ${PET_EGG_COST} kryształów.`, 'bad'); return false; }
  P.crystals -= PET_EGG_COST; P.pets.eggs++;
  save(); emit('change'); emit('sfx', 'coin');
  return true;
}
export function hatchEgg(rnd = R) {
  if (P.pets.eggs <= 0) { toast('Nie masz jaj. Zdobywasz je w Otchłani, z koła fortuny lub w sklepie.', 'bad'); return null; }
  P.pets.eggs--;
  const total = PETS.reduce((s, p) => s + p.weight, 0);
  let x = rnd() * total, pet = PETS[PETS.length - 1];
  for (const p of PETS) { x -= p.weight; if (x <= 0) { pet = p; break; } }
  const cur = P.pets.owned[pet.id] || 0;
  let res;
  if (!cur) { P.pets.owned[pet.id] = 1; res = { pet, lvl: 1, isNew: true }; if (!P.pets.active) P.pets.active = pet.id; }
  else if (cur < PET_MAX_LVL) { P.pets.owned[pet.id] = cur + 1; res = { pet, lvl: cur + 1, up: true }; }
  else { addCrystals(PET_DUP_CRYSTALS); res = { pet, lvl: cur, cr: PET_DUP_CRYSTALS }; }
  save(); emit('change'); emit('appearance'); pushProfileSoon();
  return res;
}
export function setActivePet(id) {
  if (id && !P.pets.owned[id]) return;
  P.pets.active = id || null;
  save(); emit('change'); emit('appearance'); pushProfileSoon();
}

// ——— Koło fortuny: weekend (sob–nd) lub event „Szczęśliwe Koło” ———
export const WHEEL_PRIZES = [
  { id: 'gold', label: 'Wór złota', icon: 'gold', w: 30 },
  { id: 'cr15', label: '15 💎', icon: 'crystal', w: 20 },
  { id: 'energy', label: '+30 energii', icon: 'energy', w: 12 },
  { id: 'keys', label: '+3 klucze', icon: 'key', w: 10 },
  { id: 'cr50', label: '50 💎', icon: 'crystal', w: 8 },
  { id: 'epic', label: 'Epicki łup', icon: 'chest', w: 8 },
  { id: 'egg', label: 'Jajo peta', icon: 'egg', w: 5 },
  { id: 'legend', label: 'Legendarny łup', icon: 'legendChest', w: 4 },
  { id: 'cr250', label: '250 💎', icon: 'crystal', w: 2 },
  { id: 'mythic', label: 'Skrzynia Mityczna', icon: 'mythicChest', w: 1 },
];
const isWeekend = (t) => { const d = new Date(t).getDay(); return d === 0 || d === 6; };
export const wheelActive = (t = Date.now()) => isWeekend(t) || liveActive('wheel', t);
// klucz okresu: weekend (data soboty) albo konkretny event – żetony wygasają, gdy okres się zmieni
function wheelPeriod(t) {
  if (isWeekend(t)) { const d = new Date(t); d.setDate(d.getDate() - (d.getDay() === 0 ? 1 : 0)); return 'wk' + dayKey(d.getTime()); }
  const ev = activeLive(t).find((e) => e.kind === 'wheel');
  return ev ? 'ev' + ev.id : null;
}
function ensureWheel(t = Date.now()) {
  const key = wheelPeriod(t);
  if (!key) return null;
  if (!P.wheel || P.wheel.key !== key) P.wheel = { key, tokens: 0, freeDay: null, spins: 0, last: [] };
  return P.wheel;
}
export const wheelFreeTokens = () => (liveActive('wheel') ? 5 : 3);
// czas do otwarcia koła (najbliższa sobota 00:00 albo wcześniejszy zaplanowany event „Szczęśliwe Koło”) i do jego zamknięcia
export function wheelOpensIn(t = Date.now()) {
  const d = new Date(t);
  const add = ((6 - d.getDay() + 7) % 7) || 7;
  d.setDate(d.getDate() + add); d.setHours(0, 0, 0, 0);
  const ev = nextStartOf(Net.Net.live, 'wheel', t);
  return Math.min(d.getTime(), ev ?? Infinity) - t;
}
export function wheelClosesIn(t = Date.now()) {
  if (isWeekend(t)) { const d = new Date(t); d.setDate(d.getDate() + (d.getDay() === 6 ? 2 : 1)); d.setHours(0, 0, 0, 0); return d.getTime() - t; }
  const ev = activeLive(t).find((e) => e.kind === 'wheel');
  return ev ? new Date(ev.ends_at).getTime() - t : 0;
}
export function wheelState() {
  const w = ensureWheel();
  return { active: !!w, tokens: w ? w.tokens : 0, freeReady: !!w && w.freeDay !== dayKey(), spins: w ? w.spins : 0, last: w ? w.last : [] };
}
export function wheelToken(n = 1) {
  const w = ensureWheel();
  if (!w) return 0;
  const k = n * (liveActive('wheel') ? 2 : 1);
  w.tokens += k;
  return k;
}
export function claimWheelFree() {
  const w = ensureWheel();
  if (!w || w.freeDay === dayKey()) return 0;
  w.freeDay = dayKey();
  const n = wheelFreeTokens();
  w.tokens += n;
  save(); emit('change');
  return n;
}
export function wheelPick(rnd = R) {
  const total = WHEEL_PRIZES.reduce((s, p) => s + p.w, 0);
  let x = rnd() * total;
  for (let i = 0; i < WHEEL_PRIZES.length; i++) { x -= WHEEL_PRIZES[i].w; if (x <= 0) return i; }
  return WHEEL_PRIZES.length - 1;
}
export function spinWheel(rnd = R) {
  const w = ensureWheel();
  if (!w) { toast('Koło fortuny kręci się w weekendy (sobota–niedziela).', 'bad'); return null; }
  if (w.tokens <= 0) { toast('Brak żetonów. Zdobywasz je za przygody, lochy, arenę, bossów i misje.', 'bad'); return null; }
  w.tokens--; w.spins++;
  const index = wheelPick(rnd);
  const prize = WHEEL_PRIZES[index];
  const L = P.lvl;
  let text = prize.label, item = null;
  switch (prize.id) {
    case 'gold': text = `+${fmt(addGold(goldBase(L) * 15))} złota`; break;
    case 'cr15': addCrystals(15); break;
    case 'energy': P.energy = Math.min(ENERGY_MAX * 2, P.energy + 30); break;
    case 'keys': P.dungeon.keys += 3; break;
    case 'cr50': addCrystals(50); break;
    case 'epic': item = rollItem(L, 3); addItem(item); break;
    case 'egg': P.pets.eggs++; break;
    case 'legend': item = rollItem(L, 4); addItem(item); break;
    case 'cr250': addCrystals(250); break;
    case 'mythic': item = openMythicChest(rnd); break;
  }
  if (item) text = `${prize.label}: ${item.name}`;
  w.last = [{ t: Date.now(), text }, ...(w.last || [])].slice(0, 8);
  save(); emit('change');
  return { index, prize, text, item };
}

// ——— Moderacja czatu: wyciszanie graczy (lokalnie), zgłoszenia ———
export const isMuted = (authorId) => !!authorId && P.settings.muted.includes(authorId);
export function toggleMute(authorId, name) {
  if (!authorId) return;
  const m = P.settings.muted;
  const i = m.indexOf(authorId);
  if (i >= 0) { m.splice(i, 1); toast(`Wyciszenie gracza ${name} zostało zdjęte.`); }
  else { m.push(authorId); toast(`Gracz ${name} został wyciszony – nie zobaczysz jego wiadomości.`); }
  save(); emit('chat');
}
export async function reportMessage(msg, reason) {
  if (!Net.isOnline()) { toast('Zgłoszenia działają w trybie online.', 'bad'); return false; }
  try { await Net.reportMessage(msg.id, reason); }
  catch (e) { toast(/duplicate|unique/i.test(e.message) ? 'Ta wiadomość została już przez Ciebie zgłoszona.' : 'Nie udało się zgłosić: ' + e.message, 'bad'); return false; }
  toast('Dziękujemy – zgłoszenie trafiło do administratora.', 'good');
  return true;
}
export function markVersionSeen(v) { P.seenVersion = v; save(); }

export { calcStats, powerOf, expNext, unlockedSkills, upgradeCost, sellPrice, buyPrice, MAX_UP, BAG_SIZE, goldBase, MAX_LVL, levelCap };
