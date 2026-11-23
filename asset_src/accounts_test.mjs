// Testy kont graczy: konta lokalne (przeglądarka) i konta online (atrapa Supabase Auth + tabela saves)
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
const G = await import('../src/core/game.js');
const Net = await import('../src/net/online.js');
const A = await import('../src/core/accounts.js');
let fails = 0;
const assert = (c, m) => { if (c) console.log('ok  ', m); else { console.error('FAIL:', m); fails++; } };
async function rejects(fn, re, m) {
  try { await fn(); assert(false, m + ' (brak błędu)'); } catch (e) { assert(re.test(e.message), `${m} → „${e.message}”`); }
}
const hero = (name, cls = 'warrior') => G.newPlayer({ name, cls, look: 0, hue: 0, aura: 0 });
const L = 'local';

// ——— Konta lokalne ———
await rejects(() => A.register({ login: 'ab', password: 'tajne123', password2: 'tajne123', mode: L }), /Login/, 'za krótki login odrzucony');
await rejects(() => A.register({ login: 'zbyszko', password: '123', password2: '123', mode: L }), /co najmniej 6/, 'za krótkie hasło odrzucone');
await rejects(() => A.register({ login: 'zbyszko', password: 'tajne123', password2: 'tajne124', mode: L }), /nie są takie same/, 'różne hasła odrzucone');

const r1 = await A.register({ login: 'Zbyszko', password: 'tajne123', password2: 'tajne123', mode: L });
assert(r1.user.login === 'Zbyszko' && A.Acc.user.mode === 'local', 'rejestracja konta lokalnego');
assert(G.saveSlot().endsWith(':l:zbyszko') && !G.hasSave(), 'konto ma własny, pusty slot zapisu');
assert(!localStorage.getItem('fho_accounts_v1').includes('tajne123'), 'hasło nie jest zapisane jawnym tekstem');
hero('Zbyszko Groźny');
G.P.gold = 777; G.save();
assert(G.hasSave() && !localStorage.getItem(G.GUEST_SAVE_KEY), 'bohater zapisany w slocie konta');
await A.logout();
assert(A.Acc.user === null && G.saveSlot() === G.GUEST_SAVE_KEY && G.P === null, 'wylogowanie czyści sesję');
await rejects(() => A.register({ login: 'ZBYSZKO', password: 'inne123', password2: 'inne123', mode: L }), /zajęty/, 'login zajęty (bez względu na wielkość liter)');
await rejects(() => A.login({ login: 'zbyszko', password: 'zle-haslo', mode: L }), /Nieprawidłowy login lub hasło/, 'złe hasło odrzucone');
await A.login({ login: 'zbyszko', password: 'tajne123', mode: L });
assert(G.load() && G.P.name === 'Zbyszko Groźny' && G.P.gold === 777, 'logowanie wczytuje bohatera konta');

await A.logout();
await A.register({ login: 'ania', password: 'haslo456', password2: 'haslo456', mode: L });
assert(!G.hasSave(), 'drugie konto nie widzi bohatera pierwszego');
hero('Ania Łuczniczka', 'archer');
// „odświeżenie strony”
G.setSaveSlot(null); A.Acc.user = null;
const back = await A.restore();
assert(back && back.login === 'ania' && G.load().name === 'Ania Łuczniczka', 'sesja przywrócona po odświeżeniu strony');

await rejects(() => A.changePassword({ old: 'zle', password: 'nowe789', password2: 'nowe789' }), /Obecne hasło/, 'zmiana hasła wymaga obecnego hasła');
await A.changePassword({ old: 'haslo456', password: 'nowe789', password2: 'nowe789' });
await A.logout();
await rejects(() => A.login({ login: 'ania', password: 'haslo456', mode: L }), /Nieprawidłowy/, 'stare hasło już nie działa');
await A.login({ login: 'ania', password: 'nowe789', mode: L });
assert(A.Acc.user.login === 'ania', 'logowanie nowym hasłem');

// plik postaci: eksport z konta „zbyszko” → import na konto „ania”
await A.logout();
await A.login({ login: 'zbyszko', password: 'tajne123', mode: L });
G.load();
const file = A.exportFile();
assert(file.name.startsWith('fho_Zbyszko') && file.text.includes('"game":"fantasy_heroes_online"'), 'eksport pliku postaci');
await A.logout();
await A.login({ login: 'ania', password: 'nowe789', mode: L });
await rejects(() => A.importText('{"x":1}'), /nie zawiera postaci/, 'zły plik odrzucony');
await A.importText(file.text);
assert(G.load().name === 'Zbyszko Groźny' && G.P.gold === 777, 'import pliku podmienia bohatera konta');

// bohater bez konta (starszy zapis) przypisywany do nowego konta
await A.logout();
hero('Gość Bez Konta');
assert(A.guestInfo() && A.guestInfo().name === 'Gość Bez Konta', 'wykryto bohatera bez konta');
await A.register({ login: 'gosc', password: 'gosc123', password2: 'gosc123', mode: L, attach: true });
assert(G.load().name === 'Gość Bez Konta' && !A.guestInfo(), 'bohater bez konta przypisany do nowego konta');

await rejects(() => A.deleteLocalAccount('zle'), /Nieprawidłowe hasło/, 'usunięcie konta wymaga hasła');
await A.deleteLocalAccount('gosc123');
assert(A.Acc.user === null && A.localAccountCount() === 2, 'konto lokalne usunięte');
await rejects(() => A.login({ login: 'gosc', password: 'gosc123', mode: L }), /Nieprawidłowy/, 'usunięte konto nie loguje');

