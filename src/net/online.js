// Warstwa online (Supabase): profile graczy, rankingi, asynchroniczne PvP, czat na żywo, gildie, bossowie.
// Gdy brak konfiguracji lub połączenia – gra działa offline (solo: przygody, lochy, Próby; bez areny, gildii i czatu).
import { DEFAULT_ONLINE } from './config.js';
import { applyAwakening } from '../core/formulas.js';

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
  };
  check(await withTimeout(Net.client.from('players').upsert(row), 'Zapis profilu'), 'Zapis profilu');
}

// ——— Odświeżenie danych świata ———
export async function refresh(week, guildNetId) {
  if (!Net.client) return;
  Net.lastRefresh = Date.now();
  const c = Net.client;
  const [pl, gu, wb] = await Promise.all([
    withTimeout(c.from('players').select('id,name,cls,look,hue,skin,lvl,power,rating,guild_id,fighter,updated_at').neq('id', Net.uid).order('power', { ascending: false }).limit(300), 'Gracze'),
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
  emit('refresh');
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
  return { id: row.id, from: row.name, cls: row.cls, text: row.body, t: new Date(row.created_at).getTime(), me: row.author === Net.uid, online: true, channel: row.channel };
}
export async function loadChat(channel) {
  const rows = check(await withTimeout(Net.client.from('chat_messages').select('id,channel,author,name,cls,body,created_at').eq('channel', channel).order('created_at', { ascending: false }).limit(40), 'Czat'), 'Czat');
  return rows.reverse().map(toMsg);
}
function subscribeChat() {
  Net.channel = Net.client.channel('fho-chat')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => emit('chat', toMsg(payload.new)))
    .subscribe((st, err) => { if (err) console.error('Realtime czatu:', err); });
}
export async function sendChat(channel, name, cls, body) {
  const r = await withTimeout(Net.client.from('chat_messages').insert({ channel, name, cls, body }), 'Wysyłanie wiadomości');
  if (r.error && /CHAT_RATE_LIMIT/.test(r.error.message)) throw new Error('Za szybko! Odczekaj chwilę.');
  check(r, 'Wysyłanie wiadomości');
}

// ——— Walczący z „snapshotu” innego gracza (asynchroniczne PvP) ———
const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
export function fighterFromRow(row) {
  const f = row.fighter || {};
  const L = num(row.lvl, 1, 150, 1);
  const maxHp = num(f.maxHp, 1, 5e7, 100);
  // liczba przebudzeń ograniczona poziomem (np. poziom 112 → maks. 2); efekty nakładane lokalnie
  const awak = Math.floor(num(f.awak, 0, Math.min(6, L >= 100 ? 1 + Math.floor((L - 100) / 10) : 0), 0));
  return applyAwakening({
    name: row.name, lvl: L, maxHp, hp: maxHp, dmgMin: num(f.dmgMin, 1, 1e6, 10), dmgMax: num(f.dmgMax, 1, 1e6, 12), armor: num(f.armor, 0, 1e6, 0),
    crit: num(f.crit, 0, 65, 5), critDmg: num(f.critDmg, 1, 5, 1.8), dodge: num(f.dodge, 0, 42, 0), block: num(f.block, 0, 30, 0), resist: num(f.resist, 0, 30, 0),
    pierce: num(f.pierce, 0, 0.6, 0), leech: num(f.leech, 0, 30, 0), regen: num(f.regen, 0, 10, 0), skillPct: num(f.skillPct, 0, 200, 0), initPct: num(f.initPct, 0, 50, 0),
    skills: Array.isArray(f.skills) ? f.skills.filter((s) => typeof s === 'string').slice(0, 8) : [], cls: row.cls, netPlayer: true,
  }, row.cls, awak);
}
