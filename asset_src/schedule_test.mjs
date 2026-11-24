// Testy planowania eventów (1.8.1): walidacja terminów, statusy, zapowiedzi, formatowanie oraz operacje panelu na atrapie serwera
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
const S = await import('../src/core/schedule.js');
const G = await import('../src/core/game.js');
const Net = await import('../src/net/online.js');
let fails = 0;
const assert = (c, m) => { if (c) console.log('ok  ', m); else { console.error('FAIL:', m); fails++; process.exitCode = 1; } };
const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const T0 = new Date(2026, 10, 25, 12, 0, 0, 0).getTime(); // środa 25.11.2026, 12:00 (czas lokalny)
const iso = (ms) => new Date(ms).toISOString();
const ev = (id, kind, s, e) => ({ id, kind, starts_at: iso(s), ends_at: iso(e) });

// ——— 1) statusy i podział listy ———
{
  const list = [ev(1, 'xp2', T0 - HOUR, T0 + HOUR), ev(2, 'gold2', T0 + DAY, T0 + DAY + 4 * HOUR), ev(3, 'wheel', T0 - 3 * DAY, T0 - 2 * DAY), ev(4, 'nieznany', T0, T0 + HOUR)];
  const { active, upcoming, ended } = S.splitLive(list, T0);
  assert(active.length === 1 && active[0].id === 1, 'trwający event rozpoznany');
  assert(upcoming.length === 1 && upcoming[0].id === 2, 'zaplanowany event rozpoznany');
  assert(ended.length === 1 && ended[0].id === 3, 'zakończony event rozpoznany');
  assert(![...active, ...upcoming, ...ended].some((e) => e.id === 4), 'nieznany rodzaj eventu pomijany');
  assert(S.liveStatus(list[1], T0 + DAY) === 'active' && S.liveStatus(list[1], T0 + DAY + 4 * HOUR) === 'ended', 'zaplanowany event sam przechodzi w „trwa”, potem w „zakończony”');
  const far = [ev(5, 'xp2', T0 + 20 * DAY, T0 + 21 * DAY), ev(6, 'xp2', T0 + 2 * DAY, T0 + 3 * DAY), ev(7, 'wheel', T0 + 5 * HOUR, T0 + 9 * HOUR)];
  const soon = S.upcomingLive(far, T0);
  assert(soon.length === 2 && soon[0].id === 7 && soon[1].id === 6, 'zapowiedzi: najbliższe 14 dni, posortowane od najwcześniejszego');
  assert(S.nextStartOf(far, 'wheel', T0) === T0 + 5 * HOUR && S.nextStartOf(far, 'gold2', T0) === null, 'najbliższy start danego rodzaju');
}

