// Testy VIP (1.8.2) po stronie gry: korzyści, synchronizacja z serwerem, paczki kryształów (raz na nadanie), wygaśnięcie,
// skórka VIP oraz operacje panelu administratora na atrapie serwera (również gdy na serwerze brakuje migracji).
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
const G = await import('../src/core/game.js');
const Net = await import('../src/net/online.js');
const { VIP, VIP_PERKS, vipBonusFor } = await import('../src/data/vip.js');
const { SKINS } = await import('../src/data/classes.js');
const F = await import('../src/core/formulas.js');
let fails = 0;
const assert = (c, m) => { if (c) console.log('ok  ', m); else { console.error('FAIL:', m); fails++; process.exitCode = 1; } };
const DAY = 86400000, H = 3600000;
const N = Net.Net;
const fresh = () => { G.wipe(); G.newPlayer({ name: 'Vip Tester', cls: 'mage', look: 0, hue: 0, aura: 0 }); return G.P; };
const iso = (ms) => new Date(ms).toISOString();

// ——— 1) korzyści ———
{
  const P = fresh();
  assert(!G.isVip() && G.bagSize() === F.BAG_SIZE && G.idleCapMs() === 12 * H && G.abyssKeysMax() === G.ABYSS_KEYS, 'bez VIP-a: zwykły plecak, Idle 12 h, 15 kluczy');
  assert(P.vip && P.vip.until === 0 && Array.isArray(P.vip.claimed), 'nowa postać ma pusty stan VIP');
  P.vip.until = Date.now() + 30 * DAY;
  assert(G.isVip() && G.bagSize() === F.BAG_SIZE + VIP.bag && G.idleCapMs() === VIP.idleHours * H && G.abyssKeysMax() === G.ABYSS_KEYS + VIP.abyssKeys, 'z VIP-em: plecak +10, Idle 16 h, +1 klucz');
  P.idleT = Date.now() - 20 * H;
  assert(Math.abs(G.idlePending().ms - 16 * H) < 1000 && G.idlePending().full, 'Idle VIP zbiera się do 16 h');
  P.vip.until = 0;
  assert(Math.abs(G.idlePending().ms - 12 * H) < 1000, 'bez VIP-a Idle zatrzymuje się na 12 h');
  P.vip.until = Date.now() + DAY;
  P.bag = [];
  for (let i = 0; i < F.BAG_SIZE + VIP.bag; i++) G.addItem(F.genItem({ lvl: 5, rarity: 1, cls: 'mage' }), true);
  assert(P.bag.length === 40, 'VIP mieści 40 przedmiotów w plecaku');
  P.vip.until = Date.now() - 1000;
  const g0 = P.gold;
  assert(G.addItem(F.genItem({ lvl: 5, rarity: 1, cls: 'mage' }), true) === false && P.bag.length === 40 && P.gold > g0, 'po wygaśnięciu przedmioty zostają, a nowe zwykłe są sprzedawane (pełny plecak)');
  assert(G.addItem(F.genItem({ lvl: 5, rarity: 4, cls: 'mage' }), true) && P.bag.length === 41, 'legendarne nadal trafiają do plecaka');
  P.abyss.day = 'wczoraj'; P.vip.until = Date.now() + DAY;
  G.tick(true);
  assert(P.abyss.keys === G.ABYSS_KEYS + 1, 'reset o północy z VIP-em daje 16 kluczy Otchłani');
  assert(VIP_PERKS.length === 6 && vipBonusFor(30) === 300 && vipBonusFor(366) === 1000 && vipBonusFor(0) === 0, 'opis korzyści i wyliczenie paczki zgodne z serwerem (10 💎/dzień, maks. 1000)');
}

