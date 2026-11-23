// Prowadzony samouczek pierwszych minut gry: podświetlenie celu + dymek, przejście po wykonaniu akcji
import { h } from './dom.js';
import { sfx } from './audio.js';
import * as G from '../core/game.js';

const STEPS = [
  { text: 'Witaj, bohaterze! W 2 minuty pokażę Ci, jak zostać legendą. Gotowy?', btn: 'Zaczynamy!' },
  {
    text: 'Wybierz najkrótszą przygodę i kliknij „Wyrusz”. Przygody trwają od 1 do 10 minut.',
    target: '[data-quest="0"]', tab: 'adventures', done: (P) => !!P.quest.active || P.stats.quests > 0,
  },
  {
    text: 'Pierwsze przyspieszenie jest gratis! Kliknij „Przyspiesz”. Później przygody biegną nawet, gdy gra jest zamknięta.',
    target: '#btn-quest-skip', tab: 'adventures', done: (P) => !P.quest.active || G.questDone(),
  },
  {
    text: 'Przygoda ukończona! Kliknij „Walcz” – walka toczy się sama. Ty decydujesz o sprzęcie i statystykach.',
    target: '#btn-quest-fight', tab: 'adventures', done: (P) => P.stats.fights > 0,
  },
  {
    text: 'Zdobyłeś łupy! Otwórz zakładkę „Postać”, aby je obejrzeć.',
    target: '.nav-btn[data-tab="character"]', done: (P, app) => app.tab === 'character' && app.panelOpen,
  },
  {
    text: 'Kliknij „Załóż najlepsze” – gra sama porówna przedmioty i założy mocniejsze. Zielona strzałka ▲ = lepszy przedmiot.',
    target: '#btn-autoequip', tab: 'character', sub: ['character', 'equip'], done: (P) => !!P.tutAuto,
  },
  {
    text: 'Twój bohater zarabia złoto i EXP także, gdy Cię nie ma (do 12 godzin). Odbierasz je tutaj jednym kliknięciem.',
    target: '.quick .qbtn', btn: 'Rozumiem',
  },
  {
    text: 'Na Arenie walczysz z innymi graczami o miejsce w rankingu i nagrody sezonu. Zajrzyj tam!',
    target: '.nav-btn[data-tab="arena"]', done: (P, app) => app.tab === 'arena' && app.panelOpen,
  },
  {
    text: 'Świetnie! Czekają na Ciebie lochy z bossami, gildie, boss światowy i misje dzienne. Odbierz nagrodę za samouczek!',
    btn: 'Odbierz nagrodę', final: true,
  },
];

export class Tutorial {
  constructor(app) {
    this.app = app;
    this.ring = h('div', { class: 'tut-ring' });
    this.bubble = h('div', { class: 'tut-bubble' });
    this.el = h('div', { id: 'tut' }, this.ring, this.bubble);
    this.shown = -1;
    this.loop = this.loop.bind(this);
  }
  get active() { const P = G.P; return !!P && P.tut !== 'done' && typeof P.tut === 'number'; }
  start() {
    if (!this.active) return;
    if (!this.el.isConnected) this.app.root.append(this.el);
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }
  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.el.remove();
  }
  advance() {
    const P = G.P;
    P.tut++;
    sfx('click', 0.5);
    G.save();
    this.shown = -1;
    if (P.tut >= STEPS.length) { P.tut = 'done'; G.save(); this.stop(); }
  }
  skip() {
    G.P.tut = 'done'; G.save(); this.stop();
    this.app.toast('Samouczek pominięty. Powodzenia, bohaterze!');
  }
  finish() {
    const it = G.claimTutorialReward();
    this.stop();
    if (it) this.app.toast(`Nagroda za samouczek: 50 kryształów i ${it.name}!`, 'good');
    this.app.render();
  }
  draw(step) {
    const s = STEPS[step];
    const kids = [
      h('div', { class: 'tut-step' }, `Samouczek ${step + 1}/${STEPS.length}`),
      h('div', { class: 'tut-text' }, s.text),
    ];
    const row = h('div', { class: 'tut-row' });
    if (s.btn) row.append(h('button', { class: 'btn primary small', id: 'tut-next', onclick: () => (s.final ? this.finish() : this.advance()) }, s.btn));
    if (!s.final) row.append(h('button', { class: 'tut-skip', onclick: () => this.skip() }, 'Pomiń samouczek'));
    kids.push(row);
    this.bubble.replaceChildren(...kids);
  }
  loop() {
    this.raf = requestAnimationFrame(this.loop);
    const P = G.P;
    const app = this.app;
    if (!this.active) { this.stop(); return; }
    let step = P.tut;
    // automatyczne przejście, gdy gracz wykonał akcję
    while (step < STEPS.length && STEPS[step].done && STEPS[step].done(P, app)) { P.tut = ++step; G.save(); }
    if (step >= STEPS.length) { P.tut = 'done'; G.save(); this.stop(); return; }
    const s = STEPS[step];
    const blocked = app.inBattle || document.querySelector('.modal-wrap') || document.querySelector('.levelup');
    this.el.classList.toggle('hidden', !!blocked);
    if (blocked) return;
    // upewnij się, że wymagana zakładka jest widoczna
    if (s.tab && !(app.tab === s.tab && app.panelOpen) && step !== this.forcedTab) {
      this.forcedTab = step;
      if (s.sub) app.sub[s.sub[0]] = s.sub[1];
      app.tab = s.tab; app.panelOpen = true; document.body.classList.add('panel-open'); app.render();
    }
    if (this.shown !== step) { this.draw(step); this.shown = step; }
    const t = s.target ? document.querySelector(s.target) : null;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (t) {
      const r = t.getBoundingClientRect();
      if (r.width > 0) {
        if (this.scrolled !== step) { this.scrolled = step; t.scrollIntoView({ block: 'nearest' }); }
        Object.assign(this.ring.style, { display: 'block', left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
        const bw = Math.min(340, vw - 24);
        const bh = this.bubble.offsetHeight || 120;
        let left = Math.min(vw - bw - 12, Math.max(12, r.left + r.width / 2 - bw / 2));
        let top = r.top > vh * 0.5 ? r.top - bh - 18 : r.bottom + 18;
        top = Math.min(vh - bh - 12, Math.max(12, top));
        Object.assign(this.bubble.style, { left: left + 'px', top: top + 'px', width: bw + 'px', transform: 'none' });
        return;
      }
    }
    this.ring.style.display = 'none';
    Object.assign(this.bubble.style, { left: '50%', top: '38%', width: Math.min(380, vw - 24) + 'px', transform: 'translate(-50%, -50%)' });
  }
}
