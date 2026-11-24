// Panel administratora – widoczny tylko dla konta administratora; każdą operację i tak weryfikuje serwer (is_admin()).
import { h, btn, clsBadge, uiIcon, fill, vipTag } from './dom.js';
import * as G from '../core/game.js';
import { LIVE_EVENTS } from '../data/live.js';
import { VIP_DAY_PRESETS, vipBonusFor } from '../data/vip.js';
import { fmt } from '../core/util.js';
import { splitLive, liveStatus, evStart, evEnd, validateSchedule, presetRange, toLocalInput, fromLocalInput, fmtRange, fmtWhen, fmtIn, fmtDuration, timeZoneLabel, ANNOUNCE_DAYS } from '../core/schedule.js';
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

  // ——— Eventy: planowanie (data i godzina od–do), lista trwających i zaplanowanych, edycja, anulowanie ———
  let editing = null; // id edytowanego eventu
  async function drawEvents() {
    const list = await A().events();
    const t = Date.now();
    const { active, upcoming, ended } = splitLive(list, t);
    const cur = editing != null ? list.find((e) => e.id === editing && liveStatus(e, t) !== 'ended') : null;
    if (!cur) editing = null;
    fill(content,
      h('div', { class: 'sec-head' }, h('h4', {}, cur ? `Edycja: ${LIVE_EVENTS[cur.kind].name}` : 'Zaplanuj event')),
      scheduleForm(list, cur),
      h('div', { class: 'sec-head' }, h('h4', {}, `Trwające (${active.length})`)),
      active.length ? h('div', { class: 'ev-list' }, active.map((e) => evRow(e, 'active', t))) : h('div', { class: 'muted' }, 'Teraz nie trwa żaden event.'),
      h('div', { class: 'sec-head' }, h('h4', {}, `Zaplanowane (${upcoming.length})`)),
      upcoming.length ? h('div', { class: 'ev-list' }, upcoming.map((e) => evRow(e, 'upcoming', t))) : h('div', { class: 'muted' }, 'Brak zaplanowanych eventów.'),
      h('div', { class: 'sec-head' }, h('h4', {}, 'Historia')),
      h('div', { class: 'lb small' }, ended.length ? ended.slice(0, 10).map((e) => h('div', { class: 'lb-row' },
        h('span', { class: 'lb-name' }, LIVE_EVENTS[e.kind].name), h('span', { class: 'muted' }, fmtRange(evStart(e), evEnd(e))))) : h('div', { class: 'muted center' }, 'Brak zakończonych eventów.')),
      h('div', { class: 'tip' }, `🕑 Godziny w czasie Twojego urządzenia (${timeZoneLabel()}). Event włącza się i wyłącza sam o ustalonej godzinie u wszystkich graczy – nie trzeba mieć otwartego panelu. Zaplanowane eventy widać na ekranie startowym jako zapowiedź (do ${ANNOUNCE_DAYS} dni wcześniej).`));
  }
  function scheduleForm(list, cur) {
    const activeEdit = !!cur && liveStatus(cur) === 'active';
    let kind = cur ? cur.kind : 'xp2';
    const def = presetRange('evening');
    const startInp = h('input', { type: 'datetime-local', class: 'inp', id: 'ev-start', value: toLocalInput(cur ? evStart(cur) : def.start), disabled: activeEdit || undefined, oninput: () => update(), onchange: () => update() });
    const endInp = h('input', { type: 'datetime-local', class: 'inp', id: 'ev-end', value: toLocalInput(cur ? evEnd(cur) : def.end), oninput: () => update(), onchange: () => update() });
    const kinds = h('div', { class: 'ev-kinds' }, Object.entries(LIVE_EVENTS).map(([k, ev]) => h('button', {
      type: 'button', class: 'ev-kind' + (k === kind ? ' sel' : ''), 'data-kind': k, style: { '--ec': ev.color }, disabled: activeEdit || undefined, title: ev.desc,
      onclick: () => { kind = k; kinds.querySelectorAll('.ev-kind').forEach((b) => b.classList.toggle('sel', b.dataset.kind === k)); update(); },
    }, uiIcon(ev.icon, 'ico'), h('span', {}, h('b', {}, ev.name), h('small', {}, ev.short)))));
    const presets = activeEdit ? null : h('div', { class: 'ev-presets' }, h('span', { class: 'muted' }, 'Szybko:'),
      [['now1', 'Teraz · 1 godz.'], ['now24', 'Teraz · 24 godz.'], ['evening', 'Wieczór 18:00–22:00'], ['weekend', 'Najbliższy weekend']].map(([id, label]) => h('button', {
        type: 'button', class: 'chip small', 'data-preset': id,
        onclick: () => { const r = presetRange(id); startInp.value = toLocalInput(r.start); endInp.value = toLocalInput(r.end); update(); },
      }, label)));
    const info = h('div', { class: 'ev-info', id: 'ev-info', role: 'status' });
    const vals = () => ({ kind, start: activeEdit ? evStart(cur) : fromLocalInput(startInp.value), end: fromLocalInput(endInp.value) });
    const submit = btn(cur ? 'Zapisz zmiany' : 'Zaplanuj event', async () => {
      const v = vals();
      submit.disabled = true;
      try {
        if (cur) await A().updateEvent(cur.id, v); else await A().scheduleEvent(v.kind, v.start, v.end);
        app.toast(cur ? 'Zapisano nowy termin eventu.' : v.start <= Date.now() ? `Uruchomiono: ${LIVE_EVENTS[v.kind].name}` : `Zaplanowano: ${LIVE_EVENTS[v.kind].name} – ${fmtWhen(v.start)}`, 'good');
        editing = null;
        draw();
      } catch (e) { app.toast(e.message, 'bad'); update(); }
    }, 'primary', { id: 'ev-submit', type: 'button' });
    function update() {
      const v = vals();
      const t = Date.now();
      // uwaga: nie zmieniamy tu atrybutu min pól – Chrome gubi wtedy wpisywaną z klawiatury część daty
      const err = validateSchedule(v, list, t, { ignoreId: cur ? cur.id : null, keepStart: activeEdit });
      if (err) { info.className = 'ev-info bad'; info.textContent = err; submit.disabled = true; return; }
      const now = v.start <= t;
      info.className = 'ev-info ok';
      info.textContent = `${LIVE_EVENTS[v.kind].name}: ${fmtRange(v.start, v.end)} · czas trwania ${fmtDuration(v.end - v.start)} · ${activeEdit ? 'trwa – zmieniasz godzinę końca' : now ? 'wystartuje od razu' : 'start za ' + fmtIn(v.start - t)}`;
      submit.disabled = false;
      submit.textContent = cur ? 'Zapisz zmiany' : now ? 'Uruchom teraz' : 'Zaplanuj event';
    }
    const nowMin = toLocalInput(Date.now());
    if (!activeEdit) startInp.min = nowMin;
    endInp.min = nowMin;
    update();
    return h('div', { class: 'ev-form' + (cur ? ' editing' : ''), id: 'ev-form' },
      kinds,
      h('div', { class: 'ev-dates' },
        h('label', { class: 'lbl', for: 'ev-start' }, 'Start (data i godzina)'), startInp,
        h('label', { class: 'lbl', for: 'ev-end' }, 'Koniec (data i godzina)'), endInp),
      presets, info,
      h('div', { class: 'row gap wrap' }, submit, cur ? btn('Anuluj edycję', () => { editing = null; draw(); }, 'ghost small', { type: 'button', id: 'ev-edit-cancel' }) : null));
  }
  function evRow(e, st, t) {
    const ev = LIVE_EVENTS[e.kind];
    const s = evStart(e), en = evEnd(e);
    let armed = null;
    const label = st === 'active' ? 'Zatrzymaj' : 'Anuluj';
    const cancel = btn(label, async () => {
      if (!armed) { // dwuetapowe potwierdzenie bez okna przeglądarki
        cancel.textContent = st === 'active' ? 'Na pewno zatrzymać?' : 'Na pewno anulować?';
        cancel.classList.add('primary');
        armed = setTimeout(() => { armed = null; cancel.textContent = label; cancel.classList.remove('primary'); }, 4000);
        return;
      }
      clearTimeout(armed); armed = null;
      cancel.disabled = true;
      try {
        await A().cancelEvent(e.id);
        if (editing === e.id) editing = null;
        app.toast(st === 'active' ? `Zatrzymano: ${ev.name}` : `Anulowano: ${ev.name} (${fmtWhen(s)})`, 'good');
        draw();
      } catch (err) { app.toast(err.message, 'bad'); cancel.disabled = false; cancel.textContent = label; cancel.classList.remove('primary'); }
    }, 'ghost small', { 'data-cancel': e.id, type: 'button' });
    return h('div', { class: 'ev-row ' + st + (editing === e.id ? ' editing' : ''), 'data-ev-id': e.id, style: { '--ec': ev.color } },
      h('div', { class: 'ev-row-ico' }, uiIcon(ev.icon, 'ico')),
      h('div', { class: 'ev-row-in' },
        h('b', {}, ev.name), h('div', {}, fmtRange(s, en)),
        h('div', { class: 'ev-when' }, st === 'active' ? `● Trwa – jeszcze ${fmtIn(en - t)}` : `Start za ${fmtIn(s - t)} · ${fmtDuration(en - s)}`)),
      h('div', { class: 'ev-row-act' },
        btn('Edytuj', () => { editing = e.id; draw(); content.scrollIntoView({ block: 'start' }); }, 'ghost small', { 'data-edit': e.id, type: 'button' }),
        cancel));
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

  // przycisk z dwuetapowym potwierdzeniem (bez okna przeglądarki)
  function confirmBtn(label, confirmText, action, okMsg, attrs = {}) {
    let armed = null;
    const reset = () => { armed = null; b.textContent = label; b.classList.remove('primary'); };
    const b = btn(label, async () => {
      if (!armed) { b.textContent = confirmText; b.classList.add('primary'); armed = setTimeout(reset, 4000); return; }
      clearTimeout(armed); armed = null; b.disabled = true;
      try { await action(); app.toast(okMsg, 'good'); draw(); } catch (e) { app.toast(e.message, 'bad'); b.disabled = false; reset(); }
    }, 'ghost small', { type: 'button', ...attrs });
    return b;
  }

  let lastQuery = '';
  let vipOpen = null; // id gracza z otwartym formularzem VIP
  async function drawPlayers(q = lastQuery) {
    lastQuery = q;
    const inp = h('input', { class: 'inp', placeholder: 'Szukaj gracza po nazwie…', value: q, onkeydown: (e) => { if (e.key === 'Enter') drawPlayers(inp.value).catch(fail); } });
    const [list, flagged, vips] = await Promise.all([A().searchPlayers(q), A().flagged(), A().vipList()]);
    const guards = Object.fromEntries((await A().guards(list.map((p) => p.id))).map((g) => [g.user_id, g]));
    fill(content,
      h('div', { class: 'row gap' }, inp, btn('Szukaj', () => drawPlayers(inp.value).catch(fail), 'small')),
      vipSection(vips),
      flagged.length ? h('div', { class: 'admin-flagged' }, h('b', {}, '⚠ Odrzucone zapisy (ochrona przed oszustwami)'),
        flagged.map((g) => h('div', { class: 'lb-row' + (g.flagged ? ' flag' : '') }, h('span', { class: 'lb-name' }, nameOf(g.user_id)),
          h('span', { class: 'muted' }, `${g.strikes}× · ${g.last_reject || ''}`), btn('Wyczyść', run(() => A().clearGuard(g.user_id), 'Wyczyszczono flagi'), 'ghost small')))) : null,
      h('div', { class: 'sec-head' }, h('h4', {}, q ? `Gracze: „${q}” (${list.length})` : `Ostatnio aktywni gracze (${list.length})`)),
      h('div', { class: 'lb' }, list.flatMap((p) => {
        const g = guards[p.id];
        const vu = G.Net.vipUntil(p.id);
        const open = vipOpen === p.id;
        return [h('div', { class: 'lb-row' + (g && g.flagged ? ' flag' : '') + (open ? ' vip-open' : ''), 'data-player': p.id }, clsBadge(p.cls),
          h('span', { class: 'lb-name' }, p.name, vipTag(vu > 0), h('small', { class: 'muted' }, ` poz. ${p.lvl} · siła ${fmt(p.power)} · Otchłań ${p.abyss || 0} · ${when(p.updated_at)}${vu ? ` · VIP do ${fmtWhen(vu)}` : ''}`), g && g.strikes ? h('small', { class: 'flag-tag' }, ` ⚠${g.strikes}`) : null),
          btn(open ? 'Zamknij VIP' : '👑 VIP', () => { vipOpen = open ? null : p.id; drawPlayers().catch(fail); }, (open ? '' : 'ghost ') + 'small', { 'data-vip-open': p.id, type: 'button', disabled: vips === null || undefined, title: vips === null ? 'Najpierw uruchom migrację VIP na serwerze' : 'Nadaj, przedłuż lub odbierz VIP' }),
          btn('Profil', () => openProfile(app, p.id), 'ghost small'),
          btn('Blokada 24 h', run(() => A().ban(p.id, 24, 'Decyzja administratora'), `Zablokowano czat: ${p.name}`), 'ghost small')),
        open && vips !== null ? vipForm(p, vu) : null];
      })));
  }
  // lista aktywnych VIP-ów (albo informacja o brakującej migracji na serwerze)
  function vipSection(vips) {
    if (vips === null) {
      return h('div', { class: 'admin-flagged vip-missing', id: 'vip-missing' }, h('b', {}, '👑 VIP – na serwerze brakuje tabel VIP'),
        h('div', {}, `Otwórz Supabase › SQL Editor i jednorazowo uruchom zawartość pliku ${G.Net.VIP_MIGRATION_FILE}. Do tego czasu nadawanie VIP-a jest wyłączone, a gra działa bez zmian.`));
    }
    const t = Date.now();
    return h('div', { class: 'vip-admin', id: 'vip-admin' },
      h('div', { class: 'sec-head' }, h('h4', {}, `👑 Aktywni VIP (${vips.length})`), h('span', { class: 'muted' }, 'Nadajesz VIP-a przyciskiem 👑 VIP przy graczu poniżej.')),
      vips.length ? h('div', { class: 'lb small' }, vips.map((v) => h('div', { class: 'lb-row', 'data-vip-row': v.id }, clsBadge(v.cls),
        h('span', { class: 'lb-name' }, v.name, vipTag(true), h('small', { class: 'muted' }, ` do ${fmtWhen(v.until)} · zostało ${fmtIn(v.until - t)}`)),
        btn('+30 dni', run(() => A().grantVip(v.id, 30, 'Przedłużenie z panelu'), `VIP przedłużony: ${v.name} (+30 dni)`), 'ghost small', { 'data-vip-plus': v.id, type: 'button' }),
        confirmBtn('Odbierz', 'Na pewno odebrać?', () => A().revokeVip(v.id, 'Odebrano z panelu'), `Odebrano VIP: ${v.name}`, { 'data-vip-revoke': v.id }))))
        : h('div', { class: 'muted' }, 'Nikt nie ma teraz VIP-a.'));
  }
  // formularz VIP pod wierszem gracza: dni (1–366), powód, podgląd nowego końca i paczki, nadanie/przedłużenie, odebranie, historia
  function vipForm(p, vu) {
    const DAY = 86400000;
    const daysInp = h('input', { type: 'number', class: 'inp small', id: 'vip-days', min: 1, max: 366, step: 1, value: 30, oninput: () => upd() });
    const reason = h('input', { class: 'inp', id: 'vip-reason', maxlength: 120, placeholder: 'Powód (np. Konkurs Discord 12.12) – widoczny tylko w dzienniku' });
    const info = h('div', { class: 'ev-info', id: 'vip-info', role: 'status' });
    const hist = h('div', { class: 'vip-hist muted' }, 'Wczytywanie historii…');
    const submit = btn(vu ? 'Przedłuż VIP' : 'Nadaj VIP', async () => {
      submit.disabled = true;
      try {
        const until = await A().grantVip(p.id, Number(daysInp.value), reason.value);
        app.toast(`${vu ? 'Przedłużono' : 'Nadano'} VIP: ${p.name} – do ${fmtWhen(until)}`, 'good');
        vipOpen = null;
        draw();
      } catch (e) { app.toast(e.message, 'bad'); upd(); }
    }, 'primary small', { id: 'vip-submit', type: 'button' });
    function upd() {
      const d = Number(daysInp.value);
      const t = Date.now();
      const nu = Math.max(t, vu || 0) + Math.floor(d) * DAY;
      let err = null;
      if (!Number.isInteger(d) || d < 1 || d > 366) err = 'Podaj liczbę dni od 1 do 366.';
      else if (nu > t + 730 * DAY) err = 'VIP może sięgać najwyżej 2 lata naprzód.';
      info.className = 'ev-info ' + (err ? 'bad' : 'ok');
      info.textContent = err || `${vu ? 'Przedłużenie' : 'Nadanie'}: ${d} dni → VIP do ${fmtWhen(nu)} · paczka dla gracza: ${vipBonusFor(d)} 💎`;
      submit.disabled = !!err;
    }
    upd();
    A().vipHistory(p.id).then((rows) => {
      fill(hist, rows.length ? [h('b', {}, 'Historia VIP'), rows.slice(0, 5).map((r) => h('div', {},
        r.action === 'grant' ? `+${r.days} dni (${r.bonus} 💎)` : 'odebrano', ` · ${when(r.created_at)}`, r.reason ? ` · ${r.reason}` : ''))] : 'Brak wcześniejszych nadań.');
    }).catch((e) => { console.error('Historia VIP', e); fill(hist, `Nie udało się wczytać historii: ${e.message}`); });
    return h('div', { class: 'vip-form', 'data-vip-form': p.id },
      h('div', { class: 'vip-form-h' }, h('b', {}, `👑 VIP dla gracza ${p.name}`), h('span', { class: vu ? 'vip-on' : 'muted' }, vu ? `aktywny do ${fmtWhen(vu)} (zostało ${fmtIn(vu - Date.now())})` : 'brak aktywnego VIP-a')),
      h('div', { class: 'vip-days' }, h('span', { class: 'muted' }, 'Dni:'),
        VIP_DAY_PRESETS.map((d) => h('button', { type: 'button', class: 'chip small', 'data-vip-days': d, onclick: () => { daysInp.value = d; upd(); } }, `${d} dni`)), daysInp),
      reason, info,
      h('div', { class: 'row gap wrap' }, submit, vu ? confirmBtn('Odbierz VIP', 'Na pewno odebrać?', () => A().revokeVip(p.id, reason.value), `Odebrano VIP: ${p.name}`, { id: 'vip-revoke' }) : null),
      hist);
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
