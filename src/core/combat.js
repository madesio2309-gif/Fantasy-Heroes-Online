// Symulacja automatycznej walki 1v1 → lista zdarzeń do odtworzenia
import { R } from './util.js';

const MAX_ACTIONS = 40;
const CLASS_VFX = { warrior: 'slash', mage: 'magic', archer: 'arrow', assassin: 'shadow', paladin: 'holy' };

function prep(src) {
  return {
    ...src, turn: 0, shield: 0, buffT: 0, buffMul: 1, dots: [], evadeNext: false, blockNext: false, undyingUsed: false, healUsed: false, attacked: false,
    stunned: false, nextCrit: false, reviveUsed: false, aw: src.aw || null,
  };
}
// efekty przebudzenia (f.aw) – bezpieczne odczyty
const awv = (x, k, d) => (x.aw && x.aw[k] !== undefined ? x.aw[k] : d);

export function simulate(A, B, opts = {}) {
  const r = opts.rnd || R;
  const f = [prep(A), prep(B)];
  const ev = [];
  const snap = () => [Math.max(0, Math.round(f[0].hp)), Math.max(0, Math.round(f[1].hp)), Math.round(f[0].shield), Math.round(f[1].shield)];
  const push = (e) => { e.hp = snap(); ev.push(e); };
  const has = (x, id) => x.skills && x.skills.includes(id);
  const addDot = (src, target, dmg) => target.dots.push({ dmg: dmg * awv(src, 'dotMul', 1), n: 3 });

  // efekty startowe
  for (let i = 0; i < 2; i++) {
    const x = f[i];
    if (has(x, 'm_iceshield')) { x.shield = x.maxHp * 0.2; push({ t: 'buff', a: i, label: 'Lodowa Tarcza', vfx: 'ice' }); }
    if (awv(x, 'shield', 0)) { x.shield = Math.max(x.shield, x.maxHp * x.aw.shield); push({ t: 'buff', a: i, label: 'Bariera Arkanów', vfx: 'ice' }); }
    if (has(x, 'w_shout')) { x.buffT = 3; x.buffMul = 1.2; push({ t: 'buff', a: i, label: 'Okrzyk Bojowy', vfx: 'shout' }); }
    const ob = awv(x, 'openBuff', null);
    if (ob) { x.buffT = Math.max(x.buffT, ob.turns); x.buffMul = (x.buffMul || 1) * ob.mul; push({ t: 'buff', a: i, label: 'Gniew Tytana', vfx: 'shout' }); }
  }

  const iniA = 50 + (f[0].initPct || 0) + (f[0].dodge - f[1].dodge) / 2;
  let actor = r() * 100 < iniA ? 0 : 1;
  let actions = 0;
  const maxActions = opts.maxActions || MAX_ACTIONS;

  function dealHits(me, foe, ai, hits) {
    for (const h of hits) {
      if (foe.hp <= 0) break;
      const base = {
        t: 'hit', a: ai, skill: h.skill || null, vfx: h.vfx, combo: h.combo || 0, n: h.n || 1,
      };
      if (foe.evadeNext && !h.sure) { foe.evadeNext = false; push({ ...base, t: 'miss', reason: 'Krok Cienia' }); continue; }
      if (!h.sure && r() * 100 < foe.dodge) {
        if (awv(foe, 'dodgeCrit', false)) foe.nextCrit = true; // Mistrz Cienia
        push({ ...base, t: 'miss', reason: 'Unik' }); continue;
      }
      let dmg = me.dmgMin + r() * (me.dmgMax - me.dmgMin);
      dmg *= h.mul;
      if (h.skill) dmg *= 1 + (me.skillPct || 0) / 100;
      if (me.buffT > 0) dmg *= me.buffMul;
      const lh = awv(me, 'lowHp', null);
      if (lh && me.hp < me.maxHp * lh.thr) dmg *= lh.mul;
      const crit = h.crit || me.nextCrit || r() * 100 < me.crit;
      if (me.nextCrit) me.nextCrit = false;
      if (crit) dmg *= me.critDmg;
      const effArmor = foe.armor * (1 - (me.pierce || 0) - (h.pierce || 0));
      const dr = Math.min(0.65, Math.max(0, effArmor) / (Math.max(0, effArmor) + 60 + me.lvl * 18));
      dmg *= 1 - dr;
      if (me.cls === 'mage' || me.enemy?.arch === 'caster') dmg *= 1 - (foe.resist || 0) / 100;
      dmg *= awv(foe, 'dmgTaken', 1);
      let blocked = false;
      if (foe.blockNext) { foe.blockNext = false; dmg = 0; blocked = 'Boska Tarcza'; }
      else if (foe.block && r() * 100 < foe.block) { dmg *= 0.3; blocked = 'Blok'; }
      dmg = Math.max(1, Math.round(dmg));
      if (blocked === 'Boska Tarcza') dmg = 0;
      let absorbed = 0;
      if (foe.shield > 0 && dmg > 0) { absorbed = Math.min(foe.shield, dmg); foe.shield -= absorbed; }
      foe.hp -= dmg - absorbed;
      let revived = null;
      if (foe.hp <= 0 && foe.skills?.includes('w_undying') && !foe.undyingUsed) {
        foe.undyingUsed = true; foe.hp = Math.max(1, Math.round(foe.maxHp * awv(foe, 'undyingHeal', 0))); revived = 'Nieugięty!';
      } else if (foe.hp <= 0 && awv(foe, 'revive', 0) && !foe.reviveUsed) {
        foe.reviveUsed = true; foe.hp = Math.round(foe.maxHp * foe.aw.revive); revived = 'Awatar!';
      }
      if (me.leech && dmg > 0) me.hp = Math.min(me.maxHp, me.hp + dmg * me.leech / 100);
      push({ ...base, dmg, crit, blocked, absorbed });
      if (revived) push({ t: 'buff', a: 1 - ai, label: revived, vfx: 'shout' });
      if (h.stun && dmg > 0 && foe.hp > 0) foe.stunned = true;
      if (h.burn && dmg > 0) addDot(me, foe, dmg * h.burn);
      if (h.onHit && dmg > 0) h.onHit(crit, dmg);
    }
  }

  while (f[0].hp > 0 && f[1].hp > 0 && actions < maxActions) {
    const me = f[actor], foe = f[1 - actor];
    me.turn++;
    // DoT
    if (me.dots.length) {
      let tot = 0;
      for (const d of me.dots) { tot += d.dmg; d.n--; }
      me.dots = me.dots.filter((d) => d.n > 0);
      tot = Math.round(tot);
      me.hp -= tot;
      push({ t: 'dot', a: 1 - actor, target: actor, dmg: tot });
      if (me.hp <= 0) break;
    }
    if (me.regen) me.hp = Math.min(me.maxHp, me.hp + me.maxHp * me.regen / 100);
    if (me.buffT > 0) me.buffT--;
    // ogłuszenie – tracisz turę
    if (me.stunned) {
      me.stunned = false;
      push({ t: 'buff', a: actor, label: 'Ogłuszony!', vfx: 'stun' });
      actions++; actor = 1 - actor;
      continue;
    }
    // jednorazowe leczenie
    if (has(me, 'p_heal') && !me.healUsed && me.hp < me.maxHp * 0.4) {
      me.healUsed = true; const h = Math.round(me.maxHp * 0.3 * awv(me, 'healMul', 1)); me.hp = Math.min(me.maxHp, me.hp + h);
      push({ t: 'heal', a: actor, amount: h, label: 'Uzdrowienie' });
    }
    const T = me.turn;
    const v = me.cls ? CLASS_VFX[me.cls] : (me.boss ? 'boss' : 'claw');
    let hits = [{ mul: 1, vfx: v }];
    const poisonOn = (pct, chance) => (crit, dmg) => { if (r() < chance) addDot(me, foe, dmg * pct); };

    switch (me.cls) {
      case 'warrior':
        if (has(me, 'w_whirl') && T % 5 === 0) hits = [0, 1, 2].map((i) => ({ mul: 0.75, vfx: 'whirl', skill: 'Wir Ostrzy', combo: i, n: 3 }));
        else if (T % 4 === 0) hits = [{ mul: 2.5, vfx: 'power', skill: 'Potężny Cios' }];
        break;
      case 'mage':
        if (has(me, 'm_meteor') && T % 7 === 0) hits = [{ mul: 4, vfx: 'meteor', skill: 'Meteor' }];
        else if (has(me, 'm_chain') && T % 5 === 0) hits = [0, 1, 2].map((i) => ({ mul: 0.8, vfx: 'chain', skill: 'Łańcuch Błyskawic', combo: i, n: 3 }));
        else if (T % 3 === 0) hits = [{ mul: 2.0, vfx: 'fireball', skill: 'Kula Ognia', onHit: (c, d) => addDot(me, foe, d * 0.12) }];
        break;
      case 'archer':
        if (has(me, 'a_volley') && T % 5 === 0) hits = [0, 1, 2, 3].map((i) => ({ mul: 0.65, vfx: 'volley', skill: 'Grad Strzał', combo: i, n: 4 }));
        else if (T % 3 === 0) hits = [{ mul: 1.35, vfx: 'aimed', skill: 'Celny Strzał', crit: true, sure: true }];
        if (has(me, 'a_poison')) hits.forEach((h) => { h.onHit = poisonOn(0.1, 0.25); });
        break;
      case 'assassin':
        if (!me.attacked) hits = [{ mul: 2.5, vfx: 'backstab', skill: 'Cios w Plecy' }];
        else if (has(me, 's_execute') && foe.hp < foe.maxHp * awv(me, 'execThr', 0.3)) hits = [{ mul: 3, vfx: 'execute', skill: 'Egzekucja' }];
        else hits = [{ mul: 0.6, vfx: 'shadow', combo: 0, n: 2 }, { mul: 0.6, vfx: 'shadow', combo: 1, n: 2 }];
        if (has(me, 's_shadow') && T % 4 === 0) { me.evadeNext = true; push({ t: 'buff', a: actor, label: 'Krok Cienia', vfx: 'shadowstep' }); }
        if (has(me, 's_venom')) hits.forEach((h) => { h.onHit = (crit, d) => { if (crit) addDot(me, foe, d * 0.18); }; });
        break;
      case 'paladin':
        if (has(me, 'p_wrath') && T % 7 === 0) hits = [{ mul: 3.5, vfx: 'wrath', skill: 'Gniew Niebios', pierce: 0.3 }];
        else if (T % 4 === 0) hits = [{ mul: 1.8, vfx: 'smite', skill: 'Święte Uderzenie', onHit: () => { const h = me.maxHp * 0.1 * awv(me, 'healMul', 1); me.hp = Math.min(me.maxHp, me.hp + h); } }];
        if (has(me, 'p_aegis') && T % 5 === 0) { me.blockNext = true; push({ t: 'buff', a: actor, label: 'Boska Tarcza', vfx: 'aegis' }); }
        break;
      default:
        if (me.boss && T % 4 === 0) hits = [{ mul: 2.0, vfx: 'bossSmash', skill: me.bossSkill || 'Druzgocący Cios' }];
        else if (me.enemy?.arch === 'caster' && T % 4 === 0) hits = [{ mul: 1.6, vfx: 'curse', skill: 'Klątwa' }];
    }
    // umiejętności przebudzenia mają pierwszeństwo nad zwykłymi atakami
    if (me.aw) {
      if (me.aw.firstCrit && !me.attacked) hits = [{ mul: me.aw.firstCrit, vfx: 'aimed', skill: 'Legenda Łuku', crit: true, sure: true }];
      else {
        const p = me.aw.periodic.find((x) => T % x.every === 0);
        if (p) hits = p.hits.map((x, i) => ({ ...x, skill: p.name, combo: i, n: p.hits.length }));
      }
    }
    dealHits(me, foe, actor, hits);
    me.attacked = true;
    actions++;
    actor = 1 - actor;
  }
  let winner;
  if (f[0].hp <= 0) winner = 1;
  else if (f[1].hp <= 0) winner = 0;
  else winner = f[0].hp / f[0].maxHp >= f[1].hp / f[1].maxHp ? 0 : 1;
  const timeout = f[0].hp > 0 && f[1].hp > 0;
  return { events: ev, winner, timeout, maxHp: [f[0].maxHp, f[1].maxHp], dmgDealt: [B.maxHp - Math.max(0, f[1].hp), A.maxHp - Math.max(0, f[0].hp)] };
}

// szansa na wygraną (Monte Carlo) – do porównania siły
export function winChance(A, B, n = 40) {
  let w = 0;
  for (let i = 0; i < n; i++) if (simulate(A, B).winner === 0) w++;
  return w / n;
}
