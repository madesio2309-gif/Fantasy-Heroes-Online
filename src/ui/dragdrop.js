// Przeciąganie przedmiotów: plecak → slot postaci (załóż), slot → plecak (zdejmij), plecak → strefa sprzedaży.
// Pointer Events: mysz – przeciąganie po przesunięciu o kilka pikseli; dotyk – po krótkim przytrzymaniu
// (zwykłe przesunięcie palcem nadal przewija panel).
import * as G from '../core/game.js';
import { SLOT_NAMES } from '../data/items.js';
import { sfx } from './audio.js';
import { fmt } from '../core/util.js';

const MOUSE_THRESHOLD = 6;
const TOUCH_HOLD_MS = 220;
const TOUCH_CANCEL_PX = 10;

export function initItemDrag(app, root) {
  let st = null; // { el, uid, src, slot, x0, y0, id, type, timer, dragging, ghost, hover }

  const findItem = (uid) => G.findItem(uid);
  const dropTargetAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('[data-drop]') : null;
  };
  const accepts = (target) => {
    if (!target || !st) return false;
    const kind = target.dataset.drop;
    if (st.src === 'bag') return (kind === 'slot' && target.dataset.slot === st.slot) || kind === 'sell';
    if (st.src === 'equip') return kind === 'bag';
    return false;
  };

  function begin() {
    const it = findItem(st.uid);
    if (!it) { cleanup(); return; }
    st.dragging = true;
    app.dragBlock = true;
    const rect = st.el.getBoundingClientRect();
    const ghost = st.el.cloneNode(true);
    ghost.classList.add('drag-ghost');
    Object.assign(ghost.style, { width: rect.width + 'px', height: rect.height + 'px' });
    document.body.append(ghost);
    st.ghost = ghost;
    st.offX = rect.width / 2; st.offY = rect.height / 2;
    st.el.classList.add('drag-src');
    document.body.classList.add('dragging', st.src === 'bag' ? 'drag-from-bag' : 'drag-from-equip');
    // podświetl miejsca docelowe
    for (const t of root.querySelectorAll('[data-drop]')) t.classList.toggle('drop-ok', accepts(t));
    if (navigator.vibrate && st.type === 'touch') navigator.vibrate(15);
    sfx('click', 0.35);
    move(st.lx, st.ly);
    st.raf = requestAnimationFrame(autoScroll);
  }
  function move(x, y) {
    st.lx = x; st.ly = y;
    if (!st.dragging) return;
    st.ghost.style.transform = `translate(${x - st.offX}px, ${y - st.offY}px) rotate(-4deg) scale(1.12)`;
    const t = dropTargetAt(x, y);
    if (t !== st.hover) {
      st.hover?.classList.remove('drop-hover', 'drop-bad');
      st.hover = t;
      if (t) t.classList.add(accepts(t) ? 'drop-hover' : 'drop-bad');
    }
  }
  // automatyczne przewijanie panelu, gdy kursor jest przy jego krawędzi
  // prędkość zależna od czasu (px/s), a nie od liczby klatek – działa tak samo przy 30 i 120 FPS
  function autoScroll(now) {
    if (!st || !st.dragging) return;
    const dt = Math.min(0.1, ((now || performance.now()) - (st.lastT || now || performance.now())) / 1000);
    st.lastT = now || performance.now();
    const body = root.querySelector('.panel-body');
    if (body && dt > 0) {
      const r = body.getBoundingClientRect();
      const edge = 70;
      let k = 0;
      if (st.hover?.dataset.drop === 'sell') k = 0; // nad strefą sprzedaży nie przewijamy
      else if (st.ly < r.top + edge && st.ly > r.top - 140) k = -Math.min(1, (r.top + edge - st.ly) / edge);
      else if (st.ly > r.bottom - edge && st.ly < r.bottom + 90) k = Math.min(1, (st.ly - (r.bottom - edge)) / edge);
      if (k) {
        body.scrollTop += k * (500 + 900 * Math.abs(k)) * dt;
        move(st.lx, st.ly); // cel pod kursorem zmienia się podczas przewijania
      }
    }
    st.raf = requestAnimationFrame(autoScroll);
  }
  function drop() {
    const t = st.hover;
    const it = findItem(st.uid);
    if (!it || !t) return;
    const kind = t.dataset.drop;
    if (st.src === 'bag' && kind === 'slot') {
      if (t.dataset.slot !== it.slot) { app.toast(`„${it.name}” pasuje do slotu: ${SLOT_NAMES[it.slot]}.`, 'bad'); return; }
      const before = G.power();
      app.justEquipped = it.slot;
      G.equip(it.uid);
      sfx('levelup', 0.35);
      const d = G.power() - before;
      app.toast(`Założono: ${it.name}${d ? ` (siła ${d > 0 ? '+' : ''}${fmt(d)})` : ''}`, d < 0 ? 'bad' : 'good');
    } else if (st.src === 'bag' && kind === 'sell') {
      if (it.rarity >= 3 && !confirm(`Sprzedać „${it.name}”?`)) return;
      const g = G.sell(it.uid);
      app.toast(`Sprzedano „${it.name}” za ${fmt(g)} zł.`, 'good');
    } else if (st.src === 'equip' && kind === 'bag') {
      G.unequip(st.slot);
      sfx('click', 0.5);
    }
  }
  function cleanup() {
    if (!st) return;
    clearTimeout(st.timer);
    if (st.raf) cancelAnimationFrame(st.raf);
    st.ghost?.remove();
    st.el?.classList.remove('drag-src');
    for (const t of document.querySelectorAll('.drop-ok, .drop-hover, .drop-bad')) t.classList.remove('drop-ok', 'drop-hover', 'drop-bad');
    document.body.classList.remove('dragging', 'drag-from-bag', 'drag-from-equip');
    const wasDragging = st.dragging;
    st = null;
    // kliknięcie wywołane puszczeniem przycisku nie może otworzyć okna przedmiotu
    if (wasDragging) setTimeout(() => { app.dragBlock = false; }, 0);
  }

  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || st) return;
    const el = e.target.closest('[data-uid][data-src]');
    if (!el || !root.contains(el)) return;
    st = { el, uid: el.dataset.uid, src: el.dataset.src, slot: el.dataset.slot, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId, type: e.pointerType, dragging: false };
    if (e.pointerType === 'mouse') e.preventDefault(); // bez zaznaczania tekstu
    else st.timer = setTimeout(() => { if (st && !st.dragging) begin(); }, TOUCH_HOLD_MS);
  });
  window.addEventListener('pointermove', (e) => {
    if (!st || e.pointerId !== st.id) return;
    const dist = Math.hypot(e.clientX - st.x0, e.clientY - st.y0);
    if (!st.dragging) {
      if (st.type === 'mouse') { if (dist > MOUSE_THRESHOLD) { st.lx = e.clientX; st.ly = e.clientY; begin(); } }
      else if (dist > TOUCH_CANCEL_PX) cleanup(); // to było przewijanie
      return;
    }
    move(e.clientX, e.clientY);
  });
  window.addEventListener('pointerup', (e) => {
    if (!st || e.pointerId !== st.id) return;
    if (st.dragging) { move(e.clientX, e.clientY); drop(); }
    cleanup();
  });
  window.addEventListener('pointercancel', (e) => { if (st && e.pointerId === st.id) cleanup(); });
  // podczas przeciągania palcem blokujemy przewijanie strony
  window.addEventListener('touchmove', (e) => { if (st && st.dragging) e.preventDefault(); }, { passive: false });
  // długie przytrzymanie nie otwiera menu kontekstowego
  root.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-uid][data-src]')) e.preventDefault(); });
  // podpowiedź myszą: wskazanie przedmiotu w plecaku podświetla jego slot
  root.addEventListener('pointerover', (e) => {
    if (st || e.pointerType !== 'mouse') return;
    const el = e.target.closest('[data-src="bag"]');
    for (const t of root.querySelectorAll('.doll-slot.hint')) t.classList.remove('hint');
    if (el) root.querySelector(`.doll-slot[data-slot="${el.dataset.slot}"]`)?.classList.add('hint');
  });
}
