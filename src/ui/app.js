// Główna aplikacja: ekrany, układ, nawigacja, modale, hub
import { Stage, loadTex, loadAnimMeta, GROUND_Y } from '../render/stage.js';
import { h, $, icon, uiIcon, itemSlotEl, itemDetails, bar, heroLook, btn } from './dom.js';
import { preloadAudio, sfx, playMusic, setMusic, setSound, audioState } from './audio.js';
import { BattlePlayer } from './battle.js';
import { Tutorial } from './tutorial.js';
import { initItemDrag } from './dragdrop.js';
import { renderTab, TABS } from './tabs.js';
import * as Panels from './panels.js';
import * as G from '../core/game.js';
import * as Acc from '../core/accounts.js';
import { CLASSES, CLASS_ORDER, SKILLS, OUTFIT_HUES, AURA_COLORS, outfitSwatch } from '../data/classes.js';
import { RARITIES, SLOT_NAMES } from '../data/items.js';
import { fmt, fmtTime, R } from '../core/util.js';
import { upgradeCost, sellPrice, buyPrice, MAX_UP } from '../core/formulas.js';

const HERO_LINES = [
  'Gotowy na przygodę!', 'Czy ktoś widział moją drugą skarpetę?', 'Złoto samo się nie zarobi.', 'Jeszcze jedna przygoda i idę spać.',
  'Ten szlam na mnie krzywo patrzył.', 'Arena czeka!', 'Mama mówiła, żebym został piekarzem…', 'Kto pierwszy do lochu?', 'Czuję legendarny łup w kościach.',
];

export class App {
  constructor(root) {
    this.root = root;
    this.canvas = h('canvas', { id: 'stage' });
    this.fxLayer = h('div', { id: 'fx-layer' });
    this.toasts = h('div', { id: 'toasts' });
    root.append(this.canvas, this.fxLayer, this.toasts);
    this.stage = new Stage(this.canvas);
    new ResizeObserver(() => { this.stage.resize(); this.placeHero(); }).observe(this.canvas);
    this.battle = new BattlePlayer(this);
    this.tutorial = new Tutorial(this);
    this.tab = 'adventures';
    this.sub = {};
    this.panelOpen = true;
    this.busy = false;
    G.on('toast', (m, k) => this.toast(m, k));
    G.on('change', () => this.scheduleRender());
    G.on('appearance', () => this.refreshHero());
    G.on('levelup', (l, sk) => this.levelUp(l, sk));
    G.on('sfx', (s) => sfx(s));
    G.on('chat', () => { if (this.chatEl) Panels.refreshChat(this); });
    this.stage.onResize = () => this.placeHero();
  }
  P() { return G.P; }

