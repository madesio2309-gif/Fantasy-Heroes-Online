// Konta graczy: rejestracja, logowanie, wylogowanie, zmiana hasła i zapis postaci.
// • Konto online („cloud”) – Supabase Auth (e-mail + hasło); postać trzymana w tabeli public.saves,
//   więc ten sam bohater jest dostępny na każdym urządzeniu. Wymaga skonfigurowanego serwera (ONLINE.md).
// • Konto lokalne („local”) – gdy serwer nie jest podłączony: konta w tej przeglądarce, hasło jako skrót PBKDF2.
import * as G from './game.js';
import * as Net from '../net/online.js';
import { LEGAL_VERSION } from '../data/legal.js';

const ACC_KEY = 'fho_accounts_v1';
const SES_KEY = 'fho_session_v1';
const PBKDF2_ITER = 120000;
export const CLOUD_SYNC_MS = 15000;
const LOGIN_RE = /^[a-z0-9_.\-ąćęłńóśźż]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD = 6;
const FILE_TAG = 'fantasy_heroes_online';
// konto administratora – przycisk panelu widzi tylko ono; uprawnienia i tak sprawdza serwer (is_admin)
export const ADMIN_EMAIL = 'madesio2309@gmail.com';
// link z maila „reset hasła” wraca do gry z #...type=recovery – wykrywamy go przed inicjalizacją klienta Supabase
const RECOVERY_LINK = typeof location !== 'undefined' && /type=recovery/.test(location.hash || '');

export const Acc = { user: null, dirty: false, syncing: false, lastSync: 0, syncError: '', recovery: false };
const listeners = new Set();
export function onAcc(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = (t) => { for (const fn of listeners) fn(t); };

export const cloudAvailable = () => !!Net.getConfig();
export const normLogin = (s) => (s || '').trim().toLowerCase();
const slotFor = (u) => `${G.GUEST_SAVE_KEY}:${u.mode === 'cloud' ? 'c' : 'l'}:${u.id}`;

function parse(raw, label) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { console.error(`Uszkodzone dane: ${label}`, e); return null; }
}
function readAcc() { return parse(localStorage.getItem(ACC_KEY), 'lista kont') || { users: {} }; }
function writeAcc(a) { localStorage.setItem(ACC_KEY, JSON.stringify(a)); }

// ——— Hasła kont lokalnych ———
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
function subtle() {
  const s = globalThis.crypto && globalThis.crypto.subtle;
  if (!s) throw new Error('Ta przeglądarka nie obsługuje bezpiecznego szyfrowania haseł (strona musi działać przez https).');
  return s;
}
async function hashPw(pw, saltHex, iter) {
  const salt = Uint8Array.from(saltHex.match(/../g).map((x) => parseInt(x, 16)));
  const key = await subtle().importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}
function newSalt() { const s = new Uint8Array(16); globalThis.crypto.getRandomValues(s); return hex(s); }

// ——— Walidacja ———
export function validate({ login, password, password2 }, mode) {
  if (mode === 'cloud') { if (!EMAIL_RE.test((login || '').trim())) return 'Podaj poprawny adres e-mail.'; }
  else if (!LOGIN_RE.test(normLogin(login))) return 'Login: 3–20 znaków (litery, cyfry, _ . -).';
  if ((password || '').length < MIN_PASSWORD) return `Hasło musi mieć co najmniej ${MIN_PASSWORD} znaków.`;
  if (password2 !== undefined && password !== password2) return 'Hasła nie są takie same.';
  return null;
}
// komunikaty Supabase Auth po polsku
export function authError(msg) {
  const m = String(msg || '');
  if (/invalid login credentials/i.test(m)) return 'Nieprawidłowy e-mail lub hasło.';
  if (/already registered|already exists/i.test(m)) return 'Konto z tym adresem e-mail już istnieje – zaloguj się.';
  if (/email not confirmed/i.test(m)) return 'Najpierw potwierdź adres e-mail (link w wiadomości od serwera gry).';
  if (/signups? not allowed|signup.*disabled|provider is disabled/i.test(m)) return 'Rejestracja e-mail jest wyłączona w ustawieniach serwera (Supabase → Authentication → Email).';
  if (/rate limit|too many/i.test(m)) return 'Zbyt wiele prób – spróbuj ponownie za chwilę.';
  if (/password should be|weak password/i.test(m)) return `Hasło jest za słabe (min. ${MIN_PASSWORD} znaków).`;
  if (/relation .*saves.* does not exist|could not find the table/i.test(m)) return 'Na serwerze brakuje tabeli zapisów – uruchom aktualny plik supabase/schema.sql.';
  if (/permission denied for table/i.test(m)) return 'Serwer gry nie ma nadanych uprawnień do tabel – uruchom aktualny plik supabase/schema.sql.';
  if (/email address not authorized|not authorized/i.test(m)) return 'Serwer pocztowy gry nie może jeszcze wysyłać maili na ten adres (wymagany własny serwer SMTP w Supabase).';
  if (/email.*invalid|invalid.*email/i.test(m)) return 'Ten adres e-mail jest nieprawidłowy.';
  if (/same.*password|different from the old/i.test(m)) return 'Nowe hasło musi różnić się od obecnego.';
  return m;
}
async function call(promise, label) {
  const res = await Net.withTimeout(promise, label);
  if (res.error) throw new Error(authError(res.error.message || res.error));
  return res.data;
}
const client = () => Net.getClient(Net.getConfig());

