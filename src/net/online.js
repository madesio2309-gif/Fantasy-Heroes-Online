// Warstwa online (Supabase): profile graczy, rankingi, asynchroniczne PvP, czat na żywo, gildie, bossowie.
// Gdy brak konfiguracji lub połączenia – gra działa offline (solo: przygody, lochy, Próby; bez areny, gildii i czatu).
import { DEFAULT_ONLINE } from './config.js';
import { applyAwakening, fighterPower, maxPowerFor, scaleFighter } from '../core/formulas.js';
import { cleanText } from '../data/moderation.js';
import { RARITIES, SLOTS, TEMPLATE_BY_ID } from '../data/items.js';
import { PET_BY_ID, PET_MAX_LVL } from '../data/pets.js';
import { LIVE_EVENTS } from '../data/live.js';
import { validateSchedule, liveStatus, evStart } from '../core/schedule.js';

const CFG_KEY = 'fho_online_cfg';
const TIMEOUT_MS = 12000;
const listeners = new Set();
let sbModule = null;

export const Net = {
  status: 'off', // off | connecting | on | err
  error: '',
  client: null,
  uid: null,
  players: [], // inni gracze (bez siebie)
  guilds: [], // { id, name, owner, members }
  boss: { worldTotal: 0, worldOwnServer: 0, guildOthers: 0, contributors: [] },
  live: [], // aktywne i zaplanowane eventy administratora
  news: [], // ogłoszenia
  vip: {}, // id gracza → koniec VIP-a (ms), tylko aktywni
  vipReady: null, // true – tabela VIP na serwerze; false – brak migracji supabase/vip_1.8.2.sql; null – nie sprawdzono
  myVipLog: [], // własne wpisy dziennika VIP (nadania z paczką kryształów)
  channel: null,
  lastProfile: 0,
  lastRefresh: 0,
};
export const isOnline = () => Net.status === 'on';
export function onNet(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(type, data) { for (const fn of listeners) fn(type, data); }

export function getConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (c && c.url && c.anonKey) return c;
  } catch (e) { console.error('Uszkodzona konfiguracja online', e); }
  return DEFAULT_ONLINE.url && DEFAULT_ONLINE.anonKey ? { ...DEFAULT_ONLINE } : null;
}
export function saveConfig(cfg) {
  if (cfg) localStorage.setItem(CFG_KEY, JSON.stringify({ url: cfg.url.trim(), anonKey: cfg.anonKey.trim() }));
  else localStorage.removeItem(CFG_KEY);
}

