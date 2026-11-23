// Panel administratora – widoczny tylko dla konta administratora; każdą operację i tak weryfikuje serwer (is_admin()).
import { h, btn, clsBadge, uiIcon, fill } from './dom.js';
import * as G from '../core/game.js';
import { LIVE_EVENTS, LIVE_DURATIONS } from '../data/live.js';
import { fmt, fmtTime } from '../core/util.js';
import { openProfile } from './profile.js';

const A = () => G.Net.Admin;
const when = (iso) => new Date(iso).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function openAdmin(app) {
  let tab = 'events';
  const body = h('div', { class: 'admin' });
  const content = h('div', { class: 'admin-body' });
  const tabs = () => h('div', { class: 'subtabs' }, [['events', 'Eventy'], ['news', 'Ogłoszenia'], ['reports', 'Zgłoszenia'], ['players', 'Gracze'], ['stats', 'Statystyki']]
    .map(([id, n]) => h('button', { class: 'st' + (tab === id ? ' sel' : ''), 'data-admin-tab': id, onclick: () => { tab = id; draw(); } }, n)));
  const fail = (e) => { console.error('Panel administratora', e); fill(content, h('div', { class: 'arena-empty' }, h('b', {}, 'Błąd panelu administratora'), h('div', { class: 'muted' }, e.message))); };
  const run = (fn, okMsg) => async () => { try { await fn(); if (okMsg) app.toast(okMsg, 'good'); draw(); } catch (e) { app.toast(e.message, 'bad'); } };

  async function draw() {
    body.replaceChildren(tabs(), content);
    fill(content, h('div', { class: 'muted center' }, 'Wczytywanie…'));
    if (!G.Net.isOnline()) { fill(content, h('div', { class: 'arena-empty' }, h('b', {}, 'Panel działa w trybie online'), h('div', { class: 'muted' }, 'Połącz się z serwerem (konto online).'))); return; }
    try {
      if (tab === 'events') await drawEvents();
      else if (tab === 'news') await drawNews();
      else if (tab === 'reports') await drawReports();
      else if (tab === 'players') await drawPlayers();
      else await drawStats();
    } catch (e) { fail(e); }
  }

  async function drawEvents() {
    const list = await A().events();
    const now = Date.now();
    const active = list.filter((e) => new Date(e.starts_at).getTime() <= now && now < new Date(e.ends_at).getTime());
    fill(content, 
      h('div', { class: 'tip' }, 'Event zaczyna się od razu i działa u wszystkich graczy online (odświeżenie do 1 minuty). Można go zatrzymać w dowolnej chwili.'),
      h('div', { class: 'admin-events' }, Object.entries(LIVE_EVENTS).map(([kind, ev]) => {
        const on = active.find((e) => e.kind === kind);
        const sel = h('select', { class: 'inp small', 'data-ev': kind }, LIVE_DURATIONS.map((hh) => h('option', { value: hh, selected: hh === 24 || undefined }, `${hh} h`)));
        return h('div', { class: 'admin-ev' + (on ? ' on' : ''), style: { borderColor: ev.color } },
          h('div', { class: 'admin-ev-h', style: { background: ev.color } }, uiIcon(ev.icon, 'ico'), h('b', {}, ev.name), h('span', {}, ev.short)),
          h('div', { class: 'muted' }, ev.desc),
          on ? h('div', {}, h('b', {}, '● Trwa'), ` – kończy się za ${fmtTime(new Date(on.ends_at).getTime() - now)}`) : h('div', { class: 'muted' }, 'Nieaktywny'),
          h('div', { class: 'row gap wrap' },
            on ? btn('Zatrzymaj', run(() => A().stopEvent(on.id), `Zatrzymano: ${ev.name}`), 'ghost small')
              : [sel, btn('Uruchom', run(() => A().startEvent(kind, Number(sel.value)), `Uruchomiono: ${ev.name}`), 'primary small', { 'data-start': kind })]));
      })),
      h('div', { class: 'sec-head' }, h('h4', {}, 'Historia')),
      h('div', { class: 'lb small' }, list.length ? list.slice(0, 12).map((e) => h('div', { class: 'lb-row' },
        h('span', { class: 'lb-name' }, LIVE_EVENTS[e.kind]?.name || e.kind), h('span', { class: 'muted' }, `${when(e.starts_at)} → ${when(e.ends_at)}`))) : h('div', { class: 'muted center' }, 'Brak eventów.')));
  }

  async function drawNews() {
    const list = await A().news();
    const title = h('input', { class: 'inp', maxlength: 80, placeholder: 'Tytuł (3–80 znaków)', id: 'news-title' });
    const text = h('textarea', { class: 'inp', rows: 3, maxlength: 1000, placeholder: 'Treść ogłoszenia', id: 'news-body' });
    fill(content, 
      h('div', { class: 'admin-form' }, title, text, btn('Opublikuj ogłoszenie', run(async () => {
        if (title.value.trim().length < 3 || !text.value.trim()) throw new Error('Podaj tytuł (min. 3 znaki) i treść.');
        await A().postNews(title.value, text.value);
      }, 'Ogłoszenie opublikowane'), 'primary small', { id: 'news-post' })),
      h('div', { class: 'lb' }, list.length ? list.map((n) => h('div', { class: 'lb-row' + (n.active ? '' : ' off') },
        h('span', { class: 'lb-name' }, h('b', {}, n.title), h('small', { class: 'muted' }, ' ' + when(n.created_at))),
        btn(n.active ? 'Ukryj' : 'Pokaż', run(() => A().setNewsActive(n.id, !n.active)), 'ghost small'))) : h('div', { class: 'muted center' }, 'Brak ogłoszeń.')));
  }

  async function drawReports() {
    const [list, bans] = await Promise.all([A().reports('open'), A().bans()]);
    const banBtns = (userId, name) => [1, 24, 24 * 7].map((hh) => btn(`Blokada ${hh === 1 ? '1 h' : hh === 24 ? '24 h' : '7 dni'}`, run(() => A().ban(userId, hh, 'Naruszenie zasad czatu'), `Zablokowano czat: ${name}`), 'ghost small'));
    fill(content, 
      h('div', { class: 'sec-head' }, h('h4', {}, `Otwarte zgłoszenia (${list.length})`)),
      list.length ? h('div', { class: 'admin-reports' }, list.map((r) => h('div', { class: 'admin-rep' },
        h('div', {}, h('b', {}, r.author_name || '?'), ': ', h('span', { class: 'rep-body' }, r.body || '(usunięta)')),
        r.reason ? h('div', { class: 'muted' }, 'Powód: ', r.reason) : null,
        h('div', { class: 'muted' }, when(r.created_at)),
        h('div', { class: 'row gap wrap' },
          r.message_id ? btn('Usuń wiadomość', run(async () => { await A().deleteMessage(r.message_id); await A().closeReport(r.id, 'done'); }, 'Wiadomość usunięta'), 'primary small') : null,
          r.author ? banBtns(r.author, r.author_name) : null,
          btn('Odrzuć', run(() => A().closeReport(r.id, 'dismissed')), 'ghost small'))))) : h('div', { class: 'muted center' }, 'Brak otwartych zgłoszeń. 👍'),
      h('div', { class: 'sec-head' }, h('h4', {}, `Aktywne blokady czatu (${bans.length})`)),
      h('div', { class: 'lb small' }, bans.length ? bans.map((b) => h('div', { class: 'lb-row' },
        h('span', { class: 'lb-name' }, nameOf(b.user_id)), h('span', { class: 'muted' }, `do ${when(b.until)}`),
        btn('Zdejmij', run(() => A().unban(b.user_id), 'Blokada zdjęta'), 'ghost small'))) : h('div', { class: 'muted center' }, 'Brak.')));
  }
  const nameOf = (id) => G.Net.Net.players.find((p) => p.id === id)?.name || id.slice(0, 8);

  async function drawPlayers(q = '') {
    const inp = h('input', { class: 'inp', placeholder: 'Szukaj gracza po nazwie…', value: q, onkeydown: (e) => { if (e.key === 'Enter') drawPlayers(inp.value).catch(fail); } });
    const [list, flagged] = await Promise.all([A().searchPlayers(q), A().flagged()]);
    const guards = Object.fromEntries((await A().guards(list.map((p) => p.id))).map((g) => [g.user_id, g]));
    fill(content, 
      h('div', { class: 'row gap' }, inp, btn('Szukaj', () => drawPlayers(inp.value).catch(fail), 'small')),
      flagged.length ? h('div', { class: 'admin-flagged' }, h('b', {}, '⚠ Odrzucone zapisy (ochrona przed oszustwami)'),
        flagged.map((g) => h('div', { class: 'lb-row' + (g.flagged ? ' flag' : '') }, h('span', { class: 'lb-name' }, nameOf(g.user_id)),
          h('span', { class: 'muted' }, `${g.strikes}× · ${g.last_reject || ''}`), btn('Wyczyść', run(() => A().clearGuard(g.user_id), 'Wyczyszczono flagi'), 'ghost small')))) : null,
      h('div', { class: 'lb' }, list.map((p) => {
        const g = guards[p.id];
        return h('div', { class: 'lb-row' + (g && g.flagged ? ' flag' : '') }, clsBadge(p.cls),
          h('span', { class: 'lb-name' }, p.name, h('small', { class: 'muted' }, ` poz. ${p.lvl} · siła ${fmt(p.power)} · Otchłań ${p.abyss || 0} · ${when(p.updated_at)}`), g && g.strikes ? h('small', { class: 'flag-tag' }, ` ⚠${g.strikes}`) : null),
          btn('Profil', () => openProfile(app, p.id), 'ghost small'),
          btn('Blokada 24 h', run(() => A().ban(p.id, 24, 'Decyzja administratora'), `Zablokowano czat: ${p.name}`), 'ghost small'));
      })));
  }

  async function drawStats() {
    const s = await A().stats();
    const card = (label, v) => h('div', { class: 'stile' }, h('span', {}, label), h('b', {}, fmt(Number(v) || 0)));
    fill(content, 
      h('div', { class: 'stiles' }, card('Konta', s.users), card('Postacie', s.players), card('Aktywni 24 h', s.active24h), card('Aktywni 7 dni', s.active7d),
        card('Wiadomości 24 h', s.messages24h), card('Otwarte zgłoszenia', s.openReports), card('Flagi ochrony', s.flagged), card('Blokady czatu', s.bans),
        card('Najwyższy poziom', s.maxLvl), card('Rekord Otchłani', s.maxAbyss)),
      h('div', { class: 'tip' }, 'Dane z serwera w chwili otwarcia zakładki.'));
  }

  draw();
  return app.modal('🛡 Panel administratora', body, { cls: 'wide' });
}
