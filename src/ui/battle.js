// Odtwarzanie walki na scenie + HUD + ekran wyników
import { h, icon, uiIcon, itemSlotEl, itemDetails, bar, heroLook } from './dom.js';
import { sfx, playMusic } from './audio.js';
import { fmt, clamp } from '../core/util.js';
import { CLASSES, SKINS, OUTFIT_HUES } from '../data/classes.js';
import { RARITIES } from '../data/items.js';
import * as G from '../core/game.js';
import { GROUND_Y } from '../render/stage.js';
import { TRIAL_ATTEMPTS } from '../data/awakening.js';

const VFX_COLOR = {
  slash: [0xffffff, 0xffc36b], power: [0xff7a2f, 0xffe08a], whirl: [0xffffff, 0xff9d4d], magic: [0x6fd3ff, 0xb18cff],
  fireball: [0xff7a1a, 0xffd04a], meteor: [0xff4a1a, 0xffb347], chain: [0x9fe8ff, 0xffffff], arrow: [0xfff2c0, 0x9ee07a],
  aimed: [0xffe9a0, 0xffffff], volley: [0xd7ffb0, 0xffffff], shadow: [0xb36bff, 0x5a2a9a], backstab: [0xd06bff, 0xff3a6a],
  execute: [0xff2a4a, 0x9a1aff], holy: [0xffe68a, 0xffffff], smite: [0xffe68a, 0xfff7d0], wrath: [0xfff0a0, 0x9fd8ff],
  claw: [0xffffff, 0xff8a8a], boss: [0xff9a5a, 0xffffff], bossSmash: [0xff5a2a, 0xffb36b], curse: [0x8aff7a, 0x5a2a9a],
};
const RANGED = new Set(['magic', 'fireball', 'meteor', 'chain', 'arrow', 'aimed', 'volley', 'curse', 'wrath']);

export class BattlePlayer {
  constructor(app) { this.app = app; this.stage = app.stage; this.layer = app.fxLayer; }

  async play(spec) {
    const { stage } = this;
    this.spec = spec;
    this.skipped = false;
    stage.speed = this.app.P().settings.fast ? 2 : 1;
    playMusic('battle');
    stage.setDim(0, 0);
    await stage.setBg(spec.bg || 'forest');
    // aktorzy
    const P = this.app.P();
    const tier = G.appearanceTier();
    const look = heroLook(P, tier);
    const hero = await stage.addHeroActor(look.id, 470);
    hero.setLook(look);
    stage.setAura(hero, look.aura, tier);
    let foe;
    if (spec.rightHero) {
      const rh = spec.rightHero;
      const sk = SKINS[rh.skin] || SKINS.default;
      foe = await stage.addHeroActor(CLASSES[rh.cls].looks[rh.look], 470, { flip: true });
      foe.setLook({ hue: OUTFIT_HUES[rh.hue]?.hue || 0, tint: sk.tint, sat: sk.sat, glow: sk.glow, glowAmt: sk.glow ? 0.7 : 0 });
    } else {
      foe = await stage.addActor(spec.rightImg, spec.boss ? 560 : 400, { breath: 0.018 });
      // boss Próby: pulsująca poświata w kolorze Próby (shader postaci)
      if (spec.trial) foe.setLook({ glow: spec.trial.glow, glowAmt: 0.85, sat: 1.1, tint: [1.06, 1.02, 1.08] });
    }
    const vw = stage.width;
    const gap = Math.min(vw * 0.26, 420);
    hero.setPos(-gap - (vw < 900 ? 0 : 40), GROUND_Y);
    foe.setPos(gap + (vw < 900 ? 0 : 40), GROUND_Y);
    // wejście
    hero.offX = -vw * 0.5; foe.offX = vw * 0.5;
    stage.tween(hero, 'offX', 0, 0.5); stage.tween(foe, 'offX', 0, 0.5);
    this.actors = [hero, foe];
    this.buildHud(spec);
    await stage.wait(550);
    // zdarzenia
    const evs = spec.sim.events;
    const n = evs.length || 1;
    const total = clamp(n * 0.75, 10, 20);
    const per = clamp(total / n, 0.42, 1.4) * 1000;
    for (const e of evs) {
      if (this.skipped) break;
      await this.playEvent(e, per);
    }
    this.finishHp();
    // wynik
    // Próba: gdy pula PŻ bossa spadnie do zera, boss rozpada się mimo trybu obrażeń
    const winner = spec.damageMode ? (spec.rew?.awakened ? 0 : null) : spec.sim.winner;
    if (winner != null) {
      const loser = this.actors[1 - winner];
      stage.tween(loser.uniforms.uDissolve, 'value', 1, 1.0);
      stage.particles.burst(loser.center().x, loser.center().y, 40, [0xffffff, 0xffb347], 500, { life: 0.9 });
      const w = this.actors[winner];
      stage.tween(w, 'offY', 60, 0.18, undefined, () => stage.tween(w, 'offY', 0, 0.25));
    }
    if (spec.win) { playMusic('jingle'); } else { sfx('lose', 0.8); }
    await stage.wait(this.skipped ? 200 : 900);
    const res = await this.results(spec);
    this.cleanup();
    return res;
  }

