// Testy prezentów (1.8.3) po stronie gry: walidacja wysyłki, odbiór w dokładnej kwocie (bez mnożników eventów), tylko raz,
// blokada podwójnego odbioru oraz operacje panelu administratora na atrapie serwera (również gdy brakuje migracji).
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
const G = await import('../src/core/game.js');
const Net = await import('../src/net/online.js');
const { GIFT, GIFT_GOLD_PRESETS, GIFT_CRYSTAL_PRESETS, validateGift, giftLabel, giftTotals } = await import('../src/data/gifts.js');
let fails = 0;
const assert = (c, m) => { if (c) console.log('ok  ', m); else { console.error('FAIL:', m); fails++; process.exitCode = 1; } };
const N = Net.Net;
const iso = (ms) => new Date(ms).toISOString();
const fresh = () => { G.wipe(); G.newPlayer({ name: 'Gift Tester', cls: 'warrior', look: 0, hue: 0, aura: 0 }); return G.P; };

// ——— 1) walidacja i opisy ———
{
  assert(GIFT.maxGold === 100000000 && GIFT.maxCrystals === 10000 && GIFT.maxRecipients === 5000, 'limity zgodne z serwerem (100 mln zł, 10 000 💎, 5000 odbiorców)');
  assert(GIFT_GOLD_PRESETS.every((v) => v <= GIFT.maxGold) && GIFT_CRYSTAL_PRESETS.every((v) => v <= GIFT.maxCrystals), 'gotowe kwoty mieszczą się w limitach');
  assert(validateGift({ gold: 1000, crystals: 0, recipients: 1 }) === null, 'samo złoto – poprawne');
  assert(validateGift({ gold: '', crystals: '100', recipients: 3 }) === null, 'same kryształy (tekst z pola) – poprawne');
  assert(validateGift({ gold: 0, crystals: 0, recipients: 1 }) === 'Podaj ilość złota lub kryształów.', 'pusty prezent odrzucony');
  assert(/Złoto/.test(validateGift({ gold: -1, crystals: 5, recipients: 1 })), 'ujemne złoto odrzucone');
  assert(/Złoto/.test(validateGift({ gold: 1.5, crystals: 0, recipients: 1 })), 'ułamkowe złoto odrzucone');
  assert(/Złoto/.test(validateGift({ gold: GIFT.maxGold + 1, crystals: 0, recipients: 1 })), 'za dużo złota odrzucone');
  assert(/Kryształy/.test(validateGift({ gold: 0, crystals: 10001, recipients: 1 })), 'za dużo kryształów odrzucone');
  assert(/Kryształy/.test(validateGift({ gold: 0, crystals: 'abc', recipients: 1 })), 'tekst zamiast liczby odrzucony');
  assert(validateGift({ gold: 0, crystals: 10000, recipients: 1 }) === null, 'maksymalne 10 000 💎 dozwolone');
  assert(/co najmniej jednego/.test(validateGift({ gold: 10, crystals: 0, recipients: 0 })), 'brak odbiorców odrzucony');
  assert(/5000/.test(validateGift({ gold: 10, crystals: 0, recipients: 5001 })), 'ponad 5000 odbiorców odrzucone');
  assert(giftLabel(10000, 100).replace(/\s/g, ' ') === '10 000 zł + 100 💎' && giftLabel(0, 5) === '5 💎' && giftLabel(0, 0) === '—', 'opis prezentu („10 000 zł + 100 💎”)');
  const t = giftTotals([{ gold: 100, crystals: 5 }, { gold: '50', crystals: null }, { gold: -10, crystals: 2.7 }]);
  assert(t.gold === 150 && t.crystals === 7 && t.count === 3, 'suma prezentów odporna na złe dane (ujemne → 0, ułamki w dół)');
}

