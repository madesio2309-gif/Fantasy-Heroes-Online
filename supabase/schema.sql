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