  buildHud(spec) {
    const P = this.app.P();
    const [m0, m1] = spec.sim.maxHp;
    const plate = (name, lvl, side, max, extra) => h('div', { class: `plate ${side}` },
      h('div', { class: 'plate-name' }, h('span', { class: 'plv' }, lvl), name),
      h('div', { class: 'hpbar' }, h('div', { class: 'hp-shield' }), h('div', { class: 'hp-fill' }), h('div', { class: 'hp-txt' }, `${fmt(max)} / ${fmt(max)}`)),
      extra || null);
    this.hud = h('div', { class: 'battle-hud' },
      h('div', { class: 'bh-top' },
        plate(P.name, P.lvl, 'left', m0),
        h('div', { class: 'bh-vs' }, h('div', { class: 'bh-title' }, spec.title), h('div', { class: 'vs' }, 'VS'),
          h('div', { class: 'bh-pow' }, `Siła: ${fmt(G.power())}`)),
        plate(spec.rightName, spec.rightLvl, 'right', m1, spec.damageMode ? h('div', { class: 'dmg-counter' }, 'Zadane obrażenia: ', h('b', { id: 'dmgc' }, '0'), spec.trial ? h('div', { class: 'trial-ph' }, `PŻ Próby · ${spec.trial.phase}`) : null) : null)),
      h('div', { class: 'bh-bottom' },
        h('button', { class: 'btn ghost small', onclick: () => { const s = this.stage.speed === 2 ? 1 : 2; this.stage.speed = s; P.settings.fast = s === 2; G.save(); this.speedBtn.textContent = s === 2 ? 'Tempo ×2' : 'Tempo ×1'; } }, ''),
        h('button', { class: 'btn primary', onclick: () => { this.skipped = true; } }, 'Pomiń ⏭')),
    );
    this.speedBtn = this.hud.querySelector('.bh-bottom .btn');
    this.speedBtn.textContent = this.stage.speed === 2 ? 'Tempo ×2' : 'Tempo ×1';
    this.app.root.append(this.hud);
    this.maxHp = [m0, m1];
    this.dmgTotal = 0;
    if (spec.trial) {
      this.hud.querySelectorAll('.plate')[1].classList.add('trial');
      this.trialHp(spec.trial.before);
    }
  }
  // pasek wspólnej puli PŻ bossa Próby (nie odnawia się między walkami)
  trialHp(cur) {
    const t = this.spec.trial;
    const pl = this.hud.querySelectorAll('.plate')[1];
    cur = Math.max(0, cur);
    pl.querySelector('.hp-fill').style.width = (cur / t.max) * 100 + '%';
    pl.querySelector('.hp-txt').textContent = `${fmt(cur)} / ${fmt(t.max)}`;
  }
  setHp(hp) {
    const plates = this.hud.querySelectorAll('.plate');
    for (let i = 0; i < 2; i++) {
      if (this.spec.damageMode && i === 1) continue;
      const f = Math.max(0, hp[i]) / this.maxHp[i];
      plates[i].querySelector('.hp-fill').style.width = f * 100 + '%';
      plates[i].querySelector('.hp-shield').style.width = Math.min(1, (hp[2 + i] || 0) / this.maxHp[i]) * 100 + '%';
      plates[i].querySelector('.hp-txt').textContent = `${fmt(Math.max(0, hp[i]))} / ${fmt(this.maxHp[i])}`;
    }
  }
  finishHp() {
    const evs = this.spec.sim.events;
    const last = evs[evs.length - 1];
    if (last) this.setHp(last.hp);
    if (this.spec.damageMode) { const el = this.hud.querySelector('#dmgc'); if (el) el.textContent = fmt(this.spec.rew.raw ?? this.spec.rew.dmg); }
    if (this.spec.trial) this.trialHp(this.spec.rew.trialLeft);
  }
  float(actor, text, cls = '', dy = 0) {
    const c = actor.center();
    c.y += actor.h * 0.35 + dy;
    const p = this.stage.toScreen(c);
    const el = h('div', { class: 'floatxt ' + cls, style: { left: p.x + (Math.random() - 0.5) * 40 + 'px', top: p.y + 'px' } }, text);
    this.layer.append(el);
    setTimeout(() => el.remove(), 1300);
  }
  banner(actor, text) {
    const c = actor.center(); c.y += actor.h * 0.62;
    const p = this.stage.toScreen(c);
    const el = h('div', { class: 'skillbanner', style: { left: p.x + 'px', top: p.y + 'px' } }, text);
    this.layer.append(el);
    setTimeout(() => el.remove(), 1100);
  }

