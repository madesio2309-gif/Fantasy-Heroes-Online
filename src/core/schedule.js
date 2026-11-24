// Planowanie eventów administratora: walidacja terminów, statusy, zapowiedzi i formatowanie dat (czas lokalny urządzenia).
import { LIVE_EVENTS } from '../data/live.js';

export const MIN_EVENT_MIN = 15; // najkrótszy event (minuty)
export const MAX_EVENT_H = 7 * 24; // najdłuższy event – zgodnie z ograniczeniem tabeli live_events na serwerze
export const MAX_AHEAD_DAYS = 90; // jak daleko w przód można planować
export const ANNOUNCE_DAYS = 14; // zapowiedzi na ekranie startowym
const MIN = 60000, HOUR = 3600000, DAY = 86400000;

export const evStart = (e) => new Date(e.starts_at).getTime();
export const evEnd = (e) => new Date(e.ends_at).getTime();
export function liveStatus(e, t = Date.now()) {
  if (t < evStart(e)) return 'upcoming';
  if (t < evEnd(e)) return 'active';
  return 'ended';
}
// eventy trwające / zaplanowane / zakończone (posortowane do wyświetlenia)
export function splitLive(list, t = Date.now()) {
  const known = (list || []).filter((e) => LIVE_EVENTS[e.kind]);
  const by = (s) => known.filter((e) => liveStatus(e, t) === s);
  return {
    active: by('active').sort((a, b) => evEnd(a) - evEnd(b)),
    upcoming: by('upcoming').sort((a, b) => evStart(a) - evStart(b)),
    ended: by('ended').sort((a, b) => evEnd(b) - evEnd(a)),
  };
}
// zapowiedzi dla graczy: eventy, które zaczną się w ciągu najbliższych dni
export function upcomingLive(list, t = Date.now(), days = ANNOUNCE_DAYS) {
  return splitLive(list, t).upcoming.filter((e) => evStart(e) - t <= days * DAY);
}
// najbliższy początek eventu danego rodzaju (ms) albo null
export function nextStartOf(list, kind, t = Date.now()) {
  const e = splitLive(list, t).upcoming.find((x) => x.kind === kind);
  return e ? evStart(e) : null;
}

// Sprawdza termin. start/end w ms. existing – lista eventów z serwera; ignoreId – edytowany event.
// keepStart – edycja trwającego eventu: start już minął i nie jest zmieniany.
// Zwraca komunikat błędu (po polsku) albo null.
export function validateSchedule({ kind, start, end }, existing = [], t = Date.now(), { ignoreId = null, keepStart = false } = {}) {
  if (!LIVE_EVENTS[kind]) return 'Wybierz rodzaj eventu.';
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Podaj datę i godzinę startu oraz końca.';
  if (end <= start) return 'Koniec musi być później niż start.';
  if (end - start < MIN_EVENT_MIN * MIN) return `Event musi trwać co najmniej ${MIN_EVENT_MIN} minut.`;
  if (end - start > MAX_EVENT_H * HOUR) return 'Event może trwać najwyżej 7 dni.';
  if (!keepStart && start < t - 5 * MIN) return 'Start nie może być w przeszłości (aby włączyć event od razu, ustaw start na teraz).';
  if (end <= t) return 'Koniec eventu już minął.';
  if (start > t + MAX_AHEAD_DAYS * DAY) return `Event można zaplanować najwyżej ${MAX_AHEAD_DAYS} dni naprzód.`;
  const clash = (existing || []).find((e) => e.kind === kind && e.id !== ignoreId && evEnd(e) > t && evStart(e) < end && start < evEnd(e));
  if (clash) return `W tym czasie ${liveStatus(clash, t) === 'active' ? 'trwa już' : 'jest już zaplanowany'} „${LIVE_EVENTS[kind].name}” (${fmtRange(evStart(clash), evEnd(clash))}). Eventy tego samego rodzaju nie mogą się nakładać.`;
  return null;
}

// ——— Formatowanie (pl-PL, strefa urządzenia) ———
const pad = (n) => String(n).padStart(2, '0');
export function fmtWhen(ms) {
  const d = new Date(ms);
  const wd = d.toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', '');
  return `${wd}. ${pad(d.getDate())}.${pad(d.getMonth() + 1)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fmtRange(a, b) {
  const da = new Date(a), db = new Date(b);
  const sameDay = da.toDateString() === db.toDateString();
  return sameDay ? `${fmtWhen(a)}–${pad(db.getHours())}:${pad(db.getMinutes())}` : `${fmtWhen(a)} – ${fmtWhen(b)}`;
}
// „za 2 dni 3 godz.”, „za 3 godz. 20 min”, „za 12 min”
export function fmtIn(ms) {
  const total = Math.max(1, Math.ceil(Math.max(0, ms) / MIN)); // pełne minuty w górę (59,5 min → „1 godz.”)
  const d = Math.floor(total / 1440), hh = Math.floor((total % 1440) / 60), mm = total % 60;
  if (d > 0) return hh ? `${d} ${d === 1 ? 'dzień' : 'dni'} ${hh} godz.` : `${d} ${d === 1 ? 'dzień' : 'dni'}`;
  if (hh > 0) return mm ? `${hh} godz. ${mm} min` : `${hh} godz.`;
  return `${Math.max(1, mm)} min`;
}
export function fmtDuration(ms) {
  const totalMin = Math.round(ms / MIN);
  const d = Math.floor(totalMin / 1440), hh = Math.floor((totalMin % 1440) / 60), mm = totalMin % 60;
  return [d ? `${d} d` : '', hh ? `${hh} godz.` : '', mm ? `${mm} min` : ''].filter(Boolean).join(' ') || '0 min';
}
// wartości pól <input type="datetime-local"> (czas lokalny)
export function toLocalInput(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fromLocalInput(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return NaN;
  const d = new Date(2000, +m[2] - 1, +m[3], +m[4], +m[5], 0, 0);
  d.setFullYear(+m[1]); // bez zamiany lat 0–99 na 1900–1999
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d.getTime() : NaN;
}
export function timeZoneLabel() {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { tz = ''; }
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${tz ? tz + ', ' : ''}UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? ':' + pad(abs % 60) : ''}`;
}

// ——— Szybkie terminy w formularzu ———
const at = (base, h, m = 0) => { const d = new Date(base); d.setHours(h, m, 0, 0); return d.getTime(); };
export function presetRange(id, t = Date.now()) {
  const nowMin = Math.floor(t / MIN) * MIN;
  switch (id) {
    case 'now1': return { start: nowMin, end: nowMin + HOUR };
    case 'now24': return { start: nowMin, end: nowMin + 24 * HOUR };
    case 'evening': { // dziś 18:00–22:00, a po 18:00 – jutro
      let s = at(t, 18);
      if (s < t) s += DAY;
      return { start: s, end: s + 4 * HOUR };
    }
    case 'weekend': { // najbliższy weekend: sobota 00:00 – poniedziałek 00:00
      const d = new Date(t);
      const add = (6 - d.getDay() + 7) % 7;
      let s = at(t + add * DAY, 0);
      if (s + 2 * DAY <= t) s += 7 * DAY;
      return { start: Math.max(s, nowMin), end: at(s + 2 * DAY + HOUR, 0) };
    }
    default: return null;
  }
}