// ——— 2) skórka VIP ———
{
  const P = fresh();
  assert(SKINS.vip && SKINS.vip.src === 'vip', 'skórka „Królewski VIP” istnieje');
  G.buySkin('vip');
  assert(P.skin === 'default', 'bez VIP-a skórki VIP nie da się założyć');
  P.vip.until = Date.now() + DAY;
  G.buySkin('vip');
  assert(P.skin === 'vip' && !P.skinsOwned.includes('vip'), 'z VIP-em skórka zakładana bez kupowania (nie trafia do kolekcji na stałe)');
  P.vip.until = Date.now() - 1; P.vip.active = true;
  G.tick(true);
  assert(P.skin === 'default' && P.vip.active === false, 'po wygaśnięciu VIP-a skórka wraca do klasycznej');
}

// ——— 3) synchronizacja z serwerem i paczki kryształów ———
{
  const P = fresh();
  const now = Date.now();
  P.created = now - 1000;
  N.uid = 'me-1';
  N.vipReady = null; N.vip = { 'me-1': now + 30 * DAY };
  assert(G.syncVip() === null && !G.isVip(), 'przed odpowiedzią serwera stan VIP się nie zmienia');
  N.vipReady = true;
  N.myVipLog = [{ id: 11, action: 'grant', days: 30, bonus: 300, until: iso(now + 30 * DAY), created_at: iso(now) }];
  const cr0 = P.crystals, keys0 = P.abyss.keys;
  const r1 = G.syncVip();
  assert(r1.now && !r1.was && r1.cr === 300 && P.crystals === cr0 + 300, 'nadanie: VIP aktywny i paczka +300 💎');
  assert(P.abyss.keys === keys0 + 1 && r1.keys === 1, 'w dniu nadania od razu +1 klucz Otchłani');
  const r2 = G.syncVip();
  assert(r2.cr === 0 && P.crystals === cr0 + 300 && P.abyss.keys === keys0 + 1, 'ponowna synchronizacja nie daje paczki ani klucza drugi raz');
  N.vip = { 'me-1': now + 40 * DAY };
  N.myVipLog = [{ id: 12, action: 'grant', days: 10, bonus: 100, until: iso(now + 40 * DAY), created_at: iso(now + 10) }, ...N.myVipLog];
  const r3 = G.syncVip();
  assert(r3.was && r3.now && r3.cr === 100 && P.crystals === cr0 + 400 && Math.abs(G.vipUntil() - (now + 40 * DAY)) < 5, 'przedłużenie: nowa data końca i paczka +100 💎');
  N.myVipLog = [{ id: 13, action: 'grant', days: 366, bonus: 999999, until: iso(now + 40 * DAY), created_at: iso(now + 20) }, { id: 14, action: 'revoke', days: 0, bonus: 0, until: iso(now), created_at: iso(now + 30) }, ...N.myVipLog];
  const r4 = G.syncVip();
  assert(r4.cr === VIP.crystalsMax, 'zawyżona paczka z serwera przycięta do 1000 💎');
  // nadanie sprzed utworzenia postaci nie daje kryształów nowej postaci
  const P2 = fresh();
  P2.created = now + 60000;
  N.myVipLog = [{ id: 21, action: 'grant', days: 30, bonus: 300, until: iso(now + 30 * DAY), created_at: iso(now) }];
  const c2 = P2.crystals;
  G.syncVip(now + 61000);
  assert(P2.crystals === c2 && G.isVip(now + 61000), 'nowa postać ma VIP-a konta, ale nie odbiera ponownie starej paczki');
  // odebranie VIP-a na serwerze
  P2.skin = 'vip';
  N.vip = {};
  const toasts = [];
  const offToast = G.on('toast', (msg) => toasts.push(msg));
  const r5 = G.syncVip(now + 62000);
  if (typeof offToast === 'function') offToast();
  assert(r5.was && !r5.now && !G.isVip() && P2.skin === 'default' && P2.vip.active === false, 'odebranie na serwerze: VIP znika, skórka zdjęta');
  assert(toasts.some((m) => /VIP został zakończony/.test(String(m))), 'gracz dostaje komunikat o zakończeniu VIP-a');
  // brak migracji: zapamiętany stan zostaje (np. chwilowy błąd serwera)
  P2.vip.until = now + DAY; P2.vip.active = true;
  N.vipReady = false;
  assert(G.syncVip() === null && G.isVip(), 'bez tabel VIP na serwerze synchronizacja nic nie zmienia');
  // plakietka przy nicku
  N.vipReady = true; N.vip = { other: now + DAY, gone: now - DAY };
  assert(G.isVipId('other') && !G.isVipId('gone') && !G.isVipId('nobody') && G.isVipId('me') === G.isVip(), 'plakietka VIP: aktywni gracze z serwera i własny status');
  N.uid = null; N.vip = {}; N.myVipLog = []; N.vipReady = null;
}

