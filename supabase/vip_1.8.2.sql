-- >>> VIP 1.8.2 (nadawany ręcznie przez administratora) – blok można uruchamiać wielokrotnie
-- Status VIP i dziennik nadań zmieniają wyłącznie funkcje administratora (brak polityk zapisu dla graczy).
create table if not exists public.vip (
  user_id uuid primary key references auth.users(id) on delete cascade,
  until timestamptz not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.vip_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('grant', 'revoke')),
  days int not null default 0 check (days between 0 and 366),
  bonus int not null default 0 check (bonus between 0 and 1000),
  until timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 120),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists vip_log_user on public.vip_log (user_id, created_at desc);
alter table public.vip enable row level security;
alter table public.vip_log enable row level security;
-- status VIP jest publiczny (korona przy nicku na czacie i w rankingach)
drop policy if exists vip_read on public.vip;
create policy vip_read on public.vip for select to authenticated using (true);
-- dziennik: gracz widzi własne wpisy (odbiór paczki kryształów), administrator – wszystkie
drop policy if exists vip_log_read on public.vip_log;
create policy vip_log_read on public.vip_log for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- nadanie / przedłużenie: od końca obecnego VIP-a (albo od teraz), maks. 366 dni na raz i 730 dni naprzód
create or replace function public.admin_grant_vip(p_user uuid, p_days int, p_reason text default null) returns timestamptz
language plpgsql security definer set search_path = public, auth as $$
declare
  cur timestamptz;
  nu timestamptz;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_days is null or p_days < 1 or p_days > 366 then raise exception 'VIP_DAYS'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'VIP_NO_USER'; end if;
  select until into cur from public.vip where user_id = p_user for update;
  nu := greatest(coalesce(cur, now()), now()) + make_interval(days => p_days);
  if nu > now() + interval '730 days' then raise exception 'VIP_TOO_LONG'; end if;
  insert into public.vip (user_id, until, updated_at) values (p_user, nu, now())
    on conflict (user_id) do update set until = excluded.until, updated_at = now();
  insert into public.vip_log (user_id, action, days, bonus, until, reason)
    values (p_user, 'grant', p_days, least(1000, p_days * 10), nu, nullif(left(btrim(coalesce(p_reason, '')), 120), ''));
  return nu;
end $$;

-- odebranie: VIP kończy się teraz (wpis zostaje w dzienniku)
create or replace function public.admin_revoke_vip(p_user uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  update public.vip set until = now(), updated_at = now() where user_id = p_user and until > now();
  if not found then raise exception 'VIP_NOT_ACTIVE'; end if;
  insert into public.vip_log (user_id, action, days, bonus, until, reason)
    values (p_user, 'revoke', 0, 0, now(), nullif(left(btrim(coalesce(p_reason, '')), 120), ''));
end $$;

revoke all on function public.admin_grant_vip(uuid, int, text) from public, anon;
revoke all on function public.admin_revoke_vip(uuid, text) from public, anon;
grant execute on function public.admin_grant_vip(uuid, int, text) to authenticated;
grant execute on function public.admin_revoke_vip(uuid, text) to authenticated;
grant select on public.vip, public.vip_log to authenticated;
-- <<< VIP 1.8.2
