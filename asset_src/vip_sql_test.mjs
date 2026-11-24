// Test migracji VIP (supabase/vip_1.8.2.sql) na prawdziwym Postgresie (PGlite) z atrapą schematu auth z Supabase:
// uprawnienia (tylko administrator), przedłużanie, limity, dziennik, RLS odczytu, odebranie, powtarzalność migracji.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

let fails = 0;
const assert = (c, m) => { if (c) console.log('ok  ', m); else { console.error('FAIL:', m); fails++; process.exitCode = 1; } };
const root = new URL('../supabase/', import.meta.url);
const vipSql = readFileSync(new URL('vip_1.8.2.sql', root), 'utf8');
const schema = readFileSync(new URL('schema.sql', root), 'utf8');
const block = (s) => { const a = s.indexOf('-- >>> VIP 1.8.2'), b = s.indexOf('-- <<< VIP 1.8.2'); return a >= 0 && b > a ? s.slice(a, b).replace(/\r\n/g, '\n') : null; };
assert(block(vipSql) && block(vipSql) === block(schema), 'blok VIP w schema.sql jest identyczny z plikiem migracji');
const adminsSql = schema.slice(schema.indexOf('-- ——— Administratorzy'), schema.indexOf('-- konto administratora gry'));
assert(/create or replace function public\.is_admin/.test(adminsSql), 'definicja is_admin() pobrana ze schema.sql');

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(adminsSql);
await db.exec(vipSql);
await db.exec(vipSql); // drugi raz – migracja musi być powtarzalna
assert(true, 'migracja uruchomiona dwukrotnie bez błędów');

const A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b', C = '00000000-0000-4000-8000-00000000000c', X = '00000000-0000-4000-8000-0000000000ff';
await db.exec(`insert into auth.users (id, email, email_confirmed_at) values ('${A}', 'madesio2309@gmail.com', now()), ('${B}', 'b@test.pl', now()), ('${C}', 'c@test.pl', now());
  insert into public.admins (user_id) values ('${A}');`);

// zapytanie jako dany użytkownik (rola authenticated + sub z JWT) albo anon
async function as(uid, sql, params = []) {
  await db.exec(uid ? `reset role; set request.jwt.claim.sub = '${uid}'; set role authenticated;` : `reset role; set request.jwt.claim.sub = ''; set role anon;`);
  try { return { rows: (await db.query(sql, params)).rows }; } catch (e) { return { error: e.message }; } finally { await db.exec('reset role;'); }
}
const days = (ms) => ms / 86400000;
const untilOf = async (u) => { const r = (await db.query(`select until from public.vip where user_id = $1`, [u])).rows[0]; return r ? new Date(r.until).getTime() : null; };

// 1) tylko administrator
let r = await as(B, `select public.admin_grant_vip($1, 30, 'hack')`, [C]);
assert(/NOT_ADMIN/.test(r.error || ''), 'gracz nie może nadać VIP-a (NOT_ADMIN)');
r = await as(B, `insert into public.vip (user_id, until) values ($1, now() + interval '30 days')`, [B]);
assert(!!r.error, `gracz nie może sam wpisać się do tabeli vip (${(r.error || '').slice(0, 60)})`);
r = await as(B, `select public.admin_revoke_vip($1)`, [C]);
assert(/NOT_ADMIN/.test(r.error || ''), 'gracz nie może odebrać VIP-a');
r = await as(null, `select public.admin_grant_vip($1, 30)`, [B]);
assert(!!r.error, 'gość (anon) nie ma dostępu do funkcji VIP');

// 2) nadanie i przedłużenie
const t0 = Date.now();
r = await as(A, `select public.admin_grant_vip($1, 30, 'Konkurs Discord') as until`, [B]);
const u1 = new Date(r.rows?.[0]?.until).getTime();
assert(!r.error && Math.abs(days(u1 - t0) - 30) < 0.01, 'administrator nadaje VIP na 30 dni');
r = await as(A, `select public.admin_grant_vip($1, 10) as until`, [B]);
const u2 = new Date(r.rows?.[0]?.until).getTime();
assert(!r.error && Math.abs(days(u2 - u1) - 10) < 0.001 && (await untilOf(B)) === u2, 'przedłużenie liczy się od końca obecnego VIP-a (+10 dni)');
for (const [d, re, m] of [[0, /VIP_DAYS/, '0 dni odrzucone'], [367, /VIP_DAYS/, '367 dni odrzucone'], [null, /VIP_DAYS/, 'brak liczby dni odrzucony']]) {
  r = await as(A, `select public.admin_grant_vip($1, $2)`, [C, d]);
  assert(re.test(r.error || ''), m);
}
r = await as(A, `select public.admin_grant_vip($1, 5)`, [X]);
assert(/VIP_NO_USER/.test(r.error || ''), 'nieistniejący gracz odrzucony');
r = await as(A, `select public.admin_grant_vip($1, 366)`, [C]);
assert(!r.error, 'nadanie 366 dni dozwolone');
r = await as(A, `select public.admin_grant_vip($1, 366)`, [C]);
assert(/VIP_TOO_LONG/.test(r.error || ''), 'łącznie ponad 730 dni naprzód odrzucone');

