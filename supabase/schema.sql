-- Fantasy Heroes Online – schemat bazy Supabase
-- Uruchom w: Supabase Dashboard → SQL Editor → New query → wklej całość → Run.
-- Konta graczy: Authentication → Sign In / Providers → Email → ON (rejestracja e-mail + hasło).
-- Opcjonalnie (gra bez konta w trybie online): Authentication → Sign In / Providers → Anonymous sign-ins → ON.
-- Skrypt można uruchamiać wielokrotnie – aktualizuje istniejącą bazę.

-- ——— Zapisy postaci kont graczy (pełny stan gry, prywatny dla właściciela) ———
create table if not exists public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  data jsonb not null check (pg_column_size(data) < 600000),
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;
drop policy if exists saves_read on public.saves;
create policy saves_read on public.saves for select to authenticated using (user_id = auth.uid());
drop policy if exists saves_insert on public.saves;
create policy saves_insert on public.saves for insert to authenticated with check (user_id = auth.uid());
drop policy if exists saves_update on public.saves;
create policy saves_update on public.saves for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists saves_delete on public.saves;
create policy saves_delete on public.saves for delete to authenticated using (user_id = auth.uid());

-- ——— Gildie ———
create table if not exists public.guilds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 3 and 28),
  owner uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

-- ——— Profile graczy (publiczny „snapshot” postaci do rankingów i areny) ———
create table if not exists public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 18),
  cls text not null check (cls in ('warrior', 'mage', 'archer', 'assassin', 'paladin')),
  look smallint not null default 0 check (look between 0 and 1),
  hue smallint not null default 0 check (hue between 0 and 7),
  skin text not null default 'default' check (char_length(skin) <= 24),
  lvl int not null default 1 check (lvl between 1 and 150),
  power int not null default 0 check (power >= 0),
  rating int not null default 1000 check (rating between 0 and 10000),
  guild_id uuid references public.guilds(id) on delete set null,
  fighter jsonb not null default '{}'::jsonb check (pg_column_size(fighter) < 4096),
  updated_at timestamptz not null default now()
);
-- aktualizacja istniejącej bazy: Przebudzenia podnoszą limit poziomu do 150
alter table public.players drop constraint if exists players_lvl_check;
alter table public.players add constraint players_lvl_check check (lvl between 1 and 150);
create index if not exists players_power_idx on public.players (power desc);
create index if not exists players_lvl_idx on public.players (lvl desc);
create index if not exists players_rating_idx on public.players (rating desc);
create index if not exists players_guild_idx on public.players (guild_id);

-- limit 30 członków gildii
create or replace function public.fho_guild_cap() returns trigger language plpgsql as $$
begin
  if new.guild_id is not null and (tg_op = 'INSERT' or new.guild_id is distinct from old.guild_id) then
    perform pg_advisory_xact_lock(hashtext(new.guild_id::text));
    if (select count(*) from public.players where guild_id = new.guild_id and id <> new.id) >= 30 then
      raise exception 'GUILD_FULL';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists fho_guild_cap on public.players;
create trigger fho_guild_cap before insert or update on public.players
  for each row execute function public.fho_guild_cap();

-- ——— Czat (globalny + gildyjny) ———
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  channel text not null check (channel = 'global' or channel ~ '^guild:[0-9a-f-]{36}$'),
  author uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 18),
  cls text not null,
  body text not null check (char_length(body) between 1 and 140),
  created_at timestamptz not null default now()
);
create index if not exists chat_channel_idx on public.chat_messages (channel, created_at desc);

-- ochrona przed spamem: maks. 1 wiadomość na 2 sekundy
create or replace function public.fho_chat_rate() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.chat_messages
             where author = new.author and created_at > now() - interval '2 seconds') then
    raise exception 'CHAT_RATE_LIMIT';
  end if;
  return new;
end $$;
drop trigger if exists fho_chat_rate on public.chat_messages;
create trigger fho_chat_rate before insert on public.chat_messages
  for each row execute function public.fho_chat_rate();