// ——— 2) walidacja terminu ———
{
  const V = (o, list = [], opt) => S.validateSchedule(o, list, T0, opt);
  assert(V({ kind: 'xp2', start: T0 + HOUR, end: T0 + 5 * HOUR }) === null, 'poprawny termin w przyszłości');
  assert(V({ kind: 'xp2', start: T0 - 2 * MIN, end: T0 + HOUR }) === null, 'start „teraz” (kilka minut tolerancji) dozwolony');
  assert(/Wybierz/.test(V({ kind: 'abc', start: T0 + HOUR, end: T0 + 2 * HOUR })), 'nieznany rodzaj odrzucony');
  assert(/Podaj/.test(V({ kind: 'xp2', start: NaN, end: T0 + HOUR })), 'brak daty odrzucony');
  assert(/później/.test(V({ kind: 'xp2', start: T0 + 2 * HOUR, end: T0 + HOUR })), 'koniec przed startem odrzucony');
  assert(/15 minut/.test(V({ kind: 'xp2', start: T0 + HOUR, end: T0 + HOUR + 10 * MIN })), 'za krótki event odrzucony');
  assert(/7 dni/.test(V({ kind: 'xp2', start: T0 + HOUR, end: T0 + HOUR + 8 * DAY })), 'event dłuższy niż 7 dni odrzucony');
  assert(/przeszłości/.test(V({ kind: 'xp2', start: T0 - HOUR, end: T0 + HOUR })), 'start w przeszłości odrzucony');
  assert(V({ kind: 'xp2', start: T0 - HOUR, end: T0 + 2 * HOUR }, [], { keepStart: true }) === null, 'trwający event: można przesunąć koniec mimo minionego startu');
  assert(/minął/.test(V({ kind: 'xp2', start: T0 - 2 * HOUR, end: T0 - HOUR }, [], { keepStart: true })), 'koniec w przeszłości odrzucony');
  assert(/90 dni/.test(V({ kind: 'xp2', start: T0 + 91 * DAY, end: T0 + 92 * DAY })), 'planowanie dalej niż 90 dni odrzucone');
  const list = [ev(10, 'xp2', T0 + DAY, T0 + DAY + 4 * HOUR), ev(11, 'xp2', T0 - 3 * DAY, T0 - 2 * DAY)];
  assert(/nakładać/.test(V({ kind: 'xp2', start: T0 + DAY + HOUR, end: T0 + DAY + 6 * HOUR }, list)), 'nakładające się eventy tego samego rodzaju odrzucone');
  assert(V({ kind: 'gold2', start: T0 + DAY + HOUR, end: T0 + DAY + 6 * HOUR }, list) === null, 'różne rodzaje mogą trwać jednocześnie');
  assert(V({ kind: 'xp2', start: T0 + DAY + 4 * HOUR, end: T0 + DAY + 8 * HOUR }, list) === null, 'event zaraz po poprzednim (styk) dozwolony');
  assert(V({ kind: 'xp2', start: T0 + DAY + HOUR, end: T0 + DAY + 6 * HOUR }, list, { ignoreId: 10 }) === null, 'edycja nie koliduje sama ze sobą');
  assert(V({ kind: 'xp2', start: T0 + HOUR, end: T0 + 3 * HOUR }, [ev(12, 'xp2', T0 - 3 * DAY, T0 - 2 * DAY)]) === null, 'zakończony event tego samego rodzaju nie blokuje terminu');
}

// ——— 3) formatowanie i pola formularza ———
{
  const sat18 = new Date(2026, 10, 28, 18, 0).getTime();
  assert(S.fmtWhen(sat18) === 'sob. 28.11, 18:00', `data po polsku (${S.fmtWhen(sat18)})`);
  assert(S.fmtRange(sat18, sat18 + 4 * HOUR) === 'sob. 28.11, 18:00–22:00', `zakres w jednym dniu (${S.fmtRange(sat18, sat18 + 4 * HOUR)})`);
  assert(S.fmtRange(sat18, sat18 + DAY) === 'sob. 28.11, 18:00 – niedz. 29.11, 18:00' || /– .*29\.11, 18:00$/.test(S.fmtRange(sat18, sat18 + DAY)), `zakres wielodniowy (${S.fmtRange(sat18, sat18 + DAY)})`);
  assert(S.fmtIn(2 * DAY + 3 * HOUR) === '2 dni 3 godz.' && S.fmtIn(DAY) === '1 dzień' && S.fmtIn(3 * HOUR + 20 * MIN) === '3 godz. 20 min' && S.fmtIn(30 * 1000) === '1 min', 'odliczanie „za …”');
  assert(S.fmtIn(HOUR - 30 * 1000) === '1 godz.' && S.fmtIn(DAY - 20 * 1000) === '1 dzień' && S.fmtIn(2 * HOUR + 59.5 * MIN) === '3 godz.', `zaokrąglenie w górę bez „0 min” (${S.fmtIn(HOUR - 30 * 1000)})`);
  assert(S.fmtDuration(4 * HOUR) === '4 godz.' && S.fmtDuration(DAY + 30 * MIN) === '1 d 30 min', 'czas trwania');
  const v = S.toLocalInput(sat18);
  assert(v === '2026-11-28T18:00' && S.fromLocalInput(v) === sat18, 'pole datetime-local: zapis i odczyt w czasie lokalnym');
  assert(Number.isNaN(S.fromLocalInput('2026-02-31T10:00')) && Number.isNaN(S.fromLocalInput('')), 'niepoprawna data w polu odrzucona');
  assert(new Date(S.fromLocalInput('0026-11-29T23:00')).getFullYear() === 26, 'rok 0026 nie jest zamieniany na 1926');
  assert(new Date(2028, 1, 29, 12).getTime() === S.fromLocalInput('2028-02-29T12:00'), 'dzień przestępny akceptowany');
  assert(/UTC[+-]\d/.test(S.timeZoneLabel()), `opis strefy czasowej (${S.timeZoneLabel()})`);
}

