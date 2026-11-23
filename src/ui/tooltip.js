// Porównanie ekwipunku po najechaniu myszą: dymek z przedmiotem, obecnie założonym odpowiednikiem i zmianą siły.
// Działa dla każdego slotu .islot z przypisanym przedmiotem (plecak, lalka, sklep, nagrody, profil innego gracza).
// Na ekranach dotykowych dymek się nie pojawia – dotknięcie otwiera okno porównania jak dotychczas.
import { h, itemDetails, fill } from './dom.js';
import * as G from '../core/game.js';

let tip = null, cur = null, lastX = 0, lastY = 0;

export function initItemTooltip() {
  if (tip || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  tip = h('div', { class: 'itip', role: 'tooltip' });
  document.body.append(tip);
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest && e.target.closest('.islot');
    if (!el || !el.__item || el === cur) return;
    cur = el;
    lastX = e.clientX; lastY = e.clientY;
    show(el);
  });
  document.addEventListener('pointerout', (e) => {
    if (!cur) return;
    if (e.relatedTarget && cur.contains(e.relatedTarget)) return;
    hide();
  });
  document.addEventListener('pointermove', (e) => { if (!cur) return; lastX = e.clientX; lastY = e.clientY; place(); });
  // przeciąganie, przewijanie i klawiatura chowają dymek
  for (const ev of ['pointerdown', 'wheel', 'keydown']) window.addEventListener(ev, hide, { capture: true, passive: true });
}

function show(el) {
  const P = G.P;
  if (!P || !document.body.contains(el)) return;
  const it = el.__item;
  const mine = !it.preview;
  const equipped = mine && P.equip[it.slot]?.uid === it.uid;
  const worn = equipped ? null : P.equip[it.slot];
  const delta = equipped || el.__noCompare ? null : G.compare(it);
  fill(tip, 
    h('div', { class: 'itip-col' }, h('div', { class: 'itip-lbl' }, equipped ? 'Założony' : mine ? 'Przedmiot' : 'Przedmiot gracza'), itemDetails(it, delta)),
    worn && !el.__noCompare ? h('div', { class: 'itip-col worn' }, h('div', { class: 'itip-lbl' }, 'Obecnie założony'), itemDetails(worn)) : null,
  );
  tip.classList.add('on');
  place();
}
function place() {
  if (!tip || !tip.classList.contains('on')) return;
  const r = tip.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = lastX + 18, y = lastY + 16;
  if (x + r.width > vw - 8) x = Math.max(8, lastX - r.width - 18);
  if (y + r.height > vh - 8) y = Math.max(8, vh - r.height - 8);
  tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}
export function hide() {
  cur = null;
  if (tip) tip.classList.remove('on');
}