-- ——— Obrażenia zadane bossom (światowy i gildyjny), sumowane tygodniowo ———
create table if not exists public.boss_damage (
  player_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('world', 'guild')),
  scope text not null check (char_length(scope) <= 64),
  week int not null,
  dmg bigint not null default 0 check (dmg >= 0),
  updated_at timestamptz not null default now(),
  primary key (player_id, kind, scope, week)
);
create or replace view public.boss_totals with (security_invoker = true) as
  select kind, scope, week, sum(dmg)::bigint as total, count(*)::int as players
  from public.boss_damage group by kind, scope, week;

-- ——— Row Level Security ———
alter table public.players enable row level security;
alter table public.guilds enable row level security;
alter table public.chat_messages enable row level security;
alter table public.boss_damage enable row level security;

drop policy if exists players_read on public.players;
create policy players_read on public.players for select to authenticated using (true);
drop policy if exists players_insert on public.players;
create policy players_insert on public.players for insert to authenticated with check (id = auth.uid());
drop policy if exists players_update on public.players;
create policy players_update on public.players for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists guilds_read on public.guilds;
create policy guilds_read on public.guilds for select to authenticated using (true);
drop policy if exists guilds_insert on public.guilds;
create policy guilds_insert on public.guilds for insert to authenticated with check (owner = auth.uid());

-- czat gildii widzą i piszą tylko jej członkowie
drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages for select to authenticated using (
  channel = 'global' or exists (
    select 1 from public.players p where p.id = auth.uid() and channel = 'guild:' || p.guild_id::text));
drop policy if exists chat_insert on public.chat_messages;
create policy chat_insert on public.chat_messages for insert to authenticated with check (
  author = auth.uid() and (channel = 'global' or exists (
    select 1 from public.players p where p.id = auth.uid() and channel = 'guild:' || p.guild_id::text)));

drop policy if exists boss_read on public.boss_damage;
create policy boss_read on public.boss_damage for select to authenticated using (true);
drop policy if exists boss_insert on public.boss_damage;
create policy boss_insert on public.boss_damage for insert to authenticated with check (player_id = auth.uid());
drop policy if exists boss_update on public.boss_damage;
create policy boss_update on public.boss_damage for update to authenticated using (player_id = auth.uid()) with check (player_id = auth.uid());

grant select on public.boss_totals to authenticated;

-- ——— Uprawnienia do tabel dla zalogowanych graczy ———
-- Nowe projekty Supabase nie nadają ich automatycznie tabelom tworzonym w SQL. RLS (powyżej) nadal decyduje,
-- których wierszy dotyczy operacja – gracz zmienia wyłącznie własne dane.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.saves to authenticated;
grant select, insert, update on public.players to authenticated;
grant select, insert on public.guilds to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant select, insert, update on public.boss_damage to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ——— Realtime dla czatu ———
do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null; end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Aktualizacja 1.8 – poziomy bez limitu, Otchłań, podgląd ekwipunku, administrator,
-- eventy, ogłoszenia, moderacja czatu, ochrona przed oszustwami, usuwanie konta.
-- Wszystkie zmiany są addytywne – istniejące konta i postacie zostają.
-- ═══════════════════════════════════════════════════════════════════════════

-- ——— Filtr wulgaryzmów (ta sama lista rdzeni co src/data/moderation.js) ———
create or replace function public.fho_clean_text(t text) returns text language plpgsql immutable as $$
declare
  roots text[] := array['kurw','kurew','chuj','huj','pierdol','pierdal','jeba','jebi','jebn','jebe','jebc','zajeb','wyjeb','pizd','skurw',
    'cipa','cipy','cipe','fiut','kutas','dziwk','szmat','cwel','ciota','spierd','wypierd','zjeb','debil',
    'fuck','shit','bitch','cunt','nigg','fagg','whore','dick','asshole'];
  w text; n text; r text; res text := t;
begin
  if t is null then return null; end if;
  for w in select distinct m[1] from regexp_matches(t, '([[:alnum:]@$!ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)', 'g') as m loop
    n := translate(lower(w), '013457@$!ąęóśłżźćń', 'oieastasiaeoslzzcn');
    n := regexp_replace(n, '[^a-z]', '', 'g');
    foreach r in array roots loop
      if position(r in n) > 0 then
        res := replace(res, w, left(w, 1) || repeat('*', greatest(2, char_length(w) - 1)));
        exit;
      end if;
    end loop;
  end loop;
  return res;