// ——— 4) szybkie terminy ———
{
  const r1 = S.presetRange('now1', T0 + 30 * 1000);
  assert(r1.start === T0 && r1.end === T0 + HOUR, '„Teraz · 1 godz.”');
  const ev1 = S.presetRange('evening', T0);
  assert(ev1.start === new Date(2026, 10, 25, 18).getTime() && ev1.end - ev1.start === 4 * HOUR, '„Wieczór” dziś 18–22');
  const ev2 = S.presetRange('evening', new Date(2026, 10, 25, 19).getTime());
  assert(ev2.start === new Date(2026, 10, 26, 18).getTime(), '„Wieczór” po 18:00 → jutro');
  const wk = S.presetRange('weekend', T0);
  assert(wk.start === new Date(2026, 10, 28, 0).getTime() && wk.end === new Date(2026, 10, 30, 0).getTime(), '„Najbliższy weekend” sob 00:00 – pn 00:00');
  const wkSat = S.presetRange('weekend', new Date(2026, 10, 28, 15, 30).getTime());
  assert(wkSat.start === new Date(2026, 10, 28, 15, 30).getTime() && wkSat.end === new Date(2026, 10, 30, 0).getTime(), 'w trakcie weekendu – od teraz do poniedziałku');
  for (const id of ['now1', 'now24', 'evening', 'weekend']) {
    const r = S.presetRange(id, T0);
    assert(S.validateSchedule({ kind: 'gold2', start: r.start, end: r.end }, [], T0) === null, `szybki termin „${id}” przechodzi walidację`);
  }
}

// ——— 5) koło fortuny: zaplanowane „Szczęśliwe Koło” skraca odliczanie ———
{
  const N = Net.Net;
  N.live = [];
  const base = G.wheelOpensIn(T0);
  assert(base === new Date(2026, 10, 28, 0).getTime() - T0, 'bez eventu koło wraca w sobotę');
  N.live = [ev(20, 'wheel', T0 + 5 * HOUR, T0 + 9 * HOUR)];
  assert(G.wheelOpensIn(T0) === 5 * HOUR, 'zaplanowane „Szczęśliwe Koło” przed weekendem → odliczanie do eventu');
  assert(!G.wheelActive(T0) && G.wheelActive(T0 + 6 * HOUR), 'koło włącza się samo o godzinie startu eventu');
  N.live = [];
}

