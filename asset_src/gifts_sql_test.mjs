// Test migracji prezentów (supabase/gifts_1.8.3.sql) na prawdziwym Postgresie (PGlite) z atrapą schematu auth z Supabase
// i prawdziwą ochroną zapisów ze schema.sql: tylko administrator wysyła/anuluje/przegląda historię, RLS, odbiór raz,
// prezent kryształów nie zostaje odrzucony przez ochronę przed oszustwami.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

let fails = 0;
const assert = (c, m) => { if (c) console.log('ok  ', m); else { console.error('FAIL:', m); fails++; process.exitCode = 1; } };
const root = new URL('../supabase/', import.meta.url);
const giftSql = readFileSync(new URL('gifts_1.8.3.sql', root), 'utf8');
const schema = readFileSync(new URL('schema.sql', root), 'utf8');
const block = (s) => { const a = s.indexOf('-- >>> PREZENTY 1.8.3'), b = s.indexOf('-- <<< PREZENTY 1.8.3'); return a >= 0 && b > a ? s.slice(a, b).replace(/\r\n/g, '\n') : null; };
assert(block(giftSql) && block(giftSql) === block(schema), 'blok prezentów w schema.sql jest identyczny z plikiem migracji');
const cut = (from, to) => schema.slice(schema.indexOf(from), schema.indexOf(to));
const adminsSql = cut('-- ——— Administratorzy', '-- konto administratora gry');
const guardSql = cut('-- ——— Ochrona przed oszustwami ———', '-- limit siły na poziomie');
assert(/fho_saves_guard/.test(guardSql) && /is_admin/.test(adminsSql), 'ochrona zapisów i is_admin() pobrane ze schema.sql');

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create table public.saves (user_id uuid primary key references auth.users(id) on delete cascade, data jsonb not null, updated_at timestamptz not null default now());
  create table public.players (id uuid primary key references auth.users(id) on delete cascade, name text not null);
