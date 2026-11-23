// Formuły: statystyki postaci, siła, EXP, generowanie przedmiotów i przeciwników
import { CLASSES, SKILLS, TALENTS, STATS } from '../data/classes.js';
import { TEMPLATES, LEGENDARIES, MYTHICS, RARITIES, TEMPLATE_BY_ID } from '../data/items.js';
import { R, clamp } from './util.js';
import { AWAKENINGS, AWAKEN_LEVELS } from '../data/awakening.js';
import { petBonus } from '../data/pets.js';

// brak maksymalnego poziomu – po 6. Przebudzeniu poziomy rosną bez limitu
export const MAX_LVL = Infinity;
// maksymalny poziom osiągalny bez kolejnego Przebudzenia (100 → 110 → … → 150 → bez limitu)
export const levelCap = (p) => ((p.awak || 0) >= AWAKEN_LEVELS.length ? Infinity : AWAKEN_LEVELS[0] + 10 * (p.awak || 0));
export const HP_MULT = 1.6; // wydłuża walki do 10–20 s

export function expNext(l) {
  return Math.round(50 * Math.pow(l, 1.8) + 50);
}
// tempo progresu: ułamek poziomu na minutę przygody
export function questLvlRate(l) {
  if (l < 10) return 0.16;
  if (l < 20) return 0.1;
  return Math.max(0.022, 0.07 - (l - 20) * 0.0007);
}
export function goldBase(l) { return Math.round(8 + l * 3 + l * l * 0.45); }

export function talentBonus(p) {
  const b = {};
  for (const t of TALENTS) b[t.key] = (b[t.key] || 0) + (p.talents?.[t.id] || 0) * t.per;
  return b;
}
export function itemMul(it) { return 1 + (it.up || 0) * 0.08; }
export function itemStats(it) {
  const m = itemMul(it);
  const s = {};
  for (const k in it.stats) s[k] = Math.round(it.stats[k] * m);
  return { stats: s, dmg: it.dmg ? Math.round(it.dmg * m) : 0, armor: it.armor ? Math.round(it.armor * m) : 0 };
}

export function unlockedSkills(cls, lvl) { return SKILLS[cls].filter((s) => lvl >= s.lvl); }

// Pełne statystyki postaci gracza (opcjonalnie z podmienionym ekwipunkiem do porównań)
export function calcStats(p, equipOverride) {
  const cls = CLASSES[p.cls];
  const equip = equipOverride || p.equip;
  const tb = talentBonus(p);
  const tot = {};
  for (const k of STATS) tot[k] = cls.base[k] + (p.alloc?.[k] || 0);
  let wdmg = 0, armor = 0;
  const special = {};
  for (const slot in equip) {
    const it = equip[slot];
    if (!it) continue;
    const s = itemStats(it);
    for (const k in s.stats) tot[k] += s.stats[k];
    wdmg += s.dmg; armor += s.armor;
    if (it.special) for (const k in it.special) special[k] = (special[k] || 0) + it.special[k];
  }
  const bon = { ...tb };
  for (const k in special) bon[k] = (bon[k] || 0) + special[k];
  // aktywny pet: wyłącznie bonusy pasywne
  const pet = p.pets && p.pets.active;
  if (pet) for (const [k, v] of Object.entries(petBonus(pet, p.pets.owned?.[pet]))) bon[k] = (bon[k] || 0) + v;
  if (p.guildBonus) { bon.goldPct = (bon.goldPct || 0) + p.guildBonus; bon.expPct = (bon.expPct || 0) + p.guildBonus; }
  const L = p.lvl;
  const main = tot[cls.main];
  const base = (Math.max(4, wdmg) + main * 1.5 + L * 1.5) * (1 + (bon.dmgPct || 0) / 100);
  const hp = Math.round((100 + tot.con * 10 + L * 22) * cls.hpMul * (1 + (bon.hpPct || 0) / 100));
  const arm = Math.round((armor * cls.armorMul + L * 2) * (1 + (bon.armorPct || 0) / 100));
  const hawk = p.cls === 'archer' && L >= 50 ? 12 : 0;
  const crit = clamp(5 + cls.crit + (tot.lck / (tot.lck + L * 6 + 30)) * 40 + (bon.critPct || 0) + hawk, 0, 65);
  const critDmg = 1.8 + (cls.critDmg || 0) + (bon.critDmgPct || 0) / 100;
  const dodge = clamp(2 + cls.dodge + (tot.dex / (tot.dex + L * 8 + 60)) * 18 + (bon.dodgePct || 0), 0, 42);
  const resist = clamp((tot.int / (tot.int + L * 8 + 60)) * 30, 0, 30);
  return {
    tot, main, mainKey: cls.main, hp, armor: arm, dmgMin: Math.round(base * 0.85), dmgMax: Math.round(base * 1.15),
    crit, critDmg, dodge, resist, block: cls.block || 0, pierce: cls.pierce || 0,
    leech: bon.leechPct || 0, regen: bon.regenPct || 0, skillPct: bon.skillPct || 0, initPct: bon.initPct || 0,
    goldPct: bon.goldPct || 0, expPct: bon.expPct || 0, findPct: bon.findPct || 0, idlePct: bon.idlePct || 0,
    speedPct: Math.min(40, bon.speedPct || 0), lvl: L,
  };
}