  async playEvent(e, per) {
    const st = this.stage;
    const sp = st.speed || 1;
    const dur = (e.n > 1 ? per * 0.55 : per);
    if (e.t === 'buff') {
      const a = this.actors[e.a];
      this.banner(a, e.label);
      const c = a.center();
      st.fxRing(c.x, c.y, e.vfx === 'ice' ? 0x7fe3ff : e.vfx === 'shadowstep' ? 0xb36bff : 0xffd34d, 520, 0.6);
      st.particles.burst(c.x, c.y, 26, e.vfx === 'ice' ? 0x9fe8ff : 0xffe08a, 300, { grav: 200, life: 0.8 });
      a.flash(e.vfx === 'ice' ? 0x9fe8ff : 0xffe08a, 0.5);
      sfx('magic', 0.5);
      this.setHp(e.hp);
      await st.wait(dur * 0.8);
      return;
    }
    if (e.t === 'heal') {
      const a = this.actors[e.a];
      this.banner(a, e.label);
      this.float(a, '+' + fmt(e.amount), 'heal');
      st.fxPillar(a.group.position.x, GROUND_Y, 0x8aff9a, 260, 700, 0.8);
      sfx('levelup', 0.4);
      this.setHp(e.hp);
      await st.wait(dur * 0.8);
      return;
    }
    if (e.t === 'dot') {
      const d = this.actors[e.target];
      d.flash(0x7aff5a, 0.55);
      const c = d.center();
      st.particles.burst(c.x, c.y, 14, [0x7aff5a, 0xffa33a], 160, { grav: 200 });
      this.float(d, fmt(e.dmg), 'dot');
      this.setHp(e.hp);
      if (this.spec.damageMode && e.target === 1) this.addDmg(e.dmg);
      await st.wait(dur * 0.6);
      return;
    }
    const att = this.actors[e.a], def = this.actors[1 - e.a];
    const dir = e.a === 0 ? 1 : -1;
    const kind = e.vfx;
    const cols = VFX_COLOR[kind] || VFX_COLOR.claw;
    if (e.skill && !e.combo) this.banner(att, e.skill);
    const ranged = RANGED.has(kind);
    const ac = att.center(), dc = def.center();
    // animacja klatkowa ataku: zamach -> klatka szczytowa w chwili trafienia -> powrót
    const anim = att.sheet;
    const apex = anim ? anim.apex : 0;
    const windUp = anim ? att.playFrames(e.combo ? Math.max(1, apex - 1) : 1, apex - 1, ranged ? 260 : 160) : Promise.resolve();
    if (ranged) {
      await windUp;
      if (anim) att.setFrame(apex);
      st.tween(att, 'offX', -dir * 18, 0.1 / sp, undefined, () => st.tween(att, 'offX', 0, 0.2 / sp));
      const from = { x: ac.x + dir * att.w * 0.3, y: ac.y + att.h * 0.1 };
      const to = { x: dc.x - dir * def.w * 0.1 * (e.t === 'miss' ? -3 : 1), y: dc.y };
      if (kind === 'meteor' || kind === 'wrath') {
        await st.projectile({ from: { x: dc.x - dir * 200, y: 700 }, to, color: cols[0], size: kind === 'meteor' ? 220 : 160, dur: 0.38 });
        if (kind === 'wrath') st.fxPillar(dc.x, GROUND_Y, 0xfff0a0, 300, 1100, 0.7);
      } else if (kind === 'chain') {
        st.fxBolt(from.x, from.y, to.x, to.y, cols[0], 0.25);
        await st.wait(90);
      } else if (kind === 'arrow' || kind === 'aimed' || kind === 'volley') {
        await st.projectile({ from, to, kind: 'arrow', dur: kind === 'volley' ? 0.18 : 0.24, arc: kind === 'volley' ? 90 : 20 });
      } else {
        await st.projectile({ from, to, color: cols[0], size: kind === 'fireball' ? 150 : 100, dur: 0.28, arc: 30 });
      }
    } else {
      const dist = Math.abs(dc.x - ac.x) - (att.w + def.w) * 0.28;
      if (kind === 'shadow' || kind === 'backstab') { st.particles.burst(ac.x, ac.y, 14, 0x5a2a9a, 200, { grav: 0 }); }
      await Promise.all([new Promise((r) => st.tween(att, 'offX', dir * Math.max(0, dist), 0.15 / sp, (t) => t * t, r)), windUp]);
      if (anim) att.setFrame(apex);
    }
    if (anim) att.playFrames(apex, anim.frames - 1, 320).then((done) => { if (done) att.setFrame(0); });
    // trafienie
    if (e.t === 'miss') {
      st.tween(def, 'offX', -dir * 70, 0.12 / sp, undefined, () => st.tween(def, 'offX', 0, 0.25 / sp));
      st.tween(def, 'offY', 40, 0.12 / sp, undefined, () => st.tween(def, 'offY', 0, 0.2 / sp));
      this.float(def, e.reason === 'Unik' ? 'UNIK!' : e.reason, 'miss');
      sfx('miss', 0.5);
    } else {
      const big = e.crit || (e.skill && !e.n) || kind === 'meteor' || kind === 'bossSmash';
      def.flash(e.blocked ? 0x9fd8ff : 0xffffff, 0.9);
      def.uniforms.uSquash.value = big ? 0.08 : 0.04;
      st.tween(def, 'offX', -dir * (big ? 50 : 24), 0.08 / sp, undefined, () => st.tween(def, 'offX', 0, 0.3 / sp));
      const hx = dc.x - dir * def.w * 0.15, hy = dc.y + (Math.random() - 0.3) * 60;
      if (!ranged || kind === 'curse') st.fxSlash(hx, hy, cols[0], big ? 1.2 : 0.8, dir < 0, Math.random() * 0.6 - 0.3);
      st.fxRing(hx, hy, cols[1], big ? 380 : 220, 0.35);
      st.particles.burst(hx, hy, big ? 46 : 22, cols, big ? 700 : 450, { dx: dir * 200, life: 0.6 });
      if (kind === 'holy' || kind === 'smite') st.fxPillar(dc.x, GROUND_Y, 0xffe68a, 200, 800, 0.5);
      if (e.crit) { st.shake = 18; this.float(def, fmt(e.dmg), 'crit'); this.float(def, 'KRYTYK!', 'critlbl', 70); sfx('crit', 0.7); }
      else { if (big) st.shake = 10; this.float(def, e.blocked ? `${e.blocked}! ${fmt(e.dmg)}` : fmt(e.dmg), e.blocked ? 'block' : ''); sfx(ranged ? 'magic' : 'hit', 0.55); }
      if (e.absorbed) this.float(def, `Tarcza −${fmt(e.absorbed)}`, 'shield', -50);
      if (this.spec.damageMode && e.a === 0) this.addDmg(e.dmg);
    }
    this.setHp(e.hp);
    if (!ranged) await new Promise((r) => st.tween(att, 'offX', 0, 0.22 / sp, undefined, r));
    await st.wait(Math.max(60, dur - (ranged ? 300 : 370)));
  }
  addDmg(d) {
    this.dmgTotal += d;
    const el = this.hud.querySelector('#dmgc');
    if (el) el.textContent = fmt(this.dmgTotal);
    if (this.spec.trial) this.trialHp(this.spec.trial.before - Math.min(this.dmgTotal, this.spec.trial.cap || Infinity));
  }