`);
await db.exec(adminsSql);
await db.exec(guardSql);
await db.exec(giftSql);
await db.exec(giftSql); // migracja powtarzalna
assert(true, 'migracja uruchomiona dwukrotnie bez błędów');

const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b', C = '00000000-0000-4000-8000-00000000000c', D = '00000000-0000-4000-8000-00000000000d', X = '00000000-0000-4000-8000-0000000000ff';
await db.exec(`insert into auth.users (id, email) values ('${A}', 'madesio2309@gmail.com'), ('${B}', 'b@t.pl'), ('${C}', 'c@t.pl'), ('${D}', 'd@t.pl');
  insert into public.admins (user_id) values ('${A}');
  insert into public.players (id, name) values ('${A}', 'Admin'), ('${B}', 'Bartek'), ('${C}', 'Celina'), ('${D}', 'Darek');`);
async function as(uid, sql, params = []) {
  await db.exec(uid ? `reset role; set request.jwt.claim.sub = '${uid}'; set role authenticated;` : `reset role; set request.jwt.claim.sub = ''; set role anon;`);
  try { return { rows: (await db.query(sql, params)).rows }; } catch (e) { return { error: e.message }; } finally { await db.exec('reset role;'); }
}
const count = async (where = 'true') => (await db.query(`select count(*)::int as n from public.gifts where ${where}`)).rows[0].n;
const send = (uid, users, all, gold, cr, msg = null, reason = null) => as(uid, `select public.admin_send_gift($1::uuid[], $2, $3, $4, $5, $6) as r`, [users, all, gold, cr, msg, reason]);

// 1) tylko administrator
let r = await send(B, [C], false, 1000, 0);
assert(/NOT_ADMIN/.test(r.error || ''), 'gracz nie może wysłać prezentu (NOT_ADMIN)');
r = await as(null, `select public.admin_send_gift(array['${B}']::uuid[], false, 10, 0)`);
assert(!!r.error, 'gość (anon) nie ma dostępu do wysyłki');
r = await as(B, `insert into public.gifts (batch, user_id, gold) values (gen_random_uuid(), $1, 999999)`, [B]);
assert(!!r.error, `gracz nie może sam dopisać sobie prezentu (${(r.error || '').slice(0, 50)})`);
r = await as(B, `select public.admin_gift_history()`);
assert(/NOT_ADMIN/.test(r.error || ''), 'gracz nie widzi historii wysyłek');
r = await as(B, `select public.admin_cancel_gift(gen_random_uuid())`);
assert(/NOT_ADMIN/.test(r.error || ''), 'gracz nie może anulować wysyłki');

// 2) wysyłka i walidacja
r = await send(A, [B, C, B], false, 5000, 100, '  Nagroda za event Discord 12.12  ', 'Turniej #3');
const b1 = r.rows?.[0]?.r?.batch;
assert(!r.error && r.rows[0].r.count === 2 && (await count(`batch = '${b1}'`)) === 2, 'wysyłka do wybranych graczy (duplikaty odbiorców pominięte)');
const g1 = (await db.query(`select gold, crystals, message, reason from public.gifts where user_id = $1`, [B])).rows[0];
assert(Number(g1.gold) === 5000 && g1.crystals === 100 && g1.message === 'Nagroda za event Discord 12.12' && g1.reason === 'Turniej #3', 'kwoty, wiadomość (przycięta) i powód zapisane');
for (const [args, re, m] of [
  [[[B], false, 0, 0], /GIFT_EMPTY/, 'pusty prezent odrzucony'],
  [[[B], false, -5, 10], /GIFT_AMOUNT/, 'ujemne złoto odrzucone'],
  [[[B], false, 100000001, 0], /GIFT_AMOUNT/, 'ponad 100 mln złota odrzucone'],
  [[[B], false, 0, 10001], /GIFT_AMOUNT/, 'ponad 10 000 kryształów odrzucone'],
  [[[], false, 10, 0], /GIFT_NO_USERS/, 'brak odbiorców odrzucony'],
  [[[B, X], false, 10, 0], /GIFT_NO_USER/, 'nieistniejący odbiorca odrzuca całą wysyłkę'],
]) { r = await send(A, ...args); assert(re.test(r.error || ''), m); }
assert((await count()) === 2, 'odrzucone wysyłki nie zostawiły wpisów');
r = await send(A, null, true, 0, 50, 'Dla wszystkich');
const b2 = r.rows?.[0]?.r?.batch;
assert(!r.error && r.rows[0].r.count === 4, 'wysyłka do wszystkich graczy z profilem (4)');

// 3) odczyt (RLS) i odbiór
r = await as(B, `select user_id, gold, crystals from public.gifts`);
assert(!r.error && r.rows.length === 2 && r.rows.every((x) => x.user_id === B), 'gracz widzi tylko własne prezenty');
r = await as(A, `select * from public.gifts`);
assert(!r.error && r.rows.length === 6, 'administrator widzi wszystkie prezenty');
r = await as(null, `select * from public.gifts`);
assert(!!r.error, 'gość (anon) nie czyta prezentów');
r = await as(B, `update public.gifts set gold = 100000000 where user_id = $1`, [B]);
assert(!!r.error || (await db.query(`select max(gold)::bigint as m from public.gifts where user_id = $1`, [B])).rows[0].m < 100000000, 'gracz nie może zwiększyć kwoty prezentu');
// ochrona zapisów: zapis startowy z 100 kryształami
await as(B, `insert into public.saves (user_id, data) values ($1, '{"lvl": 10, "crystals": 100}')`, [B]);
await db.exec(`grant select, insert, update on public.saves to authenticated; create policy saves_own on public.saves for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid()); alter table public.saves enable row level security;`);
await as(B, `insert into public.saves (user_id, data) values ($1, '{"lvl": 10, "crystals": 100}') on conflict (user_id) do update set data = excluded.data`, [B]);
const guard0 = (await db.query(`select cr from public.player_guard where user_id = $1`, [B])).rows[0];
assert(guard0 && Number(guard0.cr) === 100, 'ochrona zapisów zna stan startowy gracza (100 💎)');
// próba „dopisania” 9000 kryształów bez prezentu – odrzucona
await as(B, `update public.saves set data = '{"lvl": 10, "crystals": 9100}' where user_id = $1`, [B]);
const s1 = (await db.query(`select (data->>'crystals')::int as c from public.saves where user_id = $1`, [B])).rows[0].c;
assert(s1 === 100, 'bez prezentu skok +9000 💎 odrzucony przez ochronę zapisów');
r = await as(B, `select id, gold, crystals from public.claim_gifts()`);
const sum = r.rows?.reduce((s, x) => s + x.crystals, 0);
assert(!r.error && r.rows.length === 2 && sum === 150 && r.rows.reduce((s, x) => s + Number(x.gold), 0) === 5000, 'odbiór: 2 prezenty (5000 zł, 150 💎)');
r = await as(B, `select * from public.claim_gifts()`);
assert(!r.error && r.rows.length === 0, 'drugi odbiór nic nie zwraca (prezent tylko raz)');
assert((await count(`user_id = '${C}' and claimed_at is null`)) === 2, 'odbiór jednego gracza nie rusza prezentów innych');
const guard1 = (await db.query(`select cr from public.player_guard where user_id = $1`, [B])).rows[0];
assert(Number(guard1.cr) === 250, 'po odbiorze zweryfikowany stan kryształów podniesiony o prezent (250)');
await as(B, `update public.saves set data = '{"lvl": 10, "crystals": 250}' where user_id = $1`, [B]);
const s2 = (await db.query(`select (data->>'crystals')::int as c from public.saves where user_id = $1`, [B])).rows[0].c;
assert(s2 === 250, 'zapis z odebranym prezentem przyjęty przez ochronę zapisów');
// duży prezent (10 000 💎 > limit 6000 przyrostu) też przechodzi
r = await send(A, [B], false, 0, 10000, 'Główna nagroda');
await as(B, `select * from public.claim_gifts()`);
await as(B, `update public.saves set data = '{"lvl": 10, "crystals": 10250}' where user_id = $1`, [B]);
const s3 = (await db.query(`select (data->>'crystals')::int as c from public.saves where user_id = $1`, [B])).rows[0].c;
assert(s3 === 10250, 'prezent 10 000 💎 (powyżej limitu przyrostu) przyjęty po odbiorze');
r = await as(null, `select * from public.claim_gifts()`);
assert(!!r.error, 'gość (anon) nie może odbierać prezentów');

// 4) historia i anulowanie
r = await as(A, `select * from public.admin_gift_history(10)`);
const h = r.rows || [];
const hb2 = h.find((x) => x.batch === b2), hb1 = h.find((x) => x.batch === b1);
assert(!r.error && h.length === 3 && h[0].message === 'Główna nagroda', 'historia: 3 wysyłki, najnowsza pierwsza');
assert(hb2.recipients === 4 && hb2.claimed === 1 && hb2.crystals === 50 && hb2.names.length === 4, 'historia: odbiorcy, odebrane i nazwy graczy');
assert(hb1.recipients === 2 && hb1.claimed === 1 && hb1.reason === 'Turniej #3', 'historia: powód wysyłki');
r = await as(A, `select public.admin_cancel_gift($1) as n`, [b2]);
assert(!r.error && r.rows[0].n === 3 && (await count(`batch = '${b2}'`)) === 1, 'anulowanie usuwa tylko nieodebrane prezenty (3), odebrany zostaje');
r = await as(C, `select * from public.claim_gifts()`);
assert(r.rows.length === 1 && r.rows[0].batch === b1, 'gracz nie odbierze anulowanego prezentu');

// 5) domyślne pełne uprawnienia Supabase – zapis i tak blokuje RLS
await db.exec(`grant all on public.gifts to anon, authenticated;`);
r = await as(B, `insert into public.gifts (batch, user_id, gold) values (gen_random_uuid(), $1, 5)`, [B]);
assert(/row-level security/.test(r.error || ''), 'RLS blokuje wpis prezentu mimo pełnych uprawnień tabeli');
r = await as(D, `update public.gifts set claimed_at = null`);
assert((await count(`user_id = '${B}' and claimed_at is null`)) === 0, 'RLS blokuje „odnowienie” odebranych prezentów');
const before = await count();
r = await as(B, `delete from public.gifts`);
assert(before > 0 && (await count()) === before, `RLS blokuje kasowanie prezentów przez gracza (również własnych, ${before})`);

// 6) usunięcie konta usuwa jego prezenty (RODO)
await db.exec(`delete from auth.users where id = '${D}'`);
assert((await count(`user_id = '${D}'`)) === 0, 'usunięcie konta usuwa jego prezenty');

await db.close();
console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystkie testy bazy prezentów OK');
