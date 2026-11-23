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
    else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } }
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
// zastępuje zawartość elementu – pomija null/false i spłaszcza tablice (jak h()); natywne replaceChildren wypisałoby „null”
export function fill(el, ...kids) {
  el.replaceChildren();
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
  mythicChest: 'ui_16', egg: 'ui_17', token: 'ui_18',
};
export const uiIcon = (k, cls) => icon(UI_ICON[k], cls);
export const rar = (r) => RARITIES[r];

// sylwetki pustych slotów (wyszarzone ikony z istniejącego zestawu)
export const SLOT_GHOST = { weapon: 'weapons_00', helmet: 'armor_01', armor: 'armor_05', gloves: 'armor_08', boots: 'armor_12', ring: 'jewelry_00', amulet: 'jewelry_09' };
export function itemSlotEl(it, opts = {}) {
  const el = h('button', { class: `islot r${it ? it.rarity : 'x'} ${opts.small ? 'small' : ''} ${opts.cls || ''}`, title: it && !opts.noTitle ? it.name : opts.empty || '', onclick: opts.onclick, ...(opts.attrs || {}) },
    it ? icon(it.icon, 'iimg') : opts.ghost ? icon(SLOT_GHOST[opts.ghost], 'iimg ghost') : h('span', { class: 'islot-empty' }, opts.empty || ''),
    it && it.up ? h('span', { class: 'iup' }, '+' + it.up) : null,
    it ? h('span', { class: 'ilvl' }, it.lvl) : null,
    opts.delta != null && opts.delta !== 0 ? h('span', { class: 'idelta ' + (opts.delta > 0 ? 'pos' : 'neg') }, opts.delta > 0 ? '▲' : '▼') : null,
  );
  // przedmiot dostępny dla dymka porównania (tooltip.js)
  if (it) { el.__item = it; if (opts.compare === false) el.__noCompare = true; }
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

// ——— Miniatura bohatera w danej skórce: ten sam algorytm co shader sceny (odcień stroju, nasycenie, tint), liczony na canvasie ———
const imgCache = {};
function loadImg(src) {
  if (!imgCache[src]) imgCache[src] = new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Brak obrazu ' + src)); i.src = src; });
  return imgCache[src];
}
function rgb2hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let hh = 0;
  if (d > 1e-6) { if (mx === r) hh = ((g - b) / d) % 6; else if (mx === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4; hh /= 6; if (hh < 0) hh += 1; }
  return [hh, mx === 0 ? 0 : d / mx, mx];
}
function hsv2rgb(hh, s, v) {
  const i = Math.floor(hh * 6), f = hh * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// rysuje bohatera (cls/look/hue) w skórce skinId na canvasie o wysokości hgt
export function skinPreview(cls, look, hueIdx, skinId, hgt = 150) {
  const C = CLASSES[cls];
  const skin = SKINS[skinId] || SKINS.default;
  const hue = OUTFIT_HUES[hueIdx || 0]?.hue || 0;
  const cv = h('canvas', { class: 'skin-cv' });
  cv.style.filter = skin.glow ? `drop-shadow(0 0 6px ${skin.glow}) drop-shadow(0 0 2px ${skin.glow})` : 'drop-shadow(2px 3px 0 rgba(0,0,0,.4))';
  loadImg(`./assets/heroes/${C.looks[look || 0]}.webp`).then((img) => {
    const k = hgt / img.height;
    cv.width = Math.round(img.width * k); cv.height = hgt;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const d = ctx.getImageData(0, 0, cv.width, cv.height), px = d.data;
    const [tr, tg, tb] = skin.tint, sat = skin.sat;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 8) continue;
      let r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
      if (Math.abs(hue) > 0.001) {
        const [x, s, v] = rgb2hsv(r, g, b);
        const isSkin = ((x >= 0.02 && x <= 0.12 && s < 0.8) || ((x > 0.86 || x < 0.02) && s < 0.6)) && v > 0.3;
        const kk = smooth(0.3, 0.45, s);
        if (!isSkin && kk > 0) { const [nr, ng, nb] = hsv2rgb((x + hue) % 1, s, v); r += (nr - r) * kk; g += (ng - g) * kk; b += (nb - b) * kk; }
      }
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      px[i] = Math.min(255, (l + (r - l) * sat) * tr * 255);
      px[i + 1] = Math.min(255, (l + (g - l) * sat) * tg * 255);
      px[i + 2] = Math.min(255, (l + (b - l) * sat) * tb * 255);
    }
    ctx.putImageData(d, 0, 0);
  }).catch((e) => console.error('Podgląd skórki', e));
  return cv;
}