  results(spec) {
    return new Promise((resolve) => {
      const rew = spec.rew;
      const P = this.app.P();
      const rows = [];
      if (rew.dmg != null) rows.push(h('div', { class: 'rw big' }, uiIcon('swords', 'ico'), `Zadane obrażenia: ${fmt(rew.raw ?? rew.dmg)}`));
      if (rew.capped) rows.push(h('div', { class: 'rw trial-cap' }, '🛡', `Bariera Próby: zaliczono ${fmt(rew.capped)} (maks. na atak)`));
      if (rew.gold) rows.push(h('div', { class: 'rw' }, uiIcon('gold', 'ico'), `+${fmt(rew.gold)} złota`));
      if (rew.exp) rows.push(h('div', { class: 'rw' }, uiIcon('star', 'ico'), `+${fmt(rew.exp)} EXP`));
      if (rew.cr) rows.push(h('div', { class: 'rw' }, uiIcon('crystal', 'ico'), `+${rew.cr} kryształów`));
      if (rew.rating) rows.push(h('div', { class: 'rw ' + (rew.rating > 0 ? 'pos' : 'neg') }, uiIcon('trophy', 'ico'), `${rew.rating > 0 ? '+' : ''}${rew.rating} pkt rankingu (${P.arena.rating})`));
      if (rew.skin) rows.push(h('div', { class: 'rw legend' }, uiIcon('star', 'ico'), `Nowa skórka: ${SKINS[rew.skin].name}!`));
      let awk = null;
      if (spec.trial && !rew.awakened) {
        const pct = (rew.trialLeft / rew.trialMax) * 100;
        rows.splice(rew.capped ? 2 : 1, 0,
          h('div', { class: 'rw trial-left' }, uiIcon('skull', 'ico'), `Bossowi zostało ${fmt(rew.trialLeft)} PŻ (${pct < 1 ? pct.toFixed(1) : Math.ceil(pct)}%) · ${rew.phaseName}`),
          h('div', { class: 'rw' }, uiIcon('hourglass', 'ico'), rew.attemptsLeft > 0 ? `Pozostałe ataki dziś: ${rew.attemptsLeft}/${TRIAL_ATTEMPTS}` : 'Dzisiejsze ataki wykorzystane – wróć jutro!'));
      }
      if (rew.awakened) {
        const a = rew.awakened;
        awk = h('div', { class: 'awk-new', style: { borderColor: spec.trial.glow } },
          h('div', { class: 'awk-rn big', style: { background: spec.trial.glow } }, a.roman),
          h('div', {}, h('div', { class: 'muted' }, 'Nowa umiejętność Przebudzenia'), h('b', {}, a.skill.name), h('div', {}, a.skill.desc),
            h('div', { class: 'awk-new-bon' }, `+7% siły · ${Number.isFinite(G.levelCap(P)) ? `limit poziomu ${G.levelCap(P)}` : 'poziomy bez limitu'}`)));
      }
      const items = rew.items?.length ? h('div', { class: 'rw-items' }, rew.items.map((it) => {
        const el = itemSlotEl(it, { onclick: () => this.app.showItem(it) });
        return h('div', { class: 'rw-item' }, el, h('span', { style: { color: RARITIES[it.rarity].color } }, it.name));
      })) : null;
      const title = rew.awakened ? `Przebudzenie ${rew.awakened.roman}!` : spec.damageMode ? 'Atak zakończony' : spec.win ? 'Zwycięstwo!' : 'Porażka';
      const card = h('div', { class: 'result-card ' + (spec.win ? 'win' : 'lose') + (rew.awakened ? ' awaken' : '') },
        h('div', { class: 'stamp', style: rew.awakened ? { background: spec.trial.glow, color: '#1e1b24' } : {} }, title),
        h('div', { class: 'rc-sub' }, rew.awakened ? `${spec.rightName} pokonany! Twoja moc rośnie.` : spec.win || spec.damageMode ? spec.title : 'Wróg okazał się silniejszy. Ulepsz ekwipunek, rozdaj punkty lub spróbuj ponownie!'),
        awk,
        h('div', { class: 'rw-list' }, rows), items,
        h('div', { class: 'rc-actions' }));
      const actions = card.querySelector('.rc-actions');
      const done = () => { wrap.remove(); resolve(); };
      if (spec.event) {
        const ev = spec.event;
        const evBox = h('div', { class: 'event-box' },
          h('div', { class: 'ev-title' }, '❖ Wydarzenie: ', ev.t), h('p', {}, ev.d),
          h('div', { class: 'ev-btns' },
            h('button', { class: 'btn primary', onclick: () => choose('a') }, ev.a.l),
            h('button', { class: 'btn', onclick: () => choose('b') }, ev.b.l)));
        const choose = (c) => {
          const msg = G.resolveEvent(ev, c);
          evBox.replaceChildren(h('div', { class: 'ev-title' }, ev.t), h('p', { class: 'ev-res' }, msg));
          actions.append(h('button', { class: 'btn primary', onclick: done }, 'Dalej'));
          sfx('coin');
        };
        card.insertBefore(evBox, actions);
      } else {
        actions.append(h('button', { class: 'btn primary', onclick: done }, 'Dalej'));
      }
      const wrap = h('div', { class: 'modal-wrap result' }, card);
      this.app.root.append(wrap);
      this.hud.querySelector('.bh-bottom').style.display = 'none';
    });
  }
  cleanup() {
    this.hud?.remove();
    for (const a of this.actors) this.stage.removeActor(a);
    this.actors = [];
    this.stage.speed = 1;
  }
}