end $$;

-- ——— Administratorzy (uprawnienia wyłącznie przez is_admin()) ———
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
-- konto administratora gry (musi już istnieć i mieć potwierdzony e-mail)
insert into public.admins (user_id)
  select id from auth.users where lower(email) = 'madesio2309@gmail.com' and email_confirmed_at is not null
  on conflict do nothing;

-- ——— Profile: poziomy bez limitu, ekwipunek do podglądu, pet, Otchłań ———
alter table public.players drop constraint if exists players_lvl_check;
alter table public.players add constraint players_lvl_check check (lvl between 1 and 100000);
alter table public.players add column if not exists equip jsonb not null default '{}'::jsonb;
alter table public.players add column if not exists pet jsonb;
alter table public.players add column if not exists abyss int not null default 0;
alter table public.players drop constraint if exists players_equip_size;
alter table public.players add constraint players_equip_size check (pg_column_size(equip) < 12000);
alter table public.players drop constraint if exists players_pet_size;
alter table public.players add constraint players_pet_size check (pet is null or pg_column_size(pet) < 512);
alter table public.players drop constraint if exists players_abyss_check;
alter table public.players add constraint players_abyss_check check (abyss between 0 and 2000);
create index if not exists players_abyss_idx on public.players (abyss desc);

-- ——— Ochrona przed oszustwami ———
-- Zweryfikowany stan każdego konta + „wiadra” dozwolonych przyrostów odnawiające się z czasem.
-- Gracze nie mają do tej tabeli żadnego dostępu (tylko administrator przez RLS i wyzwalacze security definer).
create table if not exists public.player_guard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lvl int not null default 1,
  cr bigint not null default 0,
  abyss int not null default 0,
  b_lvl real not null default 40,
  b_cr real not null default 6000,
  b_abyss real not null default 60,
  at timestamptz not null default now(),
  strikes int not null default 0,
  last_reject text,
  flagged boolean not null default false
);
alter table public.player_guard enable row level security;
drop policy if exists guard_admin_read on public.player_guard;
create policy guard_admin_read on public.player_guard for select to authenticated using (public.is_admin());
drop policy if exists guard_admin_update on public.player_guard;
create policy guard_admin_update on public.player_guard for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- limity: poziom +40 (odnawia się 1 / 90 s), kryształy +6000 (1,5 / s), Otchłań +60 pięter (1 / 40 s)
create or replace function public.fho_saves_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare
  g public.player_guard;
  nl int; ncr bigint; nab int; dt double precision; reason text := null;
  bl double precision; bc double precision; ba double precision;