  // ——— Start / ładowanie ———
  async boot() {
    preloadAudio();
    const bgs = ['hub', 'forest', 'swamp', 'volcano', 'desert', 'dungeon', 'arena', 'guildhall'];
    const heroes = CLASS_ORDER.flatMap((c) => CLASSES[c].looks.map((l) => `heroes/${l}.webp`));
    const anims = CLASS_ORDER.flatMap((c) => CLASSES[c].looks.map((l) => `anims/atk_${l}.webp`));
    const list = [...bgs.map((b) => `bg/${b}.jpg`), ...heroes, ...anims];
    loadAnimMeta();
    let done = 0;
    this.renderStart(0, list.length);
    await this.stage.setBg('hub');
    this.stage.setDim(0.18, 0.6);
    const showcase = this.showcase();
    await Promise.all(list.map((p) => loadTex(p).then(() => { done++; this.updateLoad(done, list.length); })));
    await showcase;
    this.updateLoad(list.length, list.length, true);
  }
  async showcase() {
    const picks = ['warrior_a', 'mage_b', 'paladin_a'];
    const xs = [-0.22, 0, 0.22];
    this.showActors = [];
    for (let i = 0; i < 3; i++) {
      const a = await this.stage.addActor(`heroes/${picks[i]}.webp`, i === 1 ? 520 : 470);
      a.setPos(this.stage.width * xs[i] - this.stage.width * 0.08, GROUND_Y + (i === 1 ? -10 : 20));
      a.mesh.position.z = i === 1 ? 2 : 1;
      if (i === 1) this.stage.setAura(a, '#b36bff', 2);
      this.showActors.push(a);
    }
  }
  renderStart(n, total) {
    const segs = 12;
    this.startEl = h('div', { class: 'start' },
      h('div', { class: 'start-right' },
        h('div', { class: 'title' }, h('span', { class: 't1' }, 'Fantasy'), h('span', { class: 't2' }, 'Heroes'), h('span', { class: 't3' }, 'Online')),
        h('div', { class: 'tagline' }, 'Szybkie przygody. Animowane pojedynki. Jeden wspólny świat.'),
        h('div', { class: 'load' },
          h('div', { class: 'load-segs' }, Array.from({ length: segs }, () => h('i'))),
          h('div', { class: 'load-txt' }, 'Wczytywanie świata… 0%')),
        h('div', { class: 'start-actions' })),
      h('div', { class: 'start-rules' },
        h('div', { class: 'rule' }, h('b', {}, 'Cel'), 'Rozwiń bohatera do 100 poziomu, przejdź 6 Przebudzeń aż do 150 i zostań legendą rankingu.'),
        h('div', { class: 'rule' }, h('b', {}, 'Przygody'), 'Wybierz 1 z 3 zleceń (1–10 min) → odbierz łupy, nawet offline.'),
        h('div', { class: 'rule' }, h('b', {}, 'Walka'), 'Pojedynki toczą się same — Ty decydujesz o ekwipunku, statystykach i talentach.'),
        h('div', { class: 'rule' }, h('b', {}, 'Sterowanie'), 'Klik / dotyk. 5 zakładek na dole ekranu.')),
    );
    this.root.append(this.startEl);
  }
  updateLoad(n, total, ready = false) {
    const segs = this.startEl.querySelectorAll('.load-segs i');
    const k = Math.floor((n / total) * segs.length);
    segs.forEach((s, i) => s.classList.toggle('on', i < k));
    this.startEl.querySelector('.load-txt').textContent = ready ? 'Gotowe!' : `Wczytywanie świata… ${Math.round((n / total) * 100)}%`;
    if (ready) {
      this.startEl.querySelector('.load').classList.add('ready');
      this.afterLoad();
    }
  }
  async afterLoad() {
    const acts = this.startEl.querySelector('.start-actions');
    acts.replaceChildren(h('div', { class: 'acc-note' }, 'Sprawdzanie konta…'));
    try { await Acc.restore(); } catch (e) {
      console.error('Przywracanie sesji konta nieudane', e);
      this.toast('Nie udało się sprawdzić konta: ' + e.message, 'bad');
    }
    Acc.startSync();
    this.renderStartActions();
    const flash = sessionStorage.getItem('fho_flash');
    if (flash) { sessionStorage.removeItem('fho_flash'); this.toast(flash, 'good'); }
  }
  // ——— Konto gracza na ekranie startowym ———
  renderStartActions() {
    const acts = this.startEl.querySelector('.start-actions');
    this.startEl.classList.remove('auth-open');
    const u = Acc.Acc.user;
    if (u) {
      const has = G.hasSave();
      acts.replaceChildren(
        h('div', { class: 'acc-pill', id: 'acc-pill' }, uiIcon('key', 'acc-ico'),
          h('div', {}, h('small', {}, u.mode === 'cloud' ? 'Konto online' : 'Konto w tej przeglądarce'), h('b', {}, u.login))),
        has ? btn('Graj', () => this.enter(), 'primary big', { id: 'btn-play' })
          : btn('Stwórz bohatera', () => this.startCreator(), 'primary big', { id: 'btn-play' }),
        h('div', { class: 'acc-row' },
          has ? btn('Nowa postać', () => this.newCharacter(), 'ghost small') : null,
          btn('Wyloguj', () => this.doLogout(), 'ghost small', { id: 'btn-logout' })));
      return;
    }
    const guest = Acc.guestInfo();
    acts.replaceChildren(
      btn('Zaloguj się', () => this.openAuth('login'), 'primary big', { id: 'btn-login' }),
      btn('Załóż konto', () => this.openAuth('register'), '', { id: 'btn-register' }),
      h('div', { class: 'acc-note' }, Acc.cloudAvailable()
        ? 'Konto online: bohater zapisuje się na serwerze i jest dostępny na każdym urządzeniu.'
        : 'Serwer gry nie jest jeszcze podłączony – konto i bohater zapisują się w tej przeglądarce.'),
      guest ? h('div', { class: 'acc-note gold' }, `Znaleziono bohatera bez konta: ${guest.name} (poz. ${guest.lvl}). Załóż konto lub zaloguj się, aby go przypisać.`) : null);
  }
  openAuth(tab = 'login', mode = Acc.cloudAvailable() ? 'cloud' : 'local') {
    sfx('click');
    const acts = this.startEl.querySelector('.start-actions');
    this.startEl.classList.add('auth-open');
    const reg = tab === 'register';
    const cloud = mode === 'cloud';
    const guest = Acc.guestInfo();
    const label = reg ? 'Załóż konto' : 'Zaloguj się';
    const idInp = h('input', {
      class: 'inp', id: 'auth-login', name: cloud ? 'email' : 'username', type: cloud ? 'email' : 'text', maxlength: cloud ? 120 : 20,
      autocomplete: cloud ? 'email' : 'username', placeholder: cloud ? 'np. zbyszko@poczta.pl' : 'np. zbyszko', required: true,
    });
    const pw = h('input', { class: 'inp', id: 'auth-pass', type: 'password', autocomplete: reg ? 'new-password' : 'current-password', placeholder: `min. ${Acc.MIN_PASSWORD} znaków`, required: true });
    const pw2 = reg ? h('input', { class: 'inp', id: 'auth-pass2', type: 'password', autocomplete: 'new-password', placeholder: 'powtórz hasło', required: true }) : null;
    const attach = guest ? h('input', { type: 'checkbox', id: 'auth-attach', checked: true }) : null;
    const err = h('div', { class: 'auth-err', id: 'auth-err', role: 'alert' });
    const submit = btn(label, null, 'primary big', { id: 'auth-go', type: 'submit' });
    const go = async () => {
      err.textContent = '';
      submit.disabled = true;
      submit.textContent = reg ? 'Tworzenie konta…' : 'Logowanie…';
      try {
        const data = { login: idInp.value, password: pw.value, mode, attach: attach ? attach.checked : false };
        if (reg) {
          const r = await Acc.register({ ...data, password2: pw2.value });
          if (r.needConfirm) { this.authConfirm(r.email); return; }
          this.toast('Konto utworzone – witaj w świecie gry!', 'good');
        } else {
          await Acc.login(data);
          this.toast(`Zalogowano jako ${Acc.Acc.user.login}.`, 'good');
        }
        sfx('coin');
        this.renderStartActions();
      } catch (e) {
        err.textContent = e.message;
        submit.disabled = false;
        submit.textContent = label;
        sfx('miss');
      }
    };
    const tabBtn = (t, txt) => h('button', { type: 'button', class: 'chip' + (t === tab ? ' sel' : ''), id: 'auth-tab-' + t, onclick: () => this.openAuth(t, mode) }, txt);
    const modeBtn = (m, txt) => h('button', { type: 'button', class: 'chip small' + (m === mode ? ' sel' : ''), onclick: () => this.openAuth(tab, m) }, txt);
    acts.replaceChildren(h('form', { class: 'auth', id: 'auth-form', novalidate: true, onsubmit: (e) => { e.preventDefault(); go(); } },
      h('div', { class: 'auth-tabs' }, tabBtn('login', 'Logowanie'), tabBtn('register', 'Rejestracja')),
      Acc.cloudAvailable() ? h('div', { class: 'auth-mode' }, modeBtn('cloud', 'Konto online (e-mail)'), modeBtn('local', 'Konto lokalne (offline)')) : null,
      h('label', { class: 'lbl', for: 'auth-login' }, cloud ? 'Adres e-mail' : 'Login'), idInp,
      h('label', { class: 'lbl', for: 'auth-pass' }, 'Hasło'), pw,
      reg ? [h('label', { class: 'lbl', for: 'auth-pass2' }, 'Powtórz hasło'), pw2] : null,
      attach ? h('label', { class: 'toggle auth-attach' }, attach, ` Przypisz bohatera ${guest.name} (poz. ${guest.lvl}) do tego konta`) : null,
      err,
      submit,
      h('div', { class: 'auth-foot' },
        h('span', { class: 'muted' }, cloud ? 'Hasło przechowuje bezpiecznie serwer gry.' : 'Konto lokalne działa tylko w tej przeglądarce.'),
        btn('Wróć', () => { sfx('click'); this.renderStartActions(); }, 'ghost small', { type: 'button' }))));
    setTimeout(() => idInp.focus(), 50);
  }
  authConfirm(email) {
    const acts = this.startEl.querySelector('.start-actions');
    acts.replaceChildren(h('div', { class: 'auth' },
      h('b', { class: 'auth-title' }, 'Potwierdź adres e-mail'),
      h('p', {}, `Wysłaliśmy link aktywacyjny na adres ${email}. Kliknij go w wiadomości, a następnie zaloguj się tutaj.`),
      btn('Przejdź do logowania', () => this.openAuth('login', 'cloud'), 'primary', { type: 'button' })));
  }
  async newCharacter() {
    if (!confirm('Usunąć obecną postać i zacząć od nowa? Tego nie można cofnąć.')) return;
    try { await Acc.wipeCharacter(); } catch (e) { this.toast('Nie udało się usunąć postaci: ' + e.message, 'bad'); return; }
    this.startCreator();
  }
  async doLogout() {
    try { await Acc.logout(); } catch (e) { this.toast('Wylogowanie nieudane: ' + e.message, 'bad'); return; }
    sessionStorage.setItem('fho_flash', 'Wylogowano. Do zobaczenia!');
    location.reload();
  }
  clearShowcase() { for (const a of this.showActors || []) this.stage.removeActor(a); this.showActors = []; }