// 3) dziennik i paczka kryształów
const log = (await db.query(`select action, days, bonus, reason from public.vip_log where user_id = $1 order by id`, [B])).rows;
assert(log.length === 2 && log[0].bonus === 300 && log[1].bonus === 100 && log[0].reason === 'Konkurs Discord' && log[1].reason === null, 'dziennik: 2 nadania, bonus 10 💎/dzień, powód zapisany');
const long = await as(A, `select public.admin_grant_vip($1, 1, $2)`, [B, 'x'.repeat(300)]);
const lr = (await db.query(`select char_length(reason) as n from public.vip_log where user_id = $1 order by id desc limit 1`, [B])).rows[0];
assert(!long.error && lr.n === 120, 'zbyt długi powód przycięty do 120 znaków');

// 4) odczyt (RLS)
r = await as(C, `select user_id, until from public.vip order by user_id`);
assert(!r.error && r.rows.length === 2, 'status VIP innych graczy jest widoczny (korona przy nicku)');
r = await as(C, `select * from public.vip_log`);
assert(!r.error && r.rows.length === 1 && r.rows[0].user_id === C, 'gracz widzi tylko własny dziennik VIP');
r = await as(B, `select * from public.vip_log`);
assert(!r.error && r.rows.every((x) => x.user_id === B) && r.rows.length === 3, 'drugi gracz też tylko swój dziennik');
r = await as(A, `select * from public.vip_log`);
assert(!r.error && r.rows.length === 4, 'administrator widzi cały dziennik');
r = await as(null, `select * from public.vip`);
assert(!!r.error, 'gość (anon) nie czyta tabeli vip');
r = await as(B, `update public.vip set until = now() + interval '999 days' where user_id = $1`, [B]);
assert(!!r.error || (await untilOf(B)) < Date.now() + 100 * 86400000, 'gracz nie może wydłużyć sobie VIP-a');

// 5) odebranie
r = await as(A, `select public.admin_revoke_vip($1, 'Naruszenie regulaminu')`, [B]);
assert(!r.error && (await untilOf(B)) <= Date.now(), 'odebranie kończy VIP teraz');
r = await as(A, `select public.admin_revoke_vip($1)`, [B]);
assert(/VIP_NOT_ACTIVE/.test(r.error || ''), 'ponowne odebranie nieaktywnego VIP-a zgłasza błąd');
const rv = (await db.query(`select action, bonus from public.vip_log where user_id = $1 order by id desc limit 1`, [B])).rows[0];
assert(rv.action === 'revoke' && rv.bonus === 0, 'odebranie zapisane w dzienniku (bez kryształów)');
r = await as(A, `select public.admin_grant_vip($1, 7) as until`, [B]);
const u3 = new Date(r.rows?.[0]?.until).getTime();
assert(!r.error && Math.abs(days(u3 - Date.now()) - 7) < 0.01, 'po odebraniu nowe nadanie liczy się od teraz');

// 6) domyślne uprawnienia Supabase (pełne prawa do tabel) – zapis i tak blokuje RLS (brak polityk zapisu)
await db.exec(`grant all on public.vip, public.vip_log to anon, authenticated;`);
const before = await untilOf(B);
r = await as(B, `insert into public.vip (user_id, until) values ($1, now() + interval '99 days') on conflict (user_id) do update set until = excluded.until`, [C]);
assert(!!r.error, `RLS blokuje wpis do vip mimo pełnych uprawnień (${(r.error || '').slice(0, 50)})`);
r = await as(B, `update public.vip set until = now() + interval '999 days' where user_id = $1`, [B]);
assert((await untilOf(B)) === before, 'RLS blokuje przedłużenie własnego VIP-a');
r = await as(B, `insert into public.vip_log (user_id, action, days, bonus, until) values ($1, 'grant', 30, 1000, now())`, [B]);
assert(!!r.error, 'RLS blokuje dopisanie fałszywego wpisu z kryształami do dziennika');
r = await as(B, `delete from public.vip_log where user_id = $1`, [B]);
assert((await db.query(`select count(*)::int as n from public.vip_log where user_id = $1`, [B])).rows[0].n >= 4, 'RLS blokuje kasowanie dziennika');
r = await as(null, `select * from public.vip`);
assert(!r.error && r.rows.length === 0, 'gość (anon) nadal nie widzi statusów VIP');

// 7) usunięcie konta gracza czyści VIP (RODO)
await db.exec(`delete from auth.users where id = '${C}'`);
assert((await db.query(`select count(*)::int as n from public.vip where user_id = $1`, [C])).rows[0].n === 0 && (await db.query(`select count(*)::int as n from public.vip_log where user_id = $1`, [C])).rows[0].n === 0, 'usunięcie konta usuwa VIP i jego dziennik');

await db.close();
console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystkie testy bazy VIP OK');