export function powerOf(st) {
  const dr = st.armor / (st.armor + 60 + st.lvl * 18);
  const effHp = st.hp / (1 - Math.min(dr, 0.65)) / (1 - st.dodge / 100);
  const avg = (st.dmgMin + st.dmgMax) / 2;
  const dps = avg * (1 + (st.crit / 100) * (st.critDmg - 1)) * (1 + st.pierce * 0.25) * (1 + st.skillPct / 300);
  return Math.round(Math.sqrt(effHp * dps) * 2);
}
// umiejętności przebudzenia nie są widoczne w statystykach – dolicz je do siły (+7% za każde)
export const awakenPowerMul = (p) => 1 + 0.07 * (p.awak || 0);
export const playerPower = (p) => Math.round(powerOf(calcStats(p)) * awakenPowerMul(p));
// górny limit siły na poziomie L (≈3× realnego maksimum: mityczny ekwipunek +10, pełne talenty, pet, Przebudzenia)
// – ta sama formuła działa na serwerze (fho_max_power) i przy wczytywaniu rywali
export const maxPowerFor = (L) => 18000 + 7200 * Math.max(1, L);

// Efekty umiejętności przebudzenia (pierwsze n z listy klasy) nakładane na walczącego
export function applyAwakening(f, cls, n) {
  const list = (AWAKENINGS[cls] || []).slice(0, n || 0);
  if (!list.length) return f;
  const aw = { periodic: [] };
  for (const a of list) {
    const x = a.fx;
    if (x.critPct) f.crit = Math.min(75, f.crit + x.critPct);
    if (x.critDmgPct) f.critDmg += x.critDmgPct / 100;
    if (x.dodgePct) f.dodge = Math.min(50, f.dodge + x.dodgePct);
    if (x.blockPct) f.block = Math.min(40, (f.block || 0) + x.blockPct);
    if (x.leechPct) f.leech = (f.leech || 0) + x.leechPct;
    if (x.regenPct) f.regen = (f.regen || 0) + x.regenPct;
    if (x.pierce) f.pierce = Math.min(0.75, (f.pierce || 0) + x.pierce);
    if (x.skillPct) f.skillPct = (f.skillPct || 0) + x.skillPct;
    for (const k of ['lowHp', 'dmgTaken', 'dotMul', 'healMul', 'shield', 'openBuff', 'execThr', 'revive', 'firstCrit', 'dodgeCrit', 'undyingHeal']) if (x[k] !== undefined) aw[k] = x[k];
    if (x.periodic) aw.periodic.push(x.periodic);
  }
  aw.periodic.sort((a, b) => b.every - a.every); // rzadsze (mocniejsze) mają pierwszeństwo
  f.aw = aw;
  return f;
}

// Statystyki „wirtualnej” postaci o danym poziomie (boty, przeciwnicy)
export function refStats(L, q = 1) {
  // skalibrowane do średniej postaci gracza (ekwipunek niezwykły/rzadki, auto‑statystyki)
  return {
    hp: Math.round((280 + 60 * L + 0.25 * L * L) * q), dmg: (45 + 20 * L + 0.05 * L * L) * q, armor: Math.round((15 + 9 * L + 0.03 * L * L) * q),
  };
}