// ——— Konta online (atrapa Supabase) ———
function fakeSupabase() {
  const users = {}; const saves = {}; let session = null; let n = 0;
  const S = { confirm: false };
  const ok = (data) => Promise.resolve({ data, error: null });
  const fail = (message) => Promise.resolve({ data: null, error: { message } });
  const client = {
    auth: {
      getSession: () => ok({ session }),
      signUp: ({ email, password }) => {
        if (users[email]) return fail('User already registered');
        const u = { id: 'uid-' + (++n), email, is_anonymous: false };
        users[email] = { u, password };
        if (S.confirm) return ok({ user: u, session: null });
        session = { user: u };
        return ok({ user: u, session });
      },
      signInWithPassword: ({ email, password }) => {
        const r = users[email];
        if (!r || r.password !== password) return fail('Invalid login credentials');
        session = { user: r.u };
        return ok({ user: r.u, session });
      },
      signOut: () => { session = null; return ok({}); },
      updateUser: ({ password }) => { users[session.user.email].password = password; return ok({ user: session.user }); },
    },
    from(table) {
      const q = {};
      const exec = () => {
        if (table !== 'saves') return fail('unknown table');
        if (!session) return fail('JWT required');
        if (q.op === 'select') return ok(saves[q.id] ? { data: structuredClone(saves[q.id].data) } : null);
        if (q.op === 'upsert') {
          if (q.row.user_id !== session.user.id) return fail('new row violates row-level security policy');
          saves[q.row.user_id] = structuredClone(q.row);
          return ok(null);
        }
        if (q.op === 'delete') { if (q.id === session.user.id) delete saves[q.id]; return ok(null); }
        return fail('bad op');
      };
      const b = {
        select() { q.op = 'select'; return b; },
        upsert(row) { q.op = 'upsert'; q.row = row; return b; },
        delete() { q.op = 'delete'; return b; },
        eq(k, v) { q.id = v; return b; },
        maybeSingle() { return b; },
        then(res, rej) { return exec().then(res, rej); },
      };
      return b;
    },
  };
  return { client, saves, S };
}
const cfg = { url: 'https://test-projekt.supabase.co', anonKey: 'publiczny-klucz-testowy' };
Net.saveConfig(cfg);
const sb = fakeSupabase();
Net.setClientForTests(cfg, sb.client);
A.startSync();
assert(A.cloudAvailable(), 'serwer skonfigurowany → konta online dostępne');
const C = 'cloud';
await rejects(() => A.register({ login: 'zly-email', password: 'tajne123', password2: 'tajne123', mode: C }), /e-mail/, 'niepoprawny e-mail odrzucony');
const rc = await A.register({ login: 'Gracz@Test.pl', password: 'tajne123', password2: 'tajne123', mode: C });
assert(rc.user.mode === 'cloud' && rc.user.email === 'gracz@test.pl', 'rejestracja konta online');
assert(G.saveSlot().includes(':c:uid-1') && !G.hasSave(), 'konto online ma własny slot');
hero('Rycerz Chmur', 'paladin');
G.P.gold = 4242; G.save();
assert(A.Acc.dirty, 'zapis gry oznacza zmianę do wysłania na serwer');
assert(await A.pushCloud() && sb.saves['uid-1'] && sb.saves['uid-1'].data.name === 'Rycerz Chmur', 'bohater wysłany na serwer (tabela saves)');
await rejects(() => A.register({ login: 'inny@test.pl', password: 'tajne123', password2: 'tajne123', mode: C }), /wyloguj/, 'rejestracja zablokowana, gdy ktoś jest zalogowany');
G.P.gold = 4242; G.save();

await A.logout();
assert(!A.Acc.syncError && !Object.keys(localStorage._s).some((k) => k.includes(':c:uid-1')), 'po wylogowaniu kopia bohatera nie zostaje w przeglądarce');
await rejects(() => A.register({ login: 'gracz@test.pl', password: 'tajne123', password2: 'tajne123', mode: C }), /już istnieje/, 'drugie konto na ten sam e-mail odrzucone');
await rejects(() => A.login({ login: 'gracz@test.pl', password: 'zle-haslo', mode: C }), /Nieprawidłowy e-mail lub hasło/, 'złe hasło konta online odrzucone');
// „inne urządzenie”: pusty localStorage przeglądarki, logowanie pobiera bohatera z serwera
await A.login({ login: 'gracz@test.pl', password: 'tajne123', mode: C });
assert(G.load() && G.P.name === 'Rycerz Chmur' && G.P.gold === 4242, 'logowanie na innym urządzeniu wczytuje bohatera z serwera');
G.setSaveSlot(null); A.Acc.user = null;
const backC = await A.restore();
assert(backC && backC.mode === 'cloud' && G.load().name === 'Rycerz Chmur', 'sesja online przywrócona po odświeżeniu');

await A.changePassword({ old: 'tajne123', password: 'nowe-haslo', password2: 'nowe-haslo' });
await A.logout();
await A.login({ login: 'gracz@test.pl', password: 'nowe-haslo', mode: C });
assert(A.Acc.user.email === 'gracz@test.pl', 'zmiana hasła konta online');

await A.wipeCharacter();
assert(!sb.saves['uid-1'] && !G.hasSave(), 'nowa postać usuwa bohatera także z serwera');

await A.logout();
sb.S.confirm = true;
const rConf = await A.register({ login: 'nowy@test.pl', password: 'tajne123', password2: 'tajne123', mode: C });
assert(rConf.needConfirm === true, 'gdy serwer wymaga potwierdzenia e-mail – komunikat o linku');

console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystkie testy kont OK');
process.exit(fails ? 1 : 0);