// ——— 2) odbiór w grze: dokładna kwota, bez mnożników, tylko raz ———
{
  const P = fresh();
  N.live = [{ kind: 'gold', start_at: iso(Date.now() - 60000), end_at: iso(Date.now() + 3600000) }, { kind: 'crystal', start_at: iso(Date.now() - 60000), end_at: iso(Date.now() + 3600000) }];
  const g0 = P.gold, c0 = P.crystals;
  const r = G.applyGifts([{ id: 1, gold: 5000, crystals: 100 }, { id: 2, gold: 0, crystals: 50 }]);
  assert(r.count === 2 && P.gold === g0 + 5000 && P.crystals === c0 + 150, 'odbiór: dokładnie +5000 zł i +150 💎 mimo aktywnych eventów złota/kryształów');
  assert(P.gifts.claimed.includes(1) && P.gifts.claimed.includes(2) && P.gifts.gold === 5000 && P.gifts.crystals === 150, 'zapis odebranych prezentów w postaci');
  const r2 = G.applyGifts([{ id: 1, gold: 5000, crystals: 100 }]);
  assert(r2.count === 0 && P.gold === g0 + 5000 && P.crystals === c0 + 150, 'ten sam prezent nie zostanie dodany drugi raz');
  const r3 = G.applyGifts([{ id: 3, gold: 1, crystals: 0 }, null, { gold: 999 }]);
  assert(r3.count === 1 && P.gold === g0 + 5001, 'wiersze bez id są pomijane');
  N.live = [];
  // migracja starego zapisu
  const P2 = fresh(); delete P2.gifts; G.save();
  G.load && G.load();
  assert(G.P.gifts && Array.isArray(G.P.gifts.claimed), 'stary zapis bez sekcji prezentów dostaje pusty stan');
}