// ——— Postać bez konta (starsze zapisy) ———
export function guestInfo() {
  const p = parse(localStorage.getItem(G.GUEST_SAVE_KEY), 'zapis bez konta');
  return p && typeof p.name === 'string' ? { name: p.name, lvl: p.lvl, cls: p.cls } : null;
}
function attachGuest(slot) {
  const raw = localStorage.getItem(G.GUEST_SAVE_KEY);
  if (!raw || localStorage.getItem(slot)) return false;
  localStorage.setItem(slot, raw);
  localStorage.removeItem(G.GUEST_SAVE_KEY);
  return true;
}

// ——— Aktywacja konta: ustawienie slotu zapisu i (dla kont online) pobranie postaci z serwera ———
async function activate(user, { attach = false } = {}) {
  const slot = slotFor(user);
  if (user.mode === 'cloud') {
    Acc.user = user;
    try { await pullCloud(slot); } catch (e) { Acc.user = null; throw e; }
    // bohater bez konta trafia na konto tylko, gdy na serwerze nie ma jeszcze postaci
    if (attach && attachGuest(slot)) Acc.dirty = true;
  } else {
    if (attach) attachGuest(slot);
    localStorage.setItem(SES_KEY, JSON.stringify({ mode: 'local', id: user.id }));
  }
  Acc.user = user;
  G.setSaveSlot(slot);
  emit('login');
  return user;
}
const cloudUser = (u) => ({ mode: 'cloud', id: u.id, email: u.email, login: u.email });
export const isAdminUser = () => !!Acc.user && Acc.user.mode === 'cloud' && (Acc.user.email || '').toLowerCase() === ADMIN_EMAIL;
// adres powrotu z maili (potwierdzenie, reset hasła, zmiana e-maila) – bieżąca strona gry bez parametrów
const returnUrl = () => (typeof location !== 'undefined' ? location.origin + location.pathname : undefined);

// przywrócenie sesji po odświeżeniu strony
export async function restore() {
  if (cloudAvailable()) {
    const c = await client();
    const d = await call(c.auth.getSession(), 'Sesja');
    const u = d.session && d.session.user;
    if (u && !u.is_anonymous && u.email) {
      const user = await activate(cloudUser(u));
      if (RECOVERY_LINK) { Acc.recovery = true; emit('recovery'); }
      return user;
    }
  }
  const s = parse(localStorage.getItem(SES_KEY), 'sesja');
  if (s && s.mode === 'local') {
    const u = readAcc().users[s.id];
    if (u) return activate({ mode: 'local', id: s.id, login: u.login });
    localStorage.removeItem(SES_KEY);
  }
  return null;
}

export async function register({ login, password, password2, mode, attach = true, consent = false }) {
  if (Acc.user) throw new Error('Najpierw wyloguj się z obecnego konta.');
  const err = validate({ login, password, password2 }, mode);
  if (err) throw new Error(err);
  if (!consent) throw new Error('Aby założyć konto, zaakceptuj Regulamin i Politykę prywatności.');
  const consentAt = new Date().toISOString();
  if (mode === 'cloud') {
    const c = await client();
    const email = login.trim().toLowerCase();
    // ewentualna sesja anonimowa (gra online bez konta) ustępuje miejsca nowemu kontu
    const cur = await call(c.auth.getSession(), 'Sesja');
    if (cur.session) await call(c.auth.signOut(), 'Wylogowanie');
    const d = await call(c.auth.signUp({ email, password, options: { emailRedirectTo: returnUrl(), data: { tos_v: LEGAL_VERSION, tos_at: consentAt } } }), 'Rejestracja');
    if (!d.session) return { needConfirm: true, email };
    return { user: await activate(cloudUser(d.user), { attach }) };
  }
  const a = readAcc();
  const id = normLogin(login);
  if (a.users[id]) throw new Error('Taki login jest już zajęty.');
  const salt = newSalt();
  a.users[id] = { login: login.trim(), salt, hash: await hashPw(password, salt, PBKDF2_ITER), iter: PBKDF2_ITER, created: Date.now(), last: Date.now(), tos_v: LEGAL_VERSION, tos_at: consentAt };
  writeAcc(a);
  return { user: await activate({ mode: 'local', id, login: login.trim() }, { attach }) };
}