begin
  begin
    nl := coalesce((new.data->>'lvl')::numeric, 1)::int;
    ncr := coalesce((new.data->>'crystals')::numeric, 0)::bigint;
    nab := coalesce((new.data #>> '{abyss,floor}')::numeric, 0)::int;
  exception when others then
    reason := 'nieprawidłowy format zapisu'; nl := 1; ncr := 0; nab := 0;
  end;
  if reason is null and (nl < 1 or nl > 100000 or ncr < 0 or ncr > 1000000000 or nab < 0 or nab > 2000) then reason := 'wartości poza zakresem'; end if;
  select * into g from public.player_guard where user_id = new.user_id for update;
  if not found then
    -- pierwszy zapis konta (np. przeniesiona postać lokalna) – zaufany punkt startowy
    if reason is null then
      insert into public.player_guard (user_id, lvl, cr, abyss) values (new.user_id, nl, ncr, nab);
      return new;
    end if;
    insert into public.player_guard (user_id, strikes, last_reject, flagged) values (new.user_id, 1, reason, true);
    if tg_op = 'UPDATE' then new.data := old.data; new.updated_at := old.updated_at; return new; end if;
    return null;
  end if;
  dt := greatest(0, extract(epoch from (now() - g.at)));
  bl := least(40, g.b_lvl + dt / 90.0);
  bc := least(6000, g.b_cr + dt * 1.5);
  ba := least(60, g.b_abyss + dt / 40.0);
  if reason is null and nl - g.lvl > bl then reason := format('poziom +%s (limit %s)', nl - g.lvl, floor(bl)); end if;
  if reason is null and ncr - g.cr > bc then reason := format('kryształy +%s (limit %s)', ncr - g.cr, floor(bc)); end if;
  if reason is null and nab - g.abyss > ba then reason := format('Otchłań +%s pięter (limit %s)', nab - g.abyss, floor(ba)); end if;
  if reason is not null then
    update public.player_guard set strikes = strikes + 1, last_reject = left(reason, 200), flagged = (strikes + 1 >= 3),
      at = now(), b_lvl = bl, b_cr = bc, b_abyss = ba where user_id = new.user_id;
    -- zapis odrzucony: serwer zachowuje poprzednią wersję postaci
    if tg_op = 'UPDATE' then new.data := old.data; new.updated_at := old.updated_at; return new; end if;
    return null;
  end if;
  update public.player_guard set lvl = nl, cr = ncr, abyss = nab, at = now(),
    b_lvl = bl - greatest(0, nl - g.lvl), b_cr = bc - greatest(0, ncr - g.cr), b_abyss = ba - greatest(0, nab - g.abyss)
    where user_id = new.user_id;
  return new;
end $$;
drop trigger if exists fho_saves_guard on public.saves;
create trigger fho_saves_guard before insert or update on public.saves for each row execute function public.fho_saves_guard();

-- limit siły na poziomie (≈3× realnego maksimum; ta sama formuła co maxPowerFor w src/core/formulas.js)
create or replace function public.fho_max_power(l int) returns bigint language sql immutable as $$
  select (18000 + 7200 * greatest(1, l))::bigint;
$$;
-- profil areny/rankingów nie może wyprzedzać zweryfikowanego zapisu; nazwa bez wulgaryzmów
create or replace function public.fho_players_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare g public.player_guard;
begin
  select * into g from public.player_guard where user_id = new.id;
  if found then
    if new.lvl > g.lvl + 2 then new.lvl := greatest(1, g.lvl); end if;
    if new.abyss > g.abyss + 2 then new.abyss := g.abyss; end if;
  else
    if new.lvl > 20 then new.lvl := 20; end if;
    if new.abyss > 0 then new.abyss := 0; end if;
  end if;
  if new.power > public.fho_max_power(new.lvl) then new.power := public.fho_max_power(new.lvl); end if;
  new.name := public.fho_clean_text(new.name);
  return new;
end $$;
drop trigger if exists fho_players_guard on public.players;
create trigger fho_players_guard before insert or update on public.players for each row execute function public.fho_players_guard();

-- punkt startowy ochrony dla istniejących kont (z ich obecnych zapisów)
insert into public.player_guard (user_id, lvl, cr, abyss)
  select user_id, greatest(1, coalesce((data->>'lvl')::numeric, 1)::int), greatest(0, coalesce((data->>'crystals')::numeric, 0)::bigint),
         least(2000, greatest(0, coalesce((data #>> '{abyss,floor}')::numeric, 0)::int))
  from public.saves on conflict (user_id) do nothing;

-- nazwy gildii bez wulgaryzmów
create or replace function public.fho_guild_clean() returns trigger language plpgsql as $$
begin new.name := public.fho_clean_text(new.name); return new; end $$;
drop trigger if exists fho_guild_clean on public.guilds;
create trigger fho_guild_clean before insert or update on public.guilds for each row execute function public.fho_guild_clean();

-- ——— Moderacja czatu ———
create table if not exists public.chat_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  until timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 200),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.chat_bans enable row level security;
drop policy if exists bans_read on public.chat_bans;
create policy bans_read on public.chat_bans for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists bans_admin on public.chat_bans;
create policy bans_admin on public.chat_bans for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.chat_reports (
  id bigint generated always as identity primary key,
  message_id bigint references public.chat_messages(id) on delete set null,
  reporter uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author uuid,
  author_name text,
  body text,
  reason text check (reason is null or char_length(reason) <= 200),
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (message_id, reporter)
);
alter table public.chat_reports enable row level security;
drop policy if exists reports_insert on public.chat_reports;
create policy reports_insert on public.chat_reports for insert to authenticated with check (reporter = auth.uid());
drop policy if exists reports_admin on public.chat_reports;
create policy reports_admin on public.chat_reports for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- treść zgłoszonej wiadomości kopiowana z serwera (zgłaszający nie może jej podmienić)
create or replace function public.fho_report_fill() returns trigger language plpgsql security definer set search_path = public as $$
begin
  select author, name, body into new.author, new.author_name, new.body from public.chat_messages where id = new.message_id;
  if new.author is null then raise exception 'MESSAGE_NOT_FOUND'; end if;
  new.reporter := auth.uid();
  new.status := 'open';
  return new;
end $$;
drop trigger if exists fho_report_fill on public.chat_reports;
create trigger fho_report_fill before insert on public.chat_reports for each row execute function public.fho_report_fill();

-- czat: filtr wulgaryzmów na serwerze, zablokowani gracze nie piszą, administrator usuwa wiadomości
create or replace function public.fho_chat_clean() returns trigger language plpgsql as $$
begin new.body := public.fho_clean_text(new.body); new.name := public.fho_clean_text(new.name); return new; end $$;
drop trigger if exists fho_chat_clean on public.chat_messages;
create trigger fho_chat_clean before insert on public.chat_messages for each row execute function public.fho_chat_clean();
drop policy if exists chat_insert on public.chat_messages;
create policy chat_insert on public.chat_messages for insert to authenticated with check (
  author = auth.uid()
  and not exists (select 1 from public.chat_bans b where b.user_id = auth.uid() and b.until > now())
  and (channel = 'global' or exists (
    select 1 from public.players p where p.id = auth.uid() and channel = 'guild:' || p.guild_id::text)));
drop policy if exists chat_admin_delete on public.chat_messages;
create policy chat_admin_delete on public.chat_messages for delete to authenticated using (public.is_admin());

-- ——— Eventy administratora ———
create table if not exists public.live_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('xp2', 'gold2', 'wheel')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at - interval '1 minute' and ends_at <= starts_at + interval '7 days')
);
alter table public.live_events enable row level security;
drop policy if exists live_read on public.live_events;
create policy live_read on public.live_events for select to anon, authenticated using (true);
drop policy if exists live_admin on public.live_events;
create policy live_admin on public.live_events for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ——— Ogłoszenia ———
create table if not exists public.announcements (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 3 and 80),
  body text not null check (char_length(body) between 1 and 1000),
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists news_read on public.announcements;
create policy news_read on public.announcements for select to anon, authenticated using (active or public.is_admin());
drop policy if exists news_admin on public.announcements;
create policy news_admin on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ——— Statystyki dla panelu administratora ———
create or replace function public.admin_stats() returns json language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  return json_build_object(
    'users', (select count(*) from auth.users),
    'players', (select count(*) from public.players),
    'active24h', (select count(*) from public.players where updated_at > now() - interval '24 hours'),
    'active7d', (select count(*) from public.players where updated_at > now() - interval '7 days'),
    'messages24h', (select count(*) from public.chat_messages where created_at > now() - interval '24 hours'),
    'openReports', (select count(*) from public.chat_reports where status = 'open'),
    'flagged', (select count(*) from public.player_guard where flagged),
    'bans', (select count(*) from public.chat_bans where until > now()),
    'maxLvl', (select coalesce(max(lvl), 0) from public.players),
    'maxAbyss', (select coalesce(max(abyss), 0) from public.players)
  );
end $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- ——— Usunięcie własnego konta (RODO) – dane gry kasują się kaskadowo ———
create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ——— Uprawnienia do nowych tabel ———
grant usage on schema public to anon;
grant select on public.live_events, public.announcements to anon;
grant select, insert, update, delete on public.live_events, public.announcements to authenticated;
grant select, insert, update, delete on public.chat_reports, public.chat_bans to authenticated;
grant select, update on public.player_guard to authenticated;
grant delete on public.chat_messages to authenticated;
grant usage, select on all sequences in schema public to authenticated;