  // ——— Kreator postaci ———
  async startCreator() {
    sfx('click'); playMusic('hub');
    this.startEl.classList.add('leave');
    setTimeout(() => this.startEl.remove(), 300);
    this.clearShowcase();
    this.stage.setDim(0.12, 0.4);
    this.cr = { name: '', cls: 'warrior', look: 0, hue: 0, aura: 0 };
    this.creatorEl = h('div', { class: 'creator' });
    this.root.append(this.creatorEl);
    this.renderCreator();
    await this.creatorPreview();
  }
  async creatorPreview() {
    const c = this.cr;
    const path = `heroes/${CLASSES[c.cls].looks[c.look]}.webp`;
    if (this.prevActor && this.prevActor.path === path) {
      this.prevActor.setLook({ hue: OUTFIT_HUES[c.hue].hue });
      this.stage.setAura(this.prevActor, AURA_COLORS[c.aura].c, 2);
      return;
    }
    const old = this.prevActor;
    const a = await this.stage.addActor(path, 540);
    a.path = path;
    a.setPos(this.creatorX(), GROUND_Y);
    a.setLook({ hue: OUTFIT_HUES[c.hue].hue });
    this.stage.setAura(a, AURA_COLORS[c.aura].c, 2);
    a.offY = 120; this.stage.tween(a, 'offY', 0, 0.35);
    if (old) this.stage.removeActor(old);
    this.prevActor = a;
    this.stage.particles.burst(a.center().x, GROUND_Y + 40, 30, 0xffe08a, 400, { grav: 300 });
  }
  creatorX() { return this.stage.width < 1100 ? 0 : -this.stage.width * 0.2; }
  renderCreator() {
    const c = this.cr;
    const C = CLASSES[c.cls];
    const el = this.creatorEl;
    el.replaceChildren(
      h('div', { class: 'cr-panel' },
        h('h2', {}, 'Stwórz bohatera'),
        h('label', { class: 'lbl' }, 'Imię'),
        h('input', { class: 'inp', id: 'cr-name', maxlength: 18, placeholder: 'np. Zbyszko Groźny', value: c.name, oninput: (e) => { c.name = e.target.value; } }),
        h('label', { class: 'lbl' }, 'Klasa'),
        h('div', { class: 'cr-classes' }, CLASS_ORDER.map((id) => h('button', {
          class: 'cr-class' + (id === c.cls ? ' sel' : ''), onclick: () => { c.cls = id; sfx('click'); this.renderCreator(); this.creatorPreview(); },
        }, h('img', { src: `./assets/heroes/${CLASSES[id].looks[0]}.webp`, alt: '' }), h('span', {}, CLASSES[id].name)))),
        h('div', { class: 'cr-desc' }, h('b', {}, C.name), ' — ', C.desc,
          h('ul', { class: 'cr-skills' }, SKILLS[c.cls].map((s) => h('li', {}, h('b', {}, s.name), ` (poz. ${s.lvl}): ${s.desc}`)))),
        h('label', { class: 'lbl' }, 'Wygląd'),
        h('div', { class: 'row gap' }, [0, 1].map((i) => h('button', { class: 'chip' + (c.look === i ? ' sel' : ''), onclick: () => { c.look = i; this.renderCreator(); this.creatorPreview(); } }, i === 0 ? 'Wariant I' : 'Wariant II'))),
        h('label', { class: 'lbl' }, 'Kolor stroju'),
        h('div', { class: 'swatches' }, OUTFIT_HUES.map((o, i) => h('button', { class: 'sw' + (c.hue === i ? ' sel' : ''), title: o.name, style: { background: outfitSwatch(c.cls, c.look, i) }, onclick: () => { c.hue = i; this.renderCreator(); this.creatorPreview(); } }))),
        h('label', { class: 'lbl' }, 'Kolor aury (widoczna od 10 poziomu)'),
        h('div', { class: 'swatches' }, AURA_COLORS.map((o, i) => h('button', { class: 'sw' + (c.aura === i ? ' sel' : ''), title: o.name, style: { background: o.c }, onclick: () => { c.aura = i; this.renderCreator(); this.creatorPreview(); } }))),
        btn('Rozpocznij przygodę', () => this.finishCreator(), 'primary big', { id: 'cr-go' }),
      ));
  }
  finishCreator() {
    const name = (this.cr.name || '').trim();
    if (name.length < 3) { this.toast('Imię musi mieć co najmniej 3 znaki.', 'bad'); $('#cr-name')?.focus(); return; }
    G.newPlayer({ ...this.cr, name });
    this.creatorEl.remove();
    if (this.prevActor) { this.stage.removeActor(this.prevActor); this.prevActor = null; }
    this.enter(true);
  }