// ——— Odzyskiwanie hasła i zmiana e-maila (konta online) ———
export async function requestPasswordReset(email) {
  if (!EMAIL_RE.test((email || '').trim())) throw new Error('Podaj poprawny adres e-mail.');
  const c = await client();
  await call(c.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: returnUrl() }), 'Reset hasła');
  return true;
}
// po wejściu z linku „reset hasła” gracz jest zalogowany sesją odzyskiwania – ustawia nowe hasło
export async function setNewPassword(password, password2) {
  if (!Acc.user || Acc.user.mode !== 'cloud') throw new Error('Link odzyskiwania wygasł – poproś o nowy.');
  const err = validate({ login: Acc.user.email, password, password2 }, 'cloud');
  if (err) throw new Error(err);
  const c = await client();
  await call(c.auth.updateUser({ password }), 'Nowe hasło');
  Acc.recovery = false;
  if (typeof history !== 'undefined' && location.hash) history.replaceState(null, '', returnUrl());
  return true;
}
async function verifyCloudPassword(password) {
  const c = await client();
  await call(c.auth.signInWithPassword({ email: Acc.user.email, password }), 'Sprawdzenie hasła');
  return c;
}
export async function changeEmail(newEmail, password) {
  const u = Acc.user;
  if (!u || u.mode !== 'cloud') throw new Error('Zmiana e-maila dotyczy kont online.');
  const email = (newEmail || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error('Podaj poprawny adres e-mail.');
  if (email === u.email) throw new Error('To jest Twój obecny adres e-mail.');
  const c = await verifyCloudPassword(password);
  const d = await call(c.auth.updateUser({ email }, { emailRedirectTo: returnUrl() }), 'Zmiana e-maila');
  // bez wymaganego potwierdzenia serwer zmienia adres od razu
  if (d.user && d.user.email === email) { u.email = email; u.login = email; emit('login'); return { changed: true }; }
  return { pending: true };
}
// usunięcie konta online: serwer usuwa użytkownika, a dane gry (postać, profil, wiadomości) kasują się kaskadowo
export async function deleteCloudAccount(password) {
  const u = Acc.user;
  if (!u || u.mode !== 'cloud') throw new Error('Tę operację można wykonać tylko dla konta online.');
  const c = await verifyCloudPassword(password);
  await Net.disconnect();
  await Net.deleteMyAccount(c);
  await c.auth.signOut().catch((e) => console.error('Wylogowanie po usunięciu konta', e));
  localStorage.removeItem(slotFor(u));
  localStorage.removeItem(SES_KEY);
  Acc.user = null; Acc.dirty = false;
  G.setSaveSlot(null);
  emit('logout');
}

export async function login({ login, password, mode, attach = false }) {
  const err = validate({ login, password }, mode);
  if (err) throw new Error(err);
  if (mode === 'cloud') {
    const c = await client();
    const d = await call(c.auth.signInWithPassword({ email: login.trim().toLowerCase(), password }), 'Logowanie');
    return activate(cloudUser(d.user), { attach });
  }
  const a = readAcc();
  const id = normLogin(login);
  const u = a.users[id];
  if (!u || (await hashPw(password, u.salt, u.iter)) !== u.hash) throw new Error('Nieprawidłowy login lub hasło.');
  u.last = Date.now();
  writeAcc(a);
  return activate({ mode: 'local', id, login: u.login }, { attach });
}

export async function logout() {
  const u = Acc.user;
  if (u && u.mode === 'cloud') {
    if (G.P) G.save();
    await pushCloud(true);
    await Net.disconnect();
    const c = await client();
    await call(c.auth.signOut(), 'Wylogowanie');
    // na wspólnym komputerze nie zostawiamy kopii postaci – chyba że nie udało się jej wysłać na serwer
    if (!Acc.syncError) localStorage.removeItem(slotFor(u));
  } else if (G.P) G.save();
  localStorage.removeItem(SES_KEY);
  Acc.user = null;
  G.setSaveSlot(null);
  emit('logout');
}

export async function changePassword({ old, password, password2 }) {
  const u = Acc.user;
  if (!u) throw new Error('Nie jesteś zalogowany.');
  const err = validate({ login: u.mode === 'cloud' ? u.email : u.id, password, password2 }, u.mode);
  if (err) throw new Error(err);
  if (u.mode === 'cloud') {
    const c = await client();
    await call(c.auth.signInWithPassword({ email: u.email, password: old }), 'Sprawdzenie hasła');
    await call(c.auth.updateUser({ password }), 'Zmiana hasła');
    return true;
  }
  const a = readAcc();
  const rec = a.users[u.id];
  if (!rec || (await hashPw(old, rec.salt, rec.iter)) !== rec.hash) throw new Error('Obecne hasło jest nieprawidłowe.');
  rec.salt = newSalt();
  rec.iter = PBKDF2_ITER;
  rec.hash = await hashPw(password, rec.salt, rec.iter);
  writeAcc(a);
  return true;
}

// usunięcie konta lokalnego razem z postacią (konta online usuwa się w panelu Supabase)
export async function deleteLocalAccount(password) {
  const u = Acc.user;
  if (!u || u.mode !== 'local') throw new Error('Tę operację można wykonać tylko dla konta lokalnego.');
  const a = readAcc();
  const rec = a.users[u.id];
  if (!rec || (await hashPw(password, rec.salt, rec.iter)) !== rec.hash) throw new Error('Nieprawidłowe hasło.');
  delete a.users[u.id];
  writeAcc(a);
  localStorage.removeItem(slotFor(u));
  localStorage.removeItem(SES_KEY);
  Acc.user = null;
  G.setSaveSlot(null);
  emit('logout');
}
export const localAccountCount = () => Object.keys(readAcc().users).length;

// usunięcie bohatera z konta (nowa postać) – dla kont online także kopia na serwerze
export async function wipeCharacter() {
  const u = Acc.user;
  if (u && u.mode === 'cloud') {
    const c = await client();
    await call(c.from('saves').delete().eq('user_id', u.id), 'Usuwanie postaci z serwera');
    Acc.dirty = false;
  }
  G.wipe();
}

// ——— Zapis w chmurze ———
async function pullCloud(slot) {
  const c = await client();
  const d = await call(c.from('saves').select('data').eq('user_id', Acc.user.id).maybeSingle(), 'Wczytywanie postaci');
  const remote = d && d.data;
  const local = parse(localStorage.getItem(slot), 'zapis konta');
  if (remote && (!local || (remote.savedAt || 0) >= (local.savedAt || 0))) { localStorage.setItem(slot, JSON.stringify(remote)); Acc.dirty = false; }
  else Acc.dirty = !!local; // lokalna kopia jest nowsza (np. przypisana postać) – zostanie wysłana
  Acc.lastSync = Date.now();
  Acc.syncError = '';
}
export async function pushCloud(force = false) {
  const u = Acc.user;
  if (!u || u.mode !== 'cloud' || !G.P || Acc.syncing) return false;
  if (!force && !Acc.dirty) return false;
  Acc.syncing = true;
  try {
    const c = await client();
    await call(c.from('saves').upsert({ user_id: u.id, data: G.P, updated_at: new Date().toISOString() }), 'Zapis postaci na serwerze');
    Acc.dirty = false;
    Acc.lastSync = Date.now();
    Acc.syncError = '';
    return true;
  } catch (e) {
    // błąd zostaje pokazany w Ustawieniach; kolejna próba nastąpi przy następnym cyklu zapisu
    console.error('Zapis postaci na serwerze nieudany', e);
    Acc.syncError = e.message;
    return false;
  } finally {
    Acc.syncing = false;
    emit('sync');
  }
}
let syncTimer = null;
export function startSync() {
  if (syncTimer) return;
  G.on('saved', () => { if (Acc.user && Acc.user.mode === 'cloud') Acc.dirty = true; });
  syncTimer = setInterval(() => { pushCloud(); }, CLOUD_SYNC_MS);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pushCloud(); });
}

// ——— Plik postaci (kopia zapasowa / przeniesienie na inne konto) ———
export function exportFile() {
  if (!G.P) throw new Error('Brak postaci do zapisania.');
  G.save();
  const P = G.P;
  const safe = P.name.replace(/[^\p{L}\p{N}_-]+/gu, '_');
  return { name: `fho_${safe}_poz${P.lvl}.json`, text: JSON.stringify({ game: FILE_TAG, v: 1, exported: Date.now(), data: P }) };
}
export async function importText(text) {
  const o = parse(text, 'plik postaci');
  const p = o && o.game === FILE_TAG ? o.data : null;
  if (!p || typeof p.name !== 'string' || !p.cls || !Number.isFinite(p.lvl) || !p.equip || !Array.isArray(p.bag)) throw new Error('Ten plik nie zawiera postaci z Fantasy Heroes Online.');
  p.savedAt = Date.now();
  G.replaceSave(p);
  if (Acc.user && Acc.user.mode === 'cloud') {
    G.load();
    Acc.dirty = true;
    if (!(await pushCloud(true))) throw new Error('Postać wczytana, ale nie udało się wysłać jej na serwer: ' + Acc.syncError);
  }
  return { name: p.name, lvl: p.lvl };
}