function withTimeout(p, label) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${label}: przekroczono czas oczekiwania`)), TIMEOUT_MS))]);
}
function check(res, label) {
  if (res.error) throw new Error(`${label}: ${res.error.message || res.error}`);
  return res.data;
}
function setStatus(s, err = '') { Net.status = s; Net.error = err; emit('status', s); }

// ——— Klient Supabase (wspólny dla kont graczy i świata online – jedna sesja na przeglądarkę) ———
let cachedClient = null;
export async function getClient(cfg) {
  if (!cfg) throw new Error('Brak konfiguracji serwera gry');
  if (!/^https:\/\/.+/.test(cfg.url)) throw new Error('Adres projektu musi zaczynać się od https://');
  if (cachedClient && cachedClient.url === cfg.url && cachedClient.key === cfg.anonKey) return cachedClient.client;
  sbModule = sbModule || (await import('@supabase/supabase-js'));
  const client = sbModule.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'fho_sb_auth' },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  cachedClient = { url: cfg.url, key: cfg.anonKey, client };
  return client;
}
// tylko dla testów: podstawienie klienta zgodnego z API supabase-js
export function setClientForTests(cfg, client) { cachedClient = client ? { url: cfg.url, key: cfg.anonKey, client } : null; }
export { withTimeout };

// ——— Połączenie ———
export async function connect(cfg, profile) {
  if (!cfg) throw new Error('Brak konfiguracji online');
  if (!/^https:\/\/.+/.test(cfg.url)) throw new Error('Adres projektu musi zaczynać się od https://');
  await disconnect();
  setStatus('connecting');
  try {
    const client = await getClient(cfg);
    const ses = check(await withTimeout(client.auth.getSession(), 'Sesja'), 'Sesja');
    let session = ses.session;
    // gracze z kontem są już zalogowani; sesja anonimowa tylko dla gry bez konta
    if (!session) {
      const d = check(await withTimeout(client.auth.signInAnonymously(), 'Logowanie anonimowe'), 'Logowanie anonimowe');
      session = d.session;
    }
    if (!session) throw new Error('Nie udało się utworzyć sesji gracza');
    Net.client = client;
    Net.uid = session.user.id;
    await pushProfile(profile, true);
    await refresh(profile.week, profile.guildNetId);
    subscribeChat();
    setStatus('on');
    return true;
  } catch (e) {
    console.error('Błąd połączenia online', e);
    Net.client = null; Net.uid = null;
    setStatus('err', e.message);
    throw e;
  }
}
export async function disconnect() {
  if (Net.channel && Net.client) { await Net.client.removeChannel(Net.channel); }
  Net.channel = null; Net.client = null; Net.uid = null; Net.players = []; Net.guilds = [];
  setStatus('off');
}

// ——— Profil gracza ———
export async function pushProfile(profile, force = false) {
  if (!Net.client) return;
  const now = Date.now();
  if (!force && now - Net.lastProfile < 30000) return;
  Net.lastProfile = now;
  const row = {
    id: Net.uid, name: profile.name, cls: profile.cls, look: profile.look, hue: profile.hue, skin: profile.skin,
    lvl: profile.lvl, power: profile.power, rating: profile.rating, guild_id: profile.guildNetId || null, fighter: profile.fighter,
    equip: profile.equip || {}, pet: profile.pet || null, abyss: profile.abyss || 0,
  };
  check(await withTimeout(Net.client.from('players').upsert(row), 'Zapis profilu'), 'Zapis profilu');
}

// ——— Dane publiczne (dostępne także przed zalogowaniem): eventy i ogłoszenia ———
export async function loadPublic(cfg = getConfig()) {
  if (!cfg) return { live: [], news: [] };
  const c = Net.client || (await getClient(cfg));
  const now = new Date().toISOString();
  const [ev, an] = await Promise.all([
    withTimeout(c.from('live_events').select('id,kind,starts_at,ends_at').gt('ends_at', now).order('starts_at').limit(50), 'Eventy'),
    withTimeout(c.from('announcements').select('id,title,body,created_at').eq('active', true).order('created_at', { ascending: false }).limit(5), 'Ogłoszenia'),
  ]);
  Net.live = check(ev, 'Eventy').filter((e) => LIVE_EVENTS[e.kind]);
  Net.news = check(an, 'Ogłoszenia').map((a) => ({ ...a, title: cleanText(a.title), body: cleanText(a.body) }));
  emit('live');
  return { live: Net.live, news: Net.news };
}
// pełny profil jednego gracza (z ekwipunkiem) – pobierany na żądanie
export async function getPlayerProfile(id) {
  if (!Net.client) throw new Error('Brak połączenia z serwerem');
  const row = check(await withTimeout(Net.client.from('players').select('id,name,cls,look,hue,skin,lvl,power,rating,guild_id,fighter,equip,pet,abyss,updated_at').eq('id', id).maybeSingle(), 'Profil gracza'), 'Profil gracza');
  if (!row) throw new Error('Gracz nie istnieje lub usunął konto');
  return row;
}

// ——— Odświeżenie danych świata ———
export async function refresh(week, guildNetId) {
  if (!Net.client) return;
  Net.lastRefresh = Date.now();
  const c = Net.client;
  const [pl, gu, wb] = await Promise.all([
    withTimeout(c.from('players').select('id,name,cls,look,hue,skin,lvl,power,rating,guild_id,fighter,abyss,updated_at').neq('id', Net.uid).order('power', { ascending: false }).limit(300), 'Gracze'),
    withTimeout(c.from('guilds').select('id,name,owner,players(count)').order('created_at').limit(100), 'Gildie'),
    withTimeout(c.from('boss_damage').select('player_id,dmg').eq('kind', 'world').eq('scope', 'world').eq('week', week).order('dmg', { ascending: false }).limit(100), 'Boss światowy'),
  ]);
  Net.players = check(pl, 'Gracze');
  Net.guilds = check(gu, 'Gildie').map((g) => ({ id: g.id, name: g.name, owner: g.owner, members: g.players?.[0]?.count || 0 }));
  const wbRows = check(wb, 'Boss światowy');
  const tot = check(await withTimeout(c.from('boss_totals').select('total').eq('kind', 'world').eq('scope', 'world').eq('week', week).maybeSingle(), 'Suma bossa'), 'Suma bossa');
  const own = wbRows.find((r) => r.player_id === Net.uid);
  Net.boss.worldTotal = Number(tot?.total || 0);
  Net.boss.worldOwnServer = Number(own?.dmg || 0);
  const names = Object.fromEntries(Net.players.map((p) => [p.id, p]));
  Net.boss.contributors = wbRows.filter((r) => r.player_id !== Net.uid && names[r.player_id]).map((r) => ({ name: names[r.player_id].name, cls: names[r.player_id].cls, dmg: Number(r.dmg), online: true }));
  if (guildNetId) {
    const gb = check(await withTimeout(c.from('boss_damage').select('player_id,dmg').eq('kind', 'guild').eq('scope', guildNetId).eq('week', week), 'Boss gildii'), 'Boss gildii');
    Net.boss.guildOthers = gb.filter((r) => r.player_id !== Net.uid).reduce((s, r) => s + Number(r.dmg), 0);
  } else Net.boss.guildOthers = 0;
  await loadPublic();
  await loadVip();
  emit('refresh');
}

// ——— VIP (nadawany przez administratora; status i dziennik tylko z serwera) ———
export const VIP_MIGRATION_FILE = 'supabase/vip_1.8.2.sql';
const missingRelation = (err) => /PGRST20[25]|does not exist|schema cache/i.test(`${err?.code || ''} ${err?.message || ''}`);
export async function loadVip() {
  if (!Net.client) return;
  const r = await withTimeout(Net.client.from('vip').select('user_id,until').gt('until', new Date().toISOString()).limit(1000), 'VIP');
  if (r.error && missingRelation(r.error)) {
    if (Net.vipReady !== false) console.warn(`VIP: na serwerze brakuje tabeli vip – uruchom ${VIP_MIGRATION_FILE} w Supabase › SQL Editor.`);
    Net.vipReady = false; Net.vip = {}; Net.myVipLog = [];
    emit('vip');
    return;
  }
  Net.vip = Object.fromEntries(check(r, 'VIP').map((x) => [x.user_id, new Date(x.until).getTime()]));
  Net.myVipLog = Net.uid ? check(await withTimeout(Net.client.from('vip_log').select('id,action,days,bonus,until,created_at').eq('user_id', Net.uid).order('created_at', { ascending: false }).limit(50), 'Dziennik VIP'), 'Dziennik VIP') : [];
  Net.vipReady = true;
  emit('vip');
}
// koniec VIP-a gracza (ms) albo 0, gdy nie jest VIP-em
export function vipUntil(id, t = Date.now()) {
  const u = Net.vip[id];
  return u && u > t ? u : 0;
}
const VIP_ERRORS = [
  [/NOT_ADMIN/, 'Brak uprawnień administratora.'],
  [/VIP_DAYS/, 'Podaj od 1 do 366 dni VIP-a.'],
  [/VIP_TOO_LONG/, 'VIP może sięgać najwyżej 2 lata naprzód.'],
  [/VIP_NO_USER/, 'Taki gracz nie istnieje.'],
  [/VIP_NOT_ACTIVE/, 'Ten gracz nie ma aktywnego VIP-a.'],
];
function vipCheck(res, label) {
  if (res.error) {
    const msg = `${res.error.code || ''} ${res.error.message || res.error}`;
    if (missingRelation(res.error) || /PGRST202|function .*admin_(grant|revoke)_vip/i.test(msg)) throw new Error(`Na serwerze brakuje funkcji VIP – uruchom ${VIP_MIGRATION_FILE} w Supabase › SQL Editor.`);
    const known = VIP_ERRORS.find(([re]) => re.test(msg));
    throw new Error(known ? known[1] : `${label}: ${res.error.message || res.error}`);
  }
  return res.data;
}

export async function pushBossDamage(kind, scope, week, totalDmg) {
  if (!Net.client) return;
  check(await withTimeout(Net.client.from('boss_damage').upsert({ player_id: Net.uid, kind, scope, week, dmg: Math.round(totalDmg) }), 'Zapis obrażeń'), 'Zapis obrażeń');
}

// ——— Gildie ———
export async function createGuild(name) {
  const g = check(await withTimeout(Net.client.from('guilds').insert({ name }).select('id,name').single(), 'Zakładanie gildii'), 'Zakładanie gildii');
  await joinGuild(g.id);
  return g;
}
export async function joinGuild(id) {
  const r = await withTimeout(Net.client.from('players').update({ guild_id: id }).eq('id', Net.uid), 'Dołączanie do gildii');
  if (r.error && /GUILD_FULL/.test(r.error.message)) throw new Error('Gildia jest pełna (30/30).');
  check(r, 'Dołączanie do gildii');
}
export async function leaveGuild() {
  check(await withTimeout(Net.client.from('players').update({ guild_id: null }).eq('id', Net.uid), 'Opuszczanie gildii'), 'Opuszczanie gildii');
}

// ——— Czat ———
function toMsg(row) {
  return { id: row.id, author: row.author, from: cleanText(row.name), cls: row.cls, text: cleanText(row.body), t: new Date(row.created_at).getTime(), me: row.author === Net.uid, online: true, channel: row.channel };
}
export async function loadChat(channel) {
  const rows = check(await withTimeout(Net.client.from('chat_messages').select('id,channel,author,name,cls,body,created_at').eq('channel', channel).order('created_at', { ascending: false }).limit(40), 'Czat'), 'Czat');
  return rows.reverse().map(toMsg);
}
function subscribeChat() {
  Net.channel = Net.client.channel('fho-chat')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => emit('chat', toMsg(payload.new)))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => emit('chatDelete', payload.old && payload.old.id))
    .subscribe((st, err) => { if (err) console.error('Realtime czatu:', err); });
}
export async function sendChat(channel, name, cls, body) {
  const r = await withTimeout(Net.client.from('chat_messages').insert({ channel, name, cls, body }), 'Wysyłanie wiadomości');
  if (r.error && /CHAT_RATE_LIMIT/.test(r.error.message)) throw new Error('Za szybko! Odczekaj chwilę.');
  if (r.error && /row-level security|CHAT_BANNED/i.test(r.error.message)) throw new Error('Twój czat jest czasowo zablokowany przez administratora.');
  check(r, 'Wysyłanie wiadomości');
}
export async function reportMessage(messageId, reason) {
  if (!Net.client) throw new Error('Brak połączenia z serwerem');
  check(await withTimeout(Net.client.from('chat_reports').insert({ message_id: messageId, reason: String(reason || '').slice(0, 200) }), 'Zgłoszenie'), 'Zgłoszenie');
}
export async function myChatBan() {
  if (!Net.client || !Net.uid) return null;
  return check(await withTimeout(Net.client.from('chat_bans').select('until,reason').eq('user_id', Net.uid).gt('until', new Date().toISOString()).maybeSingle(), 'Blokada czatu'), 'Blokada czatu');
}

// ——— Konto: usunięcie (funkcja serwera usuwa użytkownika; dane gry kasują się kaskadowo) ———
export async function deleteMyAccount(client) {
  check(await withTimeout(client.rpc('delete_my_account'), 'Usuwanie konta'), 'Usuwanie konta');
}

// ——— Panel administratora (uprawnienia sprawdza serwer: is_admin()) ———
const db = () => { if (!Net.client) throw new Error('Brak połączenia z serwerem'); return Net.client; };
export const Admin = {
  async isAdmin() { return !!check(await withTimeout(db().rpc('is_admin'), 'Uprawnienia'), 'Uprawnienia'); },
  async stats() { return check(await withTimeout(db().rpc('admin_stats'), 'Statystyki'), 'Statystyki'); },
  // trwające i zaplanowane (wszystkie) + ostatnie zakończone
  async events() {
    const now = new Date().toISOString();
    const [cur, past] = await Promise.all([
      withTimeout(db().from('live_events').select('id,kind,starts_at,ends_at,created_at').gt('ends_at', now).order('starts_at', { ascending: true }).limit(200), 'Eventy'),
      withTimeout(db().from('live_events').select('id,kind,starts_at,ends_at,created_at').lte('ends_at', now).order('ends_at', { ascending: false }).limit(15), 'Eventy'),
    ]);
    return [...check(cur, 'Eventy'), ...check(past, 'Eventy')];
  },
  // nowy event od teraz (hours) – skrót dla „Uruchom teraz”
  async startEvent(kind, hours) {
    const t = Math.floor(Date.now() / 60000) * 60000;
    return this.scheduleEvent(kind, t, t + hours * 3600000);
  },
  // nowy event w terminie start–end (ms); termin sprawdzany względem już zaplanowanych
  async scheduleEvent(kind, start, end) {
    const err = validateSchedule({ kind, start, end }, await this.events());
    if (err) throw new Error(err);
    const row = { kind, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString() };
    check(await withTimeout(db().from('live_events').insert(row), 'Zaplanowanie eventu'), 'Zaplanowanie eventu');
    await loadPublic();
  },
  // zmiana terminu: zaplanowany – rodzaj, start i koniec; trwający – tylko koniec
  async updateEvent(id, { kind, start, end }) {
    const list = await this.events();
    const cur = list.find((e) => e.id === id);
    if (!cur) throw new Error('Nie znaleziono eventu – mógł zostać usunięty.');
    const st = liveStatus(cur);
    if (st === 'ended') throw new Error('Ten event już się zakończył.');
    const next = st === 'active' ? { kind: cur.kind, start: evStart(cur), end } : { kind, start, end };
    const err = validateSchedule(next, list, Date.now(), { ignoreId: id, keepStart: st === 'active' });
    if (err) throw new Error(err);
    const patch = st === 'active' ? { ends_at: new Date(end).toISOString() } : { kind: next.kind, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString() };
    check(await withTimeout(db().from('live_events').update(patch).eq('id', id), 'Zmiana eventu'), 'Zmiana eventu');
    await loadPublic();
  },
  // anulowanie: zaplanowany – usuwany; trwający – kończy się teraz
  async cancelEvent(id) {
    const cur = (await this.events()).find((e) => e.id === id);
    if (!cur) throw new Error('Nie znaleziono eventu – mógł zostać już anulowany.');
    if (liveStatus(cur) === 'upcoming') check(await withTimeout(db().from('live_events').delete().eq('id', id), 'Anulowanie eventu'), 'Anulowanie eventu');
    else check(await withTimeout(db().from('live_events').update({ ends_at: new Date().toISOString() }).eq('id', id), 'Zatrzymanie eventu'), 'Zatrzymanie eventu');
    await loadPublic();
  },
  async stopEvent(id) { return this.cancelEvent(id); },
  async news() { return check(await withTimeout(db().from('announcements').select('id,title,body,active,created_at').order('created_at', { ascending: false }).limit(30), 'Ogłoszenia'), 'Ogłoszenia'); },
  async postNews(title, body) {
    check(await withTimeout(db().from('announcements').insert({ title: title.trim(), body: body.trim() }), 'Nowe ogłoszenie'), 'Nowe ogłoszenie');
    await loadPublic();
  },
  async setNewsActive(id, active) {
    check(await withTimeout(db().from('announcements').update({ active }).eq('id', id), 'Ogłoszenie'), 'Ogłoszenie');
    await loadPublic();
  },
  async reports(status = 'open') { return check(await withTimeout(db().from('chat_reports').select('id,message_id,reporter,author,author_name,body,reason,status,created_at').eq('status', status).order('created_at', { ascending: false }).limit(50), 'Zgłoszenia'), 'Zgłoszenia'); },
  async closeReport(id, status) { check(await withTimeout(db().from('chat_reports').update({ status }).eq('id', id), 'Zgłoszenie'), 'Zgłoszenie'); },
  async deleteMessage(id) { check(await withTimeout(db().from('chat_messages').delete().eq('id', id), 'Usuwanie wiadomości'), 'Usuwanie wiadomości'); },
  async ban(userId, hours, reason) {
    const until = new Date(Date.now() + hours * 3600000).toISOString();
    check(await withTimeout(db().from('chat_bans').upsert({ user_id: userId, until, reason: String(reason || '').slice(0, 200) }), 'Blokada czatu'), 'Blokada czatu');
  },
  async unban(userId) { check(await withTimeout(db().from('chat_bans').delete().eq('user_id', userId), 'Zdjęcie blokady'), 'Zdjęcie blokady'); },
  async bans() { return check(await withTimeout(db().from('chat_bans').select('user_id,until,reason,created_at').gt('until', new Date().toISOString()).order('until', { ascending: false }).limit(50), 'Blokady'), 'Blokady'); },
  async searchPlayers(q) {
    let req = db().from('players').select('id,name,cls,lvl,power,abyss,updated_at').order('updated_at', { ascending: false }).limit(30);
    if (q && q.trim()) req = req.ilike('name', `%${q.trim().replace(/[%_]/g, '')}%`);
    return check(await withTimeout(req, 'Gracze'), 'Gracze');
  },
  // ——— VIP ———
  async vipList() {
    await loadVip();
    if (Net.vipReady === false) return null;
    const ids = Object.keys(Net.vip);
    const names = ids.length ? check(await withTimeout(db().from('players').select('id,name,cls,lvl').in('id', ids), 'Gracze VIP'), 'Gracze VIP') : [];
    const by = Object.fromEntries(names.map((p) => [p.id, p]));
    return ids.map((id) => ({ id, until: Net.vip[id], name: by[id]?.name || id.slice(0, 8), cls: by[id]?.cls || 'warrior', lvl: by[id]?.lvl || 0 })).sort((a, b) => a.until - b.until);
  },
  async grantVip(userId, days, reason = '') {
    const d = Math.floor(Number(days));
    if (!(d >= 1 && d <= 366)) throw new Error('Podaj od 1 do 366 dni VIP-a.');
    const until = vipCheck(await withTimeout(db().rpc('admin_grant_vip', { p_user: userId, p_days: d, p_reason: String(reason || '').trim().slice(0, 120) || null }), 'Nadanie VIP'), 'Nadanie VIP');
    await loadVip();
    return new Date(until).getTime();
  },
  async revokeVip(userId, reason = '') {
    vipCheck(await withTimeout(db().rpc('admin_revoke_vip', { p_user: userId, p_reason: String(reason || '').trim().slice(0, 120) || null }), 'Odebranie VIP'), 'Odebranie VIP');
    await loadVip();
  },
  async vipHistory(userId) {
    return vipCheck(await withTimeout(db().from('vip_log').select('id,action,days,bonus,until,reason,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10), 'Dziennik VIP'), 'Dziennik VIP');
  },
  async guards(ids) {
    if (!ids.length) return [];
    return check(await withTimeout(db().from('player_guard').select('user_id,lvl,cr,abyss,strikes,last_reject,flagged,at').in('user_id', ids), 'Ochrona'), 'Ochrona');
  },
  async flagged() { return check(await withTimeout(db().from('player_guard').select('user_id,lvl,cr,abyss,strikes,last_reject,flagged,at').gt('strikes', 0).order('strikes', { ascending: false }).limit(30), 'Ochrona'), 'Ochrona'); },
  async clearGuard(userId) {
    check(await withTimeout(db().from('player_guard').update({ strikes: 0, flagged: false, last_reject: null, b_lvl: 40, b_cr: 6000, b_abyss: 60 }).eq('user_id', userId), 'Ochrona'), 'Ochrona');
  },
};

// ——— Ekwipunek z profilu innego gracza (oczyszczany: zakresy liczb, znane ikony, krótkie teksty) ———
const ICON_RE = /^(weapons|armor|jewelry)_\d\d$/;
export function itemsFromRow(row) {
  const src = row && typeof row.equip === 'object' && row.equip ? row.equip : {};
  const out = {};
  for (const slot of SLOTS) {
    const x = src[slot];
    if (!x || typeof x !== 'object') continue;
    const tpl = TEMPLATE_BY_ID[x.t];
    const stats = {};
    if (x.s && typeof x.s === 'object') for (const k of ['str', 'dex', 'int', 'con', 'lck']) if (x.s[k] !== undefined) stats[k] = num(x.s[k], 0, 1e7, 0);
    out[slot] = {
      uid: `pv:${row.id}:${slot}`, tid: tpl ? tpl.tid : '', slot, type: tpl ? tpl.type : String(x.y || '').slice(0, 12),
      name: cleanText(String(x.n || (tpl && tpl.name) || 'Przedmiot').slice(0, 40)), icon: ICON_RE.test(x.i) ? x.i : (tpl ? tpl.icon : 'weapons_00'),
      rarity: Math.floor(num(x.r, 0, RARITIES.length - 1, 0)), lvl: Math.floor(num(x.l, 1, 100000, 1)), up: Math.floor(num(x.u, 0, 10, 0)),
      stats, dmg: num(x.d, 0, 1e7, 0), armor: num(x.a, 0, 1e7, 0), fx: tpl && tpl.fx ? tpl.fx : '', preview: true,
      special: tpl && tpl.special ? { ...tpl.special } : undefined,
    };
  }
  return out;
}
export function petFromRow(row) {
  const p = row && row.pet;
  if (!p || !PET_BY_ID[p.id]) return null;
  return { id: p.id, lvl: Math.floor(num(p.lvl, 1, PET_MAX_LVL, 1)) };
}

// ——— Walczący z „snapshotu” innego gracza (asynchroniczne PvP) ———
const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
export function fighterFromRow(row) {
  const f = row.fighter || {};
  const L = num(row.lvl, 1, 100000, 1);
  const maxHp = num(f.maxHp, 1, 5e9, 100);
  // liczba przebudzeń ograniczona poziomem (np. poziom 112 → maks. 2); efekty nakładane lokalnie
  const awak = Math.floor(num(f.awak, 0, Math.min(6, L >= 100 ? 1 + Math.floor((L - 100) / 10) : 0), 0));
  const fr = applyAwakening({
    name: row.name, lvl: L, maxHp, hp: maxHp, dmgMin: num(f.dmgMin, 1, 1e8, 10), dmgMax: num(f.dmgMax, 1, 1e8, 12), armor: num(f.armor, 0, 1e8, 0),
    crit: num(f.crit, 0, 65, 5), critDmg: num(f.critDmg, 1, 5, 1.8), dodge: num(f.dodge, 0, 42, 0), block: num(f.block, 0, 30, 0), resist: num(f.resist, 0, 30, 0),
    pierce: num(f.pierce, 0, 0.6, 0), leech: num(f.leech, 0, 30, 0), regen: num(f.regen, 0, 10, 0), skillPct: num(f.skillPct, 0, 200, 0), initPct: num(f.initPct, 0, 50, 0),
    skills: Array.isArray(f.skills) ? f.skills.filter((s) => typeof s === 'string').slice(0, 8) : [], cls: row.cls, netPlayer: true,
  }, row.cls, awak);
  // siła ponad realny limit dla poziomu (zmodyfikowany zapis) jest przycinana
  const p = fighterPower(fr), cap = maxPowerFor(L);
  if (p > cap) scaleFighter(fr, cap / p);
  return fr;
}