  // ——— Gra ———
  async enter(fresh = false) {
    sfx('click');
    if (!G.P && !G.load()) { this.startCreator(); return; }
    audioState.music = G.P.settings.music; audioState.sound = G.P.settings.sound;
    playMusic('hub');
    if (this.startEl) { this.startEl.classList.add('leave'); setTimeout(() => this.startEl?.remove(), 300); }
    this.clearShowcase();
    this.buildGame();
    await this.toHub();
    this.render();
    setInterval(() => this.second(), 1000);
    // tryb online: automatyczne połączenie, jeśli skonfigurowano serwer
    G.Net.onNet((t) => { if (t === 'status' || t === 'refresh') this.scheduleRender(); });
    const cfg = G.Net.getConfig();
    const acc = Acc.Acc.user;
    // konto lokalne gra offline (wspólny świat wymaga konta online)
    if (cfg && acc && acc.mode === 'local') this.toast('Konto lokalne – grasz offline. Arena, gildie i czat wymagają konta online (e-mail).', 'info');
    else if (cfg) G.connectOnline(cfg).then(() => this.toast('Połączono ze wspólnym światem gry!', 'good')).catch((e) => this.toast('Nie udało się połączyć z serwerem – grasz offline (arena, gildie i czat niedostępne). (' + e.message + ')', 'bad'));
    // powitanie: samouczek dla nowych graczy, w przeciwnym razie offline idle + logowanie
    setTimeout(() => {
      if (this.tutorial.active) { this.tutorial.start(); return; }
      if (!G.P.login.claimed) Panels.openDaily(this);
      else { const p = G.idlePending(); if (p.ms > 30 * 60000) Panels.openIdle(this); }
      if (G.P.seasonRewards.length) Panels.openSeasonReward(this);
    }, 600);
  }
  buildGame() {
    const top = h('div', { class: 'topbar' });
    const quick = h('div', { class: 'quick' });
    const panel = h('div', { class: 'panel' }, h('div', { class: 'panel-head' }), h('div', { class: 'panel-body' }));
    const nav = h('div', { class: 'nav' }, TABS.map((t) => h('button', { class: 'nav-btn', 'data-tab': t.id, onclick: () => this.openTab(t.id) }, icon(t.icon, 'nav-ico'), h('span', {}, t.name), h('i', { class: 'badge' }))));
    this.hubBubble = h('div', { class: 'bubble' });
    this.game = h('div', { class: 'game' }, top, quick, panel, nav, this.hubBubble);
    this.root.append(this.game);
    this.top = top; this.quick = quick; this.panel = panel; this.nav = nav;
    initItemDrag(this, panel);
    this.canvas.addEventListener('click', (e) => this.heroClick(e));
    document.body.classList.add('panel-open');
  }
  async toHub() {
    this.stage.setDim(0, 0);
    await this.stage.setBg('hub');
    await this.refreshHero();
  }
  refreshHero() {
    this._heroP = (this._heroP || Promise.resolve()).then(() => this._refreshHero()).catch((e) => console.error(e));
    return this._heroP;
  }
  async _refreshHero() {
    if (!G.P || this.inBattle) return;
    const tier = G.appearanceTier();
    const look = heroLook(G.P, tier);
    const key = look.path;
    if (!this.hero || this.hero.path !== key) {
      const old = this.hero;
      const a = await this.stage.addActor(look.path, 560);
      a.path = key;
      if (old) this.stage.removeActor(old);
      this.hero = a;
    }
    this.hero.setLook(look);
    this.stage.setAura(this.hero, look.aura, tier);
    this.placeHero();
  }
  placeHero() {
    if (this.prevActor) this.prevActor.setPos(this.creatorX(), GROUND_Y);
    if (!this.hero || this.inBattle) return;
    const wide = this.stage.width >= 1250 && window.innerWidth > 820;
    this.hero.setPos(wide && this.panelOpen ? -this.stage.width * 0.2 : 0, GROUND_Y);
  }
  heroClick(e) {
    if (!this.hero || this.inBattle) return;
    const a = this.hero;
    a.uniforms.uSquash.value = -0.05;
    this.stage.tween(a, 'offY', 70, 0.18, undefined, () => this.stage.tween(a, 'offY', 0, 0.25));
    const c = a.center();
    this.stage.particles.burst(c.x, c.y + 120, 18, 0xffe08a, 300, { grav: 200 });
    const p = this.stage.toScreen(c.clone().setY(c.y + a.h * 0.55));
    this.hubBubble.textContent = R.pick(HERO_LINES);
    Object.assign(this.hubBubble.style, { left: p.x + 'px', top: p.y + 'px' });
    this.hubBubble.classList.remove('show'); void this.hubBubble.offsetWidth; this.hubBubble.classList.add('show');
    sfx('click', 0.4);
  }
  openTab(id) {
    sfx('click', 0.4);
    if (this.tab === id && this.panelOpen) { this.panelOpen = false; }
    else { this.tab = id; this.panelOpen = true; }
    document.body.classList.toggle('panel-open', this.panelOpen);
    this.render();
    setTimeout(() => this.placeHero(), 30);
  }
  setSub(tab, sub) { this.sub[tab] = sub; this.render(); }
  scheduleRender() {
    if (this._rq) return;
    this._rq = requestAnimationFrame(() => { this._rq = null; this.render(); });
  }
  render() {
    if (!this.game || !G.P) return;
    this.renderTop();
    this.renderQuick();
    this.nav.querySelectorAll('.nav-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === this.tab && this.panelOpen);
      b.querySelector('.badge').textContent = this.badge(b.dataset.tab) || '';
    });
    this.panel.classList.toggle('closed', !this.panelOpen);
    if (this.panelOpen) {
      const body = this.panel.querySelector('.panel-body');
      const scroll = body.scrollTop;
      const t = renderTab(this, this.tab);
      this.panel.querySelector('.panel-head').replaceChildren(t.head);
      // na wąskich ekranach podzakładki przewijają się poziomo – pokaż wybraną
      const sel = t.head.querySelector('.st.sel');
      if (sel && sel.parentElement.scrollWidth > sel.parentElement.clientWidth) sel.parentElement.scrollLeft = Math.max(0, sel.offsetLeft - sel.parentElement.offsetLeft - 40);
      body.replaceChildren(t.body);
      this.live = t.live;
      body.scrollTop = scroll;
    }
  }
  badge(tab) {
    const P = G.P;
    if (tab === 'adventures') return G.questDone() ? '!' : '';
    if (tab === 'character') return P.pts > 0 || G.talentPointsUsed() < G.talentPointsTotal() || (G.trialUnlocked() && G.trialAttemptsLeft() > 0) ? '!' : '';
    if (tab === 'dungeons') return P.dungeon.keys > 0 && P.dungeon.progress.some((p, d) => G.dungeonUnlocked(d) && p < 10) ? P.dungeon.keys : '';
    if (tab === 'arena') return G.Net.isOnline() ? P.arena.tickets || '' : '';
    if (tab === 'guild') return P.guild.id === null ? (G.Net.isOnline() ? '!' : '') : (P.guild.gb && P.guild.gb.attacks < G.GB_ATTACKS ? '!' : '');
    return '';
  }
  renderTop() {
    const P = G.P;
    const need = G.expNext(P.lvl);
    const maxed = P.lvl >= G.MAX_LVL;
    const capped = G.expBlocked();
    const expTxt = maxed ? 'MAKS' : capped && P.exp >= need ? 'Wymagane Przebudzenie!' : `${fmt(P.exp)} / ${fmt(need)} EXP${capped ? ' · próg' : ''}`;
    const energyTimer = P.energy < G.ENERGY_MAX ? fmtTime(6 * 60000 - (Date.now() - P.energyT)) : 'pełna';
    this.top.replaceChildren(
      h('div', { class: 'tb-hero' + (capped ? ' capped' : ''), title: capped ? 'Próg Przebudzenia – pokonaj bossa Próby (Postać → Przebudzenie)' : '', onclick: () => { if (capped) this.sub.character = 'awaken'; this.openTab('character'); } },
        h('div', { class: 'tb-lvl' }, P.lvl),
        h('div', { class: 'tb-info' }, h('div', { class: 'tb-name' }, P.name, h('span', { class: 'tb-cls' }, CLASSES[P.cls].name), P.awak ? h('span', { class: 'tb-awk' }, `✦${P.awak}`) : null),
          h('div', { class: 'tb-exp' }, bar(maxed ? 1 : P.exp / need, capped ? 'exp capped' : 'exp'), h('span', {}, expTxt)))),
      h('div', { class: 'tb-res' },
        h('div', { class: 'res', title: 'Siła postaci' }, uiIcon('swords', 'ico'), h('b', {}, fmt(G.power()))),
        h('div', { class: 'res', title: 'Złoto' }, uiIcon('gold', 'ico'), h('b', {}, fmt(P.gold))),
        h('div', { class: 'res', title: 'Kryształy (darmowa waluta premium – zdobywana w grze)', onclick: () => Panels.openShop(this, 'crystal') }, uiIcon('crystal', 'ico'), h('b', {}, fmt(P.crystals))),
        h('div', { class: 'res', title: `Energia przygód (odnowa: ${energyTimer})` }, uiIcon('energy', 'ico'), h('b', {}, `${P.energy}/${G.ENERGY_MAX}`)),
        h('button', { class: 'res set net', title: G.Net.isOnline() ? 'Tryb online – wspólny świat' : 'Offline – podłącz serwer w ustawieniach', onclick: () => Panels.openSettings(this) }, G.Net.isOnline() ? h('span', { class: 'online-dot' }) : '○', ' ', G.Net.isOnline() ? 'Online' : 'Offline'),
        h('button', { class: 'res set', title: 'Ustawienia', onclick: () => Panels.openSettings(this) }, '⚙')),
    );
  }
  renderQuick() {
    const P = G.P;
    const idle = G.idlePending();
    const dailyReady = P.daily.missions.filter((m) => m.prog >= m.goal && !m.claimed).length + (!P.login.claimed ? 1 : 0) + (G.allMissionsDone() && !P.daily.chest ? 1 : 0);
    const ev = G.currentEvent();
    const evReady = G.EVENT_TIERS.filter((t, i) => P.event.points >= t && !P.event.claimed.includes(i)).length;
    const q = (ic, label, fn, badge, extra) => h('button', { class: 'qbtn', onclick: () => { sfx('click', 0.4); fn(); } }, uiIcon(ic, 'qico'), h('span', { class: 'qlbl' }, label), badge ? h('i', { class: 'badge on' }, badge) : null, extra || null);
    this.quick.replaceChildren(
      q('hourglass', 'Idle', () => Panels.openIdle(this), idle.gold > 0 ? '•' : '', h('span', { class: 'qsub', id: 'q-idle' }, `${fmt(idle.gold)} zł`)),
      q('scroll', 'Dzienne', () => Panels.openDaily(this), dailyReady || ''),
      q('chest', 'Sklep', () => Panels.openShop(this)),
      q('star', ev.name, () => Panels.openEvent(this), evReady || ''),
      q('trophy', 'Rankingi', () => Panels.openRankings(this)),
      q('guild', 'Czat', () => Panels.openChat(this), ''),
    );
  }
  second() {
    if (!G.P) return;
    G.tick();
    G.netTick();
    if (this.inBattle) return;
    this.renderTop();
    const qi = $('#q-idle'); if (qi) qi.textContent = `${fmt(G.idlePending().gold)} zł`;
    if (this.live) this.live();
    this.nav.querySelectorAll('.nav-btn').forEach((b) => { b.querySelector('.badge').textContent = this.badge(b.dataset.tab) || ''; });
    if (Date.now() % 15000 < 1000) G.save();
  }

  // ——— Walka ———
  async fight(specOrFn) {
    if (this.inBattle) return;
    this.inBattle = true;
    this.lvlQueue = [];
    const spec = typeof specOrFn === 'function' ? specOrFn() : specOrFn;
    if (!spec) { this.inBattle = false; this.flushLevels(); this.render(); return; }
    document.body.classList.add('in-battle');
    this.closeModals();
    if (this.hero) { this.stage.removeActor(this.hero); this.hero = null; }
    try {
      await this.battle.play(spec);
    } catch (e) {
      console.error(e);
      this.toast('Błąd odtwarzania walki: ' + e.message, 'bad');
      this.battle.cleanup();
    }
    this.inBattle = false;
    document.body.classList.remove('in-battle');
    playMusic('hub');
    await this.toHub();
    this.render();
    this.flushLevels();
  }
  flushLevels() {
    const q = this.lvlQueue || [];
    this.lvlQueue = [];
    q.forEach(([l, sk], i) => setTimeout(() => this.levelUp(l, sk), i * 900));
  }

  // ——— Modale ———
  modal(title, content, opts = {}) {
    const close = () => { wrap.remove(); if (opts.onClose) opts.onClose(); };
    const wrap = h('div', { class: 'modal-wrap', onclick: (e) => { if (e.target === wrap) close(); } },
      h('div', { class: 'modal ' + (opts.cls || '') },
        h('div', { class: 'modal-head' }, h('h3', {}, title), h('button', { class: 'x', onclick: close }, '✕')),
        h('div', { class: 'modal-body' }, content)));
    this.root.append(wrap);
    return { close, el: wrap };
  }
  closeModals() { this.root.querySelectorAll('.modal-wrap').forEach((m) => m.remove()); this.chatEl = null; }
  showItem(it, ctx = {}) {
    const P = G.P;
    const equipped = P.equip[it.slot]?.uid === it.uid;
    const inBag = P.bag.some((x) => x.uid === it.uid);
    const cur = P.equip[it.slot];
    const delta = equipped ? null : G.compare(it);
    const actions = h('div', { class: 'row gap wrap' });
    let m;
    const act = (label, fn, cls) => actions.append(btn(label, () => { fn(); m.close(); }, cls));
    if (ctx.shop) act(`Kup (${fmt(buyPrice(it))} zł)`, () => G.shopBuy(it.uid), 'primary');
    if (inBag) act('Załóż', () => { G.equip(it.uid); sfx('click'); }, 'primary');
    if (equipped) act('Zdejmij', () => G.unequip(it.slot));
    if ((inBag || equipped) && it.up < MAX_UP) actions.append(btn(`Ulepsz +${it.up + 1} (${fmt(upgradeCost(it))} zł)`, () => { G.upgrade(it.uid); m.close(); this.showItem(G.findItem(it.uid) || it); }, 'gold'));
    if (inBag) act(`Sprzedaj (${fmt(sellPrice(it))} zł)`, () => G.sell(it.uid), 'ghost');
    const cmp = !equipped && cur ? h('div', { class: 'cmp' }, h('div', { class: 'cmp-lbl' }, 'Obecnie założone:'), itemDetails(cur)) : null;
    m = this.modal(SLOT_NAMES[it.slot], h('div', { class: 'item-modal' }, h('div', { class: 'cmp-grid' }, itemDetails(it, delta), cmp), actions), { cls: 'narrow' });
  }
  toast(msg, kind = 'info') {
    const t = h('div', { class: 'toast ' + kind }, msg);
    this.toasts.append(t);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3700);
  }
  levelUp(l, sk) {
    if (this.inBattle) { this.lvlQueue.push([l, sk]); return; }
    sfx('levelup', 0.8);
    const el = h('div', { class: 'levelup' }, h('div', { class: 'lu-stamp' }, 'Poziom ', h('b', {}, l), '!'),
      sk ? h('div', { class: 'lu-skill' }, 'Nowa umiejętność: ', h('b', {}, sk.name)) : null,
      [10, 25, 50, 80].includes(l) ? h('div', { class: 'lu-skill' }, 'Twój wygląd ewoluował!') : null,
      G.trialUnlocked() && l === G.levelCap(G.P) ? h('div', { class: 'lu-skill awk' }, '✦ Próba Przebudzenia odblokowana! (Postać → Przebudzenie)') : null);
    this.root.append(el);
    setTimeout(() => el.remove(), 2600);
    if (this.hero) { const c = this.hero.center(); this.stage.particles.burst(c.x, c.y, 60, [0xffe08a, 0xffffff], 600, { grav: 100, life: 1 }); this.stage.fxPillar(c.x, GROUND_Y, 0xffe08a, 300, 1000, 1); }
    this.refreshHero();
  }
}
