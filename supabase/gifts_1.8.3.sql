-- >>> PREZENTY 1.8.3 (złoto i kryształy od administratora, np. za eventy na Discordzie) – blok można uruchamiać wielokrotnie
-- Wysyłać, anulować i przeglądać historię może wyłącznie administrator (funkcje sprawdzają is_admin()).
-- Gracz widzi tylko własne prezenty i odbiera je funkcją claim_gifts(); bezpośredni zapis do tabeli jest zablokowany (brak polityk zapisu).
create table if not exists public.gifts (
  id bigint generated always as identity primary key,
  batch uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  gold bigint not null default 0 check (gold between 0 and 100000000),
  crystals int not null default 0 check (crystals between 0 and 10000),
  message text check (message is null or char_length(message) <= 200),
  reason text check (reason is null or char_length(reason) <= 120),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  check (gold > 0 or crystals > 0)
);
create index if not exists gifts_user_open on public.gifts (user_id) where claimed_at is null;
create index if not exists gifts_batch on public.gifts (batch);
alter table public.gifts enable row level security;
drop policy if exists gifts_read on public.gifts;
create policy gifts_read on public.gifts for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- wysyłka: wybrani gracze (p_users) albo wszyscy z profilem gry (p_all); ta sama kwota dla każdego odbiorcy
create or replace function public.admin_send_gift(p_users uuid[], p_all boolean, p_gold bigint, p_crystals int, p_message text default null, p_reason text default null)
returns json language plpgsql security definer set search_path = public, auth as $$
declare
  b uuid := gen_random_uuid();
  targets uuid[];
  n int;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if coalesce(p_gold, 0) < 0 or coalesce(p_gold, 0) > 100000000 or coalesce(p_crystals, 0) < 0 or coalesce(p_crystals, 0) > 10000 then raise exception 'GIFT_AMOUNT'; end if;
  if coalesce(p_gold, 0) = 0 and coalesce(p_crystals, 0) = 0 then raise exception 'GIFT_EMPTY'; end if;
  if coalesce(p_all, false) then
    select array_agg(p.id) into targets from public.players p;
  else
    select array_agg(distinct u) into targets from unnest(coalesce(p_users, '{}'::uuid[])) u where u is not null;
    if targets is not null and exists (select 1 from unnest(targets) u where not exists (select 1 from auth.users a where a.id = u)) then
      raise exception 'GIFT_NO_USER';
    end if;
  end if;
  if targets is null or cardinality(targets) = 0 then raise exception 'GIFT_NO_USERS'; end if;
  if cardinality(targets) > 5000 then raise exception 'GIFT_TOO_MANY'; end if;
  insert into public.gifts (batch, user_id, gold, crystals, message, reason)
    select b, u, coalesce(p_gold, 0), coalesce(p_crystals, 0),
      nullif(left(btrim(coalesce(p_message, '')), 200), ''), nullif(left(btrim(coalesce(p_reason, '')), 120), '')
    from unnest(targets) u;
  get diagnostics n = row_count;
  return json_build_object('batch', b, 'count', n);
end $$;

-- odbiór przez gracza: oznacza wszystkie jego nieodebrane prezenty (raz) i podnosi zweryfikowany stan kryształów
-- w ochronie zapisów, żeby zapis z prezentem nie został odrzucony jako oszustwo
create or replace function public.claim_gifts() returns setof public.gifts
language plpgsql security definer set search_path = public as $$
declare
  got public.gifts[];
  v_cr bigint;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  with c as (
    update public.gifts set claimed_at = now() where user_id = auth.uid() and claimed_at is null returning *
  ) select array_agg(c) into got from c;
  if got is null then return; end if;
  select coalesce(sum(x.crystals), 0) into v_cr from unnest(got) x;
  if v_cr > 0 then update public.player_guard g set cr = g.cr + v_cr where g.user_id = auth.uid(); end if;
  return query select * from unnest(got);
end $$;

-- anulowanie nieodebranych prezentów z danej wysyłki (odebrane zostają w historii)
create or replace function public.admin_cancel_gift(p_batch uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  delete from public.gifts where batch = p_batch and claimed_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- historia wysyłek (zbiorczo na wysyłkę): odbiorcy, odebrane, kilka nazw graczy
create or replace function public.admin_gift_history(p_limit int default 30)
returns table (batch uuid, created_at timestamptz, gold bigint, crystals int, message text, reason text, recipients int, claimed int, names text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  return query
    select g.batch, min(g.created_at), max(g.gold), max(g.crystals), max(g.message), max(g.reason),
      count(*)::int, count(g.claimed_at)::int,
      (array_agg(coalesce(p.name, left(g.user_id::text, 8)) order by p.name nulls last))[1:6]
    from public.gifts g left join public.players p on p.id = g.user_id
    group by g.batch
    order by min(g.created_at) desc
    limit least(greatest(coalesce(p_limit, 30), 1), 100);
end $$;

revoke all on function public.admin_send_gift(uuid[], boolean, bigint, int, text, text) from public, anon;
revoke all on function public.claim_gifts() from public, anon;
revoke all on function public.admin_cancel_gift(uuid) from public, anon;
revoke all on function public.admin_gift_history(int) from public, anon;
grant execute on function public.admin_send_gift(uuid[], boolean, bigint, int, text, text) to authenticated;
grant execute on function public.claim_gifts() to authenticated;
grant execute on function public.admin_cancel_gift(uuid) to authenticated;
grant execute on function public.admin_gift_history(int) to authenticated;
grant select on public.gifts to authenticated;
-- <<< PREZENTY 1.8.3