// ——— 6) operacje panelu administratora na atrapie serwera ———
function fakeServer() {
  const tables = { live_events: [], announcements: [] };
  let seq = 100;
  const calls = [];
  const query = (name) => {
    const st = { name, op: 'select', filters: [], order: null, limit: null, row: null };
    const run = () => {
      calls.push({ table: name, op: st.op });
      const rows = tables[name];
      const match = (r) => st.filters.every(([op, c, v]) => (op === 'eq' ? r[c] === v : op === 'gt' ? r[c] > v : r[c] <= v));
      if (st.op === 'insert') { const r = { id: ++seq, created_at: new Date().toISOString(), ...st.row }; rows.push(r); return { data: null, error: null }; }
      if (st.op === 'update') { rows.filter(match).forEach((r) => Object.assign(r, st.row)); return { data: null, error: null }; }
      if (st.op === 'delete') { tables[name] = rows.filter((r) => !match(r)); return { data: null, error: null }; }
      let out = rows.filter(match).map((r) => ({ ...r }));
      if (st.order) out.sort((a, b) => (a[st.order.c] < b[st.order.c] ? -1 : a[st.order.c] > b[st.order.c] ? 1 : 0) * (st.order.asc ? 1 : -1));
      if (st.limit) out = out.slice(0, st.limit);
      return { data: out, error: null };
    };
    const b = {
      select() { st.op = st.op === 'select' ? 'select' : st.op; return b; },
      insert(row) { st.op = 'insert'; st.row = row; return b; },
      update(row) { st.op = 'update'; st.row = row; return b; },
      delete() { st.op = 'delete'; return b; },
      eq(c, v) { st.filters.push(['eq', c, v]); return b; },
      gt(c, v) { st.filters.push(['gt', c, v]); return b; },
      lte(c, v) { st.filters.push(['lte', c, v]); return b; },
      order(c, o = {}) { st.order = { c, asc: o.ascending !== false }; return b; },
      limit(n) { st.limit = n; return b; },
      then(res, rej) { try { res(run()); } catch (e) { rej(e); } },
    };
    return b;
  };
  return { tables, calls, client: { from: query } };
}
{
  const sb = fakeServer();
  Net.Net.client = sb.client;
  const A = Net.Admin;
  const now = Date.now();
  const h0 = Math.floor(now / HOUR) * HOUR;
  const s1 = h0 + 26 * HOUR, e1 = s1 + 4 * HOUR;
  await A.scheduleEvent('xp2', s1, e1);
  const r1 = sb.tables.live_events[0];
  assert(sb.tables.live_events.length === 1 && r1.kind === 'xp2' && new Date(r1.starts_at).getTime() === s1 && new Date(r1.ends_at).getTime() === e1, 'zaplanowanie eventu zapisuje datę startu i końca');
  assert(Net.Net.live.some((e) => e.id === r1.id), 'po zaplanowaniu zapowiedź od razu trafia do danych publicznych');
  let err = '';
  try { await A.scheduleEvent('xp2', s1 + HOUR, e1 + HOUR); } catch (e) { err = e.message; }
  assert(/nakładać/.test(err) && sb.tables.live_events.length === 1, 'serwerowa operacja odrzuca nakładający się termin');
  try { err = ''; await A.scheduleEvent('xp2', now - DAY, now - DAY + HOUR); } catch (e) { err = e.message; }
  assert(/przeszłości/.test(err), 'nie da się zaplanować eventu w przeszłości');
  await A.updateEvent(r1.id, { kind: 'gold2', start: s1 + 2 * HOUR, end: e1 + 2 * HOUR });
  assert(r1.kind === 'gold2' && new Date(r1.starts_at).getTime() === s1 + 2 * HOUR && new Date(r1.ends_at).getTime() === e1 + 2 * HOUR, 'edycja zaplanowanego eventu: rodzaj, start i koniec');
  // trwający event: zmiana tylko końca
  await A.startEvent('wheel', 2);
  const r2 = sb.tables.live_events.find((e) => e.kind === 'wheel');
  assert(r2 && S.liveStatus(r2) === 'active', '„Uruchom teraz” tworzy trwający event');
  const origStart = r2.starts_at;
  await A.updateEvent(r2.id, { kind: 'xp2', start: now + DAY, end: now + 5 * HOUR });
  assert(r2.kind === 'wheel' && r2.starts_at === origStart && Math.abs(new Date(r2.ends_at).getTime() - (now + 5 * HOUR)) < 1000, 'edycja trwającego eventu zmienia tylko godzinę końca');
  // anulowanie
  await A.cancelEvent(r1.id);
  assert(!sb.tables.live_events.some((e) => e.id === r1.id) && sb.calls.some((c) => c.op === 'delete'), 'anulowanie zaplanowanego eventu usuwa go');
  await A.cancelEvent(r2.id);
  const r2b = sb.tables.live_events.find((e) => e.id === r2.id);
  assert(r2b && new Date(r2b.ends_at).getTime() <= Date.now() && S.liveStatus(r2b) === 'ended', 'anulowanie trwającego eventu kończy go teraz (zostaje w historii)');
  const list = await A.events();
  assert(list.some((e) => e.id === r2.id) && !list.some((e) => e.id === r1.id), 'lista panelu: historia zawiera zakończony event');
  try { err = ''; await A.updateEvent(r2.id, { kind: 'wheel', start: now, end: now + HOUR }); } catch (e) { err = e.message; }
  assert(/zakończył/.test(err), 'zakończonego eventu nie da się edytować');
  try { err = ''; await A.cancelEvent(99999); } catch (e) { err = e.message; }
  assert(/Nie znaleziono/.test(err), 'anulowanie nieistniejącego eventu zgłasza błąd');
  Net.Net.client = null;
}

console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystkie testy planowania eventów OK');