// ——— 4) warstwa sieci: odczyt VIP i operacje administratora (atrapa serwera) ———
function fakeServer({ missing = false } = {}) {
  const S = { vip: [], vip_log: [], players: [{ id: 'p1', name: 'Rycerz', cls: 'paladin', lvl: 40 }, { id: 'p2', name: 'Łucznik', cls: 'archer', lvl: 12 }], rpc: [] };
  const err = (code, message) => ({ data: null, error: { code, message } });
  const q = (name) => {
    const st = { f: [] };
    const run = () => {
      if (missing && (name === 'vip' || name === 'vip_log')) return err('PGRST205', `Could not find the table 'public.${name}' in the schema cache`);
      let rows = (S[name] || []).filter((r) => st.f.every(([op, c, v]) => (op === 'eq' ? r[c] === v : op === 'gt' ? r[c] > v : op === 'in' ? v.includes(r[c]) : true)));
      if (st.lim) rows = rows.slice(0, st.lim);
      return { data: rows.map((r) => ({ ...r })), error: null };
    };
    const b = {
      select: () => b, eq: (c, v) => (st.f.push(['eq', c, v]), b), gt: (c, v) => (st.f.push(['gt', c, v]), b), in: (c, v) => (st.f.push(['in', c, v]), b),
      order: () => b, limit: (n) => (st.lim = n, b), then: (res, rej) => { try { res(run()); } catch (e) { rej(e); } },
    };
    return b;
  };
  let seq = 0;
  const rpc = async (fn, args) => {
    S.rpc.push([fn, args]);
    if (missing) return err('PGRST202', `Could not find the function public.${fn}(p_days, p_reason, p_user) in the schema cache`);
    if (S.notAdmin) return err('P0001', 'NOT_ADMIN');
    if (fn === 'admin_grant_vip') {
      if (!S.players.some((p) => p.id === args.p_user)) return err('P0001', 'VIP_NO_USER');
      const cur = S.vip.find((v) => v.user_id === args.p_user);
      const base = Math.max(Date.now(), cur ? new Date(cur.until).getTime() : 0);
      const until = iso(base + args.p_days * DAY);
      if (cur) cur.until = until; else S.vip.push({ user_id: args.p_user, until });
      S.vip_log.push({ id: ++seq, user_id: args.p_user, action: 'grant', days: args.p_days, bonus: Math.min(1000, args.p_days * 10), until, reason: args.p_reason, created_at: iso(Date.now()) });
      return { data: until, error: null };
    }
    if (fn === 'admin_revoke_vip') {
      const cur = S.vip.find((v) => v.user_id === args.p_user && new Date(v.until).getTime() > Date.now());
      if (!cur) return err('P0001', 'VIP_NOT_ACTIVE');
      cur.until = iso(Date.now() - 1);
      S.vip_log.push({ id: ++seq, user_id: args.p_user, action: 'revoke', days: 0, bonus: 0, until: cur.until, reason: args.p_reason, created_at: iso(Date.now()) });
      return { data: null, error: null };
    }
    return err('PGRST202', 'unknown');
  };
  return { S, client: { from: q, rpc } };
}
{
  const A = Net.Admin;
  let sb = fakeServer({ missing: true });
  N.client = sb.client; N.uid = 'admin-1';
  let warned = 0; const ow = console.warn; console.warn = () => { warned++; };
  await Net.loadVip(); await Net.loadVip();
  console.warn = ow;
  assert(N.vipReady === false && Object.keys(N.vip).length === 0 && warned === 1, 'brak tabel VIP: gra działa dalej, jedno ostrzeżenie w konsoli');
  assert((await A.vipList()) === null, 'panel: brak migracji zgłaszany jako null (komunikat w panelu)');
  let e = '';
  try { await A.grantVip('p1', 30); } catch (x) { e = x.message; }
  assert(/supabase\/vip_1\.8\.2\.sql/.test(e), `nadanie bez migracji – czytelny komunikat (${e})`);

  sb = fakeServer();
  N.client = sb.client;
  await Net.loadVip();
  assert(N.vipReady === true && Object.keys(N.vip).length === 0, 'po migracji: tabela VIP pusta');
  const u1 = await A.grantVip('p1', 30, '  Konkurs Discord  ');
  assert(Math.abs(u1 - (Date.now() + 30 * DAY)) < 2000 && Net.vipUntil('p1') === u1, 'nadanie 30 dni: status od razu widoczny (vipUntil)');
  const call = sb.S.rpc.at(-1);
  assert(call[0] === 'admin_grant_vip' && call[1].p_user === 'p1' && call[1].p_days === 30 && call[1].p_reason === 'Konkurs Discord', 'wywołanie funkcji serwera z poprawnymi argumentami (powód bez spacji)');
  const u2 = await A.grantVip('p1', 10);
  assert(Math.abs(u2 - u1 - 10 * DAY) < 2000 && sb.S.rpc.at(-1)[1].p_reason === null, 'przedłużenie +10 dni od końca obecnego VIP-a, pusty powód jako null');
  const before = sb.S.rpc.length;
  for (const d of [0, 367, 'abc', -5]) { e = ''; try { await A.grantVip('p2', d); } catch (x) { e = x.message; } assert(/od 1 do 366/.test(e), `niepoprawna liczba dni (${d}) odrzucona w kliencie`); }
  assert(sb.S.rpc.length === before, 'niepoprawne dni nie trafiają na serwer');
  e = ''; try { await A.grantVip('nikt', 5); } catch (x) { e = x.message; }
  assert(e === 'Taki gracz nie istnieje.', 'błąd serwera VIP_NO_USER przetłumaczony');
  const list = await A.vipList();
  assert(list.length === 1 && list[0].name === 'Rycerz' && list[0].cls === 'paladin' && list[0].until === u2, 'lista aktywnych VIP-ów z nazwami graczy');
  const hist = await A.vipHistory('p1');
  assert(hist.length === 2 && hist[0].bonus === 300 && hist[1].bonus === 100, 'historia nadań gracza');
  await A.revokeVip('p1', 'Naruszenie');
  assert(Net.vipUntil('p1') === 0 && (await A.vipList()).length === 0, 'odebranie: VIP znika z listy i z plakietek');
  e = ''; try { await A.revokeVip('p1'); } catch (x) { e = x.message; }
  assert(e === 'Ten gracz nie ma aktywnego VIP-a.', 'ponowne odebranie – czytelny błąd');
  sb.S.notAdmin = true;
  e = ''; try { await A.grantVip('p2', 7); } catch (x) { e = x.message; }
  assert(e === 'Brak uprawnień administratora.', 'serwer odrzuca osobę bez uprawnień');
  // gracz dostaje paczkę po synchronizacji (zdarzenie 'vip' z warstwy sieci)
  sb.S.notAdmin = false;
  const P = fresh(); P.created = Date.now() - 1000;
  N.uid = 'p2';
  const crBefore = P.crystals;
  await A.grantVip('p2', 7, 'Discord'); // grantVip odświeża stan VIP → zdarzenie 'vip' → syncVip()
  assert(G.isVip() && P.crystals === crBefore + 70 && P.vip.claimed.length === 1, 'gracz z nadanym VIP-em po odświeżeniu: aktywny VIP i paczka +70 💎');
  await Net.loadVip();
  assert(P.crystals === crBefore + 70, 'paczka odebrana tylko raz');
  N.client = null; N.uid = null; N.vip = {}; N.myVipLog = []; N.vipReady = null;
}

console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystkie testy VIP OK');