export function makeFighter(name, st, extra = {}) {
  return {
    name, lvl: st.lvl, maxHp: Math.round(st.hp * HP_MULT), hp: Math.round(st.hp * HP_MULT),
    dmgMin: st.dmgMin, dmgMax: st.dmgMax, armor: st.armor, crit: st.crit, critDmg: st.critDmg,
    dodge: st.dodge, block: st.block || 0, resist: st.resist || 0, pierce: st.pierce || 0,
    leech: st.leech || 0, regen: st.regen || 0, skillPct: st.skillPct || 0, initPct: st.initPct || 0,
    skills: [], cls: null, ...extra,
  };
}
export function playerFighter(p) {
  const st = calcStats(p);
  return applyAwakening(makeFighter(p.name, st, { cls: p.cls, skills: unlockedSkills(p.cls, p.lvl).map((s) => s.id), isPlayer: true }), p.cls, p.awak);
}
// siła walczącego (do porównań i skalowania)
export function fighterPower(f) {
  return powerOf({ hp: f.maxHp / HP_MULT, armor: f.armor, dmgMin: f.dmgMin, dmgMax: f.dmgMax, crit: f.crit, critDmg: f.critDmg, dodge: f.dodge, pierce: f.pierce || 0, skillPct: f.skillPct || 0, lvl: f.lvl });
}
// przeskaluj PŻ i obrażenia tak, by siła zmieniła się k‑krotnie
export function scaleFighter(f, k) {
  f.maxHp = Math.max(1, Math.round(f.maxHp * k)); f.hp = f.maxHp;
  f.dmgMin = Math.max(1, Math.round(f.dmgMin * k)); f.dmgMax = Math.max(1, Math.round(f.dmgMax * k));
  return f;
}
// przeciwnik z bazy (enemy) na poziomie L z mnożnikiem trudności
export function enemyFighter(e, L, diff = 1, opts = {}) {
  const r = refStats(L, 1);
  const hp = r.hp * e.hp * diff * (opts.hpMul || 1);
  const d = r.dmg * e.dmg * (0.55 + 0.3 * diff) * (opts.dmgMul || 1);
  const st = {
    lvl: L, hp, dmgMin: Math.round(d * 0.85), dmgMax: Math.round(d * 1.15), armor: Math.round(r.armor * e.armor * diff),
    crit: e.crit + (opts.crit || 0), critDmg: 1.6, dodge: opts.noDodge ? 0 : e.dodge, block: 0, resist: e.arch === 'caster' ? 15 : 5,
    pierce: e.arch === 'caster' ? 0.3 : 0,
  };
  return makeFighter(e.name, st, { enemy: e, boss: !!opts.boss });
}
// bot‑gracz
export function botStats(bot, L) {
  const cls = CLASSES[bot.cls];
  // nowi gracze‑boty mają słabszy ekwipunek na pierwszych poziomach
  const q = bot.gearQ * Math.min(1, 0.62 + L * 0.035);
  const r = refStats(L, q);
  const hp = r.hp * cls.hpMul;
  const d = r.dmg;
  return {
    lvl: L, hp, dmgMin: Math.round(d * 0.85), dmgMax: Math.round(d * 1.15), armor: Math.round(r.armor * cls.armorMul),
    crit: 8 + cls.crit + 6 * q, critDmg: 1.8 + (cls.critDmg || 0), dodge: 4 + cls.dodge + 3 * q, block: cls.block || 0,
    resist: bot.cls === 'mage' ? 18 : 8, pierce: cls.pierce || 0, leech: 0, regen: 0, skillPct: 10 * q, initPct: 0,
  };
}
export function botFighter(bot, L) {
  return makeFighter(bot.name, botStats(bot, L), { cls: bot.cls, skills: unlockedSkills(bot.cls, L).map((s) => s.id), bot });
}
// siła „przeciętnego” gracza na danym poziomie
export function refPower(L) { return powerOf(botStats({ cls: 'warrior', gearQ: 1 }, L)); }

// ——— Przedmioty ———
let uidC = 0;
export const newUid = () => Date.now().toString(36) + (uidC++).toString(36) + Math.floor(R() * 1296).toString(36);

