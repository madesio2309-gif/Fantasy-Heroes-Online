// Koło fortuny – mini gra weekendowa (sobota–niedziela) i event administratora „Szczęśliwe Koło”
import { h, icon, UI_ICON, uiIcon, btn, itemDetails, fill } from './dom.js';
import { sfx } from './audio.js';
import * as G from '../core/game.js';
import { fmt, fmtTime } from '../core/util.js';
import { RARITIES } from '../data/items.js';

const SEG_COLORS = ['#b8412f', '#2b3a78', '#e0a33a', '#3d50a0', '#d2563f', '#6b3fa0', '#2b3a78', '#ff9f1c', '#1e1b24', '#ff3d6e'];
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };

function wheelSvg() {
  const n = G.WHEEL_PRIZES.length, R = 150, cx = 160, cy = 160, step = (Math.PI * 2) / n;
  const root = svg('svg', { viewBox: '0 0 320 320', class: 'wheel-svg' });
  const g = svg('g', { class: 'wheel-rot' });
  G.WHEEL_PRIZES.forEach((p, i) => {
    const a0 = -Math.PI / 2 + i * step, a1 = a0 + step;
    const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    g.append(svg('path', { d: `M${cx},${cy} L${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1} Z`, fill: SEG_COLORS[i % SEG_COLORS.length], stroke: '#1e1b24', 'stroke-width': 3 }));
    const am = a0 + step / 2, deg = (am * 180) / Math.PI + 90;
    const ic = svg('image', { href: `./assets/icons/${UI_ICON[p.icon]}.webp`, x: -17, y: -17, width: 34, height: 34 });
    const gi = svg('g', { transform: `translate(${cx + 104 * Math.cos(am)},${cy + 104 * Math.sin(am)}) rotate(${deg})` });
    gi.append(ic);
    const t = svg('text', { x: 0, y: 30, 'text-anchor': 'middle', class: 'wheel-lbl' });
    // dłuższe nazwy w dwóch linijkach
    const words = p.label.split(' ');
    const lines = p.label.length > 11 && words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [p.label];
    lines.forEach((ln, k) => { const ts = svg('tspan', { x: 0, dy: k ? 11 : 0 }); ts.textContent = ln; t.append(ts); });
    gi.append(t);
    g.append(gi);
  });
  g.append(svg('circle', { cx, cy, r: R, fill: 'none', stroke: '#1e1b24', 'stroke-width': 6 }));
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * step; g.append(svg('circle', { cx: cx + (R - 4) * Math.cos(a), cy: cy + (R - 4) * Math.sin(a), r: 4, fill: '#f2e4c6', stroke: '#1e1b24', 'stroke-width': 1.5 })); }
  root.append(g);
  const hub = svg('circle', { cx, cy, r: 26, fill: '#f2e4c6', stroke: '#1e1b24', 'stroke-width': 5 });
  root.append(hub);
  const hubIc = svg('image', { href: `./assets/icons/${UI_ICON.token}.webp`, x: cx - 18, y: cy - 18, width: 36, height: 36 });
  root.append(hubIc);
  return { root, g };
}

export function openWheel(app) {
  const body = h('div', { class: 'wheel' });
  let angle = 0, spinning = false, m;
  const { root, g } = wheelSvg();
  const stage = h('div', { class: 'wheel-stage' }, root, h('div', { class: 'wheel-ptr' }));
  const result = h('div', { class: 'wheel-res' });
  const info = h('div', { class: 'wheel-info' });
  const spinBtn = btn('Zakręć (1 żeton)', () => spin(), 'primary big', { id: 'btn-spin' });
  const setRot = (a) => { g.style.transform = `rotate(${a}deg)`; };
  const draw = () => {
    const s = G.wheelState();
    const live = G.liveActive('wheel');
    spinBtn.disabled = spinning || !s.active || s.tokens <= 0 || undefined;
    fill(info, 
      h('div', { class: 'wheel-tokens' }, uiIcon('token', 'big-ico'), h('div', {}, h('div', { class: 'muted' }, 'Twoje żetony'), h('b', { id: 'wheel-tokens' }, s.tokens))),
      s.active
        ? h('div', { class: 'muted' }, live ? '⚡ Event „Szczęśliwe Koło”: żetony ×2. ' : '', 'Koło zamyka się za ', h('b', {}, fmtTime(G.wheelClosesIn())), '. Niewykorzystane żetony przepadają.')
        : h('div', { class: 'muted' }, 'Koło fortuny kręci się w weekendy. Wraca za ', h('b', {}, fmtTime(G.wheelOpensIn())), '.'),
      s.active ? (s.freeReady ? btn(`Odbierz darmowe żetony (${G.wheelFreeTokens()})`, () => { const n = G.claimWheelFree(); if (n) { sfx('coin'); app.toast(`+${n} żetonów fortuny!`, 'good'); } draw(); }, 'gold', { id: 'btn-wheel-free' }) : h('div', { class: 'muted' }, '✔ Dzisiejsze darmowe żetony odebrane.')) : null,
      spinBtn,
      h('div', { class: 'tip' }, '🎟 Żetony w weekend: wygrana przygoda, piętro lochu lub Otchłani, walka na arenie, atak na bossa, odebrana misja – po 1 żetonie.'),
      s.last.length ? h('div', { class: 'wheel-log' }, h('b', {}, 'Ostatnie nagrody'), s.last.slice(0, 5).map((x) => h('div', { class: 'muted' }, '• ', x.text))) : null);
  };
  const spin = () => {
    if (spinning) return;
    const res = G.spinWheel();
    if (!res) { draw(); return; }
    spinning = true; draw();
    result.replaceChildren();
    const n = G.WHEEL_PRIZES.length, seg = 360 / n;
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const target = 360 - (res.index * seg + seg / 2) + jitter;
    const from = angle;
    const to = from + 360 * 5 + ((target - (from % 360)) % 360 + 360) % 360;
    const dur = 4200, t0 = performance.now();
    let lastSeg = Math.floor(from / seg);
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      angle = from + (to - from) * ease(t);
      setRot(angle);
      const sIdx = Math.floor(angle / seg);
      if (sIdx !== lastSeg) { lastSeg = sIdx; sfx('tick', 0.45); }
      if (t < 1 && m.el.isConnected) { requestAnimationFrame(frame); return; }
      angle %= 360; setRot(angle);
      spinning = false;
      const big = ['legend', 'cr250', 'mythic', 'egg'].includes(res.prize.id);
      sfx(big ? 'levelup' : 'coin', big ? 0.8 : 0.6);
      const it = res.item;
      fill(result, h('div', { class: 'wheel-win' + (big ? ' big' : '') },
        uiIcon(res.prize.icon, 'big-ico'), h('div', {}, h('div', { class: 'muted' }, big ? 'Wielka wygrana!' : 'Wygrywasz'), h('b', {}, res.text))),
        it ? itemDetails(it, G.compare(it)) : null);
      if (it) app.toast(`Koło fortuny: ${it.name} (${RARITIES[it.rarity].name})`, 'good');
      draw();
    };
    requestAnimationFrame(frame);
  };
  draw();
  body.append(h('div', { class: 'wheel-grid' }, h('div', {}, stage, result), info));
  const iv = setInterval(() => { if (!m.el.isConnected) { clearInterval(iv); return; } if (!spinning) draw(); }, 1000);
  m = app.modal('Koło fortuny', body, { cls: 'wide', onClose: () => clearInterval(iv) });
  return m;
}