// ——— 3) warstwa sieci na atrapie serwera ———
function fakeServer({ missing = false } = {}) {
  const S = { gifts: [], players: [{ id: 'me', name: 'Admin', cls: 'mage', lvl: 50 }, { id: 'p1', name: 'Rycerz', cls: 'paladin', lvl: 40 }, { id: 'p2', name: 'Łucznik', cls: 'archer', lvl: 12 }], rpc: [], notAdmin: false, uid: 'me' };
  const err = (code, message) => ({ data: null, error: { code, message } });
  let seq = 0, bseq = 0;
  const q = (name) => {
    const st = { f: [], head: false };
    const run = () => {
      if (missing && name === 'gifts') return err('PGRST205', "Could not find the table 'public.gifts' in the schema cache");
      let rows = (S[name] || []).filter((r) => st.f.every(([op, c, v]) => (op === 'eq' ? r[c] === v : op === 'is' ? (r[c] ?? null) === v : true)));
      if (name === 'gifts') rows = rows.filter((r) => r.user_id === S.uid); // RLS: tylko własne
      if (st.head) return { data: null, count: rows.length, error: null };
      if (st.lim) rows = rows.slice(0, st.lim);
      return { data: rows.map((r) => ({ ...r })), error: null };
    };
    const b = {
      select: (_c, o) => { if (o && o.head) st.head = true; return b; }, eq: (c, v) => (st.f.push(['eq', c, v]), b), is: (c, v) => (st.f.push(['is', c, v]), b),
      ilike: () => b, order: () => b, limit: (n) => (st.lim = n, b), then: (res, rej) => { try { res(run()); } catch (e) { rej(e); } },
    };
    return b;
  };
  const rpc = async (fn, args) => {
    S.rpc.push([fn, args]);
    if (missing) return err('PGRST202', `Could not find the function public.${fn} in the schema cache`);
    if (fn === 'claim_gifts') {
      const mine = S.gifts.filter((g) => g.user_id === S.uid && !g.claimed_at);
      mine.forEach((g) => { g.claimed_at = iso(Date.now()); });
      return { data: mine.map((g) => ({ ...g })), error: null };
    }
    if (S.notAdmin) return err('P0001', 'NOT_ADMIN');
    if (fn === 'admin_send_gift') {
      const ids = args.p_all ? S.players.map((p) => p.id) : args.p_users || [];
      if (!ids.length) return err('P0001', 'GIFT_NO_USERS');
      if (ids.some((id) => !S.players.some((p) => p.id === id))) return err('P0001', 'GIFT_NO_USER');
      const batch = `b${++bseq}`;
      ids.forEach((id) => S.gifts.push({ id: ++seq, batch, user_id: id, gold: args.p_gold, crystals: args.p_crystals, message: args.p_message, reason: args.p_reason, created_at: iso(Date.now()), claimed_at: null }));
      return { data: { batch, count: ids.length }, error: null };
    }
    if (fn === 'admin_gift_history') {
      const by = {};
      S.gifts.forEach((g) => { (by[g.batch] = by[g.batch] || []).push(g); });
      return { data: Object.entries(by).reverse().map(([batch, list]) => ({ batch, gold: String(list[0].gold), crystals: list[0].crystals, message: list[0].message, reason: list[0].reason, created_at: list[0].created_at, recipients: list.length, claimed: list.filter((g) => g.claimed_at).length, names: list.map((g) => S.players.find((p) => p.id === g.user_id).name) })), error: null };
    }
    if (fn === 'admin_cancel_gift') {
      const before = S.gifts.length;
      S.gifts = S.gifts.filter((g) => !(g.batch === args.p_batch && !g.claimed_at));
      return { data: before - S.gifts.length, error: null };
    }
    return err('PGRST202', 'unknown');
  };
  return { S, client: { from: q, rpc } };
}
{
  const A = Net.Admin;
  // brak migracji
  let sb = fakeServer({ missing: true });
  N.client = sb.client; N.uid = 'me'; N.giftsReady = null;
  let warned = 0; const ow = console.warn; console.warn = () => { warned++; };
  await Net.loadGifts(); await Net.loadGifts();
  console.warn = ow;
  assert(N.giftsReady === false && G.pendingGifts().length === 0 && warned === 1, 'brak tabeli prezentów: gra działa dalej, jedno ostrzeżenie');
  assert((await A.giftHistory()) === null, 'panel: brak migracji zgłaszany jako null (baner w panelu)');
  let e = '';
  try { await A.sendGift({ users: ['p1'], gold: 100 }); } catch (x) { e = x.message; }
  assert(/supabase\/gifts_1\.8\.3\.sql/.test(e), `wysyłka bez migracji – czytelny komunikat (${e})`);

  // po migracji
  sb = fakeServer();
  N.client = sb.client;
  await Net.loadGifts();
  assert(N.giftsReady === true && G.pendingGifts().length === 0, 'po migracji: brak prezentów');
  assert((await A.playerCount()) === 3, 'liczba wszystkich graczy (dla „Wszyscy gracze”)');
  const before = sb.S.rpc.length;
  for (const bad of [{ users: [], gold: 10 }, { users: ['p1'], gold: 0, crystals: 0 }, { users: ['p1'], crystals: 20000 }, { users: ['p1'], gold: -5 }]) {
    e = ''; try { await A.sendGift(bad); } catch (x) { e = x.message; }
    assert(e.length > 0, `niepoprawna wysyłka odrzucona w kliencie: ${e}`);
  }
  assert(sb.S.rpc.length === before, 'niepoprawne wysyłki nie trafiają na serwer');
  const r1 = await A.sendGift({ users: ['p1', 'p2', 'p1', '', null], gold: '1000', crystals: '50', message: '  Event Discord – dzięki!  ', reason: '  Turniej 12.12 ' });
  const c1 = sb.S.rpc.at(-1);
  assert(r1.count === 2 && c1[0] === 'admin_send_gift' && c1[1].p_users.length === 2 && c1[1].p_all === false, 'wysyłka do 2 wybranych graczy (duplikaty i puste id usunięte)');
  assert(c1[1].p_gold === 1000 && c1[1].p_crystals === 50 && c1[1].p_message === 'Event Discord – dzięki!' && c1[1].p_reason === 'Turniej 12.12', 'kwoty jako liczby, wiadomość i powód bez spacji');
  const r2 = await A.sendGift({ all: true, crystals: 10000, message: '' });
  const c2 = sb.S.rpc.at(-1);
  assert(r2.count === 3 && c2[1].p_all === true && c2[1].p_users === null && c2[1].p_message === null, '„Wszyscy gracze”: p_all=true, pusta wiadomość jako null');
  assert(G.pendingGifts().length === 1 && G.pendingGifts()[0].crystals === 10000, 'administrator jako odbiorca od razu widzi własny prezent');
  e = ''; try { await A.sendGift({ users: ['nikt'], gold: 1 }); } catch (x) { e = x.message; }
  assert(e === 'Któryś z wybranych graczy już nie istnieje – odśwież listę.', 'błąd GIFT_NO_USER przetłumaczony');
  let hist = await A.giftHistory();
  assert(hist.length === 2 && hist[0].recipients === 3 && hist[1].recipients === 2 && hist[1].gold === 1000 && typeof hist[1].gold === 'number', 'historia wysyłek pogrupowana (kwoty jako liczby)');
  assert(hist[1].names.join(',') === 'Rycerz,Łucznik' && hist[1].message === 'Event Discord – dzięki!' && hist[1].claimed === 0, 'historia: odbiorcy, wiadomość, liczba odebranych');

  // odbiór przez gracza p1 (osobna sesja)
  const P = fresh();
  sb.S.uid = 'p1'; N.uid = 'p1';
  const events = [];
  const off = G.on('gifts', (list) => events.push(list.length));
  await Net.loadGifts();
  assert(G.pendingGifts().length === 2 && events.at(-1) === 2, 'gracz widzi 2 nieodebrane prezenty (zdarzenie „gifts” dla przycisku 🎁)');
  const g0 = P.gold, cr0 = P.crystals;
  const [a, b] = await Promise.all([G.claimGifts(), G.claimGifts()]);
  assert(a === b && a.count === 2 && P.gold === g0 + 1000 && P.crystals === cr0 + 10050, 'podwójne kliknięcie „Odbierz” – jeden odbiór: +1000 zł, +10 050 💎');
  assert(G.pendingGifts().length === 0 && sb.S.rpc.filter(([fn]) => fn === 'claim_gifts').length === 1, 'po odbiorze lista pusta, serwer wywołany raz');
  const again = await G.claimGifts();
  assert(again.count === 0 && P.gold === g0 + 1000, 'ponowny odbiór nic nie dodaje');
  if (typeof off === 'function') off();

  // anulowanie nieodebranych + brak uprawnień
  sb.S.uid = 'me'; N.uid = 'me';
  hist = await A.giftHistory();
  const all = hist.find((h) => h.recipients === 3);
  assert(all.claimed === 1, 'historia: 1 z 3 odebrał prezent dla wszystkich');
  const removed = await A.cancelGift(all.batch);
  assert(removed === 2 && sb.S.gifts.filter((g) => g.batch === all.batch).length === 1, 'anulowanie usuwa tylko nieodebrane prezenty');
  sb.S.notAdmin = true;
  for (const [label, fn] of [['wysyłka', () => A.sendGift({ users: ['p2'], gold: 5 })], ['historia', () => A.giftHistory()], ['anulowanie', () => A.cancelGift('b1')]]) {
    e = ''; try { await fn(); } catch (x) { e = x.message; }
    assert(e === 'Brak uprawnień administratora.', `serwer odrzuca osobę bez uprawnień (${label})`);
  }
  N.client = null; N.uid = null; N.gifts = []; N.giftsReady = null;
  e = ''; try { await Net.claimGifts(); } catch (x) { e = x.message; }
  assert(/połączeniu z serwerem/.test(e), 'bez serwera odbiór zgłasza czytelny błąd');
}

console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystkie testy prezentów OK');