export function rollRarity(findPct = 0, boost = 0, rnd = R) {
  const f = 1 + findPct / 100 + boost;
  const x = rnd();
  if (x < 0.006 * f) return 4;
  if (x < 0.04 * f) return 3;
  if (x < 0.15 * f) return 2;
  if (x < 0.42 * f) return 1;
  return 0;
}
const SLOT_ARMOR = { helmet: 1.0, armor: 1.6, gloves: 0.7, boots: 0.8 };

function pickTemplate(slot, cls, L, rnd) {
  let list = TEMPLATES.filter((t) => t.slot === slot && t.lvl <= Math.max(1, L));
  if (slot === 'weapon') list = list.filter((t) => CLASSES[cls].weapon.includes(t.type));
  if (!list.length) list = TEMPLATES.filter((t) => t.slot === slot && (slot !== 'weapon' || CLASSES[cls].weapon.includes(t.type)));
  // preferuj najnowsze tiery
  const w = list.map((t) => 1 + Math.max(0, 30 - (L - t.lvl)) / 6);
  let s = w.reduce((a, b) => a + b, 0) * rnd();
  for (let i = 0; i < list.length; i++) { s -= w[i]; if (s <= 0) return list[i]; }
  return list[list.length - 1];
}

export function genItem({ lvl, rarity = 0, cls, slot, tid, rnd = R }) {
  const SL = ['weapon', 'weapon', 'helmet', 'armor', 'gloves', 'boots', 'ring', 'amulet'];
  slot = slot || rnd.pick(SL);
  let tpl;
  if (tid) tpl = TEMPLATE_BY_ID[tid];
  else if (rarity >= 5) {
    // mityczne zawsze są unikatowe; broń dopasowana do klasy
    const fits = (t) => (slot ? t.slot === slot : true) && (t.slot !== 'weapon' || CLASSES[cls].weapon.includes(t.type));
    tpl = rnd.pick(MYTHICS.filter(fits));
  } else if (rarity === 4 && rnd() < 0.45) {
    const leg = LEGENDARIES.filter((t) => t.slot === slot && (slot !== 'weapon' || CLASSES[cls].weapon.includes(t.type)));
    if (leg.length) tpl = rnd.pick(leg);
  }
  if (!tpl) tpl = pickTemplate(slot, cls, lvl, rnd);
  slot = tpl.slot;
  const L = clamp(Math.round(lvl), 1, MAX_LVL);
  const rar = RARITIES[rarity];
  const m = rar.mul;
  const v = () => rnd.range(0.9, 1.12);
  const it = { uid: newUid(), tid: tpl.tid, slot, type: tpl.type, name: tpl.name, icon: tpl.icon, lvl: L, rarity, up: 0, stats: {} };
  const main = CLASSES[cls].main;
  const primAmt = Math.round((2 + L * 0.9) * m * v());
  if (slot === 'weapon') {
    it.dmg = Math.round((6 + L * 2.4) * m * v());
    it.stats[main] = primAmt;
  } else if (SLOT_ARMOR[slot]) {
    it.armor = Math.round((3 + L * 1.3) * SLOT_ARMOR[slot] * m * v());
    const k = rnd() < 0.55 ? main : 'con';
    it.stats[k] = primAmt;
  } else {
    const k = slot === 'ring' ? (rnd() < 0.5 ? 'lck' : main) : (rnd() < 0.5 ? 'con' : main);
    it.stats[k] = Math.round(primAmt * 1.35);
  }
  for (let i = 0; i < rar.extra; i++) {
    const k = rnd.pick(STATS);
    it.stats[k] = (it.stats[k] || 0) + Math.max(1, Math.round(primAmt * rnd.range(0.35, 0.6)));
  }
  if (tpl.special) { it.special = { ...tpl.special }; it.fx = tpl.fx; it.unique = true; }
  return it;
}

export function upgradeCost(it) {
  const L = it.lvl;
  return Math.round((40 + L * L * 1.1 + L * 18) * (1 + it.up * 0.65) * (1 + it.rarity * 0.3));
}
export function sellPrice(it) {
  return Math.round((15 + it.lvl * 6) * (1 + it.rarity * 0.8) * (1 + (it.up || 0) * 0.2));
}
export const buyPrice = (it) => sellPrice(it) * 4;
export const MAX_UP = 10;
export const BAG_SIZE = 30;
