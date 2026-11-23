// Pomocnicze funkcje DOM i komponenty wspólne
import { RARITIES, SLOT_NAMES, WEAPON_TYPE_NAMES } from '../data/items.js';
import { STAT_SHORT, STAT_NAMES, CLASSES, SKINS, AURA_COLORS, OUTFIT_HUES } from '../data/classes.js';
import { fmt } from '../core/util.js';
import { itemStats } from '../core/formulas.js';
import { TRIALS } from '../data/awakening.js';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);
export const icon = (name, cls = 'ico') => h('img', { class: cls, src: `./assets/icons/${name}.webp`, alt: '', draggable: 'false' });
export const UI_ICON = {
  gold: 'ui_00', crystal: 'ui_01', chest: 'ui_02', legendChest: 'ui_03', potion: 'ui_04', energy: 'ui_05', trophy: 'ui_06', scroll: 'ui_07',
  key: 'ui_08', swords: 'ui_09', guild: 'ui_10', gift: 'ui_11', hourglass: 'ui_12', star: 'ui_13', skull: 'ui_14', anvil: 'ui_15',
};
export const uiIcon = (k, cls) => icon(UI_ICON[k], cls);
export const rar = (r) => RARITIES[r];

// sylwetki pustych slotów (wyszarzone ikony z istniejącego zestawu)
export const SLOT_GHOST = { weapon: 'weapons_00', helmet: 'armor_01', armor: 'armor_05', gloves: 'armor_08', boots: 'armor_12', ring: 'jewelry_00', amulet: 'jewelry_09' };
export function itemSlotEl(it, opts = {}) {
  const el = h('button', { class: `islot r${it ? it.rarity : 'x'} ${opts.small ? 'small' : ''} ${opts.cls || ''}`, title: it ? it.name : opts.empty || '', onclick: opts.onclick, ...(opts.attrs || {}) },
    it ? icon(it.icon, 'iimg') : opts.ghost ? icon(SLOT_GHOST[opts.ghost], 'iimg ghost') : h('span', { class: 'islot-empty' }, opts.empty || ''),
    it && it.up ? h('span', { class: 'iup' }, '+' + it.up) : null,
    it ? h('span', { class: 'ilvl' }, it.lvl) : null,
    opts.delta != null && opts.delta !== 0 ? h('span', { class: 'idelta ' + (opts.delta > 0 ? 'pos' : 'neg') }, opts.delta > 0 ? '▲' : '▼') : null,
  );
  return el;
}

export function itemDetails(it, delta) {
  const s = itemStats(it);
  const R = rar(it.rarity);
  return h('div', { class: 'idet' },
    h('div', { class: 'idet-head' },
      h('div', { class: `islot big r${it.rarity}` }, icon(it.icon, 'iimg')),
      h('div', {},
        h('div', { class: 'idet-name', style: { color: it.rarity === 0 ? '#5d564c' : R.color } }, it.name, it.up ? ` +${it.up}` : ''),
        h('div', { class: 'idet-sub' }, `${R.name} · ${SLOT_NAMES[it.slot]}${it.type ? ' (' + WEAPON_TYPE_NAMES[it.type] + ')' : ''} · Poz. ${it.lvl}`),
      )),
    h('div', { class: 'idet-stats' },
      s.dmg ? h('div', { class: 'srow main' }, h('span', {}, 'Obrażenia'), h('b', {}, fmt(s.dmg))) : null,
      s.armor ? h('div', { class: 'srow main' }, h('span', {}, 'Pancerz'), h('b', {}, fmt(s.armor))) : null,
      Object.entries(s.stats).map(([k, v]) => h('div', { class: 'srow' }, h('span', {}, STAT_NAMES[k]), h('b', {}, '+' + fmt(v)))),
      it.fx ? h('div', { class: 'srow legend' }, '★ ' + it.fx) : null,
    ),
    delta != null ? h('div', { class: 'idet-delta ' + (delta > 0 ? 'pos' : delta < 0 ? 'neg' : '') }, delta > 0 ? `▲ +${fmt(delta)} siły` : delta < 0 ? `▼ ${fmt(delta)} siły` : '= bez zmian siły') : null,
  );
}

export function bar(frac, cls = '') {
  return h('div', { class: 'bar ' + cls }, h('div', { class: 'bar-fill', style: { width: Math.max(0, Math.min(100, frac * 100)) + '%' } }));
}
export function btn(label, onclick, cls = '', attrs = {}) {
  return h('button', { class: 'btn ' + cls, onclick, ...attrs }, label);
}
export function statPills(stats) {
  return h('div', { class: 'pills' }, Object.entries(stats).map(([k, v]) => h('span', { class: 'pill' }, `${STAT_SHORT[k]} ${fmt(v)}`)));
}

// wygląd bohatera (do sceny)
export function heroLook(p, tier) {
  const cls = CLASSES[p.cls];
  const skin = SKINS[p.skin || 'default'] || SKINS.default;
  const hue = OUTFIT_HUES[p.hue || 0]?.hue || 0;
  const aura = AURA_COLORS[p.aura || 0]?.c || '#ffcf4a';
  let glow = skin.glow, glowAmt = skin.glow ? 0.8 : 0;
  // Przebudzenie: poświata w kolorze ostatniej ukończonej Próby
  if (!glow && p.awak > 0) { glow = TRIALS[Math.min(TRIALS.length, p.awak) - 1].glow; glowAmt = 0.55 + p.awak * 0.05; }
  const w = p.equip?.weapon;
  if (!glow && w && w.rarity >= 3) { glow = RARITIES[w.rarity].color; glowAmt = 0.45 + (w.up || 0) * 0.03; }
  if (!glow && tier >= 4) { glow = '#ffe08a'; glowAmt = 0.6; }
  return { id: cls.looks[p.look || 0], path: `heroes/${cls.looks[p.look || 0]}.webp`, hue, tint: skin.tint, sat: skin.sat, glow, glowAmt, aura, tier };
}

export function clsBadge(cls) {
  const C = CLASSES[cls];
  return h('span', { class: 'clsb', style: { background: '#' + C.color.toString(16).padStart(6, '0') } }, C.name[0]);
}
